---
name: Client note hashtags
description: Category and month syntax for client notes.
---

Client-note category codes are `770` and `CU`, assigned per year. Bare `#770` and `#CU` use the current Europe/Rome year; `#77027` and `#CU27` select that year, and four-digit forms such as `#CU2027` normalize to the same category as `#CU27`. A note may have either or both categories for one or more years. Keep month hashtags separate and unchanged.

Only organizations whose labor-consultant profession is recorded during registration/onboarding are enabled; existing organizations are not inferred or backfilled.

**Why:** The user specified annual 770/CU categories, restricted them to labor consultants, and chose to enable only new organizations.

**How to apply:** Persist normalized two-digit year category codes as note metadata, enforce the profession restriction on the server, remove category hashtags from note text, and continue parsing month hashtags independently.
