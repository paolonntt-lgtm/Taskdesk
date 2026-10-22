---
name: Client email matching
description: Product rules for resolving inbound email to client profiles, including forwarded messages and conflicts.
---

Use this matching order for inbound email:

1. Respect explicit sender rules, addresses stored on client profiles, and associations learned when a user links a ticket to a client.
2. If a match conflicts across clients, do not guess or silently choose one.
3. For forwarded messages, consider the original sender only when the outer sender has no explicit match.
4. Keep the external/forwarding sender in the ticket for replies and traceability.
5. Ensure the client name appears exactly once as the ticket-title prefix.

**Why:** Incorrect client matching and duplicated title prefixes have caused real ticket-routing mistakes.

**How to apply:** Use these rules across inbound email processing, client-profile editing, and any future sender-association UI.
