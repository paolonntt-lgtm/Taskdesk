import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const store = path.join(root, "node_modules/.pnpm");
const lock = readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
const snapshots = lock.split("\nsnapshots:\n")[1];

function lockedVersions(name) {
  return [...snapshots.matchAll(/^  '?([^@\s][^:\n]*?)@([0-9][^(:'\n]*).*:\n/gm)]
    .filter(([, packageName]) => packageName === name)
    .map(([, , version]) => version);
}

// Resolve through consumers, not stale copies left in pnpm's virtual store.
function consumerRequire(name, version) {
  const directory = `${name.replaceAll("/", "+")}@${version}`;
  const installed = readdirSync(store).find(entry => entry.startsWith(`${directory}_patch_hash=`)) ??
    readdirSync(store).find(entry => entry === directory || entry.startsWith(`${directory}_`));
  assert.ok(readdirSync(store).includes(installed), `Missing consumer ${directory}`);
  return createRequire(path.join(store, installed, "node_modules", name, "package.json"));
}

const micromatch = consumerRequire("micromatch", "4.0.8")(".");
const braces = consumerRequire("micromatch", "4.0.8")("braces");
const forge = consumerRequire("@expo/code-signing-certificates", "0.0.6")("node-forge");
// Old virtual-store directories can survive upgrades. Only test legacy
// consumers when they remain in the current dependency graph.
const hasLegacySprintf = lockedVersions("sprintf-js").includes("1.0.3");
const { sprintf, vsprintf } = hasLegacySprintf
  ? consumerRequire("argparse", "1.0.10")("sprintf-js") : {};
const { ArgumentParser } = hasLegacySprintf
  ? consumerRequire("argparse", "1.0.10")(".") : {};
const expoCertificates = consumerRequire("@expo/code-signing-certificates", "0.0.6")(".");
const apiSpecRequire = createRequire(path.join(root, "lib/api-spec/package.json"));
const orvalRequire = createRequire(apiSpecRequire.resolve("orval"));
const orvalCoreRequire = createRequire(orvalRequire.resolve("@orval/core"));
const typedocRequire = createRequire(orvalCoreRequire.resolve("typedoc"));

test("braces preserves ordinary compilation, expansion, escaping and parentheses", () => {
  assert.equal(braces.compile("a/{b,c}/d"), "a/(b|c)/d");
  assert.deepEqual(braces.expand("{1..3}"), ["1", "2", "3"]);
  assert.deepEqual(braces.expand("a/{b,{c,d}}"), ["a/b", "a/c", "a/d"]);
  assert.equal(braces.stringify(braces.parse("a/{b,c}/d")), "a/{b,c}/d");
  assert.equal(braces.stringify(braces.parse("(a)")), "(a)");
  assert.equal(braces.compile("\\{a,b\\}"), "{a,b}");
});

test("braces rejects deeply nested strings before recursive AST walkers run", () => {
  for (const pattern of [
    "{".repeat(4000) + "a,b" + "}".repeat(4000),
    "(".repeat(4000) + "a" + ")".repeat(4000),
    "{(".repeat(2000) + "a,b" + ")}".repeat(2000),
    "{".repeat(4000) + "a,b", // Unclosed nesting is also bounded.
  ]) {
    for (const operation of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => operation(pattern), {
        name: "SyntaxError",
        message: /maximum nesting depth/,
      });
    }
  }
});

test("braces guards directly supplied ASTs, including cycles", () => {
  let ast = { type: "text", value: "a" };
  for (let i = 0; i < 4000; i++) ast = { type: "root", nodes: [ast] };
  const cyclic = { type: "root", nodes: [] };
  cyclic.nodes.push(cyclic);
  for (const operation of [braces.compile, braces.expand, braces.stringify]) {
    for (const input of [ast, cyclic]) {
      assert.throws(() => operation(input), { name: "SyntaxError", message: /maximum nesting depth/ });
    }
  }
});

test("micromatch uses guarded braces for its public brace expansion API", () => {
  assert.deepEqual(micromatch.braceExpand("src/{one,two}.js"), ["src/one.js", "src/two.js"]);
  assert.throws(
    () => micromatch.braceExpand("{".repeat(4000) + "a,b" + "}".repeat(4000)),
    { name: "SyntaxError", message: /maximum nesting depth/ },
  );
});

test("sprintf preserves ordinary formatting and bounds numeric precision", { skip: !hasLegacySprintf }, () => {
  assert.equal(sprintf("%.2f", 1.234), "1.23");
  assert.equal(sprintf("%.2e", 1.234), "1.23e+0");
  assert.equal(sprintf("%.2g", 1.234), "1.2");
  assert.equal(vsprintf("%s %d", ["value", 3]), "value 3");
  for (const type of ["e", "f", "g"]) {
    for (const precision of ["101", "1000000", "9".repeat(400), "0"]) {
      const formatted = sprintf(`%.${precision}${type}`, 1.234);
      assert.equal(typeof formatted, "string");
      assert.ok(formatted.length <= 110, "Precision must not produce unbounded output");
    }
  }
  assert.equal(sprintf("%.0f", 1.234), "1");
  assert.equal(sprintf("%.0g", 1.234), "1");
});

