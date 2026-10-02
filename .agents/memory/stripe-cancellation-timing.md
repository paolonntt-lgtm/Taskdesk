---
name: Stripe cancellation timing
description: TaskDesk customer-portal cancellations remain active through the paid billing period.
---

**Rule:** A cancellation made in the customer portal takes effect at the end of the current paid period. Do not cancel immediately.

**Why:** The user explicitly confirmed this billing policy on October 2, 2026.

**How to apply:** Keep Stripe Customer Portal cancellation set to `at_period_end` in test and live environments; do not change proration or billing terms without explicit approval.