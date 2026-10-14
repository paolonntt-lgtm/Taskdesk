---
name: Effective permission contract
description: Preserve the distinction between group inheritance and final authorization in auth responses.
---

Keep `groupPermissions` as the final permission set used by existing clients for feature gating. Expose the group-only set separately as `inheritedGroupPermissions`, with `effectivePermissions` as an explicit alias for new code.

Memoize permission summaries only within the current HTTP request. Do not use a process-wide TTL cache, because a saved individual override must take effect on the next request.

**Why:** Existing web and mobile consumers already rely on `groupPermissions` to decide which actions to show. Returning only group-derived permissions would leave the UI inconsistent with individual grants and denials; cross-request caching could delay a denial or grant.

**How to apply:** Keep old client-facing permission fields aligned with server authorization, use the inherited-only field to explain access, and pass the Express request object to repeated permission checks so they share one summary without sharing it across requests.
