---
name: Client note hashtags
description: Category and month syntax for client notes.
---

Built-in client-note category codes are `770` and `CU`, assigned per year. Bare `#770` and `#CU` use the current Europe/Rome year; `#77027` and `#CU27` select that year, and four-digit forms such as `#CU2027` normalize to the same category as `#CU27`. Keep month hashtags separate and unchanged.

Organizations with clients enabled can configure additional declaratives with a display name and hashtag alias. Keep these organization-scoped and add them alongside the built-in yearly categories. Custom aliases may overlap a built-in bare alias (for example `#CU`); then resolve to both categories for labor consultants, and to the configured custom category only for other professions. Keep category identifiers stable so existing notes remain associated.

Only the built-in yearly categories are restricted to organizations whose labor-consultant profession is recorded during registration/onboarding or explicitly selected later by an organization admin. Existing organizations are not inferred or automatically backfilled. Custom declaratives are available to any organization with client management enabled.

**Why:** The user later requested organization-specific declaratives with editable names and hashtag aliases, in addition to the existing annual 770/CU categories. Built-in category restrictions remain unchanged.

**How to apply:** Persist built-in normalized two-digit year codes and stable declarative IDs as note metadata; validate custom IDs against that organization's saved settings; allow only admins to edit declaratives; keep category-only notes free of a month override; and continue parsing explicit month hashtags independently.
