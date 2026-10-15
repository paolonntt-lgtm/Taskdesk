---
name: Tracked ticket handoffs
description: Product rules for reassignment and status permissions on time-tracked tickets.
---

On time-tracked tickets, prior work sessions stay attributed to the collaborator who recorded them. Reassignment pauses an in-progress ticket without starting the new assignee's timer. Admins and collaborators with the dedicated tracked-ticket assignment permission may assign or reassign; only admins and the current assignee may change status.

**Why:** The user wants billing and collaborator recognition to remain historically correct across handoffs, while preventing the next collaborator's time from accruing before they resume work.

**How to apply:** Enforce these rules in both API and UI; leave ordinary tickets' assignment and status rules unchanged.
