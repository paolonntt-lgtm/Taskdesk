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

COMMIT;
