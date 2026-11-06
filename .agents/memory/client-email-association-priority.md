---
name: Client email matching
description: Product rules for resolving inbound email to client profiles, including forwarded messages and conflicts.
---

Use this matching order for inbound email:

1. Automatically associate only through email or PEC addresses saved on a client profile in the same organization. An explicit `*@domain` entry in the profile's email field is allowed; never infer a match from names, aliases, sender history, or a separate domain rule.
2. If multiple client profiles claim the same address, do not guess or silently choose one. An address may be shared by different companies.
3. For forwarded messages with a distinct original sender, match that sender first. If they are unmatched or ambiguous, leave the ticket without a client for manual assignment rather than falling back to the forwarding account's client. Use the outer sender only when the original sender could not be identified.
4. Keep the external/forwarding sender in the ticket for replies and traceability; manual ticket assignment does not silently change future matching.
5. Ensure the client name appears exactly once as the ticket-title prefix.

**Why:** The user reported that a forwarded request was assigned to the forwarding account's client instead of the original customer's client. Profile-only matches must prioritize the original sender when available; if that sender is unknown, automatic fallback to the forwarding account can still select the wrong company, so provide a manual assignment path. Shared addresses are not proof of a unique client, and saved legacy suggestions must not be treated as confirmed or changed automatically. An administrator's manual ticket assignment must not silently become a future matching rule; adding a sender to the profile is an explicit opt-in.

**How to apply:** Use these rules across inbound email processing, client-profile editing, and sender-association UI. Show a client selector for unassociated inbound tickets. Admins and non-admins may add an unknown sender to the selected client's email field only after explicitly choosing the add-and-link action; linking without adding must not learn it. Keep legacy learned sender and domain rules inactive, and preserve old suggestions unless the user explicitly asks to migrate or remove them.
