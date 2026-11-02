---
name: OneDrive authorization status
description: User expectation for persistent OneDrive connections and clear reauthorization handling.
---

TaskDesk should keep OneDrive connected through automatic token refresh, but distinguish a saved connection record from a Microsoft authorization that is still renewable. If Microsoft rejects renewal, preserve the stored connection and clearly ask the user to reauthorize the same account rather than showing a normal connected state.

**Why:** Users expect OneDrive to stay connected, and provider-side token invalidation can make a saved connection unusable without removing it.

**How to apply:** Use the existing refresh flow to verify authorization when status is checked; on an authorization 401, show a warning and a direct same-account reconnect action. Do not claim the provider can guarantee permanent authorization.
