const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const SAFE_ZONE_RATIO = 66 / 108;
const MINIMUM_DIMENSION = 108;
const MAXIMUM_PIXELS = 64_000_000;

function fail(message) {
  throw new Error(`[android-adaptive-icon] ${message}`);
}

function parsePng(buffer, filePath) {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail(`${filePath} is not a valid PNG file.`);
  }

  let offset = 8;
  let header;
  let palette;
  let paletteAlpha;
  let transparentColor;
  const imageData = [];
  let sawEnd = false;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const chunkType = buffer.toString("ascii", offset + 4, offset + 8);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + length;
    if (chunkEnd + 4 > buffer.length) {
      fail(`${filePath} contains a truncated PNG chunk (${chunkType}).`);
    }

    const data = buffer.subarray(chunkStart, chunkEnd);
    if (chunkType === "IHDR") {
      if (header || length !== 13) {
        fail(`${filePath} has an invalid PNG header.`);
      }
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (chunkType === "PLTE") {
      palette = Buffer.from(data);
    } else if (chunkType === "tRNS") {
      if (header?.colorType === 3) {
        paletteAlpha = Buffer.from(data);
      } else {
        transparentColor = Buffer.from(data);
      }
    } else if (chunkType === "IDAT") {
      imageData.push(data);
    } else if (chunkType === "IEND") {
      sawEnd = true;
      break;
    }

    offset = chunkEnd + 4;
  }

  if (!header || !sawEnd || imageData.length === 0) {
    fail(`${filePath} is missing required PNG data.`);
  }
  if (header.width === 0 || header.height === 0) {
    fail(`${filePath} has zero width or height.`);
  }
  if (header.width * header.height > MAXIMUM_PIXELS) {
    fail(`${filePath} is too large to inspect safely (${header.width}×${header.height}).`);
  }
  if (header.bitDepth !== 8 || header.interlace !== 0) {
    fail(
      `${filePath} must be a non-interlaced, 8-bit PNG; received bit depth ${header.bitDepth}, interlace ${header.interlace}.`,
    );
  }
  if (![0, 2, 3, 4, 6].includes(header.colorType)) {
    fail(`${filePath} uses an unsupported PNG color type (${header.colorType}).`);
  }
  if (header.compression !== 0 || header.filter !== 0) {
    fail(`${filePath} uses an unsupported PNG compression or filter method.`);
  }
  if (header.colorType === 3 && (!palette || palette.length === 0 || palette.length % 3 !== 0)) {
    fail(`${filePath} uses indexed color but has no valid palette.`);
  }

  let inflated;
  try {
    inflated = zlib.inflateSync(Buffer.concat(imageData));
  } catch (error) {
    fail(`${filePath} image data could not be decompressed: ${error.message}`);
  }

  const channelsByColorType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByColorType[header.colorType];
  const stride = header.width * channels;
  const expectedLength = header.height * (stride + 1);
  if (inflated.length !== expectedLength) {
    fail(
      `${filePath} has inconsistent PNG dimensions: expected ${expectedLength} decoded bytes, received ${inflated.length}.`,
    );
  }

  let previousRow = Buffer.alloc(stride);
  const visibleBounds = { minX: header.width, minY: header.height, maxX: -1, maxY: -1 };
  const nonWhiteBounds = { minX: header.width, minY: header.height, maxX: -1, maxY: -1 };
  let maxVisibleRadiusSquared = 0;
  let transparentPixelCount = 0;
  let partialAlphaPixelCount = 0;
  let nonWhiteVisiblePixelCount = 0;
  const centerX = (header.width - 1) / 2;
  const centerY = (header.height - 1) / 2;
  let dataOffset = 0;

  for (let y = 0; y < header.height; y += 1) {
    const filterType = inflated[dataOffset];
    dataOffset += 1;
    const row = Buffer.from(inflated.subarray(dataOffset, dataOffset + stride));
    dataOffset += stride;

    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? row[index - channels] : 0;
      const above = previousRow[index];
      const upperLeft = index >= channels ? previousRow[index - channels] : 0;

      if (filterType === 1) {
        row[index] = (row[index] + left) & 0xff;
      } else if (filterType === 2) {
        row[index] = (row[index] + above) & 0xff;
      } else if (filterType === 3) {
        row[index] = (row[index] + Math.floor((left + above) / 2)) & 0xff;
      } else if (filterType === 4) {
        const estimate = left + above - upperLeft;
        const distanceLeft = Math.abs(estimate - left);
        const distanceAbove = Math.abs(estimate - above);
        const distanceUpperLeft = Math.abs(estimate - upperLeft);
        const predictor =
          distanceLeft <= distanceAbove && distanceLeft <= distanceUpperLeft
            ? left
            : distanceAbove <= distanceUpperLeft
              ? above
              : upperLeft;
        row[index] = (row[index] + predictor) & 0xff;
      } else if (filterType !== 0) {
        fail(`${filePath} uses an invalid PNG row filter (${filterType}).`);
      }
    }

    for (let x = 0; x < header.width; x += 1) {
      let red;
      let green;
      let blue;
      let alpha = 255;
      if (header.colorType === 0) {
        red = green = blue = row[x];
        if (transparentColor?.length === 2 && row[x] === transparentColor.readUInt16BE(0)) {
          alpha = 0;
        }
      } else if (header.colorType === 2) {
        const pixelOffset = x * 3;
        red = row[pixelOffset];
        green = row[pixelOffset + 1];
        blue = row[pixelOffset + 2];
        if (
          transparentColor?.length === 6 &&
          red === transparentColor.readUInt16BE(0) &&
          green === transparentColor.readUInt16BE(2) &&
          blue === transparentColor.readUInt16BE(4)
        ) {
          alpha = 0;
        }
      } else if (header.colorType === 3) {
        const paletteOffset = row[x] * 3;
        red = palette[paletteOffset];
        green = palette[paletteOffset + 1];
        blue = palette[paletteOffset + 2];
        if (paletteAlpha && row[x] < paletteAlpha.length) {
          alpha = paletteAlpha[row[x]];
        }
      } else if (header.colorType === 4) {
        red = green = blue = row[x * 2];
        alpha = row[x * 2 + 1];
      } else if (header.colorType === 6) {
        const pixelOffset = x * 4;
        red = row[pixelOffset];
        green = row[pixelOffset + 1];
        blue = row[pixelOffset + 2];
        alpha = row[pixelOffset + 3];
      }

      if (alpha === 0) {
        transparentPixelCount += 1;
      } else {
        if (alpha < 255) partialAlphaPixelCount += 1;
        if (red !== 255 || green !== 255 || blue !== 255) {
          nonWhiteVisiblePixelCount += 1;
          nonWhiteBounds.minX = Math.min(nonWhiteBounds.minX, x);
          nonWhiteBounds.minY = Math.min(nonWhiteBounds.minY, y);
          nonWhiteBounds.maxX = Math.max(nonWhiteBounds.maxX, x);
          nonWhiteBounds.maxY = Math.max(nonWhiteBounds.maxY, y);
        }
      }

      if (alpha > 0) {
        visibleBounds.minX = Math.min(visibleBounds.minX, x);
        visibleBounds.minY = Math.min(visibleBounds.minY, y);
        visibleBounds.maxX = Math.max(visibleBounds.maxX, x);
        visibleBounds.maxY = Math.max(visibleBounds.maxY, y);
        const distanceX = x - centerX;
        const distanceY = y - centerY;
        maxVisibleRadiusSquared = Math.max(
          maxVisibleRadiusSquared,
          distanceX * distanceX + distanceY * distanceY,
        );
      }
    }

    previousRow = row;
  }

  return {
    ...header,
    visibleBounds,
    nonWhiteBounds,
    maxVisibleRadius: Math.sqrt(maxVisibleRadiusSquared),
    transparentPixelCount,
    partialAlphaPixelCount,
    nonWhiteVisiblePixelCount,
  };
}

