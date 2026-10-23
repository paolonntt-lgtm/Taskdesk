---
name: Replit preview Safe Browsing warnings
description: Handling Chrome Safe Browsing warnings on Replit development preview URLs.
---

When Chrome marks a Replit preview as a dangerous site, do not ask the user to bypass the warning or enter credentials. Check the HTTPS certificate and Google's Safe Browsing status for both the full development hostname and the exact app path. A hostname-level warning can coexist with a clean app path; this does not establish that the warning is false.

**Why:** The TaskDesk preview hostname was reported unsafe at the host level while its exact app path reported no unsafe content; HTTPS itself validated successfully.

**How to apply:** Treat the warning as a separate trust blocker from OAuth/MSAL errors. Prefer a verified, unflagged published domain only after the current build is deployed there, and request a Safe Browsing review for the flagged preview host rather than disabling browser protection.
