---
name: Android adaptive icon negative space
description: Prevent dark launcher backgrounds from showing through light regions inside the TaskDesk Android mark.
---

For TaskDesk's Android adaptive icon, keep the full foreground canvas opaque white and use the enlarged right-hand reference as the target, even if the launcher mask clips the mark slightly.

**Why:** Android launchers can expose black through transparent regions, including the margins around the mark, even when the adaptive background is configured as white. The user prefers the larger home-screen mark over the smaller fully contained version.

**How to apply:** When regenerating the adaptive foreground, composite the mark over opaque white across the whole square canvas, keep the zoom near the user's larger reference, and validate there are no transparent pixels or unintended severe clipping.
