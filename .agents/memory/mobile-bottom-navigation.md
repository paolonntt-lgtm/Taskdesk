---
name: Mobile bottom navigation
description: The preferred mobile bottom-bar behavior when optional organization modules are enabled.
---

Use a single bottom row for Dashboard, Tickets, Calendar, and any enabled optional sections, with 24px navigation icons. Keep New (+) permanently centered as a larger white plus inside a blue circle that protrudes above the bar. When both Clients and TaskTrack are enabled, hide Calendar to preserve the center action slot. Do not duplicate the New action beside the Dashboard greeting. Keep Profile and Notifications as top-right header actions; show an unread-count badge on the bell only when the count is above zero. Base Calendar hiding on organization module flags, not role-limited Hours report visibility. Keep Clients visible only when its organization module is enabled, and show Hours report only to organization admins when TaskTrack is enabled. Keep daily Report separate from Hours report.

**Why:** The user wants a single-row bottom menu, Profile at the upper right, a notification bell with an unread counter, larger bottom-nav icons, and a prominent New action that remains centered even when both optional products are active.

**How to apply:** Preserve module and role gating, keep labels legible in Italian and English, and keep Notifications and Profile available from the header.