function getConfiguredAsset(projectRoot, assetPath, label, configPath) {
  if (typeof assetPath !== "string" || assetPath.trim() === "") {
    fail(`Expo config ${configPath} must set a ${label} image path.`);
  }

  const imagePath = path.resolve(projectRoot, assetPath);
  const relativeImagePath = path.relative(projectRoot, imagePath);
  if (relativeImagePath.startsWith("..") || path.isAbsolute(relativeImagePath)) {
    fail(`The configured ${label} image must be inside the mobile project: ${assetPath}.`);
  }
  if (!fs.existsSync(imagePath)) {
    fail(`Configured ${label} image does not exist: ${assetPath}.`);
  }

  try {
    return parsePng(fs.readFileSync(imagePath), assetPath);
  } catch (error) {
    if (error.message.startsWith("[android-adaptive-icon]")) throw error;
    fail(`Cannot inspect ${assetPath}: ${error.message}`);
  }
}

function checkCenteredSplash(projectRoot, imagePath, label, configPath) {
  const image = getConfiguredAsset(projectRoot, imagePath, label, configPath);
  if (image.width !== image.height) {
    fail(`${imagePath} must be square for the shared app icon and splash image.`);
  }
  if (image.transparentPixelCount > 0) {
    fail(`${imagePath} must have an opaque background to share the app icon source.`);
  }
  if (image.nonWhiteBounds.maxX < 0) {
    fail(`${imagePath} has no non-white pixels; the splash mark may be missing.`);
  }

  const markCenterX = (image.nonWhiteBounds.minX + image.nonWhiteBounds.maxX) / 2;
  const markCenterY = (image.nonWhiteBounds.minY + image.nonWhiteBounds.maxY) / 2;
  const canvasCenterX = (image.width - 1) / 2;
  const canvasCenterY = (image.height - 1) / 2;
  if (Math.abs(markCenterX - canvasCenterX) > 5 || Math.abs(markCenterY - canvasCenterY) > 5) {
    fail(
      `${imagePath} visible mark must be centered; its center is ` +
        `${markCenterX.toFixed(1)},${markCenterY.toFixed(1)} on a ` +
        `${image.width}×${image.height} canvas.`,
    );
  }

  return image;
}

