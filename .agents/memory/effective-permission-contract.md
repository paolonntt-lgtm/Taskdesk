---
name: Effective permission contract
description: Preserve the distinction between group inheritance and final authorization in auth responses.
---

Keep `groupPermissions` as the final permission set used by existing clients for feature gating. Expose the group-only set separately as `inheritedGroupPermissions`, with `effectivePermissions` as an explicit alias for new code.

**Why:** Existing web and mobile consumers already rely on `groupPermissions` to decide which actions to show. Returning only group-derived permissions would leave the UI inconsistent with individual grants and denials.

**How to apply:** When changing authorization payloads, keep old client-facing permission fields aligned with server authorization, and use the inherited-only field for explaining where access came from.
