---
name: Mobile ticket creation back navigation
description: Expected return destination after confirming a newly created mobile ticket.
---

After a ticket is created from the mobile New tab and its detail screen opens, Back should return to the Tickets list, not reopen the submitted creation form. Tickets opened from other places should retain their normal Back destination.

**Why:** The user reported the form reopening after confirmation and explicitly expects the ticket list.

**How to apply:** Preserve the creation origin on the new ticket detail route and return to the Tickets tab only for that origin.
