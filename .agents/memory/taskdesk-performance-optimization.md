---
name: TaskDesk performance optimization
description: User-approved order for reducing TaskDesk's initial page load cost.
---

Optimize static asset compression first and measure the result before considering code splitting or other frontend changes.

**Why:** The user accepted compression as the lower-risk first step and wanted a new speed measurement before broader changes.

**How to apply:** Keep the initial optimization scoped to text assets and verify compressed transfer sizes and unchanged page responses before proposing route-level lazy loading.
