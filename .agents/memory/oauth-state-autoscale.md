---
name: OAuth state in autoscale
description: Keep OAuth callback state valid when initiation and callback reach different server instances.
---

For OAuth flows served by autoscale, do not store pending state only in process memory. Prefer a signed, short-lived state payload that is also bound to a browser cookie; validate its signature and expiry on callback. Rely on the provider's single-use authorization code to prevent successful code replay.

Start the flow on the same canonical origin used by the provider callback. If a user starts from an allowed preview or alias host, redirect to the callback host before issuing the browser-bound cookie.

**Why:** Autoscale may route the provider callback to a different instance than the one that initiated the flow, so an in-memory map causes intermittent state-validation failures. A preview-origin initiation can also leave the nonce cookie on a host different from the fixed provider callback host, causing the first callback to fail while a retry from the canonical host succeeds.

**How to apply:** Use this for any OAuth provider flow in an autoscale service. Keep state contents limited to validated attribution and flow metadata, never credentials or personal secrets. Canonicalize the origin before creating the signed state and setting its cookie.
