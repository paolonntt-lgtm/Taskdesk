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

function parsePng(buffer, filePath, { includePixels = false } = {}) {
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
  const rgba = includePixels ? Buffer.alloc(header.width * header.height * 4) : undefined;
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

      if (rgba) {
        const pixelOffset = (y * header.width + x) * 4;
        rgba[pixelOffset] = red;
        rgba[pixelOffset + 1] = green;
        rgba[pixelOffset + 2] = blue;
        rgba[pixelOffset + 3] = alpha;
      }
    }

    previousRow = row;
  }

  return {
    ...header,
    ...(rgba ? { rgba } : {}),
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

function linearizeColor(channel) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(red, green, blue) {
  return (
    0.2126 * linearizeColor(red) +
    0.7152 * linearizeColor(green) +
    0.0722 * linearizeColor(blue)
  );
}

function contrastRatio(first, second) {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function downsampleRgba(image, size) {
  const pixels = [];
  const sourceScale = image.width / size;

  for (let outputY = 0; outputY < size; outputY += 1) {
    const top = outputY * sourceScale;
    const bottom = (outputY + 1) * sourceScale;
    for (let outputX = 0; outputX < size; outputX += 1) {
      const left = outputX * sourceScale;
      const right = (outputX + 1) * sourceScale;
      let alphaSum = 0;
      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;
      let weightSum = 0;

      for (let sourceY = Math.floor(top); sourceY < Math.ceil(bottom); sourceY += 1) {
        const verticalWeight =
          Math.min(bottom, sourceY + 1) - Math.max(top, sourceY);
        for (let sourceX = Math.floor(left); sourceX < Math.ceil(right); sourceX += 1) {
          const horizontalWeight =
            Math.min(right, sourceX + 1) - Math.max(left, sourceX);
          const weight = horizontalWeight * verticalWeight;
          const sourceOffset = (sourceY * image.width + sourceX) * 4;
          const alpha = image.rgba[sourceOffset + 3] / 255;
          alphaSum += alpha * weight;
          redSum += image.rgba[sourceOffset] * alpha * weight;
          greenSum += image.rgba[sourceOffset + 1] * alpha * weight;
          blueSum += image.rgba[sourceOffset + 2] * alpha * weight;
          weightSum += weight;
        }
      }

      const alpha = alphaSum / weightSum;
      pixels.push({
        x: outputX,
        y: outputY,
        alpha,
        red: alphaSum > 0 ? redSum / alphaSum : 0,
        green: alphaSum > 0 ? greenSum / alphaSum : 0,
        blue: alphaSum > 0 ? blueSum / alphaSum : 0,
      });
    }
  }

  return pixels;
}

const FAVICON_SIZES = [16, 32, 48];
const FAVICON_BACKGROUNDS = {
  light: [241, 243, 244],
  dark: [32, 33, 36],
};
const MINIMUM_FAVICON_CONTRAST = 2;
const MINIMUM_FAVICON_ALPHA = 0.25;

function checkFaviconRendition(filePath, size, pixels) {
  const visiblePixels = pixels.filter((pixel) => pixel.alpha >= MINIMUM_FAVICON_ALPHA);
  const transparentPixels = pixels.filter((pixel) => pixel.alpha < 0.05);
  if (transparentPixels.length === 0) {
    fail(`${filePath} loses transparency at ${size}×${size}px.`);
  }

  const bounds = visiblePixels.reduce(
    (result, pixel) => ({
      minX: Math.min(result.minX, pixel.x),
      minY: Math.min(result.minY, pixel.y),
      maxX: Math.max(result.maxX, pixel.x),
      maxY: Math.max(result.maxY, pixel.y),
    }),
    { minX: size, minY: size, maxX: -1, maxY: -1 },
  );
  if (bounds.maxX < 0) {
    fail(`${filePath} monogram is not visible at ${size}×${size}px.`);
  }
  if (
    bounds.maxX - bounds.minX + 1 < size * 0.45 ||
    bounds.maxY - bounds.minY + 1 < size * 0.35
  ) {
    fail(
      `${filePath} monogram is too small to distinguish at ${size}×${size}px ` +
        `(${bounds.maxX - bounds.minX + 1}×${bounds.maxY - bounds.minY + 1}px).`,
    );
  }

  const backgroundChecks = {};
  for (const [background, backgroundColor] of Object.entries(FAVICON_BACKGROUNDS)) {
    const backgroundLuminance = relativeLuminance(...backgroundColor);
    const distinctPixels = visiblePixels.filter((pixel) => {
      const blendedRed = pixel.red * pixel.alpha + backgroundColor[0] * (1 - pixel.alpha);
      const blendedGreen = pixel.green * pixel.alpha + backgroundColor[1] * (1 - pixel.alpha);
      const blendedBlue = pixel.blue * pixel.alpha + backgroundColor[2] * (1 - pixel.alpha);
      return (
        contrastRatio(
          relativeLuminance(blendedRed, blendedGreen, blendedBlue),
          backgroundLuminance,
        ) >= MINIMUM_FAVICON_CONTRAST
      );
    });
    const minimumDistinctPixels = Math.ceil(size * size * 0.1);
    if (distinctPixels.length < minimumDistinctPixels) {
      fail(
        `${filePath} monogram is not sufficiently distinguishable on a ${background} ` +
          `background at ${size}×${size}px (${distinctPixels.length} clear pixels; ` +
          `at least ${minimumDistinctPixels} required).`,
      );
    }
    backgroundChecks[background] = distinctPixels.length;
  }

  return { size, transparentPixels: transparentPixels.length, backgroundChecks };
}

function checkFavicon(projectRoot, faviconPath, configPath) {
  const favicon = getConfiguredAsset(projectRoot, faviconPath, "web.favicon", configPath);
  if (favicon.width !== favicon.height) {
    fail(`${faviconPath} must be square to render consistently in browser tabs.`);
  }
  if (favicon.transparentPixelCount === 0) {
    fail(`${faviconPath} must preserve transparent pixels around the monogram.`);
  }
  const faviconWithPixels = parsePng(
    fs.readFileSync(path.resolve(projectRoot, faviconPath)),
    faviconPath,
    { includePixels: true },
  );

  return {
    faviconPath,
    renditions: FAVICON_SIZES.map((size) =>
      checkFaviconRendition(faviconPath, size, downsampleRgba(faviconWithPixels, size)),
    ),
  };
}

function parseIcoFrames(buffer, filePath) {
  if (
    buffer.length < 6 ||
    buffer.readUInt16LE(0) !== 0 ||
    buffer.readUInt16LE(2) !== 1
  ) {
    fail(`${filePath} is not a valid Windows icon file.`);
  }
  const frameCount = buffer.readUInt16LE(4);
  if (frameCount === 0 || 6 + frameCount * 16 > buffer.length) {
    fail(`${filePath} has an invalid icon directory.`);
  }

  const frames = [];
  for (let index = 0; index < frameCount; index += 1) {
    const entryOffset = 6 + index * 16;
    const width = buffer[entryOffset] || 256;
    const height = buffer[entryOffset + 1] || 256;
    const dataLength = buffer.readUInt32LE(entryOffset + 8);
    const dataOffset = buffer.readUInt32LE(entryOffset + 12);
    const dataEnd = dataOffset + dataLength;
    if (dataOffset < 6 + frameCount * 16 || dataEnd > buffer.length) {
      fail(`${filePath} has an invalid ${width}×${height}px frame range.`);
    }
    const frameData = buffer.subarray(dataOffset, dataEnd);

    if (frameData.subarray(0, 8).equals(PNG_SIGNATURE)) {
      const image = parsePng(frameData, `${filePath} (${width}×${height}px)`, {
        includePixels: true,
      });
      if (image.width !== width || image.height !== height) {
        fail(`${filePath} frame directory dimensions do not match the embedded PNG.`);
      }
      frames.push({ width, height, rgba: image.rgba });
      continue;
    }

    if (frameData.length < 40) {
      fail(`${filePath} has a truncated ${width}×${height}px bitmap frame.`);
    }
    const headerSize = frameData.readUInt32LE(0);
    const bitmapWidth = frameData.readInt32LE(4);
    const bitmapHeight = Math.abs(frameData.readInt32LE(8));
    const bitDepth = frameData.readUInt16LE(14);
    const compression = frameData.readUInt32LE(16);
    if (
      headerSize < 40 ||
      bitmapWidth !== width ||
      bitmapHeight !== height * 2 ||
      bitDepth !== 32 ||
      compression !== 0
    ) {
      fail(
        `${filePath} ${width}×${height}px frame must use an uncompressed 32-bit icon bitmap.`,
      );
    }
    const rowStride = Math.ceil((width * bitDepth) / 32) * 4;
    const pixelDataOffset = headerSize;
    const pixelDataEnd = pixelDataOffset + rowStride * height;
    if (pixelDataEnd > frameData.length) {
      fail(`${filePath} has truncated pixel data in its ${width}×${height}px frame.`);
    }
    const rgba = Buffer.alloc(width * height * 4);
    const topDown = frameData.readInt32LE(8) < 0;
    for (let y = 0; y < height; y += 1) {
      const sourceY = topDown ? y : height - 1 - y;
      for (let x = 0; x < width; x += 1) {
        const sourceOffset = pixelDataOffset + sourceY * rowStride + x * 4;
        const targetOffset = (y * width + x) * 4;
        rgba[targetOffset] = frameData[sourceOffset + 2];
        rgba[targetOffset + 1] = frameData[sourceOffset + 1];
        rgba[targetOffset + 2] = frameData[sourceOffset];
        rgba[targetOffset + 3] = frameData[sourceOffset + 3];
      }
    }
    frames.push({ width, height, rgba });
  }

  return frames;
}

function checkExportedFavicon(projectRoot, icoPath) {
  const absolutePath = path.resolve(projectRoot, icoPath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Exported favicon does not exist: ${icoPath}.`);
  }
  const buffer = fs.readFileSync(absolutePath);
  const frames = parseIcoFrames(buffer, icoPath);
  const sizes = frames.map(({ width, height }) => `${width}×${height}`);
  const expectedSizes = FAVICON_SIZES.map((size) => `${size}×${size}`);
  if (
    sizes.length !== expectedSizes.length ||
    expectedSizes.some((size) => !sizes.includes(size))
  ) {
    fail(
      `${icoPath} must contain exactly 16×16, 32×32, and 48×48px frames; ` +
        `found ${sizes.join(", ")}.`,
    );
  }
  const renditions = frames
    .sort((first, second) => first.width - second.width)
    .map(({ width, height, rgba }) => {
      const pixels = Array.from({ length: width * height }, (_, index) => ({
        x: index % width,
        y: Math.floor(index / width),
        red: rgba[index * 4],
        green: rgba[index * 4 + 1],
        blue: rgba[index * 4 + 2],
        alpha: rgba[index * 4 + 3] / 255,
      }));
      return checkFaviconRendition(icoPath, width, pixels);
    });
  return { icoPath, renditions };
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

  const faviconPath = config?.expo?.web?.favicon;
  if (typeof faviconPath !== "string" || faviconPath.trim() === "") {
    fail(`Expo config ${configPath} must set expo.web.favicon.`);
  }
  const favicon = checkFavicon(projectRoot, faviconPath, configPath);
  const exportedFavicon = checkExportedFavicon(projectRoot, "./static-build/favicon.ico");

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
    favicon: { ...favicon, exported: exportedFavicon },
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
    console.log(
      `[android-adaptive-icon] Favicon checks passed: ${result.favicon.faviconPath}; ` +
        result.favicon.renditions
          .map(
            ({ size, transparentPixels, backgroundChecks }) =>
              `${size}×${size}px (${transparentPixels} transparent, ` +
              `${backgroundChecks.light}/${backgroundChecks.dark} clear pixels on light/dark)`,
          )
          .join("; "),
    );
    console.log(
      `[android-adaptive-icon] Exported favicon checks passed: ${result.favicon.exported.icoPath}; ` +
        result.favicon.exported.renditions
          .map(
            ({ size, transparentPixels, backgroundChecks }) =>
              `${size}×${size}px (${transparentPixels} transparent, ` +
              `${backgroundChecks.light}/${backgroundChecks.dark} clear pixels on light/dark)`,
          )
          .join("; "),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkAdaptiveIcon,
  checkExportedFavicon,
  checkFavicon,
  parseIcoFrames,
  parsePng,
};