function checkAdaptiveIcon(projectRoot) {
  const configPath = path.join(projectRoot, "app.json");
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    fail(`Cannot read Expo config at ${configPath}: ${error.message}`);
  }

  const foregroundImage = config?.expo?.android?.adaptiveIcon?.foregroundImage;
  if (typeof foregroundImage !== "string" || foregroundImage.trim() === "") {
    fail(`Expo config ${configPath} must set expo.android.adaptiveIcon.foregroundImage.`);
  }

  const imagePath = path.resolve(projectRoot, foregroundImage);
  const relativeImagePath = path.relative(projectRoot, imagePath);
  if (relativeImagePath.startsWith("..") || path.isAbsolute(relativeImagePath)) {
    fail(`The configured foreground image must be inside the mobile project: ${foregroundImage}.`);
  }
  if (!fs.existsSync(imagePath)) {
    fail(`Configured foreground image does not exist: ${foregroundImage}.`);
  }

  let image;
  try {
    image = parsePng(fs.readFileSync(imagePath), foregroundImage);
  } catch (error) {
    if (error.message.startsWith("[android-adaptive-icon]")) throw error;
    fail(`Cannot inspect ${foregroundImage}: ${error.message}`);
  }

  if (image.width !== image.height) {
    fail(
      `${foregroundImage} must be square; received ${image.width}×${image.height}.`,
    );
  }
  if (image.width < MINIMUM_DIMENSION) {
    fail(
      `${foregroundImage} must be at least ${MINIMUM_DIMENSION}×${MINIMUM_DIMENSION}px; received ${image.width}×${image.height}.`,
    );
  }

  const { minX, minY, maxX, maxY } = image.visibleBounds;
  if (maxX < 0) {
    fail(`${foregroundImage} has no visible pixels; the monogram may be missing.`);
  }

  const margins = {
    left: minX,
    top: minY,
    right: image.width - maxX - 1,
    bottom: image.height - maxY - 1,
  };
  const requiredMargin = Math.ceil((1 - SAFE_ZONE_RATIO) * image.width / 2);
  const unsafeMargins = Object.entries(margins)
    .filter(([, margin]) => margin < requiredMargin)
    .map(([side, margin]) => `${side} ${margin}px`);

  if (unsafeMargins.length > 0) {
    fail(
      `${foregroundImage} visible content is outside Android's central 66/108 safe zone. ` +
        `Required margin: at least ${requiredMargin}px on every side; ` +
        `actual margins: left ${margins.left}px, top ${margins.top}px, ` +
        `right ${margins.right}px, bottom ${margins.bottom}px. ` +
        `Out of bounds: ${unsafeMargins.join(", ")}.`,
    );
  }

  const safeRadius = (SAFE_ZONE_RATIO * image.width) / 2;
  if (image.maxVisibleRadius > safeRadius) {
    fail(
      `${foregroundImage} visible content exceeds Android's central 66/108 circular safe zone. ` +
        `Maximum visible radius: ${image.maxVisibleRadius.toFixed(1)}px; ` +
        `safe radius: ${safeRadius.toFixed(1)}px.`,
    );
  }

  const splashPlugin = config?.expo?.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  )?.[1];
  const splashImagePath = splashPlugin?.image;
  const splashImage = checkCenteredSplash(
    projectRoot,
    splashImagePath,
    "expo-splash-screen",
    configPath,
  );

  if (typeof splashPlugin?.dark?.image === "string") {
    checkCenteredSplash(
      projectRoot,
      splashPlugin.dark.image,
      "dark expo-splash-screen",
      configPath,
    );
  }

  const notificationsPlugin = config?.expo?.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-notifications",
  )?.[1];
  const notificationImagePath = notificationsPlugin?.icon;
  const notificationImage = getConfiguredAsset(
    projectRoot,
    notificationImagePath,
    "expo-notifications",
    configPath,
  );
  if (notificationImage.width !== 96 || notificationImage.height !== 96) {
    fail(
      `${notificationImagePath} must be exactly 96×96px; received ` +
        `${notificationImage.width}×${notificationImage.height}.`,
    );
  }
  if (notificationImage.visibleBounds.maxX < 0) {
    fail(`${notificationImagePath} has no visible pixels; the notification mark may be missing.`);
  }
  if (notificationImage.transparentPixelCount === 0) {
    fail(`${notificationImagePath} must have a transparent background.`);
  }
  if (notificationImage.nonWhiteVisiblePixelCount > 0) {
    fail(`${notificationImagePath} must contain only white visible pixels.`);
  }

  return {
    foregroundImage,
    width: image.width,
    height: image.height,
    margins,
    requiredMargin,
    maxVisibleRadius: image.maxVisibleRadius,
    safeRadius,
    splashImagePath,
    splashWidth: splashImage.width,
    splashHeight: splashImage.height,
    notificationImagePath,
    notificationWidth: notificationImage.width,
    notificationHeight: notificationImage.height,
  };
}

if (require.main === module) {
  try {
    const projectRoot = path.resolve(process.argv[2] || path.join(__dirname, ".."));
    const result = checkAdaptiveIcon(projectRoot);
    console.log(
      `[android-adaptive-icon] Safe-area check passed: ${result.foregroundImage} ` +
        `(${result.width}×${result.height}); margins L/T/R/B ` +
        `${result.margins.left}/${result.margins.top}/${result.margins.right}/${result.margins.bottom}px ` +
        `(minimum ${result.requiredMargin}px); maximum radius ` +
        `${result.maxVisibleRadius.toFixed(1)}px (safe radius ${result.safeRadius.toFixed(1)}px).`,
    );
    console.log(
      `[android-adaptive-icon] Splash and notification checks passed: ${result.splashImagePath} ` +
        `(${result.splashWidth}×${result.splashHeight}, centered on opaque background); ` +
        `${result.notificationImagePath} (${result.notificationWidth}×${result.notificationHeight}, white on transparency).`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { checkAdaptiveIcon, parsePng };
