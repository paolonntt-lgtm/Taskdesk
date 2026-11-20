---
name: SMTP DNS pinning
description: Safe SMTP connections when hostnames are user-configurable.
---

For outbound SMTP, resolve the configured hostname once, reject the request if any returned address is restricted, and connect Nodemailer directly to one of the validated numeric addresses. Preserve the canonical hostname separately as TLS `servername` so SNI and certificate verification still use the configured service name.

**Why:** The installed Nodemailer SMTP connection builds its socket-resolution options without forwarding a custom `lookup` callback from the transport configuration. A callback that appears to pin DNS at the transport layer may therefore be ignored, leaving a validation-to-connect re-resolution gap.

**How to apply:** Verify the installed Nodemailer connection path before relying on custom DNS options. Prefer a validated numeric `host` plus explicit `servername`, and fail closed on DNS errors or mixed public/restricted answers.
