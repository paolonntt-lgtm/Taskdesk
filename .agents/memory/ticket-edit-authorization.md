---
name: Ticket edit authorization
description: Authorization rule for the ticket update API.
---

Authorize the actor before selecting which submitted ticket fields they may change. A status-only or priority-only payload is not itself evidence of permission; status and priority updates still require an allowed role, group permission, assignment, or creator relationship.

**Why:** An update route that treats a narrowly shaped request as an authorization exception lets any authenticated organization user mutate tickets directly through the API.

**How to apply:** Enforce role and ticket access checks before building the update object. Keep timer billing and compensation classifications restricted to admins.
