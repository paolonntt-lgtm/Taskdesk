---
name: Replit proxy X-Forwarded-Proto on healthchecks
description: The Replit deployment proxy adds X-Forwarded-Proto: http to startup health check probes, causing HTTPS redirect middleware to return 301 instead of 200.
---

The HTTPS-redirect middleware pattern `if (req.headers["x-forwarded-proto"] === "http") → 301` breaks production healthchecks on Replit autoscale deployments.

**Why:** The Replit deployment proxy forwards health check probes to backend services over plain HTTP and includes `X-Forwarded-Proto: http`. The server's production redirect middleware catches this and returns 301. The deployment system treats any non-200 as a failed probe → crash loop → promote step fails.

**How to apply:** Always exempt the health check path before the redirect check:
```typescript
if (req.path === "/api/healthz") return next();
if (req.headers["x-forwarded-proto"] === "http") return res.redirect(301, ...);
```

This is required in `app.ts` whenever `NODE_ENV=production` enables an HTTPS redirect middleware. Without it, every production publish will fail at the promote step with a crash loop and HTTP 500 errors in deployment logs (those "500" errors are actually 301s that the probe system converts to failure).
