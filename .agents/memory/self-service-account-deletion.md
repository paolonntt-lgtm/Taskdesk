---
name: Self-service account deletion
description: Product behavior for a user deleting their own TaskDesk account.
---

Self-service deletion belongs in Settings → Profile. Require an email confirmation, deactivate and anonymize the user record, revoke sessions and personal OneDrive access, but retain organization records, tickets, invoices, and any subscription. Block the action when the user is the last active administrator in their home organization or a shared workspace.

**Why:** Deleting a login should not erase shared business history or silently cancel billing, and leaving a workspace without an administrator can make it unmanageable.

**How to apply:** Keep account deletion distinct from organization deletion and billing cancellation; show the consequences before confirmation and preserve an alternate administrator.
