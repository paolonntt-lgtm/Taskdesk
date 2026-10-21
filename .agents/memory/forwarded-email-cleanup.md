---
name: Forwarded email presentation
description: User preference for preserving and visually organizing forwarded email text in ticket descriptions.
---

Preserve the complete original email body when creating a ticket. In the ticket UI, emphasize the actual message text and visually de-emphasize metadata, signature, legal footer, and quoted thread; do not remove those sections from the stored email. For long quoted chains, render each detected reply as its own readable block with a divider and avoid cumulative quote indentation.

**Why:** Forwarded emails can contain many nested replies, but the user prefers retaining the complete original content and improving readability with visual hierarchy rather than deleting or compressing it.

**How to apply:** Apply visual distinction to future ticket descriptions while preserving all message text; flatten mail-client quote markers only in the rendered view. Do not rewrite historical tickets unless the user explicitly asks.
