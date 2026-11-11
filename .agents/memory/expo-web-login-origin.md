---
name: Expo web login origin
description: Secure origin handling for browser-based Expo preview authentication.
---

When Expo web login uses a Replit Expo preview host, authorize the exact `REPLIT_EXPO_DEV_DOMAIN` origin in the session-establishing request guard. Do not allow every `*.replit.dev` origin there.

**Why:** The Expo preview browser origin differs from the main Replit development domain, while broadening the same-origin guard would weaken login-CSRF protection.

**How to apply:** Keep the exact-host comparison separate from the CORS allowlist and test that a different Expo preview host remains rejected.

For authenticated API calls from the Expo browser preview, keep API requests relative to the preview origin so the browser sends its session cookie. Configure the absolute API base only for native requests.

**Why:** The Expo preview and the main development API host can be different origins; generated requests to the API host returned 401 while same-origin requests succeeded.

**How to apply:** In the mobile root layout, set the generated API client base URL only when `Platform.OS !== "web"`; use proxied `/api/...` paths on web.
