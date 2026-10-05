---
name: Stripe payment descriptor
description: User-requested payment statement branding for TaskDesk.
---

Use `TASKDESK.IT` as the desired static Stripe statement descriptor. Changing the account default affects future payments only; it cannot rename a charge already processed, and Stripe may shorten the card prefix.

**Why:** The user explicitly requested `taskdesk.it` instead of the current `MR WOLF STUDIO` descriptor.

**How to apply:** Change the static descriptor in Stripe Dashboard under Business details. Do not promise a retroactive change or an exact 11-character card statement display.
