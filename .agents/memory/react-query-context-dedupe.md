---
name: React Query context in Vite workspaces
description: Avoid split React Query contexts between an artifact and shared workspace packages.
---

In Vite artifacts that consume generated hooks from workspace packages, dedupe `@tanstack/react-query` alongside React and React DOM. Otherwise pnpm peer resolution can bundle separate React Query modules; a provider from one instance is invisible to hooks from another.

**Why:** A production login exposed “No QueryClient set” because the app provider and shared API client resolved separate React Query instances under different React peer versions.

**How to apply:** When React Query works before auth but fails when authenticated screens mount, compare package resolution paths and inspect Vite's `resolve.dedupe` before changing provider structure.
