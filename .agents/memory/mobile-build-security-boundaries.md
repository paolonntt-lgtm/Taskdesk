---
name: Mobile build and public client configuration
description: Expo native manifests and Firebase client configuration are public by design, while Metro builds currently contend for a fixed preview port.
---

Expo native manifests and Firebase client configuration can contain public client identifiers, so credential scans should continue checking them for private keys and server secrets while excluding only the known public API-key fields. They must still be restricted at the provider where possible.

**Why:** Treating every Firebase client key as a server secret blocked valid mobile builds, while ignoring the whole file would hide a real credential if one were accidentally added.

**How to apply:** Keep the scanner narrowly scoped to the public configuration fields and keep provider-side application/API restrictions. The mobile static build currently uses Metro port 8081; running it while the mockup preview owns that port makes Expo prompt for another port and time out in non-interactive mode.