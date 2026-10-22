# Dependency security patches

Install with `pnpm install --frozen-lockfile`. The `patchedDependencies` entries
in `pnpm-workspace.yaml` apply these patches to every matching consumer. Do not
remove the patches until an upstream release fixes the corresponding advisory.

| Package | Advisory | Local fix |
| --- | --- | --- |
| braces 3.0.3 | GHSA-vfj7-8cjw-p6xm | Limit brace and parenthesis nesting before parsing; iteratively validate directly supplied ASTs before compilation, expansion, and stringification. Excessive nesting fails with a controlled SyntaxError instead of exhausting the native stack. |
| node-forge 1.4.0 | GHSA-86w9-cpqp-85rv | Require DigestAlgorithm to contain exactly an OID and optional empty, primitive, universal NULL, rejecting trailing fields and malformed ASN.1 tags before signature comparison. |
| sprintf-js 1.0.3 | GHSA-hp3w-g68c-fv3c | Bound numeric precision to ECMAScript's supported range (0–100 for e/f, 1–100 for g), preventing formatter RangeError exceptions. |

These packages had no patched upstream release at the time of remediation.
Version-only audits still report their original versions; those findings are
**not suppressed**. Their remediation is recorded here and verified against the
installed consumer paths by `pnpm run test:dependency-security`, including the
reported attack cases and valid-input compatibility.

Run that test after restoring a dependency cache as well: a patched snapshot
name in the lockfile is not proof that cached on-disk files contain the patch.
If a restored installation fails these tests, reinstall the locked packages with
`pnpm install --frozen-lockfile --force --ignore-scripts` and rerun the tests.
Consumer checks cover micromatch brace expansion, argparse help rendering, and
Expo manifest signing as well as the dependency APIs directly.

The Vite launch-editor advisories (GHSA-587h-7wmj-h5pm,
GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw) are fixed by Vite 7.3.7.
Markdown-it 14.3.3 fixes GHSA-gfr2-rv44-r23c, GHSA-r7fv-28h4-cvq7,
and GHSA-vfgh-jcmw-g37q. Its regression checks render through TypeDoc's
active Orval dependency path, including hostile references, smart quotes,
and all four unterminated HTML constructs in a time-limited child process.
Keep Markdown-it 14 on its supported Linkify-it 5 API: 5.0.2 includes the
published denial-of-service fixes, while forcing Linkify-it 6 breaks rendering.
Legacy sprintf and Metro patches may remain unused after framework upgrades;
tests must use the active lockfile consumers rather than leftover store copies.

The other findings are addressed through published patched versions. Workspace
overrides are centralized in `pnpm-workspace.yaml`: root `package.json` overrides
take precedence over that file and must not be reintroduced as a separate list.

The Metro 0.83.3 and 0.83.7 patches are compatibility adaptations for the
image-size 2 security upgrade. That API accepts bytes rather than file paths.
Metro now reads image bytes before requesting dimensions (including zipped
assets), leaving non-image assets unchanged. Regression tests exercise the real
`getAssetData` path in both Metro versions.

Native optional dependencies must remain in the lockfile for every platform
supported by their parent. Do not exclude macOS, Windows, or musl binaries from
security overrides. The dependency-security tests verify these parent-to-binary
relationships; frozen installation with `--force --ignore-scripts` can also
verify that non-host binary packages are retrievable without executing them.
