---
name: Client email matching
description: Product rules for resolving inbound email to client profiles, including forwarded messages and conflicts.
---

Use this matching order for inbound email:

1. Automatically associate only through email or PEC addresses saved on a client profile in the same organization. An explicit `*@domain` entry in the profile's email field is allowed; never infer a match from names, aliases, sender history, or a separate domain rule.
2. If multiple client profiles claim the same address, do not guess or silently choose one.
3. For forwarded messages, use a matching profile contact for the outer sender first; only when that is unmatched may a matching profile contact for the original sender be used.
4. Keep the external/forwarding sender in the ticket for replies and traceability.
5. Ensure the client name appears exactly once as the ticket-title prefix.

**Why:** The user chose profile-only matching across organizations after a learned sender rule assigned emails from one intermediary to the wrong client. An administrator's manual ticket assignment must not silently become a future matching rule; adding a sender to the profile is an explicit opt-in.

**How to apply:** Use these rules across inbound email processing, client-profile editing, and sender-association UI. Admins and non-admins may add an unknown sender to the selected client's email field only after explicitly choosing the add-and-link action; linking without adding must not learn it. Keep legacy learned sender and domain rules inactive unless the user explicitly asks to migrate or remove them.
