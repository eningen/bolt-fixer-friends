REVOKE EXECUTE ON FUNCTION public.notify_on_like() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_subscribe() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_video() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_video_views(uuid) TO anon, authenticated;