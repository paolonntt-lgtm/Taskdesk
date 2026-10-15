---
name: Tracked ticket handoffs
description: Product rules for reassignment and status permissions on time-tracked tickets.
---

On time-tracked tickets, prior work sessions stay attributed to the collaborator who recorded them. Reassignment pauses an in-progress ticket without starting the new assignee's timer. Admins and collaborators with the dedicated tracked-ticket assignment permission may assign or reassign; only admins and the current assignee may change status. After closure, only admins and session participants can consult the summary: admins see all sessions and participants see only their own. Admins can correct closed-session duration and classifications; retain before/after audit data and notify the affected collaborator.

**Why:** The user wants billing and collaborator recognition to remain historically correct across handoffs, restricts time details to people who worked on the ticket and admins, and requires collaborators to be notified when an admin corrects their recorded work.

**How to apply:** Enforce handoff, summary visibility, and correction permissions in both API and UI; leave ordinary tickets' assignment and status rules unchanged. Keep session edit history and notify the session owner after a correction.
