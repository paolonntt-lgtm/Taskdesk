---
name: EAS OTA production promotion
description: User's release gate for Android and iOS over-the-air updates.
---

Keep preview OTA automatic from `main`. Production OTA must remain an explicit manual promotion after preview verification, performed by pushing the reviewed app changes to the dedicated `ota-production` branch. A branch push replaces the separate manual workflow confirmation. EAS workflow files must be in `.eas/workflows` alongside the Expo project's `eas.json`, including when that project lives in a monorepo subdirectory.

The previously installed test APK's OTA project could not be verified. The user chose the currently linked EAS project for future OTA updates and accepted installing a fresh preview build; treat that new install as the compatibility baseline. The old APK remains tied to its previous project.

**Why:** The user wants installed production apps to receive compatible JavaScript updates without making every change an automatic production release or requiring the EAS CLI. EAS treats the configured mobile base directory as the Expo project root; workflow files at the repository root are not recognized when `eas.json` is nested. The old test APK's EAS lineage was unknown, so the user explicitly approved a new-project preview install instead of preserving uncertain OTA compatibility.

**How to apply:** Keep `extra.eas.projectId` and `updates.url` aligned with the selected EAS project. Treat a new project ID as requiring a new native install; do not promise OTA delivery to binaries built for the old project. Keep `.eas/workflows` next to the active `eas.json`. Preview installs follow `main`, while production installs update only after a push to `ota-production`. Native/runtime changes still require a new store build.
