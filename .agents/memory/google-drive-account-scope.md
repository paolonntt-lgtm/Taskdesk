---
name: Cloud-drive account scope
description: User-level account isolation for Google Drive and OneDrive browsing and ticket folder selection.
---

Google Drive and OneDrive browsing and ticket-folder selection must operate on each authenticated TaskDesk user's own connected provider account. Do not use a shared organization-wide drive account or workspace connector for customer file access.

**Why:** The user explicitly chose individual account connections so access reflects each TaskDesk user's own provider permissions.

**How to apply:** Keep provider authorization client-side and isolated per TaskDesk user. Preserve that boundary when adding browsing, ticket links, or durable connection storage.

For MSAL popup recovery, only set `overrideInteractionInProgress` after an explicit user click, and start a fresh MSAL request rather than reusing a pending single-flight promise. Microsoft documents that the override force-cancels a pending interaction but does not close its popup; automatic retries can create races or leave extra popups open.

**Why:** A stale interaction marker or a reused pending promise can block recovery, while blindly overriding it may cancel a valid sign-in attempt.

**How to apply:** Offer a user-triggered retry only after MSAL reports `interaction_in_progress`; bypass the stale local request on that click, but do not retry automatically or clear the whole account cache.
