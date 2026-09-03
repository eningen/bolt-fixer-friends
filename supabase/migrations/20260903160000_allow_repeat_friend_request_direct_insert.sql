-- Allow the existing client-side friend request INSERT flow to resend requests.
-- This is a safety net for clients that still insert directly into friend_requests.
-- The old pending request is removed before the new row is inserted, so the
-- friend_requests_pending_uniq constraint cannot reject a resend.

CREATE OR REPLACE FUNCTION public.prepare_friend_request_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    DELETE FROM public.friend_requests
    WHERE status = 'pending'
      AND (
        (requester_id = NEW.requester_id AND recipient_id = NEW.recipient_id)
        OR
        (requester_id = NEW.recipient_id AND recipient_id = NEW.requester_id)
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_friend_request_insert_trigger ON public.friend_requests;
CREATE TRIGGER prepare_friend_request_insert_trigger
BEFORE INSERT ON public.friend_requests
FOR EACH ROW
EXECUTE FUNCTION public.prepare_friend_request_insert();

GRANT EXECUTE ON FUNCTION public.prepare_friend_request_insert() TO authenticated;
NOTIFY pgrst, 'reload schema';
