ALTER TABLE "client_notes" ADD COLUMN "month_overrides" text[];
UPDATE "client_notes"
SET "month_overrides" = ARRAY["month_override"]::text[]
WHERE "month_override" IS NOT NULL;
