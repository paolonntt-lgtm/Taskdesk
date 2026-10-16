---
name: Organization trial expiration
description: Product rule for access after a TaskDesk organization's free trial expires.
---

Trial expiry applies to the organization, not only to its admin account. Once expired, collaborators cannot continue using TaskDesk until an admin activates a subscription; admins retain access to billing and subscription activation.

**Why:** The user confirmed that expired trials should block the whole organization, rather than letting collaborators continue to work.

**How to apply:** Keep both the user interface and authenticated API routes aligned with this organization-level rule. Preserve the admin-only billing path needed to resume access.
