---
name: Expo web login origin
description: Secure origin handling for browser-based Expo preview authentication.
---

When Expo web login uses a Replit Expo preview host, authorize the exact `REPLIT_EXPO_DEV_DOMAIN` origin in the session-establishing request guard. Do not allow every `*.replit.dev` origin there.

**Why:** The Expo preview browser origin differs from the main Replit development domain, while broadening the same-origin guard would weaken login-CSRF protection.

**How to apply:** Keep the exact-host comparison separate from the CORS allowlist and test that a different Expo preview host remains rejected.
