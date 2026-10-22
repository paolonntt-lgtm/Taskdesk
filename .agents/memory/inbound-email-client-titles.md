---
name: Inbound email client titles
description: Client prefixes on associated email-ticket titles must remain unique and preserve the subject.
---

When an inbound email ticket is associated with a client, format its title with exactly one leading `Client name — original subject` prefix. Prefixing must be idempotent across repeated association attempts and reassignment; normalize repeated leading copies to one while preserving the original subject. After an inbound email ticket is associated, show the client as read-only and hide the client selector.

**Why:** The client name clarifies ticket ownership, but duplicated prefixes have appeared in a title and must never recur.

**How to apply:** Use the same normalization for automatic exact-email matches, manual sender associations, and confirmed domain suggestions. Replace the old client prefix on reassignment. Legacy linked tickets without the prefix should still offer a way to apply it once.
