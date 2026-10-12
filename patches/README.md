# Dependency security patches

Install with `pnpm install --frozen-lockfile`. The `patchedDependencies` entries
in `pnpm-workspace.yaml` apply these patches to every matching consumer. Do not
remove the patches until an upstream release fixes the corresponding advisory.

| Package | Advisory | Local fix |
| --- | --- | --- |
| braces 3.0.3 | GHSA-vfj7-8cjw-p6xm | Limit brace and parenthesis nesting before parsing; iteratively validate directly supplied ASTs before compilation, expansion, and stringification. Excessive nesting fails with a controlled SyntaxError instead of exhausting the native stack. |
| node-forge 1.4.0 | GHSA-86w9-cpqp-85rv | Require DigestAlgorithm to contain exactly an OID and optional empty NULL, rejecting trailing or malformed ASN.1 fields before signature comparison. |
| sprintf-js 1.0.3 | GHSA-hp3w-g68c-fv3c | Bound numeric precision to ECMAScript's supported range (0–100 for e/f, 1–100 for g), preventing formatter RangeError exceptions. |

These packages had no patched upstream release at the time of remediation.
Version-only audits still report their original versions; those findings are
**not suppressed**. Their remediation is recorded here and verified against the
installed consumer paths by `pnpm run test:dependency-security`, including the
reported attack cases and valid-input compatibility.

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
