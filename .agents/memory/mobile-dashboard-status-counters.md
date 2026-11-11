---
name: Mobile ticket dashboard counts
description: Product rule for aggregating mobile dashboard ticket counters across configurable statuses.
---

The mobile dashboard's closed total must include every ticket status configured as closed, including the resolved status and custom statuses marked closed. The in-progress total must be populated from the `in_progress` status.

**Why:** The dashboard should reflect each organization's configured status lifecycle rather than treating the literal `closed` key as the only terminal state.

**How to apply:** When changing mobile dashboard metrics, use the organization's configured closed-status flags for the closed total and keep the in-progress API field aligned with the mobile card.
