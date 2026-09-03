ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'friend_request';

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb;