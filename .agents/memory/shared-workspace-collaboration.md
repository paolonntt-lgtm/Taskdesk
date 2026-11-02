---
name: Shared workspace collaboration
description: Product rules for enabling external collaboration in additional workspaces.
---

Create additional workspaces from the workspace menu opened by the name at the bottom left. Manage members and invitations for the active workspace in Settings → Users & Groups; do not add a separate workspace item to Settings. External invitees must accept before gaining membership. Revoking one personal invitation must not disable sharing; sharing cannot be disabled while external members remain, and disabling it revokes outstanding invite links.

Targeted workspace invitations are emailed to the address saved on the selected account, using the billing-owner organization's SMTP settings. If delivery fails, revoke the new invitation so it does not appear active.

Resending a pending invitation must reuse its existing token and expiration without changing either; the email should state the actual saved expiration rather than imply a fresh seven-day period.

Responses whose contents depend on the active workspace header, and private attachment downloads authorized against the active workspace, must not be cached by URL alone. React Query cache identities must also include the active workspace so late responses cannot be reused after switching.

**Why:** Shared workspaces let one account see different data at the same endpoint URL; URL-only caching can reuse data without asking the server to recheck access.

**How to apply:** Keep the workspace/tenant identity separate from the external-sharing setting. Put workspace creation in the bottom-left workspace menu and member management inside Settings → Users & Groups. Partition client query caches by active workspace and avoid URL-only caching for protected workspace responses and private attachment downloads. New workspaces can start private, and explicit invitations or links enable collaboration without moving accounts or billing seats. Use the billing owner organization for invitation email configuration because a newly created workspace may not have its own SMTP channel.
