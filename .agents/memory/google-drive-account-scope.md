---
name: Cloud-drive account scope
description: User-level account isolation for Google Drive and OneDrive browsing and ticket folder selection.
---

Google Drive and OneDrive browsing and ticket-folder selection must operate on each authenticated TaskDesk user's own connected provider account. Do not use a shared organization-wide drive account or workspace connector for customer file access.

**Why:** The user explicitly chose individual account connections so access reflects each TaskDesk user's own provider permissions.

**How to apply:** Keep provider authorization client-side and isolated per TaskDesk user. Preserve that boundary when adding browsing, ticket links, or durable connection storage.

For MSAL popup recovery, only set `overrideInteractionInProgress` after an explicit user click. Microsoft documents that it force-cancels a pending interaction but does not close its popup; automatic retries can create races or leave extra popups open.

**Why:** A stale interaction marker can block a retry, but blindly overriding it may cancel a valid sign-in attempt.

**How to apply:** Offer a user-triggered retry only after MSAL reports `interaction_in_progress`; do not retry automatically or clear the whole account cache.
