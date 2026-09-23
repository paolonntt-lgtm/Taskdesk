---
name: OpenAPI client generation compatibility
description: Compatibility constraints between the workspace OpenAPI generator output and its TypeScript/Zod consumers.
---

The current OpenAPI generator output targets Zod 4 APIs and uses iterable `Headers` helpers in the React client. The generated packages must therefore resolve Zod 4 and include `dom.iterable` in the client compiler libraries.

**Why:** Regenerating after the generator upgrade can silently expose stale dependency/compiler assumptions: Zod 3 does not provide the generated `zod.int()` API, and the default DOM typings do not expose `Headers.entries()`.

**How to apply:** Before regenerating OpenAPI clients, check that the Zod version used by the generated schema package and the TypeScript `lib` settings for the React client match the generator output. Treat a generator upgrade as a coordinated toolchain change, not only a schema edit.

Generated files can receive extra blank lines at EOF after codegen, and Orval may report nullable `$ref` warnings while still producing valid output.

**Why:** The repository's `git diff --check` treats those generated trailing lines as errors, while the nullable reference warning is informational for the current generator configuration.

**How to apply:** Run `git diff --check` after codegen and normalize only trailing whitespace; do not treat the nullable-reference warning alone as a failed generation.