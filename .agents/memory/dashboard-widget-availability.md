---
name: Feature-gated dashboard widgets
description: Preserve dashboard widget preferences when a role or organization feature hides a widget.
---

When a dashboard widget is unavailable because of a role or a disabled organization module, hide it from the available-widget registry and rendered layout without deleting its saved visibility or position. If the feature becomes available again, the prior layout preference should return.

**Why:** The user requires the “Da fatturare” widget to appear only for admins while time tracking is enabled, without altering existing saved dashboard layouts.

**How to apply:** For module- or role-gated widgets, filter renderable widgets and picker entries by current access, but preserve stored IDs and layout records. Do not add gated widgets to the default layout unless explicitly requested.
