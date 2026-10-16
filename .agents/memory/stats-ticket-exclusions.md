---
name: Ticket source exclusions in statistics
description: User-facing rule for whether externally generated and system-created tickets should affect aggregates.
---

System-created tickets are excluded from aggregates unless their location is “Esterno”. External tickets count in numeric statistics and summaries, but are omitted from chart series.

**Why:** The user clarified that external tickets must count in statistics and only be removed from charts; the prior broader exclusion was incorrect.

**How to apply:** Keep a base statistics filter for deleted, organization, and visibility rules; exclude system-created tickets only when they are not external. Add the normalized external-location exclusion only to chart endpoints and chart-series queries.
