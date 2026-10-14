---
name: Forwarded email cleanup
description: User preference for how forwarded emails should be cleaned when they arrive as new tickets.
---

For recognized forwarded messages, keep the useful message text and the original sender's name and role, but remove phone numbers, email addresses, links, legal footers, and older quoted messages. If the signature boundary is ambiguous, preserve content rather than aggressively truncating it.

**Why:** Forwarded emails arriving as tickets were cluttered with contact details, boilerplate, and old thread content. The user chose to retain only the message, name, and role.

**How to apply:** Use this rule for future inbound ticket creation. Do not rewrite historical tickets unless the user explicitly asks.
