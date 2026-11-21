---
name: React Query polling tests
description: Test setup for verifying periodic refetch behavior in this Expo workspace.
---

Run tests that exercise React Query's periodic refetch behavior in a browser-like environment such as jsdom. Query core detects server rendering when `window` is absent and intentionally disables its interval timers in Node. When testing intervals with `refetchIntervalInBackground: false`, also set the query focus manager to focused so the fake timer can trigger a refresh.

**Why:** A Node-environment test may pass its initial fetch but never schedule a periodic fetch, making polling assertions misleading.

**How to apply:** Use jsdom for tests that verify `refetchInterval` timing or screen-level query polling, and explicitly control query focus when using fake timers.
