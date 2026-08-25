-- Pin Stickman video administration to the confirmed Supabase Auth UID.
-- This avoids relying on an editable username such as "tetta_art".
CREATE SCHEMA IF NOT EXISTS private;

INSERT INTO private.admin_users (user_id)
VALUES ('aff7aa26-32e9-4595-bc1f-09fd0f3bd720'::uuid)
ON CONFLICT (user_id) DO NOTHING;

-- Keep the announcement sender restricted to the confirmed operator account.
DELETE FROM private.admin_users
WHERE user_id <> 'aff7aa26-32e9-4595-bc1f-09fd0f3bd720'::uuid;
