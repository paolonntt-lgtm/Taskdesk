---
name: Android home-screen widget builds
description: Compatibility and validation boundaries for native TaskDesk home-screen widgets.
---

Keep `react-native-android-widget` imports dormant in Expo Go and activate them only in an installed native Android app. Widget provider, layout, and plugin changes need a newly built Android binary; JavaScript export or over-the-air updates alone do not verify or deliver the widget.

**Why:** Expo Go does not bundle the widget's native module, and launchers install widgets from native app metadata.

**How to apply:** Guard native module loading in the Expo Go path, then validate widget installation, refresh, deep links, logout clearing, and workspace changes on a fresh Android build.
