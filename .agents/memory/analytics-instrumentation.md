---
name: Web analytics instrumentation
description: Replit-hosted analytics conventions for this project’s web artifacts.
---

Use the Replit-injected Umami tracker through a small local TypeScript wrapper in each web artifact. Do not add or configure the Replit tracker, website ID, or analytics environment variable; calls must be safe no-ops when it is absent. Any explicitly requested third-party tracker is a separate integration and must remain blocked until consent.

**Why:** Replit-hosted analytics owns pageviews and only supports website artifacts, so application code should report meaningful web interactions and outcomes without coupling product behavior to analytics availability.

**How to apply:** Keep event names in `snake_case`, use scalar dimensions only, and exclude the mobile artifact from the Replit tracker. If a third-party tracker is retained, load it only from the consent flow and remove/disable it when consent is revoked. Enable analytics and publish/republish before expecting Replit events in the analytics views.