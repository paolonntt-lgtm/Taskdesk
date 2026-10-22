---
name: Forwarded email presentation
description: User preference for preserving and visually organizing forwarded email text in ticket descriptions.
---

Preserve the complete original email body when creating a ticket. In the ticket UI, emphasize the actual message text, hide clearly recognized signatures and legal footers by default with an expand control, and visually de-emphasize metadata and quoted threads. Never remove hidden sections from the stored email. For long quoted chains, render each detected reply as its own readable block with a divider and avoid cumulative quote indentation.

**Why:** Forwarded emails can contain many nested replies and repetitive signatures, but the user prefers retaining the complete original content while reducing clutter in the default view.

**How to apply:** Apply visual distinction to future ticket descriptions while preserving all message text; flatten mail-client quote markers only in the rendered view. Only hide a signature/footer when detection is reliable, and keep an accessible way to reveal it. Do not rewrite historical tickets unless the user explicitly asks.
