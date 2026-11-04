---
name: Client note hashtags
description: Category and month syntax for client notes.
---

Every client-note category card must include a reference year. Bare aliases use the current Europe/Rome year; a two- or four-digit year suffix selects the specified year, and cards display the full year. Built-in `#770` and `#CU` retain their annual codes; month hashtags remain separate.

Organizations with clients enabled can configure declaratives with a display name and hashtag alias. Persist each custom category as a stable declarative ID plus a two-digit year. Seed labor-consultant settings with `CU #CU` and `770 #770`, and accountant settings with `Dichiarazione dei Redditi #REDDITI`, only when no settings row exists. Exact `#CU`/`#770` defaults for labor consultants map to the existing built-in categories rather than duplicate cards; other-profession custom aliases with those names stay custom.

Only the built-in yearly categories are restricted to organizations whose labor-consultant profession is recorded during registration/onboarding or explicitly selected later by an organization admin. Existing organizations are not inferred or automatically backfilled. Custom declaratives are available to any organization with client management enabled.

**Why:** The user requested yearly cards even for custom hashtags, current-year defaults when no year is written, and profession-specific default declaratives without losing existing CU/770 behavior.

**How to apply:** Persist built-in normalized two-digit codes and custom `declarative:<id>:<yy>` values; validate IDs against the organization's settings; allow only admins to edit settings; prevent removal while referenced; keep category-only notes free of a month override; and continue parsing explicit month hashtags independently.
