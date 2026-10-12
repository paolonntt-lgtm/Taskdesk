---
name: Dependency remediation policy
description: Security upgrade tradeoffs for unavailable upstream fixes and legacy mobile consumers.
---

Use published fixes when possible. When an upstream package has no patched
release and replacing its parent requires an unrelated framework migration,
keep a narrowly scoped, reproducible pnpm patch with exploit regression tests.
Do not rename packages, falsify versions, or suppress audit findings just to
make a version-only audit green. Explain the residual version-only findings.

**Why:** Several legacy Expo transitive dependencies had no published security
fix. Preserving their identity makes pending upstream fixes discoverable, while
tested local patches address the vulnerable behavior without migrating the
mobile framework.

**How to apply:** Test through actual consuming dependencies after a frozen
install. Major transitive upgrades need end-to-end consumer checks, especially
Metro image asset processing and native exports; importing the upgraded module
alone does not establish API compatibility.

Keep security overrides in one place: pnpm root package overrides replace,
rather than merge with, workspace overrides.

**Why:** Two separate override lists caused intended security pins to be
silently ignored.

**How to apply:** Inspect the resolved lockfile overrides whenever adding or
changing security pins, rather than trusting the configuration text alone.

Never turn platform-specific binary exclusions into an effective workspace
policy while consolidating overrides.

**Why:** Previously inactive binary exclusions became active when override
precedence was fixed, leaving native build tools available only for the current
Linux GNU host.

**How to apply:** Keep upstream optional binary dependencies for all supported
operating systems, architectures, and libc variants; check frozen installs for
non-host package availability as well as native builds on the current host.
