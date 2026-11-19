---
name: Expo build quota pacing
description: The user's monthly Android and iOS build limits and preferred weekly pacing.
---

For Expo builds, plan for at most 3 Android builds and 3 iOS builds per week, while never exceeding 15 builds per platform in a calendar month. Avoid unnecessary builds and batch native changes before requesting a build.

**Why:** The user has 15 Android and 15 iOS builds available per month and wants to pace usage.

**How to apply:** Track Android and iOS build counts separately. Do not initiate a build without the user's explicit request; warn if a proposed schedule could exceed either limit.
