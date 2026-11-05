---
name: Superadmin organization grouping
description: The intended account identity for grouping organizations in the superadmin view.
---

Group organizations by the account that owns/created the workspace, not by arbitrary shared admin membership. Shared workspaces already point to their billing-owner organization; use that relationship to group each workspace with its owner and siblings. Do not connect unrelated organizations merely because one admin happens to belong to both.

**Why:** The user clarified that organizations such as “la mandrakata,” “prova2,” and “rreee” should be together because the same admin account (`paolonntt@gmail.com`) created them, rather than because they share any current administrator.

**How to apply:** Prefer the explicit billing-owner relationship where present. If future organization-creation flows do not record an owner/creator, add that attribution rather than inferring it from all current administrators.
