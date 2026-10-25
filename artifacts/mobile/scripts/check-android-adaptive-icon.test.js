import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const { checkAdaptiveIcon, parsePng } = require("./check-android-adaptive-icon.js");
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

function rgbaPng(width, height, visiblePixels, backgroundPixel = [0, 0, 0, 0]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      row.set(backgroundPixel, 1 + x * 4);
    }
    for (const { x, y: pixelY, alpha = 255, color = [255, 255, 255] } of visiblePixels) {
      if (pixelY === y) {
        row.set([...color, alpha], 1 + x * 4);
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

function indexedPng(width, height, visiblePixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 3;

  const palette = Buffer.from([
    0, 0, 0,       // Index 0: fully transparent
    255, 255, 255, // Index 1: opaque
    128, 128, 128, // Index 2: partially transparent
  ]);
  const transparency = Buffer.from([0, 255, 1]);
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(width + 1);
    for (const { x, y: pixelY, index } of visiblePixels) {
      if (pixelY === y) row[x + 1] = index;
    }
    rows.push(row);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("PLTE", palette),
    pngChunk("tRNS", transparency),
    pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function grayAlphaPng(width, height, visiblePixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 4;

  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(width * 2 + 1);
    for (let x = 0; x < width; x += 1) row[1 + x * 2] = 255;
    for (const { x, y: pixelY, gray = 255, alpha = 255 } of visiblePixels) {
      if (pixelY === y) row.set([gray, alpha], 1 + x * 2);
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

function unsupportedColorTypePng(colorType) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(108, 0);
  header.writeUInt32BE(108, 4);
  header[8] = 8;
  header[9] = colorType;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(Buffer.from([0]))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createProject({
  width = 108,
  height = 108,
  visiblePixels = [{ x: 35, y: 35 }],
  foreground = rgbaPng(width, height, visiblePixels),
} = {}) {
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
        plugins: [
          ["expo-splash-screen", { image: "./assets/splash.png" }],
          ["expo-notifications", { icon: "./assets/notification.png" }],
        ],
      },
    }),
  );
  fs.writeFileSync(
    path.join(projectRoot, "assets/foreground.png"),
    foreground,
  );
  fs.writeFileSync(
    path.join(projectRoot, "assets/splash.png"),
    rgbaPng(108, 108, [{ x: 54, y: 54, color: [0, 0, 0] }], [255, 255, 255, 255]),
  );
  fs.writeFileSync(
    path.join(projectRoot, "assets/notification.png"),
    rgbaPng(96, 96, [{ x: 48, y: 48 }]),
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
    expect(result.maxVisibleRadius).toBeLessThanOrEqual(result.safeRadius);
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

  it("rejects content that fits the safe-zone bounds but crosses the circular mask", () => {
    const projectRoot = createProject({ visiblePixels: [{ x: 30, y: 30 }] });

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(
      /exceeds Android's central 66\/108 circular safe zone/,
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

  it("measures indexed PNG margins using palette transparency", () => {
    const png = indexedPng(108, 108, [
      { x: 0, y: 0, index: 0 },
      { x: 35, y: 40, index: 1 },
      { x: 70, y: 75, index: 2 },
      { x: 107, y: 107, index: 0 },
    ]);
    const projectRoot = createProject({ foreground: png });
    const result = checkAdaptiveIcon(projectRoot);

    expect(result.margins).toEqual({ left: 35, top: 40, right: 37, bottom: 32 });
  });

  it("ignores fully transparent pixels in grayscale-alpha and RGBA PNGs", () => {
    const grayAlpha = parsePng(
      grayAlphaPng(108, 108, [
        { x: 0, y: 0, alpha: 0 },
        { x: 41, y: 46, gray: 0, alpha: 255 },
        { x: 107, y: 107, alpha: 0 },
      ]),
      "gray-alpha.png",
    );
    const rgba = parsePng(
      rgbaPng(108, 108, [
        { x: 0, y: 0, alpha: 0 },
        { x: 35, y: 42 },
        { x: 107, y: 107, alpha: 0 },
      ]),
      "rgba.png",
    );

    expect(grayAlpha.visibleBounds).toEqual({
      minX: 41,
      minY: 46,
      maxX: 41,
      maxY: 46,
    });
    expect(rgba.visibleBounds).toEqual({
      minX: 35,
      minY: 42,
      maxX: 35,
      maxY: 42,
    });
  });

  it("rejects unsupported PNG color types with a clear error", () => {
    expect(() => parsePng(unsupportedColorTypePng(1), "unsupported.png")).toThrow(
      /unsupported\.png uses an unsupported PNG color type \(1\)/,
    );
  });

  it("rejects a splash image with a transparent background", () => {
    const projectRoot = createProject();
    fs.writeFileSync(
      path.join(projectRoot, "assets/splash.png"),
      rgbaPng(108, 108, [{ x: 54, y: 54 }]),
    );

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(/must have an opaque background/);
  });

  it("rejects a splash mark that is not centered", () => {
    const projectRoot = createProject();
    fs.writeFileSync(
      path.join(projectRoot, "assets/splash.png"),
      rgbaPng(108, 108, [{ x: 20, y: 54, color: [0, 0, 0] }], [255, 255, 255, 255]),
    );

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(/visible mark must be centered/);
  });

  it("rejects a missing notification path from the Expo config", () => {
    const projectRoot = createProject();
    const configPath = path.join(projectRoot, "app.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.expo.plugins[1][1].icon = "./assets/missing-notification.png";
    fs.writeFileSync(configPath, JSON.stringify(config));

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(/Configured expo-notifications image does not exist/);
  });

  it("rejects a missing splash path from the Expo config", () => {
    const projectRoot = createProject();
    const configPath = path.join(projectRoot, "app.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.expo.plugins[0][1].image = "./assets/missing-splash.png";
    fs.writeFileSync(configPath, JSON.stringify(config));

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(/Configured expo-splash-screen image does not exist/);
  });

  it("rejects a missing dark splash path from the Expo config", () => {
    const projectRoot = createProject();
    const configPath = path.join(projectRoot, "app.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.expo.plugins[0][1].dark = { image: "./assets/missing-dark-splash.png" };
    fs.writeFileSync(configPath, JSON.stringify(config));

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(/Configured dark expo-splash-screen image does not exist/);
  });

  it("rejects notification artwork with the wrong size or non-white pixels", () => {
    const wrongSizeProject = createProject();
    fs.writeFileSync(
      path.join(wrongSizeProject, "assets/notification.png"),
      rgbaPng(95, 96, [{ x: 48, y: 48 }]),
    );
    expect(() => checkAdaptiveIcon(wrongSizeProject)).toThrow(/must be exactly 96×96px/);

    const nonWhiteProject = createProject();
    fs.writeFileSync(
      path.join(nonWhiteProject, "assets/notification.png"),
      rgbaPng(96, 96, [{ x: 48, y: 48, color: [0, 0, 0] }]),
    );
    expect(() => checkAdaptiveIcon(nonWhiteProject)).toThrow(/only white visible pixels/);
  });

  it("rejects notification artwork without transparency", () => {
    const projectRoot = createProject();
    fs.writeFileSync(
      path.join(projectRoot, "assets/notification.png"),
      rgbaPng(96, 96, [{ x: 48, y: 48 }], [255, 255, 255, 255]),
    );

    expect(() => checkAdaptiveIcon(projectRoot)).toThrow(/must have a transparent background/);
  });
});

describe("mobile shared app icon, splash, and favicon asset", () => {
  it("uses the same square opaque image for app icon, splash, and favicon", () => {
    const projectRoot = path.resolve(scriptDirectory, "..");
    const config = JSON.parse(fs.readFileSync(path.join(projectRoot, "app.json"), "utf8")).expo;
    const splash = config.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
    )[1];
    const imagePath = path.join(projectRoot, splash.image);
    const image = parsePng(fs.readFileSync(imagePath), splash.image);

    expect(config.icon).toBe("./assets/images/taskdesk-app-icon.png");
    expect(splash).toMatchObject({
      image: config.icon,
      imageWidth: 220,
      resizeMode: "contain",
      backgroundColor: "#ffffff",
      dark: {
        image: config.icon,
        backgroundColor: "#ffffff",
      },
    });
    expect(config.web.favicon).toBe(config.icon);
    expect(image.width).toBe(1024);
    expect(image.height).toBe(1024);
    expect(image.transparentPixelCount).toBe(0);
    expect(Math.abs((image.nonWhiteBounds.minX + image.nonWhiteBounds.maxX) / 2 - 511.5)).toBeLessThanOrEqual(5);
    expect(Math.abs((image.nonWhiteBounds.minY + image.nonWhiteBounds.maxY) / 2 - 511.5)).toBeLessThanOrEqual(5);
  });

  it("uses a square 1024-pixel iOS app icon source to avoid aspect-ratio distortion", () => {
    const projectRoot = path.resolve(scriptDirectory, "..");
    const config = JSON.parse(fs.readFileSync(path.join(projectRoot, "app.json"), "utf8")).expo;
    const iconPath = path.join(projectRoot, config.icon);
    const icon = parsePng(fs.readFileSync(iconPath), config.icon);

    expect(config.icon).toBe("./assets/images/taskdesk-app-icon.png");
    expect(icon.width).toBe(1024);
    expect(icon.height).toBe(1024);
    expect(icon.colorType).toBe(2);
  });
});
