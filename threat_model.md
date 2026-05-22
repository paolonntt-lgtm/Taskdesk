# Threat Model

## Project Overview

TaskDesk is a publicly deployed internal ticketing platform with a React web client, an Expo mobile client, an Express 5 API, and a PostgreSQL database accessed through Drizzle ORM. Users authenticate with cookie-backed sessions and can create, view, comment on, and administer tickets; admins can also manage users, organization settings, invitations, inbound/outbound email channels, billing, and Stripe-backed subscriptions. Production scan scope is the Express API under `artifacts/api-server/src`, plus the web and mobile clients only where they expose or depend on production API behavior.

## Deployment and Scope Assumptions

- The current deployment is public at `https://www.taskdesk.it`.
- Assume `NODE_ENV=production` for deployed behavior.
- Replit terminates TLS for deployed traffic; transport-layer certificate management is handled by the platform.
- `artifacts/mockup-sandbox/**`, local scripts, and other dev-only helpers are out of scope unless a production request path reaches them.

## Assets

- **User accounts and sessions** — email addresses, password hashes, session cookies, password reset tokens, invite tokens, OAuth login state, and any seeded/demo credentials reachable from production. Compromise allows impersonation and privilege abuse.
- **Ticket data** — ticket descriptions, comments, attachments, activity logs, assignee data, internal notes, inbound-email threading metadata, and client associations. This contains operationally sensitive business data and internal troubleshooting details.
- **Organization-scoped administrative data** — users, roles, groups, locations, settings, inbound/outbound email configuration, billing details, seat counts, and superadmin visibility into subscribers. Compromise would break tenant isolation and administrative control.
- **Payment and integration data** — Stripe customer/subscription identifiers, Resend or SMTP credentials, Google OAuth secrets, inbound-email webhook secrets, and seed/bootstrap secrets. Misuse can create fraudulent billing actions or abuse third-party integrations.
- **Application secrets and backend connectivity** — database credentials, connector secrets, object storage access, and any committed runtime tokens. Exposure would permit wider backend compromise.

## Trust Boundaries

- **Browser/mobile to API** — all client input crosses into the Express API and must be treated as untrusted.
- **Authenticated user to admin/superadmin capabilities** — client-side role gating is not authoritative; the API must enforce role and organization boundaries server-side.
- **Organization to organization** — ticketing data, users, clients, settings, attachments, email channels, knowledge-base content, and reports are tenant-scoped and must not cross organization boundaries.
- **Session bootstrap routes to authenticated state** — login, registration, invite completion, password reset, OAuth callbacks, and any demo/bootstrap routes that create accounts or sessions must resist CSRF and session-forcing attacks.
- **API to PostgreSQL** — route handlers can read and mutate all application data; injection or missing authorization at this layer has full business impact.
- **API to object storage** — uploaded files and private object paths cross into a storage system with ACL support; storage routes must not treat object paths as bearer secrets.
- **API to external providers** — Stripe webhooks and API calls, Google OAuth exchanges, inbound-email webhooks, SMTP/Resend email delivery, and OpenAI requests cross service boundaries and require integrity validation.
- **Internal/development to production** — committed config files, logs, and development helpers are out of scope unless they materially weaken a production path or expose production secrets.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, route mounting in `artifacts/api-server/src/routes/index.ts`.
- **Highest-risk server areas**: `artifacts/api-server/src/routes/{auth,oauth,passwordReset,invites,seedDemo,tickets,comments,notes,attachments,activity,stats,settings,storage,users,clients,stripe,inboundEmail,inboundChannels,emailChannels,superadmin,bot,knowledgeArticles}.ts`, `artifacts/api-server/src/lib/{session,objectStorage,notifications,ticketFromEmail,email}.ts`.
- **Public vs authenticated vs admin surfaces**:
  - Public/bootstrap routes include `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/google*`, `/api/invites/:token`, `/api/invites/:token/register`, `/api/seed-demo`, `/api/stripe/products`, `/api/stripe/webhook`, `/api/inbound-email`, `/api/healthz`, and storage public-object routes.
  - Authenticated routes include most ticket, comment, attachment, client, notification, profile, stats, and bot surfaces.
  - Admin or superadmin boundaries should be enforced in `middlewares/auth.ts` and route handlers for user management, billing/settings mutation, inbound/outbound email administration, knowledge articles, onboarding completion, and superadmin reporting.
- **Dev-only areas usually ignored**: `artifacts/mockup-sandbox/**`, `artifacts/mobile/scripts/**`, workflow/dev server helpers, and purely local seed helpers unless production traffic can reach them.

## Threat Categories

### Spoofing

TaskDesk uses opaque cookie sessions plus Google OAuth login. The system must issue session identifiers with cryptographically strong randomness, bind OAuth flows to the initiating browser, and prevent attackers from forcing a victim browser into an attacker-controlled session. Password reset, invite, inbound-email, and seed/bootstrap flows must not allow impersonation through guessable, replayable, or leaked secrets.

### Tampering

Authenticated users can create and update tickets, comments, attachments, profiles, clients, and some settings. The API must enforce which roles may mutate which fields, and it must validate that cross-entity references such as `ticketId`, `assignedTo`, `clientId`, attachment `objectPath`, inbound channel IDs, and billing changes stay within the caller’s organization and privilege level. Client-side affordances such as hiding admin screens are not a security control.

### Information Disclosure

Ticket details, internal notes, comments, attachments, client records, billing details, user records, knowledge-base articles, and object storage contents are all sensitive organization-scoped data. Every read path must verify both authentication and tenant/role authorization, and private object storage paths must never become a bearer secret that grants unauthorized download access. Secondary convenience surfaces such as stats, reports, bot context search, and attachment metadata must not reveal data outside the caller’s role or organization.

### Denial of Service

The API exposes unauthenticated auth, OAuth, invite, seed/bootstrap, Stripe webhook, and inbound-email endpoints, plus authenticated search, reporting, upload, AI, and email-integration paths. These routes must keep request sizes bounded, use timeouts on third-party calls, and avoid unbounded expensive operations that can be triggered repeatedly.

### Elevation of Privilege

This project has a user/admin/superadmin hierarchy. Server-side route handlers must enforce those privileges directly, not rely on frontend controls, and subordinate ticket resources such as comments, notes, activity, attachments, clients, knowledge-base content, and object downloads must inherit the same organization and role restrictions as the parent ticket. All database writes must remain parameterized and any direct SQL usage must avoid attacker-controlled interpolation.