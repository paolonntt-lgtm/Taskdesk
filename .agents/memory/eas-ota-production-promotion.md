---
name: EAS OTA production promotion
description: User's release gate for Android and iOS over-the-air updates.
---

Run mobile typecheck and the full mobile test suite before publishing preview OTA from `main`; both must gate fingerprinting and publishing. Production OTA remains an explicit manual promotion after preview verification, performed by pushing reviewed app changes to `ota-production`. A branch push replaces separate manual confirmation. Keep EAS workflow files in `.eas/workflows` beside the Expo project's `eas.json`, including in monorepos.

The previously installed test APK's OTA project could not be verified. The user chose the currently linked EAS project for future OTA updates and accepted installing a fresh preview build; treat that new install as the compatibility baseline. The old APK remains tied to its previous project.

**Why:** The user wants eligible preview JavaScript updates to publish automatically only after tests pass, while keeping production promotion manual. Installed apps should receive compatible JavaScript updates without turning every change into an automatic production release. EAS treats the configured mobile base directory as the Expo project root; workflow files at the repository root are not recognized when `eas.json` is nested. The old test APK's EAS lineage was unknown, so the user explicitly approved a new-project preview install instead of preserving uncertain OTA compatibility.

**How to apply:** Keep `extra.eas.projectId` and `updates.url` aligned with the selected EAS project. Treat a new project ID as requiring a new native install; do not promise OTA delivery to binaries built for the old project. Keep `.eas/workflows` next to the active `eas.json`. Preview installs follow `main`, while production installs update only after a push to `ota-production`. Native/runtime changes still require a new store build. EAS custom validation steps may run from the Expo app directory, so use `pnpm -w` for root scripts. Install system tools required by tests, and support ImageMagick 6's `convert`/`identify` names as well as ImageMagick 7's `magick`.
