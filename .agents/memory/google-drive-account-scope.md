---
name: Google Drive account scope
description: User-level account isolation for Google Drive browsing and ticket folder selection.
---

Google Drive browsing and ticket folder selection must operate on each authenticated user's own connected Google account. Do not use one shared organization-wide Drive account.

**Why:** The user explicitly chose individual account connections so Drive access reflects each user's own Google permissions.

**How to apply:** Bind every Drive OAuth flow and token to the authenticated user and session. Preserve that isolation when adding browsing, ticket links, or durable connection storage.
