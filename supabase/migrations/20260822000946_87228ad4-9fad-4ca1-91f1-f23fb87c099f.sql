REVOKE EXECUTE ON FUNCTION public.notify_on_like() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_subscribe() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_video() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;