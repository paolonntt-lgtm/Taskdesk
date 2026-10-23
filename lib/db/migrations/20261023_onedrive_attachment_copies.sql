-- Preserve OneDrive attachment copies and their original account identity so
-- admins can safely remove only known-stale TaskDesk files after reassignment.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ticket_attachment_onedrive_copies (
  id serial PRIMARY KEY,
  attachment_id integer NOT NULL REFERENCES public.ticket_attachments(id) ON DELETE CASCADE,
  owner_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
  owner_name text NOT NULL,
  owner_email text NOT NULL,
  owner_tenant_id text NOT NULL,
  item_id text NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_attachment_onedrive_copies_attachment_idx
  ON public.ticket_attachment_onedrive_copies (attachment_id);
CREATE INDEX IF NOT EXISTS ticket_attachment_onedrive_copies_stale_idx
  ON public.ticket_attachment_onedrive_copies (attachment_id, is_current);
CREATE UNIQUE INDEX IF NOT EXISTS ticket_attachment_onedrive_copies_identity_idx
  ON public.ticket_attachment_onedrive_copies (attachment_id, owner_tenant_id, owner_email, item_id);

COMMIT;