test("argparse help rendering uses bounded sprintf precision", { skip: !hasLegacySprintf }, () => {
  const parser = new ArgumentParser({
    prog: "taskdesk",
    description: "Help for %(prog)s",
  });
  parser.addArgument("--ratio", { defaultValue: 1.234, help: "%(defaultValue).1000000f" });
  const help = parser.formatHelp();
  assert.match(help, /Help for taskdesk/);
  // argparse may wrap long numeric help text; successful rendering is the
  // regression here (unpatched sprintf throws before any help is returned).
  assert.match(help, /--ratio RATIO\s+1\./);
});

test("node-forge accepts valid RSA signatures but rejects malformed DigestAlgorithm sequences", () => {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 3 });
  const md = forge.md.sha256.create().update("dependency security regression");
  const digest = md.digest().getBytes();
  assert.equal(keys.publicKey.verify(digest, keys.privateKey.sign(md)), true);

  const { asn1 } = forge;
  const create = (type, constructed, value) =>
    asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
  const oid = () => create(asn1.Type.OID, false, asn1.oidToDer(forge.oids.sha256).getBytes());
  const nil = () => create(asn1.Type.NULL, false, "");
  const signature = (algorithm) => {
    const info = create(asn1.Type.SEQUENCE, true, [
      create(asn1.Type.SEQUENCE, true, algorithm),
      create(asn1.Type.OCTETSTRING, false, digest),
    ]);
    return keys.privateKey.sign(asn1.toDer(info).getBytes(), "NONE");
  };
  // SHA algorithms allow absent NULL parameters.
  assert.equal(keys.publicKey.verify(digest, signature([oid()])), true);
  assert.equal(keys.publicKey.verify(digest, signature([oid(), nil()])), true);
  for (const algorithm of [
    [oid(), nil(), create(asn1.Type.OCTETSTRING, false, "garbage")],
    [oid(), create(asn1.Type.OCTETSTRING, false, "garbage")],
    [oid(), create(asn1.Type.NULL, false, "garbage")],
    [oid(), nil(), nil()],
    [],
    [nil()],
    ...[asn1.Class.CONTEXT_SPECIFIC, asn1.Class.APPLICATION, asn1.Class.PRIVATE].map(tagClass =>
      [oid(), asn1.create(tagClass, asn1.Type.NULL, false, "")]),
    [oid(), create(asn1.Type.NULL, true, [])],
  ]) {
    assert.throws(() => keys.publicKey.verify(digest, signature(algorithm)), /DigestInfo/);
  }
});

test("Expo code signing still signs and verifies valid manifests", () => {
  const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 65537 });
  const certificate = expoCertificates.generateSelfSignedCodeSigningCertificate({
    keyPair,
    validityNotBefore: new Date("2020-01-01T00:00:00Z"),
    validityNotAfter: new Date("2040-01-01T00:00:00Z"),
    commonName: "dependency-security-test",
  });
  expoCertificates.validateSelfSignedCertificate(certificate, keyPair);
  const manifest = Buffer.from('{"runtimeVersion":"security-test"}');
  const signature = expoCertificates.signBufferRSASHA256AndVerify(keyPair.privateKey, certificate, manifest);
  const digest = forge.md.sha256.create().update(manifest.toString("binary")).digest().getBytes();
  assert.equal(keyPair.publicKey.verify(digest, Buffer.from(signature, "base64").toString("binary")), true);
});

