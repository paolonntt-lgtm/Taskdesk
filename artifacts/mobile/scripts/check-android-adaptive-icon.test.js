import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const { checkAdaptiveIcon } = require("./check-android-adaptive-icon.js");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const temporaryProjects = [];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function rgbaPng(width, height, visiblePixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(width * 4 + 1);
    for (const { x, y: pixelY } of visiblePixels) {
      if (pixelY === y) {
        row.set([255, 255, 255, 255], 1 + x * 4);
      }
    }
    rows.push(row);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createProject({ width = 108, height = 108, visiblePixels = [{ x: 30, y: 30 }] } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "android-adaptive-icon-"));
  temporaryProjects.push(projectRoot);
  fs.mkdirSync(path.join(projectRoot, "assets"));
  fs.writeFileSync(
    path.join(projectRoot, "app.json"),
    JSON.stringify({
      expo: {
        android: {
          adaptiveIcon: { foregroundImage: "./assets/foreground.png" },
        },
      },
    }),
  );
  fs.writeFileSync(
    path.join(projectRoot, "assets/foreground.png"),
    rgbaPng(width, height, visiblePixels),
  );
  return projectRoot;
}

afterEach(() => {
  for (const projectRoot of temporaryProjects.splice(0)) {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

describe("Android adaptive icon safe-area check", () => {
  it("checks the foreground image referenced by the real Expo config", () => {
    const result = checkAdaptiveIcon(path.resolve(scriptDirectory, ".."));

    expect(result.foregroundImage).toBe("./assets/images/taskdesk-adaptive-foreground.png");
    expect(result.width).toBe(1024);
    expect(result.requiredMargin).toBe(200);
    expect(result.margins.left).toBeGreaterThanOrEqual(result.requiredMargin);
    expect(result.margins.right).toBeGreaterThanOrEqual(result.requiredMargin);
    expect(result.margins.top).toBeGreaterThanOrEqual(result.requiredMargin);
    expect(result.margins.bottom).toBeGreaterThanOrEqual(result.requiredMargin);
  });

  it("rejects visible content that crosses the central Android safe zone", () => {
    const projectRoot = createProject({ visiblePixels: [{ x: 5, y: 54 }] });

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(
      /outside Android's central 66\/108 safe zone.*left 5px/,
    );
  });

  it("rejects non-square foreground images", () => {
    const projectRoot = createProject({ width: 108, height: 109 });

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(/must be square.*108×109/);
  });

  it("rejects images smaller than the adaptive icon canvas", () => {
    const projectRoot = createProject({ width: 107, height: 107 });

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(/at least 108×108px/);
  });

  it("rejects a foreground image with no visible pixels", () => {
    const projectRoot = createProject({ visiblePixels: [] });

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(/has no visible pixels/);
  });
});
