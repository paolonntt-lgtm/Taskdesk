---
name: Dashboard location fallback
description: User-approved location behavior for the dashboard hero.
---

The authenticated profile location is shown by default. On first Dashboard opening, ask for GPS; after consent, GPS takes priority for the current session and is refreshed on later app openings without asking again. If permission is denied, ask again on each app opening/foreground return. If the OS blocks another permission dialog, offer Settings. If GPS fails, keep showing the profile location. Never persist coordinates.

**Why:** The profile value represents the organization’s configured context, while GPS may be more relevant for a user on the move. The user explicitly chose a first-open request and repeated prompts after denial; GPS coordinates must not outlive the current session.

**How to apply:** Disclose the iOS/Android geocoder before the first request, skip permission prompts once granted, repeat the app's request after denial, and preserve the profile label as the fallback when GPS fails.