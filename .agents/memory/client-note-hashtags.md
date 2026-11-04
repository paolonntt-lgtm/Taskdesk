---
name: Client note hashtags
description: Category and month syntax for client notes.
---

Client-note category codes are `770` and `CU`, assigned per year. Bare `#770` and `#CU` use the current Europe/Rome year; `#77027` and `#CU27` select that year, and four-digit forms such as `#CU2027` normalize to the same category as `#CU27`. A note may have either or both categories for one or more years. Keep month hashtags separate and unchanged.

Only organizations whose labor-consultant profession is recorded during registration/onboarding or explicitly selected later by an organization admin are enabled. Existing organizations are not inferred or automatically backfilled.

**Why:** The user specified annual 770/CU categories, restricted them to labor consultants, and chose to avoid inferring professions for existing organizations while allowing admins to correct their organization profile.

**How to apply:** Persist normalized two-digit year category codes as note metadata, enforce the profession restriction on the server, let only admins update the organization profession in settings, remove category hashtags from note text, and continue parsing month hashtags independently.
