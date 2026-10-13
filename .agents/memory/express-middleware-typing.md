---
name: Express middleware typing
description: TypeScript route-handler inference when composing Express middleware.
---

Prefer a typed middleware function when shared middleware should run before many route handlers. With this project's Express and TypeScript configuration, passing a middleware array as the first route argument caused following handler parameters to infer as `any`; a single `RequestHandler` wrapper retained contextual typing.

**Why:** Strict type checking rejects implicit-any handlers, and the array overload can lose the contextual types the individual route callbacks depend on.

**How to apply:** When adding shared authorization or feature-gate middleware to a group of routes, use a typed wrapper or repeat middleware arguments directly rather than supplying an untyped handler array.
