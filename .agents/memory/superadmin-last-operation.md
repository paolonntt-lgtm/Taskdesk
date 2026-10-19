---
name: Superadmin last operation
description: Product definition for showing the latest manual user operation in the superadmin panel.
---

In superadmin, “last operation” means the timestamp of the user's most recent successfully completed manual write action. Exclude automatic read/presence polling. Show the timestamp indefinitely, separate from the five-minute online indicator.

**Why:** The user explicitly distinguished manual operations from automatic checks and asked to see the date/time even when the operation happened hours or days earlier.

**How to apply:** Keep activity timestamps separate by meaning: login, last online, and last successful operation are not interchangeable. Do not add a recency cutoff to the last-operation value.
