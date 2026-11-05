---
name: OAuth state in autoscale
description: Keep OAuth callback state valid when initiation and callback reach different server instances.
---

For OAuth flows served by autoscale, do not store pending state only in process memory. Prefer a signed, short-lived state payload that is also bound to a browser cookie; validate its signature and expiry on callback. Rely on the provider's single-use authorization code to prevent successful code replay.

**Why:** Autoscale may route the provider callback to a different instance than the one that initiated the flow, so an in-memory map causes intermittent state-validation failures.

**How to apply:** Use this for any OAuth provider flow in an autoscale service. Keep state contents limited to validated attribution and flow metadata, never credentials or personal secrets.
