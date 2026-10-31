---
name: Shared workspace collaboration
description: Product rules for enabling external collaboration in additional workspaces.
---

Additional workspaces can become externally shared by inviting active accounts from other billing organizations. Workspace creation, invitations, share links, and member management belong in a separate administration area; the bottom-left workspace switcher is only for switching between accessible workspaces. External invitees must accept before gaining membership. Revoking one personal invitation must not disable sharing; sharing cannot be disabled while external members remain, and disabling it revokes outstanding invite links.

Targeted workspace invitations are emailed to the address saved on the selected account, using the billing-owner organization's SMTP settings. If delivery fails, revoke the new invitation so it does not appear active.

Resending a pending invitation must reuse its existing token and expiration without changing either; the email should state the actual saved expiration rather than imply a fresh seven-day period.

Responses whose contents depend on the active workspace header must not be cached by URL alone. The browser can otherwise reuse the prior workspace's collaborator list after switching.

**Why:** The user requested external collaboration for additional organizations while keeping workspace switching distinct from workspace administration and preserving billing ownership.

**How to apply:** Keep the workspace/tenant identity separate from the external-sharing setting. New workspaces can start private, and explicit invitations or links enable collaboration without moving accounts or billing seats. Use the billing owner organization for invitation email configuration because a newly created workspace may not have its own SMTP channel.
