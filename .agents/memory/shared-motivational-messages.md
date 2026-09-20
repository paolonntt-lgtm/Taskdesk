---
name: Shared motivational messages
description: Product decision for organization-wide dashboard messages.
---

Motivational dashboard messages are managed by administrators at organization scope, persist on the server, and rotate deterministically by calendar day for every user in that organization.

**Why:** The user asked for daily motivational copy and for admins to define the messages for the whole team, which cannot be reliably implemented with browser-local state.

**How to apply:** Keep the admin-only editor and organization-scoped persistence as the source of truth; dashboard clients should fetch the shared list and select the day’s message locally.