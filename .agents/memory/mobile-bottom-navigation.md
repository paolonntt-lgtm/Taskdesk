---
name: Mobile bottom navigation
description: The preferred mobile bottom-bar behavior when optional organization modules are enabled.
---

Use a single bottom row for Dashboard, Tickets, Calendar, and any enabled optional sections. Keep Profile and Notifications as top-right header actions; show an unread-count badge on the bell only when the count is above zero. Hide New (+) while both Clients and TaskTrack are enabled; restore it in the center whenever either organization product is disabled. Decide this from module activation, not whether the current user can see Hours report. Keep Clients visible only when its organization module is enabled, and show Hours report only to organization admins when TaskTrack is enabled. Keep daily Report separate from Hours report.

**Why:** The user wants a single-row bottom menu, Profile at the upper right, and a notification bell with an unread counter. They later requested the centered New action when either optional product is disabled.

**How to apply:** Preserve module and role gating, keep labels legible in Italian and English, and keep Notifications and Profile available from the header.
