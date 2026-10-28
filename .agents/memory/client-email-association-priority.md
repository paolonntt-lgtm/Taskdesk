---
name: Client email matching
description: Product rules for resolving inbound email to client profiles, including forwarded messages and conflicts.
---

Use this matching order for inbound email:

1. Automatically associate only through explicit sender rules, addresses stored on client profiles (including an explicit `*@domain` entry in the email field), and confirmed domain rules. Never infer a match or suggestion from company-name, alias, or domain similarity.
2. If a match conflicts across clients, do not guess or silently choose one.
3. For forwarded messages, consider the original sender only when the outer sender has no explicit match, and associate only on an explicit match.
4. Keep the external/forwarding sender in the ticket for replies and traceability.
5. Ensure the client name appears exactly once as the ticket-title prefix.

**Why:** Incorrect client matching and duplicated title prefixes have caused real ticket-routing mistakes.

**How to apply:** Use these rules across inbound email processing, client-profile editing, and any future sender-association UI.
