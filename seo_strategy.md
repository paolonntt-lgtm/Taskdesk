# SEO Strategy

## In scope
- Public marketing landing pages in `artifacts/landing`
- Public legal pages in `artifacts/landing` (`/privacy-policy`, `/terms`, `/dpa`, `/cookie-policy` and their localized variants)
- Crawlability assets for the landing site (`robots.txt`, sitemap files, favicon/manifest assets, social metadata)

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
- Public site in `artifacts/landing` is built with Vite + React, but public routes are now prerendered to static HTML by `prerender.mjs` and served by `server.mjs`.
- The primary SEO risk is no longer Google-only JavaScript rendering; it is the correctness of the prerendered HTML, localized route handling, and crawlability assets.
- The main indexable landing pages are `/it/` and `/en/`; legal routes are intentionally `noindex` and excluded from the generated sitemaps.
- Authenticated app content is intentionally out of scope for SEO scanning.
