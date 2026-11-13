import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const masterPath = path.join(workspaceRoot, "artifacts/landing/public/favicon.svg");
const manifestPath = path.join(workspaceRoot, "scripts/taskdesk-icons.manifest.json");
const foregroundSize = 500;
const faviconArtworkSize = 900;
const adaptiveForegroundPath = "artifacts/mobile/assets/images/taskdesk-adaptive-foreground.png";
const targets = [
  ["artifacts/landing/public/favicon.png", 192, "opaque"],
  ["artifacts/landing/public/apple-touch-icon.png", 180, "opaque"],
  ["artifacts/landing/public/icon-192.png", 192, "opaque"],
  ["artifacts/landing/public/icon-512.png", 512, "opaque"],
  ["artifacts/mobile/assets/images/taskdesk-app-icon.png", 1024, "opaque"],
  [adaptiveForegroundPath, 1024, "foreground"],
  ["artifacts/mobile/assets/images/taskdesk-favicon.png", 1024, "favicon"],
];

function runMagick(args, options = {}) {
  const isIdentifyCommand = args[0] === "identify";
  try {
    return execFileSync("magick", args, {
      encoding: options.encoding ?? "buffer",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      const fallbackCommand = isIdentifyCommand ? "identify" : "convert";
      const fallbackArgs = isIdentifyCommand ? args.slice(1) : args;
      try {
        return execFileSync(fallbackCommand, fallbackArgs, {
          encoding: options.encoding ?? "buffer",
          maxBuffer: 32 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (fallbackError) {
        const detail = fallbackError.stderr?.toString().trim() || fallbackError.message;
        throw new Error(`ImageMagick failed: ${detail}`);
      }
    }
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`ImageMagick failed: ${detail}`);
  }
}

function validateMaster(svg) {
  if (!/<svg\b[^>]*\bwidth="1024"\s+height="1024"\s+viewBox="0 0 1024 1024"/.test(svg)) {
    throw new Error(`${masterPath} must remain a 1024×1024 SVG with a matching viewBox.`);
  }
  if (!/<rect\b[^>]*\bfill="#(?:fff|ffffff)"\s*\/>/.test(svg)) {
    throw new Error(`${masterPath} must include the solid white background used by app and web icons.`);
  }
}

function makeTransparentMaster(svg) {
  const background = /<rect\b[^>]*\bfill="#(?:fff|ffffff)"\s*\/>/;
  if (!background.test(svg)) {
    throw new Error("Could not remove the white background from the SVG for Android foreground output.");
  }
  return svg.replace(background, "");
}

function render(targetPath, size, variant, sourcePath) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  if (variant === "foreground") {
    runMagick([
      "-background", "none", sourcePath, "-alpha", "on", "-trim", "+repage",
      "-resize", `${foregroundSize}x${foregroundSize}`,
      "-gravity", "center", "-background", "none", "-extent", `${size}x${size}`,
      "-depth", "8", "-strip", `PNG32:${targetPath}`,
    ]);
    return;
  }
  if (variant === "favicon") {
    runMagick([
      sourcePath, "-alpha", "on", "-trim", "+repage",
      "-resize", `${faviconArtworkSize}x${faviconArtworkSize}`,
      "-gravity", "center", "-background", "none", "-extent", `${size}x${size}`,
      "-depth", "8", "-strip", `PNG32:${targetPath}`,
    ]);
    return;
  }
  if (variant === "transparent") {
    runMagick([
      "-background", "none", sourcePath, "-alpha", "on",
      "-depth", "8", "-strip", `PNG32:${targetPath}`,
    ]);
    return;
  }

  runMagick([
    "-background", "white", sourcePath, "-alpha", "remove", "-alpha", "off",
    "-filter", "Lanczos", "-resize", `${size}x${size}!`,
    "-depth", "8", "-strip", `PNG24:${targetPath}`,
  ]);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createManifest() {
  return {
    version: 1,
    source: {
      path: path.relative(workspaceRoot, masterPath),
      sha256: sha256(readFileSync(masterPath)),
    },
    assets: Object.fromEntries(
      targets.map(([relativePath]) => [
        relativePath,
        sha256(readFileSync(path.join(workspaceRoot, relativePath))),
      ]),
    ),
  };
}

function withGeneratedAssets(callback) {
  const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "taskdesk-icons-"));
  try {
    const svg = readFileSync(masterPath, "utf8");
    validateMaster(svg);
    const transparentSvgPath = path.join(tempDirectory, "monogram-transparent.svg");
    writeFileSync(transparentSvgPath, makeTransparentMaster(svg));
    const generatedByPath = new Map();
    const generated = targets.map(([relativePath, size, variant], index) => {
      const outputPath = path.join(tempDirectory, `generated-${index}.png`);
      const sourcePath = variant === "favicon"
        ? generatedByPath.get(adaptiveForegroundPath)
        : variant === "foreground" || variant === "transparent"
          ? transparentSvgPath
          : masterPath;
      if (!sourcePath) {
        throw new Error(`Could not find generated source ${adaptiveForegroundPath} for ${relativePath}.`);
      }
      render(outputPath, size, variant, sourcePath);
      const asset = { relativePath, size, variant, outputPath };
      generatedByPath.set(relativePath, outputPath);
      return asset;
    });
    callback(generated);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function generate() {
  withGeneratedAssets((generated) => {
    for (const asset of generated) {
      const destination = path.join(workspaceRoot, asset.relativePath);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(asset.outputPath, destination);
      console.log(`[taskdesk-icons] Generated ${asset.relativePath} (${asset.size}×${asset.size}).`);
    }
    writeFileSync(manifestPath, `${JSON.stringify(createManifest(), null, 2)}\n`);
    console.log(`[taskdesk-icons] Updated ${path.relative(workspaceRoot, manifestPath)}.`);
  });
}

function check() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const source = readFileSync(masterPath);
  validateMaster(source.toString("utf8"));
  if (
    manifest.version !== 1 ||
    manifest.source?.path !== path.relative(workspaceRoot, masterPath) ||
    manifest.source?.sha256 !== sha256(source)
  ) {
    throw new Error(
      `[taskdesk-icons] The master SVG changed or the manifest is invalid. Regenerate assets with: pnpm --filter @workspace/mobile generate:brand-icons`,
    );
  }

  const differences = [];
  const expectedPaths = targets.map(([relativePath]) => relativePath);
  if (
    !manifest.assets ||
    Object.keys(manifest.assets).length !== expectedPaths.length ||
    expectedPaths.some((relativePath) => !Object.hasOwn(manifest.assets, relativePath))
  ) {
    throw new Error(
      `[taskdesk-icons] The asset manifest does not match the generated icon list. Regenerate assets with: pnpm --filter @workspace/mobile generate:brand-icons`,
    );
  }

  for (const [relativePath, size, variant] of targets) {
    const assetPath = path.join(workspaceRoot, relativePath);
    let data;
    try {
      data = readFileSync(assetPath);
    } catch {
      differences.push(`${relativePath} is missing`);
      continue;
    }

    const isPng = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!isPng || data.length < 26) {
      differences.push(`${relativePath} is not a readable PNG`);
      continue;
    }

    const dimensions = `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`;
    const hasAlpha = data[25] === 4 || data[25] === 6 || data.includes(Buffer.from("tRNS"));
    if (dimensions !== `${size}x${size}`) {
      differences.push(`${relativePath} has dimensions ${dimensions}; expected ${size}x${size}`);
    } else if (variant !== "opaque" && !hasAlpha) {
      differences.push(`${relativePath} must preserve its transparent background`);
    } else if (sha256(data) !== manifest.assets[relativePath]) {
      differences.push(`${relativePath} differs from its recorded generated version`);
    }
  }

  if (differences.length > 0) {
    throw new Error(
      `[taskdesk-icons] Assets are out of sync:\n${differences.map((difference) => `- ${difference}`).join("\n")}\nRun: pnpm --filter @workspace/mobile generate:brand-icons`,
    );
  }
  console.log(`[taskdesk-icons] All ${expectedPaths.length} icon assets match the source and manifest.`);
}

const mode = process.argv[2] ?? "--generate";
try {
  if (mode === "--check") {
    check();
  } else if (mode === "--generate") {
    generate();
  } else {
    console.error("Usage: node scripts/generate-taskdesk-icons.mjs [--generate|--check]");
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
