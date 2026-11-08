BEGIN;

CREATE TABLE IF NOT EXISTS public.gym_access_events (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id integer REFERENCES public.clients(id) ON DELETE SET NULL,
  person_name text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by integer NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gym_access_events_org_occurred_idx
  ON public.gym_access_events (organization_id, occurred_at);
CREATE INDEX IF NOT EXISTS gym_access_events_org_client_occurred_idx
  ON public.gym_access_events (organization_id, client_id, occurred_at);
CREATE INDEX IF NOT EXISTS gym_access_events_org_person_idx
  ON public.gym_access_events (organization_id, person_name);

COMMIT;
