BEGIN;

ALTER TABLE public.ticket_attachment_onedrive_copies
  ADD COLUMN IF NOT EXISTS item_name text;

CREATE TABLE IF NOT EXISTS public.onedrive_client_archives (
  organization_id integer PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  clients_folder_id text NOT NULL,
  clients_folder_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onedrive_client_folders (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id integer NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  drive_item_id text NOT NULL,
  folder_name text NOT NULL,
  web_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS onedrive_client_folders_org_client_idx
  ON public.onedrive_client_folders (organization_id, client_id);

CREATE TABLE IF NOT EXISTS public.onedrive_client_archive_backfill_items (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  attachment_id integer NOT NULL REFERENCES public.ticket_attachments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  copy_name text,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS onedrive_client_archive_backfill_org_attachment_idx
  ON public.onedrive_client_archive_backfill_items (organization_id, attachment_id);
CREATE INDEX IF NOT EXISTS onedrive_client_archive_backfill_status_retry_idx
  ON public.onedrive_client_archive_backfill_items (status, next_attempt_at);

COMMIT;
