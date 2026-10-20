---
name: EAS mobile API host
description: Build-time API domain configuration for EAS native mobile builds.
---

Every EAS profile that produces a distributable native TaskDesk app must set `EXPO_PUBLIC_DOMAIN` to the verified public production host. Do not rely on Replit development-domain variables being available to EAS cloud builds.

**Why:** The mobile API helper constructs absolute HTTPS URLs only when this build-time variable is present. Without it, native requests can target an invalid relative API path and fail before reaching the production API.

**How to apply:** When creating or changing an EAS preview or production build, verify that its profile resolves `EXPO_PUBLIC_DOMAIN` to the current verified production domain before triggering the build.
