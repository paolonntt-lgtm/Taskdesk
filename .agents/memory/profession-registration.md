---
name: Profession required at signup
description: Registration rule for selecting and saving an organization's profession.
---

Every new organization must have a valid profession selected during account registration, whether the owner registers with email/password or Google. Persist it on the organization immediately and use it to initialize onboarding. Keep existing organizations unchanged; joining an existing organization by invitation does not create a new organization and does not require this selection.

**Why:** The user explicitly changed the product requirement from selecting profession only in onboarding to requiring it during registration, while preserving the decision not to infer/backfill existing organizations.

**How to apply:** Any account-creation path that creates an organization must validate and save a profession server-side. Login to an existing account and invite-based member registration are not organization-creation flows.
