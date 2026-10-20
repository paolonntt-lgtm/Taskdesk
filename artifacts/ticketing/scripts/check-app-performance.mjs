import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const sampleCount = 5;
const thresholds = {
  ttfbMs: 500,
  lcpMs: 2500,
  transferredBytes: 1_000_000,
};

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not reserve a local port"));
        return;
      }
      const port = address.port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitFor(check, description, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch {
      // The process may need another moment to bind its local port.
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function connectCdp(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

function createCdpClient(socket) {
  let nextId = 0;
  const pending = new Map();
  const events = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    } else {
      events.push(message);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`Chrome DevTools command timed out: ${method}`));
        }
      }, 20_000);
    });
  }

  return { events, send };
}

async function reserveBrowserPage(chrome, profileDir) {
  const portFile = path.join(profileDir, "DevToolsActivePort");
  await waitFor(() => fs.existsSync(portFile), "Chromium DevTools");
  const [debugPort] = fs.readFileSync(portFile, "utf8").trim().split("\n");
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("Chromium started without a page target");
  return { debugPort, page };
}

function waitForLoadEvent(events, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      const index = events.findIndex((event) => event.method === "Page.loadEventFired");
      if (index >= 0) {
        events.splice(index, 1);
        resolve();
      } else if (Date.now() >= deadline) {
        reject(new Error("Chromium did not finish loading /app/"));
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  });
}

function medianStatus(name, value, limit, unit) {
  const pass = Number.isFinite(value) && value <= limit;
  return {
    name,
    median: Math.round(value),
    limit,
    unit,
    status: pass ? "PASS" : "FAIL",
  };
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  const stopped = await Promise.race([exited.then(() => true), sleep(2000).then(() => false)]);
  if (!stopped) {
    child.kill("SIGKILL");
    await Promise.race([exited, sleep(2000)]);
  }
}

async function main() {
  const appDir = path.resolve(".");
  const serverPath = path.join(appDir, "server.mjs");
  const chromium = process.env.CHROMIUM_PATH || "chromium";
  const port = await reservePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "ticketing-perf-chrome-"));
  const serverOutput = [];
  let server;
  let browser;
  let socket;

  try {
    if (!fs.existsSync(path.join(appDir, "dist/public/index.html"))) {
      throw new Error("Build output is missing. Run the package build before this check.");
    }

    server = spawn(process.execPath, [serverPath], {
      cwd: appDir,
      env: { ...process.env, PORT: String(port), BASE_PATH: "/app/" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [server.stdout, server.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        serverOutput.push(chunk);
        if (serverOutput.join("").length > 4000) serverOutput.shift();
      });
    }

    const healthUrl = `http://127.0.0.1:${port}/app/healthz`;
    await waitFor(async () => {
      if (server.exitCode !== null) {
        throw new Error(`Ticketing server exited early:\n${serverOutput.join("")}`);
      }
      const response = await fetch(healthUrl);
      return response.ok;
    }, "the built ticketing server");

    browser = spawn(chromium, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--no-first-run",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ], { stdio: "ignore" });

    const { debugPort, page } = await reserveBrowserPage(browser, profileDir);
    socket = await connectCdp(page.webSocketDebuggerUrl);
    const { events, send } = createCdpClient(socket);
    await send("Page.enable");
    await send("Network.enable");
    await send("Performance.enable");
    await send("Page.bringToFront");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.__appPerf = { lcp: 0 };
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) window.__appPerf.lcp = entry.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch {}
      `,
    });

    const url = `http://127.0.0.1:${port}/app/`;
    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      await send("Network.clearBrowserCache");
      events.length = 0;
      const loaded = waitForLoadEvent(events);
      const navigation = await send("Page.navigate", { url });
      if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);
      await loaded;
      await send("Runtime.evaluate", {
        expression: "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
        awaitPromise: true,
      });
      await sleep(500);

      const documentResponse = events.find((event) =>
        event.method === "Network.responseReceived"
        && event.params.type === "Document"
        && new URL(event.params.response.url).pathname === "/app/",
      );
      if (!documentResponse || documentResponse.params.response.status !== 200) {
        throw new Error(`Expected /app/ to return 200; received ${documentResponse?.params.response.status ?? "no response"}`);
      }

      const evaluated = await send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          const resources = performance.getEntriesByType("resource");
          const paints = performance.getEntriesByType("paint");
          const observedLcp = window.__appPerf?.lcp || 0;
          const bufferedLcp = performance.getEntriesByType("largest-contentful-paint").at(-1)?.startTime || 0;
          return {
            pathname: location.pathname,
            title: document.title,
            ttfbMs: nav?.responseStart ?? NaN,
            lcpMs: observedLcp || bufferedLcp,
            transferredBytes: (nav?.transferSize || 0) + resources.reduce((sum, resource) => sum + resource.transferSize, 0),
            fcpMs: paints.find((entry) => entry.name === "first-contentful-paint")?.startTime || 0
          };
        })()`,
      });
      const result = evaluated.result?.value;
      if (!result || result.pathname !== "/app/" || !Number.isFinite(result.ttfbMs) || !Number.isFinite(result.lcpMs) || result.lcpMs <= 0) {
        throw new Error(`Could not collect all performance metrics: ${JSON.stringify(result)}`);
      }
      samples.push({
        ttfbMs: result.ttfbMs,
        lcpMs: result.lcpMs,
        transferredBytes: result.transferredBytes,
      });
    }

    const medians = {
      ttfbMs: median(samples.map((sample) => sample.ttfbMs)),
      lcpMs: median(samples.map((sample) => sample.lcpMs)),
      transferredBytes: median(samples.map((sample) => sample.transferredBytes)),
    };
    const checks = [
      medianStatus("TTFB", medians.ttfbMs, thresholds.ttfbMs, "ms"),
      medianStatus("LCP", medians.lcpMs, thresholds.lcpMs, "ms"),
      medianStatus("Transferred bytes", medians.transferredBytes, thresholds.transferredBytes, "bytes"),
    ];
    const passed = checks.every((check) => check.status === "PASS");

    console.log(`/app/ performance check — ${sampleCount} cold-cache samples (median)`);
    for (const check of checks) {
      console.log(`${check.status}: ${check.name} ${check.median} ${check.unit} (limit ${check.limit} ${check.unit})`);
    }
    console.log(`Samples: ${JSON.stringify(samples.map((sample) => ({
      ttfbMs: Math.round(sample.ttfbMs),
      lcpMs: Math.round(sample.lcpMs),
      transferredBytes: Math.round(sample.transferredBytes),
    })))}`);
    console.log(passed ? "RESULT: PASS" : "RESULT: FAIL");
    if (!passed) process.exitCode = 1;
    console.log(`Chromium DevTools port used: ${debugPort}`);
  } finally {
    socket?.close();
    await Promise.all([stopProcess(browser), stopProcess(server)]);
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(`Performance check failed: ${error.message}`);
  process.exitCode = 1;
});
