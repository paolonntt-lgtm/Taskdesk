---
name: Android adaptive icon negative space
description: Prevent dark launcher backgrounds from showing through light regions inside the TaskDesk Android mark.
---

For TaskDesk's Android adaptive icon, keep the full foreground canvas opaque white behind the mark; do not rely only on the adaptive background layer or background color to prevent black regions.

**Why:** Android launchers can expose black through transparent regions, including the margins around the mark, even when the adaptive background is configured as white.

**How to apply:** When regenerating the adaptive foreground, composite the mark over opaque white across the whole square canvas, keep the colored mark within Android's safe zone, and validate the full image has no transparent pixels.
