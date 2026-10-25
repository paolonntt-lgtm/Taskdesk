import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(workspaceRoot, "artifacts/landing/public/taskdesk-logo.svg");
const copyPath = path.join(workspaceRoot, "artifacts/ticketing/public/taskdesk-logo.svg");

try {
  const source = readFileSync(sourcePath);
  const copy = readFileSync(copyPath);

  if (!source.equals(copy)) {
    console.error(
      "[taskdesk-wordmark] The ticketing SVG differs from the landing master.\n" +
        "Copy artifacts/landing/public/taskdesk-logo.svg to " +
        "artifacts/ticketing/public/taskdesk-logo.svg, then rerun the check.",
    );
    process.exitCode = 1;
  } else {
    console.log("[taskdesk-wordmark] Landing and ticketing serve the same SVG.");
  }
} catch (error) {
  console.error(`[taskdesk-wordmark] Could not read a wordmark SVG: ${error.message}`);
  process.exitCode = 1;
}
