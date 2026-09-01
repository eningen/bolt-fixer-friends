
REVOKE ALL ON FUNCTION public.publish_announcement(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.publish_announcement(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
