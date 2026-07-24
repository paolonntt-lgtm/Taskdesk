import express from "express";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 18150);
const distPublic = resolve(__dirname, "dist/public");

const app = express();

// Health check
app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

// Redirect /<path>/index.html → /<path>/ (301 permanent — eliminates duplicate crawl paths)
app.use((req, res, next) => {
  if (req.path.endsWith("/index.html")) {
    const cleanPath = req.path.slice(0, -"index.html".length) || "/";
    return res.redirect(301, cleanPath);
  }
  next();
});

// Real HTTP 302 redirects for bare (language-less) routes
const BARE_REDIRECTS = {
  "/privacy-policy": "/it/privacy-policy",
  "/terms": "/it/terms",
  "/dpa": "/it/dpa",
  "/cookie-policy": "/it/cookie-policy",
};

// 301 permanent redirects: English legal pages → Italian canonical (legal content is IT-only)
const EN_LEGAL_REDIRECTS = {
  "/en/privacy-policy": "/it/privacy-policy",
  "/en/terms": "/it/terms",
  "/en/dpa": "/it/dpa",
  "/en/cookie-policy": "/it/cookie-policy",
};

app.use((req, res, next) => {
  if (req.path === "/") {
    return res.redirect(302, "/it/");
  }
  const enLegalTarget = EN_LEGAL_REDIRECTS[req.path];
  if (enLegalTarget) {
    return res.redirect(301, enLegalTarget);
  }
  const target = BARE_REDIRECTS[req.path];
  if (target) {
    return res.redirect(302, target);
  }
  next();
});

// Serve static assets (JS, CSS, images, etc.)
app.use(express.static(distPublic, { index: false }));

// For every other request: serve prerendered index.html if available, else real 404
app.use((req, res) => {
  const normalizedPath = req.path.endsWith("/") ? req.path : `${req.path}/`;
  const prerendered = resolve(distPublic, normalizedPath.slice(1), "index.html");
  if (existsSync(prerendered)) {
    return res.sendFile(prerendered);
  }
  const direct = resolve(distPublic, req.path.slice(1));
  if (existsSync(direct) && !direct.endsWith("/")) {
    return res.sendFile(direct);
  }
  // Unknown route — serve the prerendered 404 page with a real 404 status so
  // crawlers do not index soft-404s as duplicate copies of the home page.
  const notFoundPage = resolve(distPublic, "404", "index.html");
  if (existsSync(notFoundPage)) {
    return res.status(404).sendFile(notFoundPage);
  }
  res.status(404).send("Not Found");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Landing server listening on port ${port}`);
});
