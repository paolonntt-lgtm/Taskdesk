---
name: Development schema drift
description: Caution for applying Drizzle schema changes against the current development database.
---

Full Drizzle pushes surface unrelated differences in the clients and organizations tables. A `tablesFilter` or partial schema can still produce unrelated DDL, including drops of sequences owned by omitted tables. Review every proposed statement before applying schema changes; never use force.

**Why:** The development database contains schema state that does not fully match the checked-in Drizzle definitions, so a seemingly narrow update can propose unrelated constraints or column changes.

**How to apply:** Use strict/verbose output to inspect the complete DDL. Do not confirm a partial-schema push if it proposes changes to omitted tables or sequences. Before applying narrow DDL directly, confirm the SQL tool targets the same development database as the app; then verify required dependencies and apply only the reviewed addition. Never assume a filter is safe without checking its generated changes.
