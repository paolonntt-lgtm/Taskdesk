---
name: Validated .replit changes
description: Platform constraint for safely changing the root Replit configuration.
---

Changes to the root `.replit` configuration must be written to a temporary workspace file and applied through the platform's schema-validation replacement flow; direct edits are rejected.

**Why:** Replit validates the root configuration separately from normal workspace files and blocks direct file edits.

**How to apply:** When a task requires changing `.replit`, create the complete proposed TOML in a temporary file, validate and replace it through the provided platform callback, then remove the temporary file.