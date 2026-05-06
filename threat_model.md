# Threat Model

## Project Overview

TaskDesk is an internal ticketing platform with a React web client, an Expo mobile client, an Express 5 API, and a PostgreSQL database accessed through Drizzle ORM. Users authenticate with cookie-backed sessions and can create, view, comment on, and administer tickets; admins can also manage users, organization settings, invitations, billing, and Stripe-backed subscriptions. Production scope for this scan is the Express API under `artifacts/api-server/src`, plus the web and mobile clients insofar as they expose or depend on production API behavior.

## Assets

- **User accounts and sessions** — email addresses, password hashes, session cookies, password reset tokens, invite tokens, and OAuth login state. Compromise allows impersonation and privilege abuse.
- **Ticket data** — ticket descriptions, comments, attachments, activity logs, assignee data, and internal notes. This contains operationally sensitive business data and internal troubleshooting details.
- **Organization-scoped administrative data** — users, roles, billing details, settings, seat counts, and superadmin visibility into subscribers. Compromise would break tenant isolation and administrative control.
- **Payment and integration data** — Stripe customer/subscription identifiers and Resend or Google OAuth connector credentials. Misuse can create fraudulent billing actions or abuse third-party integrations.
- **Application secrets and backend connectivity** — database credentials, connector secrets, and object storage access. Exposure would permit wider backend compromise.

## Trust Boundaries

- **Browser/mobile to API** — all client input crosses into the Express API and must be treated as untrusted.
- **Authenticated user to admin/superadmin capabilities** — client-side role gating is not authoritative; the API must enforce role and organization boundaries server-side.
- **Organization to organization** — ticketing data, users, settings, attachments, and reports are tenant-scoped and must not cross organization boundaries.
- **API to PostgreSQL** — route handlers can read and mutate all application data; injection or missing authorization at this layer has full business impact.
- **API to object storage** — uploaded files and private object paths cross into a storage system with ACL support; storage routes must not expose private objects without explicit authorization.
- **API to external providers** — Stripe webhooks and API calls, Google OAuth exchanges, and Resend email delivery cross service boundaries and require integrity validation.
- **Internal/development to production** — `artifacts/mockup-sandbox`, local build scripts, and other dev-only helpers are out of scope unless a production request path reaches them. Assume `NODE_ENV=production` in deployed environments. Replit deployment TLS is handled by the platform.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, route mounting in `artifacts/api-server/src/routes/index.ts`.
- **Highest-risk server areas**: `artifacts/api-server/src/routes/{auth,oauth,passwordReset,invites,tickets,comments,notes,attachments,activity,stats,storage,users,stripe}.ts`, `artifacts/api-server/src/lib/{session,objectStorage,notifications}.ts`.
- **Public vs authenticated vs admin surfaces**: public/auth bootstrap routes include `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/google*`, `/api/stripe/products`, invite validation/registration, and storage object download routes; most ticket/user/settings surfaces are authenticated; admin boundaries should be enforced in `middlewares/auth.ts` and route handlers.
- **Dev-only areas usually ignored**: `artifacts/mockup-sandbox/**`, `artifacts/mobile/scripts/**`, and workflow/dev server helpers unless they are reachable from production traffic.

## Threat Categories

### Spoofing

TaskDesk uses opaque cookie sessions and Google OAuth login. The system must issue session identifiers with cryptographically strong randomness, bind OAuth flows to user-initiated state, and prevent attackers from forcing a victim browser into an attacker-controlled session. Password reset and invite flows must not allow impersonation through guessable or replayable tokens.

### Tampering

Authenticated users can create and update tickets, comments, attachments, profiles, and settings. The API must enforce which roles may mutate which fields, and it must validate that cross-entity references such as `ticketId`, `assignedTo`, attachment paths, and billing changes stay within the caller’s organization and privilege level. Client-side affordances such as hiding assignee pickers or internal-note tabs are not a security control.

### Information Disclosure

Ticket details, internal notes, comments, attachments, billing details, user records, and object storage contents are all sensitive organization-scoped data. Every read path must verify both authentication and tenant/role authorization, and private object storage paths must never become a bearer secret that grants unrestricted download access. Secondary convenience surfaces such as ticket search and dashboard stats must not reveal privileged internal-note text or raw `users` table rows.

### Denial of Service

The API exposes unauthenticated auth, OAuth, invite, and password-reset endpoints and authenticated search, reporting, upload, and external-integration paths. These routes must keep request sizes bounded, use timeouts on third-party calls, and avoid unbounded expensive operations that can be triggered repeatedly.

### Elevation of Privilege

This project has a clear user/admin/superadmin hierarchy. Server-side route handlers must enforce those privileges directly, not rely on frontend controls, and subordinate ticket resources such as comments, notes, activity, attachments, and object downloads must inherit the same organization and role restrictions as the parent ticket. All database writes must remain parameterized and any direct SQL usage must avoid attacker-controlled interpolation.
