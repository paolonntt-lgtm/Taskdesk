---
name: Ticket client assignment UI
description: Keep ordinary ticket-client changes in the edit form rather than an inline detail selector.
---

Ticket details should display the associated client read-only. Users who need to add or change a client should use the ticket's Edit flow.

**Why:** The user explicitly prefers editing the ticket over seeing a client selector whenever they open its details.

**How to apply:** Keep the detail view free of the general client selector and association-save controls. Preserve specialized inbound-email sender actions separately from ordinary client assignment.
