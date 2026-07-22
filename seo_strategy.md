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
- Public site is implemented as a Vite + React SPA in `artifacts/landing` using `react-helmet-async` for route-level metadata.
- Route-specific metadata and page content are therefore JavaScript-rendered unless a pre-render/SSR step is added.
- Authenticated app content is intentionally out of scope for SEO scanning.
