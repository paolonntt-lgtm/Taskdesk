import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import { JSDOM } from "jsdom";

let server;
let origin;

before(async () => {
  server = spawn(process.execPath, ["server.mjs"], {
    cwd: import.meta.dirname,
    env: { ...process.env, PORT: "0", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Exercise the normal public-production host path without disabling staging
  // protection or requiring credentials.
  origin = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 10_000);
    server.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited (${code}): ${output}`));
    });
    server.stderr.on("data", (chunk) => { output += chunk; });
    server.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/Landing server listening on port (\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
  });
});

after(async () => {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
});

function request(path, options = {}) {
  return fetch(new URL(path, origin), {
    ...options,
    redirect: "manual",
    headers: { "X-Forwarded-Host": "taskdesk.it", ...options.headers },
  });
}

async function page(path) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} must return 200 directly`);
  assert.equal(response.headers.get("location"), null, `${path} must not redirect`);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const document = new JSDOM(await response.text()).window.document;
  assert.ok(document.querySelector("h1"), `${path} must contain prerendered content`);
  return document;
}

async function redirect(path, target, options) {
  const response = await request(path, options);
  assert.equal(response.status, 301, path);
  assert.equal(response.headers.get("location"), target, path);
  const finalResponse = await request(target, options);
  assert.equal(finalResponse.status, 200, `${path} must converge in one redirect`);
  assert.equal(finalResponse.headers.get("location"), null);
}

test("all sitemap, canonical and hreflang targets serve the actual localized page without redirects", async () => {
  const paths = new Set();
  for (const lang of ["it", "en"]) {
    const response = await request(`/sitemap-${lang}.xml`);
    assert.equal(response.status, 200);
    const xml = new JSDOM(await response.text(), { contentType: "text/xml" }).window.document;
    for (const element of xml.querySelectorAll("loc, [hreflang]")) {
      const url = new URL(element.getAttribute("href") ?? element.textContent.trim());
      paths.add(url.pathname);
    }
  }
  assert.equal(paths.size, 14, "both homes and all twelve profession pages must be covered");

  for (const path of paths) {
    const document = await page(path);
    const builtHtml = readFileSync(new URL(`./dist/public${path.replace(/\/$/, "")}/index.html`, import.meta.url), "utf8");
    const expected = new JSDOM(builtHtml).window.document;
    assert.equal(document.title, expected.title, `${path} must serve its own built page`);
    assert.equal(document.documentElement.lang, path.split("/")[1]);
    assert.equal(document.querySelector("h1").textContent, expected.querySelector("h1").textContent);
    const canonical = document.querySelector('link[rel="canonical"]').href;
    assert.equal(new URL(canonical).pathname, path);
    for (const link of document.querySelectorAll('link[rel="canonical"], link[hreflang]')) {
      const target = new URL(link.href).pathname;
      assert.ok(paths.has(target), `${path} advertises an unexpected target: ${target}`);
      const targetDocument = await page(target);
      assert.equal(targetDocument.querySelector('link[rel="canonical"]').href, link.href);
    }
    assert.ok(document.querySelectorAll("link[hreflang]").length >= 3);
  }
});

test("slash, index.html and bare-home variants converge to canonical URLs in one direction", async () => {
  for (const lang of ["it", "en"]) {
    const xml = new JSDOM(readFileSync(new URL(`./dist/public/sitemap-${lang}.xml`, import.meta.url), "utf8"), {
      contentType: "text/xml",
    }).window.document;
    for (const loc of xml.querySelectorAll("loc")) {
      const path = new URL(loc.textContent.trim()).pathname;
      const home = path === `/${lang}/`;
      if (home) {
        await redirect(`/${lang}`, path);
      } else {
        await redirect(`${path}/`, path);
        await redirect(`${path}/?utm_source=seo&lang=${lang}`, `${path}?utm_source=seo&lang=${lang}`);
        await redirect(`${path}/`, path, { method: "HEAD" });
      }
      await redirect(`${path.replace(/\/$/, "")}/index.html`, path);
    }
  }
  await redirect("/", "/it/");
});

test("static assets, health checks, legal redirects and real 404s remain available", async () => {
  for (const path of ["/healthz", "/robots.txt", "/llms.txt", "/favicon.svg"]) {
    assert.equal((await request(path)).status, 200, path);
  }
  for (const slug of ["terms", "privacy-policy", "cookie-policy", "dpa"]) {
    await redirect(`/${slug}`, `/it/${slug}`);
    await redirect(`/en/${slug}`, `/it/${slug}`);
  }
  for (const path of ["/it/nonexistent", "/it/nonexistent/"]) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("location"), null);
  }
});
