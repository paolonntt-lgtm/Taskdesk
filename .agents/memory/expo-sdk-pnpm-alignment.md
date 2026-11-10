---
name: Expo SDK alignment in this workspace
description: Keep Expo SDK and EAS builds aligned with pnpm workspace and lockfile behavior.
---

Keep patch records intact. Expo CLI's `install --fix` child can reject unrelated workspace patches; use the exact compatibility versions it prints in a package-local `pnpm add --config.allowUnusedPatches=true` command. EAS Android prebuild also reruns `pnpm install --no-frozen-lockfile` against the mobile workspace subset, so keep `allowUnusedPatches: true` in the root workspace settings when other packages' patch entries are absent from that subset. This only tolerates unused entries; patch application failures must remain fatal.

**Why:** Expo CLI's child process did not inherit a command-line override, and EAS's second, filtered install ignored the preview-profile npm config override. The root workspace setting allowed the EAS install to proceed without deleting patches used by other artifacts.

**How to apply:** Upgrade Expo first and run `expo install --fix`; if its package add fails on unused patches, copy the emitted package list exactly into a package-local add command with `--config.allowUnusedPatches=true`. For EAS builds of a filtered workspace app, use the root `allowUnusedPatches` workspace setting rather than removing shared patches. Then rerun `expo install --check`, typecheck the app package, and verify platform exports.

For EAS builds targeting the nested mobile app, declare the same exact `packageManager` version in `artifacts/mobile/package.json` as the monorepo root and build profiles. In this workspace, EAS used its preinstalled pnpm 8.7.5 despite the root/profile pin to 10.26.1, ignored the pnpm 10 lockfile, and failed frozen installation. The nested manifest pin fixed the build; include that manifest in the EAS workflow's path filters so changes trigger a new build.

**Why:** EAS's initial dependency installation can select pnpm from the nested app manifest rather than the monorepo root or build profile, leaving a newer lockfile incompatible.

**How to apply:** If EAS reports an incompatible lockfile, compare the actual pnpm version in the worker log with the lockfile version. For nested workspace apps, align `packageManager` in the app manifest and ensure build workflow triggers include it; keep frozen-lockfile enabled.

EAS Workflows `fingerprint` and `update` jobs can still use the worker's preinstalled pnpm even when EAS Build uses the profile-pinned version. Use each job's `before_install_node_modules` hook to install the workspace's exact pnpm version and verify it before dependency installation.

**Why:** The OTA workflow's dependency installation ran before fingerprinting or publishing and rejected the lockfile despite the successful preview APK build.

**How to apply:** For EAS Workflows jobs that install workspace dependencies, set up and verify the same pnpm version in `before_install_node_modules`; do not disable frozen-lockfile checks.
