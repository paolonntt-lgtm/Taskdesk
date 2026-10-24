---
name: EAS workflow discovery in the Taskdesk monorepo
description: Where EAS Workflows must live when the Expo app is in a repository subdirectory.
---

Keep EAS workflow YAML files in the repository-root `.eas/workflows/` for the Expo dashboard's Git-ref workflow selector. The Expo app itself remains in `artifacts/mobile`, configured as the repository Base directory.

**Why:** The dashboard's run-workflow dialog reported no files while the workflow YAML existed at `artifacts/mobile/.eas/workflows/`; it searched `.eas/workflows/` at the selected Git ref.

**How to apply:** In this monorepo, put EAS workflow definitions at repository root, retain app-relative GitHub path filters, and ensure the change is pushed to the linked Git ref before checking discovery.
