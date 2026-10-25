---
name: Mobile client note history
description: The expected scope for client notes in the mobile app.
---

The mobile client detail should expose the separate client-note history, including reading, adding, editing, and deleting notes. Existing checklist notes should remain understandable and their completion state should remain usable.

**Why:** The user confirmed that the mobile app needs the same client-note history, not only the single basic notes field attached to a client.

**How to apply:** Reuse the existing client-note API and preserve its server-side ownership, role, and group-permission checks.
