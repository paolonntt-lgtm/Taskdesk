import fs from "node:fs";
import path from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const publicDir = path.resolve("dist/public");
const compressibleExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".txt", ".xml", ".webmanifest"]);
const minimumSize = 1024;
let compressedFiles = 0;

function compressDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      compressDirectory(filePath);
      continue;
    }

    if (!entry.isFile() || !compressibleExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const source = fs.readFileSync(filePath);
    if (source.length < minimumSize) continue;

    const brotli = brotliCompressSync(source, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
    });
    const gzip = gzipSync(source, { level: 6 });
    fs.writeFileSync(`${filePath}.br`, brotli);
    fs.writeFileSync(`${filePath}.gz`, gzip);
    compressedFiles += 1;
  }
}

if (!fs.existsSync(publicDir)) {
  throw new Error(`Static build output was not found: ${publicDir}`);
}

compressDirectory(publicDir);
console.log(`Generated Brotli and gzip variants for ${compressedFiles} static files.`);
