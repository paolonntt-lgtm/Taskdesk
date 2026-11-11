---
name: Dashboard location fallback
description: User-approved location behavior for the dashboard hero.
---

The authenticated profile location is shown by default. The user can explicitly request GPS even when a profile location exists; after a successful lookup, the GPS locality takes priority for the current app session. If permission or lookup fails, keep showing the profile location. Never persist coordinates.

**Why:** The profile value represents the organization’s configured context, while GPS may be more relevant for a user on the move. Location access must remain deliberate and the coordinates must not outlive the current session.

**How to apply:** Keep permission requests user-triggered, disclose the iOS/Android geocoder before asking, use GPS only after consent, and preserve the profile label as the fallback.