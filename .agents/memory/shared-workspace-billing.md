---
name: Shared workspace billing ownership
description: Shared workspace memberships do not change an account's billing organization or create new seats.
---

Shared workspace membership is separate from billing ownership. Existing active accounts keep their home organization as their billing owner and consume one seat there, regardless of how many workspaces they join. The invitation flow accepts only active accounts that already have a billing organization; adding a membership does not create an account or a seat.

**Why:** This prevents shared workspaces from bypassing account-seat limits while keeping workspace roles and company data separate from the billing account.

**How to apply:** Keep seat counts tied to active user accounts at their home billing organization. Any future invitation or sponsorship flow for a new account must verify the responsible billing organization and reserve available seat capacity before granting access.
