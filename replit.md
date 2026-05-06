# Workspace

## Overview

pnpm workspace monorepo using TypeScript. TaskDesk — sistema di ticketing aziendale interno con React + MUI frontend, Express backend, PostgreSQL. Supporto multi-lingua IT/EN tramite LanguageContext + translations.ts. Note interne rimosse. Dashboard responsive con stat card 2×2 su mobile e lista ticket al posto delle tabelle.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Material UI (MUI) + TanStack Query v5
- **Charts**: Recharts

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Sistema Ticketing Aziendale (`artifacts/ticketing`)
- **Type**: React SPA (Vite)
- **Language**: Italian UI
- **Auth**: Cookie-based sessions (bcryptjs-hashed passwords, rounds=12, with legacy SHA-256 auto-upgrade on login)
- **Demo users** (seed): `admin@example.com` / `admin123`, `utente@example.com` / `user123`
- **Demo users** (seedDemo route): `demo.admin@taskdesk.it` / `Demo2024!`

### API Server (`artifacts/api-server`)
- **Port**: 8080 (proxied via `/api`)
- **Sessions**: In-memory Map in `src/lib/session.ts`
- **Seed**: Auto-seeds demo data on first start via `src/lib/seed.ts`
- **Routes**: `/api/auth/*`, `/api/tickets/*`, `/api/users/*`, `/api/stats/*`, `/api/notifications/*`, `/api/notification-preferences`, `/api/stripe/*`
- **Email**: via Resend integration. Helper `src/lib/email.ts` legge le credenziali dal connector Replit (timeout 5s). `src/lib/notifications.ts` invia email in batch da 4 ogni 1.1s per rispettare il limite Resend di 5 req/sec; il dispatch è fire-and-forget rispetto alla risposta HTTP. Mittente configurato in Resend deve essere su un dominio verificato (es. `taskdesk.it`), altrimenti gli invii falliscono con 403.
- **Base URL**: `src/lib/appUrl.ts` espone `appBaseUrl()` (REPLIT_DOMAINS → REPLIT_DEV_DOMAIN → localhost) usato sia per i link nelle email che per le redirect Stripe Checkout/Portal.

### Stripe Plans
- Starter €9/mese (5 utenti), Team €25/mese (15 utenti), Business €69/mese (50 utenti), Enterprise €149/mese (utenti illimitati). Metadata `seats` su ogni Product (`unlimited` per Enterprise).

## Architecture Notes

### Auth Flow
- `AppShell` in `artifacts/ticketing/src/App.tsx` manages auth state via plain `fetch("/api/auth/me")`
- `AuthContext` (contexts/AuthContext.tsx) exports `AuthContext` and `useAuth` hook
- No route-based auth gate — `AppShell` renders either `<Login>` or `<Layout>` based on user state

### Backend SQL
- Use `inArray()` from `drizzle-orm` for `WHERE id IN (...)` queries — NOT `sql\`id = ANY(...)\``
- Array params in raw `sql\`\`` template tags do NOT work in Drizzle

### Generated API Client
- Located in `lib/api-client-react/src/generated/api.ts`
- Regenerate with: `pnpm --filter @workspace/api-spec run codegen`
- Post-codegen fix: script overwrites `lib/api-zod/src/index.ts` to remove duplicate exports from `./generated/types` (orval generates both zod schemas and TS types with same names)
- All hooks: `useListTickets`, `useGetTicket`, `useCreateTicket`, `useUpdateTicket`, `useListTicketComments`, `useAddTicketComment`, `useListTicketNotes`, `useAddTicketNote`, `useListTicketActivity`, `useListNotifications`, `useMarkAllNotificationsRead`, `useGetDashboardStats`, `useGetRecentTickets`, `useGetMyTickets`, `useGetStatsByStatus/Category/Location/Priority/Assignee`, `useGetTicketTrend`, `useListUsers`, `useCreateUser`, `useUpdateUser`, `useDeleteUser`

### Codegen Note (zod duplicate export fix)
The `lib/api-spec/package.json` codegen script runs orval and then immediately overwrites `lib/api-zod/src/index.ts` with only `export * from './generated/api'` to avoid TS2308 ambiguity errors caused by orval generating both zod schemas (`generated/api.ts`) and TypeScript types (`generated/types/`) with the same exported names.

### TaskDesk Mobile (`artifacts/mobile`)
- **Type**: Expo (React Native) — iOS, Android, Web
- **Port**: 18115 (Expo Dev Server)
- **Auth**: Cookie-based sessions, stessa API del backend `/api/auth/*`
- **Screens**: Login/Register, Dashboard, Lista Ticket, Nuovo Ticket, Profilo
- **Stack screens**: Dettaglio ticket (`/ticket/[id]`)
- **Design**: IBM Blue (#0f62fe), Inter font — sincronizzato con il tema del ticketing web
- **API**: fetch diretto con `credentials: "include"`, base URL da `EXPO_PUBLIC_DOMAIN`
- **Scan QR**: Disponibile dal menu URL bar per testare su device fisico via Expo Go

## Features Implemented
- ✅ Login / Logout con ruoli (admin / utente)
- ✅ Dashboard con statistiche e ticket recenti
- ✅ Lista ticket con ricerca full-text e filtri (stato, priorità)
- ✅ Dettaglio ticket con commenti, note interne (solo admin), cronologia attività
- ✅ Creazione nuovo ticket
- ✅ Modifica stato/priorità/assegnatario (solo admin)
- ✅ Notifiche in-app (badge + menu)
- ✅ Report con grafici (Recharts): trend, per stato, categoria, priorità, sede, operatore
- ✅ Tema chiaro/scuro con persistenza localStorage
- ✅ UI completamente in italiano
- ✅ Dati demo pre-caricati (11 ticket, commenti, note, attività)
- ✅ Gestione Utenti (solo admin): crea, modifica, disattiva utenti con tabella MUI + dialog + conferma disattivazione
