import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import os from "node:os";
import path from "node:path";
import {
  brotliCompressSync,
  brotliDecompressSync,
  gzipSync,
  gunzipSync,
} from "node:zlib";
import { createTicketingServer } from "./server.mjs";

const assetPath = "/app.js";
const asset = Buffer.from("export const compressionFixture = 'byte-for-byte';\n".repeat(128));
let root;
let server;
let port;

function request(method = "GET", acceptEncoding) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: assetPath,
        method,
        headers: acceptEncoding ? { "Accept-Encoding": acceptEncoding } : {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "ticketing-static-server-"));
  await mkdir(path.join(root, "assets"));
  const filePath = path.join(root, assetPath.slice(1));
  await writeFile(filePath, asset);
  await writeFile(`${filePath}.br`, brotliCompressSync(asset));
  await writeFile(`${filePath}.gz`, gzipSync(asset));

  server = createTicketingServer({ root, mountPath: "/" });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  port = server.address().port;
});

afterAll(async () => {
  if (server?.listening) await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (root) await rm(root, { recursive: true, force: true });
});

describe("ticketing static asset compression over HTTP", () => {
  it.each([
    ["br", brotliDecompressSync],
    ["gzip", gunzipSync],
  ])("serves the %s representation with accurate headers and original bytes", async (encoding, decompress) => {
    const response = await request("GET", encoding);
    const compressed = encoding === "br" ? brotliCompressSync(asset) : gzipSync(asset);

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-encoding"]).toBe(encoding);
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(response.headers["content-length"]).toBe(String(compressed.length));
    expect(decompress(response.body)).toEqual(asset);
  });

  it("returns matching representation headers without a body for HEAD", async () => {
    const response = await request("HEAD", "br");
    const compressed = brotliCompressSync(asset);

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-encoding"]).toBe("br");
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(response.headers["content-length"]).toBe(String(compressed.length));
    expect(response.body).toHaveLength(0);
  });

  it("serves the valid identity representation when compression is explicitly rejected", async () => {
    const response = await request("GET", "br;q=0, gzip;q=0");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(response.headers["content-length"]).toBe(String(asset.length));
    expect(response.body).toEqual(asset);
  });
});
