---
name: Mobile production-domain 403
description: Diagnosing mobile API requests blocked on a custom domain before they reach the backend.
---

When a mobile device gets HTTP 403 from the custom production domain but the same API health endpoint works through the deployment's direct Replit URL, treat this first as a domain/edge-path issue. Check production logs to confirm whether the request reaches the API. Do not broadly relax CORS or same-origin protections based only on the status code.

**Why:** During Android push testing, the phone received 403 from the custom host while the direct Replit host returned a healthy response; no corresponding mobile request reached the application logs.

**How to apply:** Compare the API health endpoint on the affected device across the verified production URLs, then inspect backend logs before changing app authentication or origin allowlists.
