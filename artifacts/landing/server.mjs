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

// Real HTTP 302 redirects for bare (language-less) routes
const BARE_REDIRECTS = {
  "/privacy-policy": "/it/privacy-policy",
  "/terms": "/it/terms",
  "/dpa": "/it/dpa",
  "/cookie-policy": "/it/cookie-policy",
};

app.use((req, res, next) => {
  if (req.path === "/") {
    return res.redirect(302, "/it/");
  }
  const target = BARE_REDIRECTS[req.path];
  if (target) {
    return res.redirect(302, target);
  }
  next();
});

// Serve static assets (JS, CSS, images, etc.)
app.use(express.static(distPublic, { index: false }));

// For every other request: serve prerendered index.html if available, else root index.html
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
  res.sendFile(resolve(distPublic, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Landing server listening on port ${port}`);
});
