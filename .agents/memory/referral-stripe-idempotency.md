---
name: Stripe referral retry consistency
description: Keep the referral record aligned with an already-accepted Stripe balance credit after database retries.
---

Use the returned Stripe balance transaction as the canonical source for the credited customer, amount, currency, and transaction ID when finalizing a referral reward.

**Why:** Stripe may accept a credit while the database transaction later rolls back. A retry with the same idempotency key must not persist newly calculated plan details that differ from the accepted credit.

**How to apply:** When changing referral reward retries or persistence, verify that the committed referral describes the Stripe transaction that was actually created or replayed.
