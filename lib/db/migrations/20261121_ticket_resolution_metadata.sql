ALTER TABLE "tickets"
  ADD COLUMN "resolution_note_by" integer
    CONSTRAINT "tickets_resolution_note_by_users_id_fk"
    REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "resolution_note_at" timestamptz;
