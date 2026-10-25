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
      paletteAlpha = Buffer.from(data);
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
  let maxVisibleRadiusSquared = 0;
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
      let alpha = 255;
      if (header.colorType === 4) {
        alpha = row[x * 2 + 1];
      } else if (header.colorType === 6) {
        alpha = row[x * 4 + 3];
      } else if (header.colorType === 3 && paletteAlpha && row[x] < paletteAlpha.length) {
        alpha = paletteAlpha[row[x]];
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
    maxVisibleRadius: Math.sqrt(maxVisibleRadiusSquared),
  };
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

  return {
    foregroundImage,
    width: image.width,
    height: image.height,
    margins,
    requiredMargin,
    maxVisibleRadius: image.maxVisibleRadius,
    safeRadius,
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
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { checkAdaptiveIcon, parsePng };
