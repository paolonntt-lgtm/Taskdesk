# SEO Strategy

## In scope
- Public marketing landing pages in `artifacts/landing`, including `/it/`, `/en/` and six profession-specific pages per locale (accountants, lawyers, labour consultants, notaries, commerce and agencies)
- Public Italian legal pages in `artifacts/landing` (`/it/privacy-policy`, `/it/terms`, `/it/dpa`, `/it/cookie-policy`)
- Crawlability assets for the landing site (`robots.txt`, sitemap files, favicon/manifest assets, social metadata, `llms.txt`)

## Out of scope
- Authenticated ticketing app routes under `/app/**`
- Admin and internal dashboard surfaces in `artifacts/ticketing`
- Mobile app routes in `artifacts/mobile`

## Target audience
- Italian accounting firms, agencies, and consultants evaluating TaskDesk
- Secondary English-speaking visitors viewing the public landing site

## Primary keywords
- task management / ticketing software for accounting firms
- software for studi commerciali
- gestione pratiche clienti
- ticketing per agenzie

## Dismissed categories
- (None yet)

## Notes
- Public site in `artifacts/landing` is built with Vite + React, but public routes are prerendered to static HTML by `prerender.mjs` and served by `server.mjs`.
- The primary SEO risk is no longer Google-only JavaScript rendering; it is the correctness of the prerendered HTML, localized route handling, and crawlability assets.
- Indexable routes are `/it/`, `/en/`, plus six paired Italian/English profession pages from `src/profession-routes.ts`, all prerendered and sitemap-listed.
- Legal routes are intentionally `noindex`, excluded from the generated sitemaps, and intended to canonicalize to the Italian URLs only.
- Authenticated app content is intentionally out of scope for SEO scanning.
- Cloudflare source evidence concerns inbound email routing only; it does not establish that the public website uses Cloudflare bot filtering.
- The landing site includes a service worker and install prompt; declared custom favicon and home-screen icons are in scope.
