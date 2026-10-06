---
name: Daily report notification context
description: Product requirement for site-aware daily-report notifications and navigation.
---

Daily-report notifications should identify the report's site when available and open that exact report, especially for organizations with multiple locations.

**Why:** Without the site, colleagues cannot distinguish reports across locations; without a direct link, the notification does not help them read the report.

**How to apply:** Preserve a structured daily report ID on the notification and enforce same-organization access when resolving it. Do not rely on parsing the notification text to find the report.
