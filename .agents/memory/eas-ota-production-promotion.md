---
name: EAS OTA production promotion
description: User's release gate for Android and iOS over-the-air updates.
---

Keep preview OTA automatic from `main`. Production OTA must remain an explicit manual promotion after preview verification, performed by pushing the reviewed app changes to the dedicated `ota-production` branch. A branch push replaces the separate manual workflow confirmation.

**Why:** The user wants installed production apps to receive compatible JavaScript updates without making every change an automatic production release or requiring the EAS CLI.

**How to apply:** Explain that preview installs follow `main`, while production installs update only after a push to `ota-production`. Native/runtime changes still require a new store build.
