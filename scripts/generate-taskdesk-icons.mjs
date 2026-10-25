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
const foregroundSize = 500;
const targets = [
  ["artifacts/landing/public/favicon.png", 192, "opaque"],
  ["artifacts/landing/public/apple-touch-icon.png", 180, "opaque"],
  ["artifacts/landing/public/icon-192.png", 192, "opaque"],
  ["artifacts/landing/public/icon-512.png", 512, "opaque"],
  ["artifacts/mobile/assets/images/icon.png", 1024, "transparent"],
  ["artifacts/mobile/assets/images/taskdesk-app-icon.png", 1024, "opaque"],
  ["artifacts/mobile/assets/images/taskdesk-adaptive-foreground.png", 1024, "foreground"],
];

function runMagick(args, options = {}) {
  try {
    return execFileSync("magick", args, {
      encoding: options.encoding ?? "buffer",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
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

function render(targetPath, size, variant, svgPath) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  if (variant === "foreground") {
    runMagick([
      "-background", "none", svgPath, "-alpha", "on", "-trim", "+repage",
      "-resize", `${foregroundSize}x${foregroundSize}`,
      "-gravity", "center", "-background", "none", "-extent", `${size}x${size}`,
      "-depth", "8", "-strip", `PNG32:${targetPath}`,
    ]);
    return;
  }
  if (variant === "transparent") {
    runMagick([
      "-background", "none", svgPath, "-alpha", "on",
      "-depth", "8", "-strip", `PNG32:${targetPath}`,
    ]);
    return;
  }

  runMagick([
    "-background", "white", svgPath, "-alpha", "remove", "-alpha", "off",
    "-filter", "Lanczos", "-resize", `${size}x${size}!`,
    "-depth", "8", "-strip", `PNG24:${targetPath}`,
  ]);
}

function imageInfo(filePath) {
  const result = runMagick(["identify", "-format", "%wx%h %[channels]", filePath], {
    encoding: "utf8",
  }).trim();
  const [dimensions, channels] = result.split(/\s+/);
  return { dimensions, channels };
}

function rgbaPixels(filePath) {
  return runMagick([filePath, "-alpha", "on", "-depth", "8", "RGBA:-"]);
}

function withGeneratedAssets(callback) {
  const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "taskdesk-icons-"));
  try {
    const svg = readFileSync(masterPath, "utf8");
    validateMaster(svg);
    const transparentSvgPath = path.join(tempDirectory, "monogram-transparent.svg");
    writeFileSync(transparentSvgPath, makeTransparentMaster(svg));
    const generated = targets.map(([relativePath, size, variant], index) => {
      const outputPath = path.join(tempDirectory, `generated-${index}.png`);
      render(outputPath, size, variant, variant === "opaque" ? masterPath : transparentSvgPath);
      return { relativePath, size, variant, outputPath };
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
  });
}

function check() {
  withGeneratedAssets((generated) => {
    const differences = [];
    for (const asset of generated) {
      const actualPath = path.join(workspaceRoot, asset.relativePath);
      let actualInfo;
      try {
        actualInfo = imageInfo(actualPath);
      } catch {
        differences.push(`${asset.relativePath} is missing or is not a readable PNG`);
        continue;
      }

      const expectedInfo = imageInfo(asset.outputPath);
      const expectedDimensions = `${asset.size}x${asset.size}`;
      if (actualInfo.dimensions !== expectedDimensions) {
        differences.push(`${asset.relativePath} has dimensions ${actualInfo.dimensions}; expected ${expectedDimensions}`);
        continue;
      }
      if (asset.variant !== "opaque" && !actualInfo.channels.includes("a")) {
        differences.push(`${asset.relativePath} must preserve its transparent background`);
        continue;
      }
      if (!rgbaPixels(actualPath).equals(rgbaPixels(asset.outputPath))) {
        differences.push(`${asset.relativePath} differs from ${path.relative(workspaceRoot, masterPath)}`);
      }
    }

    if (differences.length > 0) {
      throw new Error(
        `[taskdesk-icons] Assets are out of sync:\n${differences.map((difference) => `- ${difference}`).join("\n")}\nRun: pnpm --filter @workspace/mobile generate:brand-icons`,
      );
    }
    console.log(`[taskdesk-icons] All ${generated.length} icon assets match the official monogram.`);
  });
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
