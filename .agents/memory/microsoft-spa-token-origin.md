---
name: Microsoft SPA token redemption
description: Microsoft Entra SPA registrations require Origin on server-side token endpoint requests.
---

Microsoft SPA authorization must use one explicitly configured callback URI that is registered in Entra; never derive it from the incoming request host. When redeeming the code, include an `Origin` header matching that callback's origin. Apply the same origin requirement to server-side refresh-token requests.

**Why:** Microsoft rejects backend token requests without `Origin` for SPA client types, even when PKCE is used and sign-in has succeeded. Preview and alias hosts can also differ from the redirect URI registered in Entra.

**How to apply:** Configure the canonical callback separately for each environment and register its exact URI in Entra. Use its origin during code exchange and the canonical app origin during refresh.
