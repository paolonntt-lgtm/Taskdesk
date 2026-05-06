# Objective
Run an in-depth production security scan across the TaskDesk monorepo, focusing on the Express API and the web/mobile clients only where they expose or rely on production API behavior.

# Relevant information
- Production API entry points are `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, and `artifacts/api-server/src/routes/index.ts`.
- Auth is cookie-session based via `session_id` and `middlewares/auth.ts`.
- Multi-tenant separation is organization-based (`organizationId`) and must be enforced on every ticket/user/settings/storage access path.
- Frontend role gating exists, but only server-side checks are authoritative.
- Dev-only surfaces to deprioritize unless production reachability appears: `artifacts/mockup-sandbox/**`, `artifacts/mobile/scripts/**`, local workflow/dev helpers.
- Deterministic scanners completed. SAST highlighted one real-looking SQL construction sink in `artifacts/api-server/src/routes/users.ts`; most other hits appear low-value or dev-only. Manual review has already identified likely authorization defects around ticket subresources and private object delivery.

# Tasks

### T001: Validate auth, session, password, and OAuth security
- **Blocked By**: []
- **Details**:
  - Inspect session generation and cookie flags.
  - Review password hashing and password change/reset behavior.
  - Review Google OAuth flow for login CSRF/state integrity and other auth confusion paths.
  - Files: `artifacts/api-server/src/lib/session.ts`, `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/routes/profile.ts`, `artifacts/api-server/src/routes/passwordReset.ts`, `artifacts/api-server/src/routes/oauth.ts`, `artifacts/api-server/src/routes/invites.ts`
  - Acceptance: Confirm or reject concrete production-impactful identity/authentication vulnerabilities and write findings if needed.

### T002: Validate ticket authorization and tenant isolation
- **Blocked By**: []
- **Details**:
  - Trace all ticket, comment, note, activity, and attachment handlers for missing organization checks or missing admin-only enforcement.
  - Pay special attention to child resources under `/tickets/:id/*` that may bypass the protections present on `/tickets/:id`.
  - Files: `artifacts/api-server/src/routes/tickets.ts`, `artifacts/api-server/src/routes/comments.ts`, `artifacts/api-server/src/routes/notes.ts`, `artifacts/api-server/src/routes/activity.ts`, `artifacts/api-server/src/routes/attachments.ts`, `artifacts/ticketing/src/pages/TicketDetail.tsx`, `artifacts/mobile/app/ticket/[id].tsx`
  - Acceptance: Confirm whether authenticated non-admin or cross-org users can read or mutate ticket data they should not access, then write grouped findings.

### T003: Validate storage and attachment exposure
- **Blocked By**: []
- **Details**:
  - Inspect object storage download paths, private-vs-public object handling, and how attachment metadata turns into downloadable URLs.
  - Determine whether object ACL hooks exist but are unenforced in production routes.
  - Files: `artifacts/api-server/src/routes/storage.ts`, `artifacts/api-server/src/lib/objectStorage.ts`, `artifacts/api-server/src/routes/attachments.ts`, `artifacts/ticketing/src/pages/TicketDetail.tsx`
  - Acceptance: Confirm whether private uploaded files are publicly retrievable or guessable to authenticated/unauthenticated users, then write findings.

### T004: Validate residual route-level issues and scanner calibrations
- **Blocked By**: []
- **Details**:
  - Review the remaining higher-risk routes for exploitable findings that are not already covered, especially `users.ts`, `stripe.ts`, `settings.ts`, and obvious scanner hits.
  - Confirm whether the raw SQL construction in `users.ts` is attacker-controlled in practice.
  - Files: `artifacts/api-server/src/routes/users.ts`, `artifacts/api-server/src/routes/stripe.ts`, `artifacts/api-server/src/routes/settings.ts`, `artifacts/api-server/src/routes/stats.ts`
  - Acceptance: Either produce additional findings with evidence or explicitly rule out noisy scanner results.
