---
name: Cloud-drive account scope
description: User-level account isolation for Google Drive and OneDrive browsing and ticket folder selection.
---

Google Drive and OneDrive browsing and ticket-folder selection must operate on each authenticated TaskDesk user's own connected provider account. Do not use a shared organization-wide drive account or workspace connector for customer file access.

**Why:** The user explicitly chose individual account connections so access reflects each TaskDesk user's own provider permissions.

**How to apply:** Keep provider authorization client-side and isolated per TaskDesk user. Preserve that boundary when adding browsing, ticket links, or durable connection storage.

For OneDrive ticket attachments, collaborators may connect business or personal Microsoft accounts. Each account owns its own `Taskdesk` root and operator-named subfolder; assigned ticket files go to the assignee's subfolder. Unassigned inbound-email files go to the organization's connected admin account root.

**Why:** The user changed the OneDrive account scope to include personal Microsoft accounts while retaining per-collaborator ownership; unassigned email tickets still use a connected admin because they have no human creator.

**How to apply:** Do not substitute a shared service drive or public sharing links. Preserve matching for business tenants, permit personal accounts alongside them, invite connected collaborators by identity, and keep TaskDesk's stored attachment as the source copy.

The main navigation's OneDrive entry should open an organization-level directory of all shared Taskdesk folders, with each link opening the native OneDrive browser.

**Why:** The user requested one menu destination to navigate every organization-shared operator folder, while the storage model still has per-collaborator OneDrive roots.

**How to apply:** Keep the menu entry distinct from Google Drive and aggregate only the current user's organization-scoped share links.

Support both organizational and personal Microsoft accounts, but do not grant folder access with anonymous links.

**Why:** The user explicitly changed the requirement to accept personal accounts and selected individual collaborator invitations as the sharing method.

**How to apply:** Use a Microsoft authority and app registration that accept personal accounts; grant each connected collaborator sign-in-protected access to other connected Taskdesk roots.

For MSAL popup recovery, only set `overrideInteractionInProgress` after an explicit user click, and start a fresh MSAL request rather than reusing a pending single-flight promise. Microsoft documents that the override force-cancels a pending interaction but does not close its popup; automatic retries can create races or leave extra popups open.

**Why:** A stale interaction marker or a reused pending promise can block recovery, while blindly overriding it may cancel a valid sign-in attempt.

**How to apply:** Offer a user-triggered retry only after MSAL reports `interaction_in_progress`; bypass the stale local request on that click, but do not retry automatically or clear the whole account cache.

MSAL Browser v5 popup and silent flows in Vite require a dedicated redirect-bridge page that only processes the response; do not use the main SPA/dashboard as the popup callback. Register the exact bridge URL in Entra ID.

**Why:** Loading the SPA as the callback can navigate the user back to the dashboard instead of cleanly returning the auth response to the opener.

**How to apply:** Build a separate Vite HTML entry that calls `broadcastResponseToMainFrame` from `@azure/msal-browser/redirect-bridge`; keep API calls and app routing off that page.
