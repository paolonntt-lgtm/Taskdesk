---
name: Client note hashtags
description: Category and month syntax for client notes.
---

Client-note categories are limited to `770` and `CU`, entered as `#770` and `#CU`; a note may have either or both. They are only for labor-consultant organizations. Keep the existing month hashtag syntax separate and unchanged.

Only organizations whose labor-consultant profile is recorded during onboarding are enabled; existing organizations are not inferred or backfilled.

**Why:** The user specified these two categories, restricted them to labor consultants, and chose to enable only newly onboarded organizations.

**How to apply:** Persist the exact onboarding profile and category as note metadata, enforce the profession restriction on the server, remove the category hashtag from note text, and continue parsing month hashtags independently.
