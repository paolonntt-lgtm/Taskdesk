---
name: Microsoft SPA token redemption
description: Microsoft Entra SPA registrations require Origin on server-side token endpoint requests.
---

When redeeming Microsoft authorization codes for a client registered as a Single-Page Application, include an `Origin` header matching the registered redirect URI origin. Apply the same origin requirement to server-side refresh-token requests.

**Why:** Microsoft rejects backend token requests without `Origin` for SPA client types, even when PKCE is used and sign-in has succeeded.

**How to apply:** Use the callback URI origin during code exchange and the canonical app origin during refresh; verify both against the Entra SPA redirect URI configuration.
