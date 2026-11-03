---
name: Dashboard preferences and availability
description: Keep dashboard preferences personal while preserving them across role or organization feature changes.
---

Dashboard layout, visible widgets, custom names, filters, and widget selections belong to the individual user; do not inherit them from an organization admin or another account sharing a browser. Scope browser storage by user ID, and scope repeatable widget settings by widget instance ID.

Only newly onboarded organizations should receive automatic collaborator widgets; do not retrofit existing organizations. In an enabled organization, show one separately configured ticket-feed widget for each active non-admin collaborator. Add new collaborators without resetting layout choices; keep dismissed widgets dismissed and preserve the layout of inactive collaborators.

When a dashboard widget is unavailable because of a role or a disabled organization module, hide it from the available-widget registry and rendered layout without deleting its saved visibility or position. If the feature becomes available again, the prior layout preference should return.

**Why:** The user clarified that automatic collaborator widgets are only for new signups, not existing organizations. Their dashboards must remain unchanged; enabled admins still need the feeds to appear for active collaborators while retaining personal layout choices.

**How to apply:** Enable the feature only when a new organization completes initial onboarding; treat the feature as off for existing organizations. Within enabled organizations, scope dashboard-local preferences by authenticated user ID and repeatable widget settings by instance ID; add collaborators by stable ID and respect dismissed visibility. Preserve layouts for inactive collaborators and for role/module-gated widgets.
