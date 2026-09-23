---
name: Monthly recurrence scheduling
description: Product rule for recurring tickets that specify a calendar day.
---

When a monthly recurring ticket selects a day that a month does not contain, schedule that occurrence on the last available day of the month.

**Why:** A day-of-month choice such as 31 should remain useful in February and shorter months instead of skipping an occurrence or drifting into the following month.

**How to apply:** Preserve the selected day for future months, clamp only the target occurrence to that month’s final day, and keep the selected day in the saved recurrence rule.