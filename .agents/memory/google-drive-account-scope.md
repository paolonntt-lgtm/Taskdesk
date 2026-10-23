---
name: Cloud-drive account scope
description: User-level account isolation for Google Drive and OneDrive browsing and ticket folder selection.
---

Google Drive and OneDrive browsing and ticket-folder selection must operate on each authenticated TaskDesk user's own connected provider account. Do not use a shared organization-wide drive account or workspace connector for customer file access.

**Why:** The user explicitly chose individual account connections so access reflects each TaskDesk user's own provider permissions.

**How to apply:** Keep provider authorization client-side and isolated per TaskDesk user. Preserve that boundary when adding browsing, ticket links, or durable connection storage.
