---
name: Ticket source exclusions in statistics
description: User-facing rule for whether externally generated and system-created tickets should affect aggregates.
---

Ticket aggregates exclude tickets created by a system user. Tickets whose location is “Esterno” count in numeric statistics, summaries, leaderboards, and non-chart lists, but are omitted from chart series.

**Why:** The user clarified that external tickets must count in statistics and only be removed from charts; the prior broader exclusion was incorrect.

**How to apply:** Keep a base statistics filter for deleted, organization, visibility, and system-created rules. Add the normalized external-location exclusion only to chart endpoints and chart-series queries; keep scalar totals and list-style aggregates inclusive of external tickets.
