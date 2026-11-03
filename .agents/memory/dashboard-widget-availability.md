---
name: Dashboard preferences and availability
description: Keep dashboard preferences personal while preserving them across role or organization feature changes.
---

Dashboard layout, visible widgets, custom names, filters, and widget selections belong to the individual user; do not inherit them from an organization admin or another account sharing a browser. Scope browser storage by user ID, and scope repeatable widget settings by widget instance ID.

For an admin dashboard, show one separately configured ticket-feed widget for each active non-admin collaborator. Add newly joined collaborators without resetting existing layout choices; a removed widget stays dismissed, and inactive collaborators' widgets can be hidden while their saved layout is preserved.

When a dashboard widget is unavailable because of a role or a disabled organization module, hide it from the available-widget registry and rendered layout without deleting its saved visibility or position. If the feature becomes available again, the prior layout preference should return.

**Why:** The user wants admins to see ticket feeds for their collaborators immediately, while keeping each dashboard personal and customizable. Shared browsers can otherwise make one user's layout appear to be inherited by another, and duplicate widgets cannot share one storage key.

**How to apply:** Scope dashboard-local preferences by authenticated user ID and repeatable widget settings by instance ID; remount/reset preference state when the user changes, and save server layouts against the current user's record. Add collaborator widgets by stable collaborator ID, and recognize a widget present in saved layout but absent from visibility as intentionally dismissed. For gated widgets, filter renderable widgets and picker entries by current access while preserving stored IDs and positions.
