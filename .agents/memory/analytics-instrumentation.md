---
name: Web analytics instrumentation
description: Replit-hosted analytics conventions for this project’s web artifacts.
---

Use the Replit-injected Umami tracker through a small local TypeScript wrapper in each web artifact. Do not add an analytics script, website ID, environment variable, or send PII/free-form content; calls must be safe no-ops when the tracker is absent.

**Why:** Replit-hosted analytics owns pageviews and only supports website artifacts, so application code should report meaningful web interactions and outcomes without coupling product behavior to analytics availability.

**How to apply:** Keep event names in `snake_case`, use scalar dimensions only, and exclude the mobile artifact from this tracker. Enable analytics and publish/republish before expecting events in the analytics views.