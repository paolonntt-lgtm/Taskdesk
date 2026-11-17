---
name: Android adaptive icon negative space
description: Prevent dark launcher backgrounds from showing through light regions inside the TaskDesk Android mark.
---

For TaskDesk's Android adaptive icon, keep white negative-space areas inside the logo opaque in the foreground image; do not rely only on the adaptive background layer or background color to render them white.

**Why:** Android launchers can expose black through transparent regions, making the interior of the mark appear black even when its intended art uses white.

**How to apply:** When regenerating the adaptive foreground, preserve an opaque white underlay behind the mark within the safe area and validate a representative interior pixel as white.
