create or replace function public.send_direct_message_v3(p_body text, p_recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_message_id uuid;
begin
  if v_sender_id is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  if p_recipient_id is null or p_recipient_id = v_sender_id then
    raise exception '送信先が正しくありません' using errcode = '22023';
  end if;

  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'メッセージを入力してください' using errcode = '22023';
  end if;

  if length(btrim(p_body)) > 2000 then
    raise exception 'メッセージは2000文字以内です' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception '送信先ユーザーが見つかりません' using errcode = '22023';
  end if;

  if not (
    exists (
      select 1 from public.friendships f
      where f.user_a = least(v_sender_id, p_recipient_id)
        and f.user_b = greatest(v_sender_id, p_recipient_id)
    )
    or exists (
      select 1 from public.direct_messages dm
      where (dm.sender_id = v_sender_id and dm.recipient_id = p_recipient_id)
         or (dm.sender_id = p_recipient_id and dm.recipient_id = v_sender_id)
    )
  ) then
    raise exception 'DMはフレンド同士、または既存のDM相手のみ利用できます' using errcode = '42501';
  end if;

  insert into public.direct_messages (sender_id, recipient_id, body)
  values (v_sender_id, p_recipient_id, btrim(p_body))
  returning id into v_message_id;

  return v_message_id;
end;
$$;

grant execute on function public.send_direct_message_v3(text, uuid) to authenticated;

notify pgrst, 'reload schema';
