import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoots = [
  "artifacts/landing",
  "artifacts/ticketing",
  "artifacts/mobile",
  "artifacts/landing/dist/public",
  "artifacts/ticketing/dist/public",
  "artifacts/mobile/static-build",
];

const secretPatterns = [
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "OpenAI-like key", pattern: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "Google API key", pattern: /\bAIza[A-Za-z0-9_-]{30,}\b/ },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "secret assignment", pattern: /\b(?:client_secret|api_secret|private_key)\b\s*[:=]\s*["'`][^"'`$\n]{12,}/i },
];

const ignoredDirectories = new Set(["node_modules", ".git", "dist", "coverage"]);
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".html", ".json", ".css"]);
const publicNativeConfigFiles = new Set(["google-services.json", "GoogleService-Info.plist"]);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

function relative(filePath) {
  return path.relative(workspaceRoot, filePath);
}

function isExpoManifest(filePath) {
  const file = relative(filePath).replaceAll(path.sep, "/");
  return /^artifacts\/mobile\/static-build\/(?:ios|android)\/manifest\.json$/.test(file);
}

const findings = [];
const scannedFiles = new Set();
for (const root of frontendRoots) {
  for (const filePath of walk(path.join(workspaceRoot, root))) {
    if (scannedFiles.has(filePath)) continue;
    scannedFiles.add(filePath);
    // Firebase native config contains a client identifier by design. It is
    // not a server credential and is not shipped in the web bundles.
    if (publicNativeConfigFiles.has(path.basename(filePath))) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const { name, pattern } of secretPatterns) {
      // Expo manifests may carry Firebase client configuration needed by the
      // native runtime. Scan them for actual secrets, but not public API keys.
      if (name === "Google API key" && isExpoManifest(filePath)) continue;
      if (pattern.test(content)) findings.push(`${name}: ${relative(filePath)}`);
    }
  }
}

function historyMatches(pattern) {
  try {
    return execFileSync(
      "git",
      [
        "log",
        "--all",
        "--format=%H",
        "-G",
        pattern,
        "--",
        "artifacts/landing",
        "artifacts/ticketing",
        "artifacts/mobile",
        ":(exclude)**/google-services.json",
        ":(exclude)**/GoogleService-Info.plist",
      ],
      { cwd: workspaceRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

const historyFindings = [];
for (const { name, pattern } of secretPatterns.slice(0, 4)) {
  const commits = historyMatches(pattern.source);
  if (commits.length > 0) {
    historyFindings.push(`${name} found in frontend Git history (${commits.length} commit(s))`);
  }
}

const stagingEnabled = ["1", "true", "yes"].includes((process.env.STAGING_PROTECTION || "").toLowerCase());
if (stagingEnabled && (!process.env.STAGING_BASIC_AUTH || process.env.STAGING_BASIC_AUTH.length < 16)) {
  findings.push("STAGING_PROTECTION is enabled but STAGING_BASIC_AUTH is missing or too short");
}

if (historyFindings.length > 0 && process.env.SECURITY_STRICT_HISTORY === "1") {
  findings.push(...historyFindings);
}

if (findings.length > 0) {
  console.error("Security check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

if (historyFindings.length > 0) {
  console.warn("Security check warning: historical frontend credentials were detected.");
  for (const finding of historyFindings) console.warn(`- ${finding}`);
  console.warn("Rotate the affected credential and purge it from Git history, then rerun with SECURITY_STRICT_HISTORY=1.");
}

console.log(
  `Security check passed: scanned ${scannedFiles.size} frontend files; no embedded credentials or unsafe staging configuration found.`,
);