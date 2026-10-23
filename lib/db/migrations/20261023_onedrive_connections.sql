-- Additive OneDrive sync schema. This is intentionally applied separately
-- from Drizzle's full push because the development database has unrelated
-- schema drift and the full push proposes destructive sequence drops.
BEGIN;

ALTER TABLE public.ticket_attachments
  ADD COLUMN IF NOT EXISTS onedrive_item_id text,
  ADD COLUMN IF NOT EXISTS onedrive_sync_error text;

CREATE TABLE IF NOT EXISTS public.onedrive_connections (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id integer NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  microsoft_email text NOT NULL,
  encrypted_refresh_token text NOT NULL,
  root_folder_id text NOT NULL,
  operator_folder_id text NOT NULL,
  organization_share_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS onedrive_connections_user_idx
  ON public.onedrive_connections (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS onedrive_connections_org_user_idx
  ON public.onedrive_connections (organization_id, user_id);

COMMIT;
