---
name: Inbound email notification routing
description: Notification recipients for inbound email tickets and replies.
---

When an inbound email ticket or email reply belongs to a ticket assigned to one operator, route the notification only to that operator. Keep subscriber notifications for replies to tickets with no individual assignee; new unassigned tickets retain organization-wide notifications.

**Why:** The user requested that email-forwarded updates on tickets assigned to a specific operator notify that operator only, rather than the whole organization.

**How to apply:** Use the ticket's persisted `assignedTo` value, including a configured default assignee, as the sole target across in-app, push, and email channels.
