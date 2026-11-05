---
name: Superadmin organization grouping
description: The intended account identity for grouping organizations in the superadmin view.
---

The intended grouping key is the creating admin account's normalized email. The current schema does not retain an explicit creator field, so the page temporarily approximates this with normalized emails of admin accounts associated with each organization. Do not treat shared administration as definitive creator attribution; exact attribution requires storing the creator and resolving historical records.

**Why:** The user clarified that organizations such as “la mandrakata,” “prova2,” and “rreee” should be together because the same admin account (`paolonntt@gmail.com`) created them, rather than because they share any current administrator.

**How to apply:** Prefer a durable creator identity for exact results. Until available, compare associated admin emails case-insensitively and avoid grouping by user ID alone; be clear that this is an approximation.
