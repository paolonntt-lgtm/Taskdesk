---
name: Ticket client assignment UI
description: Keep ordinary ticket-client changes in the edit form rather than an inline detail selector.
---

Ticket details should display an assigned client read-only. Hide the client row for unassigned user-created tickets; users add or change a client through Edit.

**Why:** The user prefers assigning clients through Edit and does not want “Client: Not assigned” shown on manually created tickets.

**How to apply:** Show a read-only client name when assigned. Hide the row when no client is set and the ticket has no inbound-email metadata. Do not add inbound-email sender controls to the user-generated ticket flow.
