revoke execute on function public.send_collaboration_request(uuid, text, text) from anon;
grant execute on function public.send_collaboration_request(uuid, text, text) to authenticated;
