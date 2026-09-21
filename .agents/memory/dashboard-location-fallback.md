---
name: Dashboard location fallback
description: User-approved location behavior for the dashboard hero.
---

The authenticated profile location is the primary hero label. Browser geolocation is an explicit, optional fallback only when the profile has no location; coordinates are not persisted.

**Why:** The profile value represents the organization’s configured context, while automatic geolocation would require permission and may be inaccurate on desktops, VPNs, or corporate networks.

**How to apply:** Keep the permission request user-triggered, disclose any reverse-geocoding provider before requesting location, and leave the hero without a location when permission or lookup fails.