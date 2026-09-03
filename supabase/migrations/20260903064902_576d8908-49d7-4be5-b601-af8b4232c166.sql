CREATE OR REPLACE FUNCTION public.notify_on_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, metadata)
  VALUES (NEW.recipient_id, NEW.requester_id, 'friend_request', jsonb_build_object('request_id', NEW.id));
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.notify_on_friend_request() FROM anon, authenticated;

DROP TRIGGER IF EXISTS notify_friend_request ON public.friend_requests;
CREATE TRIGGER notify_friend_request AFTER INSERT ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_friend_request();

CREATE OR REPLACE FUNCTION public.notify_on_friend_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'accepted' AND coalesce(OLD.status, '') <> 'accepted' THEN
    INSERT INTO public.notifications (user_id, actor_id, type, metadata)
    VALUES (NEW.requester_id, NEW.recipient_id, 'friend_request', jsonb_build_object('accepted', true));
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.notify_on_friend_accept() FROM anon, authenticated;

DROP TRIGGER IF EXISTS notify_friend_accept ON public.friend_requests;
CREATE TRIGGER notify_friend_accept AFTER UPDATE ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_friend_accept();

DROP TRIGGER IF EXISTS update_friend_requests_updated_at ON public.friend_requests;
CREATE TRIGGER update_friend_requests_updated_at BEFORE UPDATE ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();