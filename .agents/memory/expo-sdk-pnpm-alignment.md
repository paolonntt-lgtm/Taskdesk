---
name: Expo SDK alignment in this workspace
description: Keep Expo SDK dependency alignment working with pnpm's strict workspace patch validation.
---

Keep patch records intact. Expo CLI's `install --fix` child can reject unrelated workspace patches; use the exact compatibility versions it prints in a package-local `pnpm add --config.allowUnusedPatches=true` command. EAS Android prebuild also reruns `pnpm install --no-frozen-lockfile` against the mobile workspace subset, so keep `allowUnusedPatches: true` in the root workspace settings when other packages' patch entries are absent from that subset. This only tolerates unused entries; patch application failures must remain fatal.

**Why:** Expo CLI's child process did not inherit a command-line override, and EAS's second, filtered install ignored the preview-profile npm config override. The root workspace setting allowed the EAS install to proceed without deleting patches used by other artifacts.

**How to apply:** Upgrade Expo first and run `expo install --fix`; if its package add fails on unused patches, copy the emitted package list exactly into a package-local add command with `--config.allowUnusedPatches=true`. For EAS builds of a filtered workspace app, use the root `allowUnusedPatches` workspace setting rather than removing shared patches. Then rerun `expo install --check`, typecheck the app package, and verify platform exports.
