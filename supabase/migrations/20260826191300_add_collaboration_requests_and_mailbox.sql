create table if not exists public.mailbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid null references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  category text not null default 'normal' check (category in ('normal','important')),
  read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mailbox_messages_user_created_idx on public.mailbox_messages(user_id, created_at desc);

alter table public.mailbox_messages enable row level security;

drop policy if exists "Users can read their mailbox" on public.mailbox_messages;
create policy "Users can read their mailbox" on public.mailbox_messages
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can mark their mailbox read" on public.mailbox_messages;
create policy "Users can mark their mailbox read" on public.mailbox_messages
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  constraint collaboration_requests_not_self check (requester_id <> recipient_id),
  constraint collaboration_requests_content_length check (char_length(trim(content)) between 1 and 1000),
  constraint collaboration_requests_reason_length check (char_length(trim(reason)) between 1 and 1000)
);

create index if not exists collaboration_requests_recipient_created_idx on public.collaboration_requests(recipient_id, created_at desc);
create index if not exists collaboration_requests_requester_created_idx on public.collaboration_requests(requester_id, created_at desc);

alter table public.collaboration_requests enable row level security;

drop policy if exists "Users can read collaboration requests they are part of" on public.collaboration_requests;
create policy "Users can read collaboration requests they are part of" on public.collaboration_requests
  for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "Recipients can update collaboration request status" on public.collaboration_requests;
create policy "Recipients can update collaboration request status" on public.collaboration_requests
  for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create or replace function public.send_collaboration_request(
  p_recipient_id uuid,
  p_content text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid := auth.uid();
  v_request_id uuid;
  v_sender_name text;
begin
  if v_requester_id is null then
    raise exception 'ログインが必要です';
  end if;
  if p_recipient_id is null or p_recipient_id = v_requester_id then
    raise exception '自分自身にはコラボ依頼を送れません';
  end if;
  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception '送信先のチャンネルが見つかりません';
  end if;
  if char_length(trim(coalesce(p_content, ''))) < 1 or char_length(trim(p_content)) > 1000 then
    raise exception 'コラボ内容は1〜1000文字で入力してください';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 1 or char_length(trim(p_reason)) > 1000 then
    raise exception 'コラボしたい理由は1〜1000文字で入力してください';
  end if;

  select display_name into v_sender_name from public.profiles where id = v_requester_id;

  insert into public.collaboration_requests (requester_id, recipient_id, content, reason)
  values (v_requester_id, p_recipient_id, trim(p_content), trim(p_reason))
  returning id into v_request_id;

  insert into public.mailbox_messages (user_id, sender_id, title, body, category, metadata)
  values (
    p_recipient_id,
    v_requester_id,
    '🤝 コラボ依頼が届きました',
    coalesce(v_sender_name, 'ユーザー') || ' さんからコラボ依頼が届いています。\n\n【コラボ内容】\n' || trim(p_content) || '\n\n【コラボしたい理由】\n' || trim(p_reason),
    'important',
    jsonb_build_object('type','collaboration_request','request_id',v_request_id,'requester_id',v_requester_id)
  );

  return v_request_id;
end;
$$;

grant execute on function public.send_collaboration_request(uuid, text, text) to authenticated;
