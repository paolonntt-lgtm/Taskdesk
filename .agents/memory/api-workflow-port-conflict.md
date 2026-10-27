---
name: API workflow port conflict
description: Behavior to check when the managed API workflow fails to bind its configured port.
---

If the API workflow fails with `EADDRINUSE` on port 8080, an older development server may still be listening even though the managed workflow is marked failed. The health endpoint can still return successfully from that older process.

**Why:** A restart can launch a second server without stopping a detached process from an earlier run.

**How to apply:** Check the listener and `/api/healthz` before changing application code. Stop only the confirmed stale API process, then restart the managed workflow once.
