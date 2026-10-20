---
name: EAS mobile builds and OTA compatibility
description: Build-time API host and native-runtime compatibility rules for TaskDesk mobile EAS builds and updates.
---

Every EAS profile that produces a distributable native TaskDesk app must set `EXPO_PUBLIC_DOMAIN` to the verified public production host. Do not rely on Replit development-domain variables being available to EAS cloud builds.

EAS Update uses `runtimeVersion` based on `appVersion`. Bump the app version whenever native code, native modules, permissions, or native configuration changes, then increment Android `versionCode` so the new binary installs as an upgrade. OTA bundles are downloaded by compatible installed binaries when they check on launch, but source changes still need to be published to the matching EAS channel.

**Why:** The mobile API helper constructs absolute HTTPS URLs only when the build-time host is present. Also, an OTA bundle cannot add or change native code, so sharing a runtime across incompatible binaries can produce broken updates.

**How to apply:** For preview and production builds, verify `EXPO_PUBLIC_DOMAIN` and channel settings. Before native changes, bump app version and Android version code; for JavaScript-only changes, publish to the matching channel with the existing update script.
