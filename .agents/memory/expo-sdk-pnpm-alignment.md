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

EAS Workflows can have a separate pnpm version from EAS Build. Set the exact version under workflow `defaults.tools.pnpm`, and install then verify it in `before_install_node_modules` when the actual dependency-install worker still exposes an older pnpm; this applies to build, fingerprint, and update jobs.

**Why:** The EAS worker exposed pnpm 8.7.5 and 9.8.1, and the frozen install still rejected the lockfile despite the app manifest, build profile, and workflow `defaults.tools.pnpm` specifying pnpm 10.26.1. A pre-install hook can update the binary in the worker that performs the install.

**How to apply:** In each EAS workflow that installs workspace dependencies, pin `defaults.tools.pnpm` to the lockfile-compatible version. If logs show the install worker still uses another version, install the pinned pnpm globally in `before_install_node_modules`, print and assert its version, and keep frozen-lockfile checks enabled.

Pin `defaults.tools.node` to Node 22 in EAS workflows that run fingerprinting or the EAS CLI. EAS CLI versions may raise their minimum Node requirement; verify the selected runtime in the pre-install hook before fingerprint generation.

**Why:** The fingerprint worker used Node 18.18.0 with EAS CLI 27.7.2, which requires Node 20.18.3 or Node 22+. It failed in `fingerprint:generate` with `tracingChannel` missing, before any OTA update could publish.

**How to apply:** For workflow jobs using EAS CLI/fingerprinting, pin `defaults.tools.node` to 22 and print/check the Node major in `before_install_node_modules`. Keep the native build profile's runtime aligned separately if its build worker has a distinct Node configuration.
