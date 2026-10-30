---
name: Dashboard preferences and availability
description: Keep dashboard preferences personal while preserving them across role or organization feature changes.
---

Dashboard layout, visible widgets, custom names, filters, and widget selections belong to the individual user; do not inherit them from an organization admin or another account sharing a browser. Scope browser storage by user ID, and scope repeatable widget settings by widget instance ID.

When a dashboard widget is unavailable because of a role or a disabled organization module, hide it from the available-widget registry and rendered layout without deleting its saved visibility or position. If the feature becomes available again, the prior layout preference should return.

**Why:** The user confirmed that dashboard preferences must not pass between users; shared browsers can otherwise make one user's layout appear to be inherited by another. Duplicate widgets also cannot share one storage key, or independently selected collaborators collapse to the last saved value after refresh. Feature-gated preferences must also survive temporary role or module restrictions.

**How to apply:** Scope dashboard-local preferences by authenticated user ID and repeatable widget settings by instance ID; remount/reset preference state when the user changes, and save server layouts against the current user's record. For gated widgets, filter renderable widgets and picker entries by current access while preserving stored IDs and positions; do not add gated widgets to defaults unless explicitly requested.
