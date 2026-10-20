import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from "node:zlib";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

const basePath = "/app/";
const largeText = Buffer.from("const compressionFixture = 'static asset';\n".repeat(300));
const smallText = Buffer.from("export const small = true;\n");

let serverProcess: ChildProcess;
let fixtureRoot: string;
let port: number;

function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not reserve a local test port"));
        return;
      }
      const selectedPort = address.port;
      probe.close((error) => error ? reject(error) : resolve(selectedPort));
    });
  });
}

function request(
  pathname: string,
  headers: Record<string, string> = {},
  method = "GET",
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: pathname, method, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        }));
      },
    );
    req.once("error", reject);
    req.end();
  });
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Static test server exited with code ${serverProcess.exitCode}`);
    }
    try {
      const response = await request("/app/healthz");
      if (response.status === 200 && response.body.toString() === "ok") return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Static test server did not become ready");
}

describe("ticketing static asset compression", () => {
  beforeAll(async () => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ticketing-static-compression-"));
    const assetsDir = path.join(fixtureRoot, "assets");
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, "index.html"), largeText);
    fs.writeFileSync(path.join(assetsDir, "fixture.js"), largeText);
    fs.writeFileSync(path.join(assetsDir, "fixture.js.br"), brotliCompressSync(largeText));
    fs.writeFileSync(path.join(assetsDir, "fixture.js.gz"), gzipSync(largeText));
    fs.writeFileSync(path.join(assetsDir, "small.js"), smallText);
    fs.writeFileSync(path.join(assetsDir, "small.js.br"), brotliCompressSync(smallText));
    fs.writeFileSync(path.join(assetsDir, "logo.webp"), Buffer.from([0x52, 0x49, 0x46, 0x46]));

    port = await reservePort();
    serverProcess = spawn(process.execPath, [path.resolve("server.mjs")], {
      cwd: path.resolve("."),
      env: {
        ...process.env,
        PORT: String(port),
        BASE_PATH: basePath,
        TICKETING_STATIC_ROOT: fixtureRoot,
      },
      stdio: "ignore",
    });
    await waitForServer();
  });

  afterAll(() => {
    serverProcess?.kill("SIGTERM");
    if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it("serves valid Brotli with matching Vary and Content-Length headers", async () => {
    const response = await request("/app/assets/fixture.js", { "Accept-Encoding": "br, gzip" });

    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBe("br");
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(Number(response.headers["content-length"])).toBe(response.body.length);
    expect(brotliDecompressSync(response.body)).toEqual(largeText);
  });

  it("serves valid gzip when Brotli is refused or has a lower quality", async () => {
    const refusedBrotli = await request("/app/assets/fixture.js", {
      "Accept-Encoding": "br;q=0, gzip;q=1",
    });
    const lowerQualityBrotli = await request("/app/assets/fixture.js", {
      "Accept-Encoding": "br;q=0.5, gzip;q=1",
    });

    for (const response of [refusedBrotli, lowerQualityBrotli]) {
      expect(response.status).toBe(200);
      expect(response.headers["content-encoding"]).toBe("gzip");
      expect(gunzipSync(response.body)).toEqual(largeText);
    }
  });

  it("serves the original bytes without Content-Encoding when compression is not accepted", async () => {
    const response = await request("/app/assets/fixture.js", { "Accept-Encoding": "identity" });

    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(Number(response.headers["content-length"])).toBe(largeText.length);
    expect(response.body).toEqual(largeText);
  });

  it("does not compress small or already-compressed image assets", async () => {
    const small = await request("/app/assets/small.js", { "Accept-Encoding": "br, gzip" });
    const image = await request("/app/assets/logo.webp", { "Accept-Encoding": "br, gzip" });

    expect(small.headers["content-encoding"]).toBeUndefined();
    expect(image.headers["content-encoding"]).toBeUndefined();
    expect(image.headers["content-type"]).toBe("image/webp");
  });

  it("supports HEAD and does not expose the precompressed sidecar directly", async () => {
    const head = await request("/app/assets/fixture.js", { "Accept-Encoding": "br" }, "HEAD");
    const sidecar = await request("/app/assets/fixture.js.br", { "Accept-Encoding": "identity" });

    expect(head.status).toBe(200);
    expect(head.headers["content-encoding"]).toBe("br");
    expect(head.body.length).toBe(0);
    expect(Number(head.headers["content-length"])).toBe(brotliCompressSync(largeText).length);
    expect(sidecar.status).toBe(404);
  });
});
