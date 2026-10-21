---
name: Inbound email client titles
description: Naming and selector behavior for email tickets associated with clients.
---

When an inbound email ticket is associated with a client, format its title as `Client name — original subject`. Keep the original subject intact. Once the title has this prefix, do not show the client name or selector anywhere else in the ticket detail.

**Why:** The user chose the client name as a title prefix to make ticket ownership clear without losing the email subject, and specified the title should be the only place the client name appears within the ticket.

**How to apply:** Apply consistently to automatic exact-email matches, manually saved sender associations, and confirmed domain suggestions. Legacy linked tickets without the prefix should still offer a way to apply it once; after the prefix is present, hide the entire client field block.
