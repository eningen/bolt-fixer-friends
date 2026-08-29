CREATE OR REPLACE FUNCTION public.create_friend_request_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, actor_id, type, metadata)
  VALUES (NEW.recipient_id, NEW.requester_id, 'friend_request', jsonb_build_object('request_id', NEW.id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS friend_request_notification_trigger ON public.friend_requests;
CREATE TRIGGER friend_request_notification_trigger AFTER INSERT ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.create_friend_request_notification();

CREATE OR REPLACE FUNCTION public.create_friend_accepted_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    UPDATE public.notifications SET read = true, metadata = metadata || jsonb_build_object('accepted', true)
    WHERE user_id = NEW.recipient_id AND type = 'friend_request' AND metadata->>'request_id' = NEW.id::text;
    INSERT INTO public.notifications(user_id, actor_id, type, metadata)
    VALUES (NEW.requester_id, NEW.recipient_id, 'friend_request', jsonb_build_object('request_id', NEW.id, 'accepted', true));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS friend_request_accepted_notification_trigger ON public.friend_requests;
CREATE TRIGGER friend_request_accepted_notification_trigger AFTER UPDATE OF status ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.create_friend_accepted_notification();

NOTIFY pgrst, 'reload schema';
