---
name: Workspace invite notification actions
description: Keep invitation actions linked to valid invite records independently of notification language.
---

Invite notifications should carry their invitation record ID, and action tokens should be returned only to the intended recipient while the invite is pending and unexpired. Legacy-notification recovery must recognize localized copy or, preferably, use structured metadata; it must not depend on one exact language prefix.

**Why:** Translating the notification from Italian to English caused an Italian-only fallback check to hide the accept and decline actions.

**How to apply:** When changing invite notification copy or locale handling, verify both the authenticated API response and visible actions in the notification menu and full notification page. Keep acceptance and rejection bound to the recipient’s active invitation.
