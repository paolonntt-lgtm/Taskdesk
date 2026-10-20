---
name: Expo SDK alignment in this workspace
description: Keep Expo SDK dependency alignment working with pnpm's strict workspace patch validation.
---

When Expo CLI's `install --fix` spawns `pnpm add` and fails on unused workspace patches, keep the patch records intact. Use the exact compatibility versions printed by Expo CLI in a package-local `pnpm add --config.allowUnusedPatches=true` command instead of weakening patch validation globally.

**Why:** Expo CLI's child pnpm process did not inherit the command-line patch-validation override in this workspace, while direct pnpm commands accepted the scoped override and preserved the root patch policy.

**How to apply:** Upgrade Expo first, run `expo install --fix`, and if its package add fails, copy its emitted package list exactly. Then rerun `expo install --check`, typecheck the app package, and verify platform exports.
