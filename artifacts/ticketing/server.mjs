import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enforceStagingAccess, isStagingRequest } from "../web-security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.resolve(process.env.TICKETING_STATIC_ROOT ?? path.join(__dirname, "dist/public"));
const port = Number(process.env.PORT ?? 25627);
const basePath = (process.env.BASE_PATH ?? "/app/").replace(/\/+$/, "") || "/";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

const COMPRESSIBLE_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".svg", ".txt", ".xml", ".webmanifest"]);
const MIN_COMPRESSION_SIZE = 1024;

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function getEncodingQuality(acceptEncoding, encoding) {
  let wildcardQuality = 0;
  for (const item of (acceptEncoding || "").split(",")) {
    const [name, ...parameters] = item.trim().toLowerCase().split(";");
    let quality = 1;
    for (const parameter of parameters) {
      const match = parameter.trim().match(/^q=(0(?:\.\d+)?|1(?:\.0+)?)$/);
      if (match) quality = Number(match[1]);
    }
    if (name === encoding) return quality;
    if (name === "*") wildcardQuality = quality;
  }
  return wildcardQuality;
}

function preferredEncoding(req, filePath, fileSize) {
  const extension = path.extname(filePath).toLowerCase();
  if (fileSize < MIN_COMPRESSION_SIZE || !COMPRESSIBLE_EXTENSIONS.has(extension)) return null;

  const acceptEncoding = req.headers["accept-encoding"];
  const brotliQuality = getEncodingQuality(acceptEncoding, "br");
  const gzipQuality = getEncodingQuality(acceptEncoding, "gzip");
  if (brotliQuality > 0 && brotliQuality >= gzipQuality) return "br";
  if (gzipQuality > 0) return "gzip";
  return null;
}

function writeResponse(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  if (res.req?.method !== "HEAD") res.end(body);
  else res.end();
}

function resolveStaticPath(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return { error: "invalid" };
  }

  const candidate = path.resolve(staticRoot, `.${decoded}`);
  if (candidate !== staticRoot && !candidate.startsWith(`${staticRoot}${path.sep}`)) {
    return { error: "forbidden" };
  }
  return { path: candidate };
}

function serveFile(filePath, req, res, staging) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const isHtml = path.extname(filePath).toLowerCase() === ".html";
  const fileSize = fs.statSync(filePath).size;
  const requestedEncoding = preferredEncoding(req, filePath, fileSize);
  const compressedPath = requestedEncoding
    ? `${filePath}.${requestedEncoding === "br" ? "br" : "gz"}`
    : null;
  const useCompressedFile = compressedPath && fs.existsSync(compressedPath);
  const body = fs.readFileSync(useCompressedFile ? compressedPath : filePath);
  const headers = {
    "Content-Type": contentType(filePath),
    "Content-Length": body.length,
    "Cache-Control": staging
      ? "no-store, max-age=0"
      : isHtml
        ? "no-store, max-age=0"
        : "public, max-age=31536000, immutable",
  };
  if (fileSize >= MIN_COMPRESSION_SIZE && COMPRESSIBLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    headers.Vary = "Accept-Encoding";
  }
  if (useCompressedFile) {
    headers["Content-Encoding"] = requestedEncoding;
  }
  writeResponse(res, 200, headers, body);
  return true;
}

const server = http.createServer((req, res) => {
  if (enforceStagingAccess(req, res, { healthPaths: ["/healthz", `${basePath}/healthz`] })) {
    return;
  }

  const parsedUrl = new URL(req.url || "/", "http://localhost");
  let pathname = parsedUrl.pathname;
  if (basePath !== "/" && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
    pathname = pathname.slice(basePath.length) || "/";
  } else if (basePath !== "/" && pathname !== "/healthz") {
    writeResponse(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found");
    return;
  }

  if (pathname === "/healthz") {
    writeResponse(res, 200, { "Content-Type": "text/plain; charset=utf-8" }, "ok");
    return;
  }

  const resolved = resolveStaticPath(pathname);
  if (resolved.error === "invalid") {
    writeResponse(res, 400, { "Content-Type": "text/plain; charset=utf-8" }, "Bad Request");
    return;
  }
  if (resolved.error === "forbidden") {
    writeResponse(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Forbidden");
    return;
  }

  const staging = isStagingRequest(req);
  if ([".map", ".br", ".gz"].includes(path.extname(resolved.path).toLowerCase())) {
    writeResponse(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found");
    return;
  }
  if (serveFile(resolved.path, req, res, staging)) return;

  const indexPath = path.join(staticRoot, "index.html");
  if (serveFile(indexPath, req, res, staging)) return;
  writeResponse(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Ticketing server listening on port ${port}`);
});