test("active Metro consumers can read image and non-image assets", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=",
    "base64",
  );
  const directory = mkdtempSync(path.join(os.tmpdir(), "metro-assets-security-"));
  try {
    const image = path.join(directory, "pixel.png");
    const text = path.join(directory, "note.txt");
    writeFileSync(image, png);
    writeFileSync(text, "not an image");
    const versions = lockedVersions("metro");
    assert.ok(versions.length > 0, "The active Metro consumer must be tested");
    for (const version of versions) {
      const metroRequire = consumerRequire("metro", version);
      const { getAssetData, getAssetSize } = metroRequire("./src/Assets.js");
      assert.deepEqual(getAssetSize("png", png, image), { width: 1, height: 1 });
      const asset = await getAssetData(image, "pixel.png", [], null, "/assets");
      assert.equal(asset.width, 1);
      assert.equal(asset.height, 1);
      const nonImage = await getAssetData(text, "note.txt", [], null, "/assets");
      assert.equal(nonImage.width, undefined);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("security patches are tracked and all vulnerable consumers use patched snapshots", () => {
  const lock = readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  for (const [name, version] of [["braces", "3.0.3"], ["node-forge", "1.4.0"], ["sprintf-js", "1.0.3"]]) {
    assert.match(lock, new RegExp(`path: patches/${name}@${version.replaceAll(".", "\\.")}\\.patch`));
    const snapshots = lock.split("\nsnapshots:\n")[1];
    assert.ok(snapshots, "Lockfile must contain snapshots");
    const dependencyLines = snapshots.split("\n").filter(line => line.startsWith(`      ${name}: `));
    if (name !== "sprintf-js") assert.ok(dependencyLines.length > 0, `${name} must have consumers`);
    assert.ok(dependencyLines.every(line => line.includes("(patch_hash=")), `${name} consumers must all be patched`);
  }
});

test("all Vite and Markdown-it consumers resolve published security fixes", () => {
  assert.deepEqual(lockedVersions("vite"), ["7.3.7"]);
  assert.deepEqual(lockedVersions("markdown-it"), ["14.3.3"]);
  const viteRequire = createRequire(path.join(root, "artifacts/landing/package.json"));
  assert.equal(viteRequire("vite/package.json").version, "7.3.7");
  assert.equal(typedocRequire("markdown-it/package.json").version, "14.3.3");
});

test("TypeDoc's Markdown-it preserves rendering and bounds all reported denial-of-service cases", () => {
  const MarkdownIt = typedocRequire("markdown-it");
  const md = new MarkdownIt({ html: true, typographer: true });
  assert.equal(md.render("[example][ref]\n\n[ref]: /url \"Title\"\n"),
    '<p><a href="/url" title="Title">example</a></p>\n');
  assert.equal(md.render('"Hello"'), "<p>“Hello”</p>\n");
  assert.equal(md.render("x <!-- comment --> <em>safe</em>"),
    "<p>x <!-- comment --> <em>safe</em></p>\n");

  // Run hostile input out of process: a regression must time out rather than
  // block the test runner's event loop indefinitely.
  const result = spawnSync(process.execPath, ["--input-type=commonjs", "-e", `
    const MarkdownIt = require(process.argv[1]);
    const md = new MarkdownIt({ html: true, typographer: true });
    const inputs = [
      '[a]: /u "' + 'x\\n'.repeat(200000),
      '[' + 'a\\n'.repeat(100000),
      '"a '.repeat(64000) + "b' ".repeat(64000),
      "'a ".repeat(64000) + 'b" '.repeat(64000),
      ...['<!--', '<?x', '<!A', '<![CDATA['].map(opener => 'x ' + opener.repeat(64000)),
    ];
    for (const input of inputs) md.render(input);
  `, typedocRequire.resolve("markdown-it")], { timeout: 10000, encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test("native optional dependencies remain available on macOS, Windows and Linux musl", () => {
  const lock = readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  const snapshots = lock.split("\nsnapshots:\n")[1].split("\n\n");
  const targets = [
    ["rollup", ["@rollup/rollup-darwin-arm64", "@rollup/rollup-darwin-x64", "@rollup/rollup-win32-x64-msvc", "@rollup/rollup-linux-x64-musl"]],
    ["esbuild", ["@esbuild/darwin-arm64", "@esbuild/darwin-x64", "@esbuild/win32-x64", "@esbuild/linux-arm64"]],
    ["@tailwindcss/oxide", ["@tailwindcss/oxide-darwin-arm64", "@tailwindcss/oxide-darwin-x64", "@tailwindcss/oxide-win32-x64-msvc", "@tailwindcss/oxide-linux-x64-musl"]],
    ["lightningcss", ["lightningcss-darwin-arm64", "lightningcss-darwin-x64", "lightningcss-win32-x64-msvc", "lightningcss-linux-x64-musl"]],
    ["@expo/ngrok-bin", ["@expo/ngrok-bin-darwin-arm64", "@expo/ngrok-bin-darwin-x64", "@expo/ngrok-bin-win32-x64", "@expo/ngrok-bin-linux-arm64"]],
  ];
  for (const [parent, binaries] of targets) {
    const consumers = snapshots.filter(block =>
      block.startsWith(`  ${parent}@`) || block.startsWith(`  '${parent}@`));
    assert.ok(consumers.length > 0, `${parent} must be in the lockfile`);
    for (const consumer of consumers) {
      assert.ok(consumer.includes("optionalDependencies:"), `${parent} must retain native optional dependencies`);
      for (const binary of binaries) {
        const line = consumer.split("\n").find(entry =>
          entry.startsWith(`      ${binary}:`) || entry.startsWith(`      '${binary}':`));
        assert.ok(line, `${parent} must retain ${binary}`);
      }
    }
  }
  assert.doesNotMatch(
    readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8"),
    />.*:\s*['"]?-['"]?\s*$/m,
    "Do not remove platform-specific optional dependencies with overrides",
  );
});
