---
name: Shared database project-reference refresh
description: TypeScript project references can keep API server declarations stale after a shared schema change.
---

After changing a shared database schema, rebuild the database project reference before typechecking dependent services.

**Why:** The API server can otherwise typecheck against an older generated declaration even when the workspace source file already contains the new column.

**How to apply:** Run the database package TypeScript build with a forced project-reference refresh, then run the dependent API server typecheck.