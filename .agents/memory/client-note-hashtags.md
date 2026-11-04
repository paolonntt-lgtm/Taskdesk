---
name: Client note hashtags
description: Category and month syntax for client notes.
---

Client-note categories are limited to `770` and `CU`, entered as `#770` and `#CU`, and are only for labor-consultant organizations. Keep the existing month hashtag syntax separate and unchanged.

**Why:** The user specified these two categories and chose not to allow arbitrary new category names.

**How to apply:** When implementing client-note category support, persist the category as note metadata, remove its hashtag from the note text, and continue parsing month hashtags independently.
