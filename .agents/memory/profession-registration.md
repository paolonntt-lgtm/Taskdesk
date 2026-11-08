---
name: Profession required at signup
description: Registration rule for selecting and saving an organization's profession.
---

Every new organization must have a valid profession selected during account registration, whether the owner registers with email/password or Google. Persist it on the organization immediately and use it to initialize onboarding. Keep existing organizations unchanged; joining an existing organization by invitation does not create a new organization and does not require this selection.

Keep one canonical profile-ID list for both registration and onboarding. UI labels remain in the bilingual translations, while onboarding-only icons and colors stay in its presentation map.

In Settings → General, hide the redundant business-type selector when a profession is selected; keep it available for existing organizations without a profession. The profession determines the business type, while custom ticket terminology remains editable.

**Why:** The user confirmed that profession already determines activity type, so showing the disabled selector is redundant. Existing unclassified organizations still need a way to keep or choose their activity type.

**How to apply:** Any account-creation path that creates an organization must validate and save a profession server-side. In settings, hide only the activity-type selector when profession is set; preserve custom terminology controls and the selector for legacy organizations without a profession.
