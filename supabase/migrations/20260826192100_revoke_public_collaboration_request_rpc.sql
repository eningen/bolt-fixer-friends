revoke execute on function public.send_collaboration_request(uuid, text, text) from public;
grant execute on function public.send_collaboration_request(uuid, text, text) to authenticated;
