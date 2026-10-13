---
name: Expo web export base path
description: Expo web artifacts served below the domain root need matching static asset URLs and preview paths.
---

Keep Expo's `experiments.baseUrl` aligned with the artifact's preview prefix when exporting a browser build. The Expo dev-domain preview may appear blank at `/` even while the same app works at its artifact path, such as `/mobile/`.

**Why:** The deployed static server and the Expo development server expose the app under different URL roots; testing only the Expo host root gives a false failure.

**How to apply:** Verify both the exported static server at the artifact path and the Expo dev preview at that same path. Preserve the base URL when building a production web export.
