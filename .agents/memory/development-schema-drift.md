---
name: Development schema drift
description: Caution for applying Drizzle schema changes against the current development database.
---

Full Drizzle pushes surface unrelated differences in the clients and organizations tables. Review every proposed statement before applying schema changes; never use force to bypass data-loss warnings.

**Why:** The development database contains schema state that does not fully match the checked-in Drizzle definitions, so a seemingly narrow update can propose unrelated constraints or column changes.

**How to apply:** Prefer the normal schema flow, inspect prompts and diff scope, and avoid truncation or unrelated table changes. If a targeted push is necessary, ensure the schema and filter include all relevant dependencies and do not assume the filter is safe without verifying its generated changes.
