---
name: Ticket client assignment UI
description: Keep ordinary ticket-client changes in the edit form rather than an inline detail selector.
---

Ticket details should display the associated client read-only. Users who need to add or change a client should use the ticket's Edit flow.

**Why:** The user explicitly prefers editing the ticket over seeing a client selector whenever they open its details.

**How to apply:** Keep ticket detail read-only for client assignment. Do not add inbound-email sender controls to the user-generated ticket flow; leave email matching to inbound-email processing.
