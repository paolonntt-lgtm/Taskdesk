---
name: Replit proxy strips Set-Cookie on 302 redirects
description: The Replit deployment proxy removes Set-Cookie headers from 302 redirect responses, so cookies set during OAuth initiation are never received by the browser.
---

The Replit deployment proxy strips `Set-Cookie` headers from HTTP 302 redirect responses before they reach the browser. This breaks any flow that relies on setting a cookie during a redirect.

**Why:** Observed in production logs for Google OAuth flow — `hasCookie=false` on every callback despite the server correctly emitting `Set-Cookie` on the `/api/auth/google` → 302 response.

**How to apply:**
- Do NOT set cookies on 302 redirect responses in production Replit deployments — they will be silently dropped.
- For OAuth CSRF state binding: use a server-side in-memory Map with cryptographically-random state values (already single-use + TTL-expiring) instead of a cookie. This provides equivalent CSRF protection.
- For other flows that need cookies-on-redirect: redirect to an intermediate HTML page that sets the cookie via JavaScript, then redirects onward. Or avoid the pattern entirely.
