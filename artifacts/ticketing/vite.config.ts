import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// PORT and BASE_PATH are provided by the workflow at dev time.
// During a production build (vite build) they are not set — use safe defaults
// so the config file loads without throwing.
const port = Number(process.env.PORT ?? 3000);
const basePath = process.env.BASE_PATH ?? "/app/";

// Plugin that prevents browsers from caching index.html so deploys take effect immediately.
// Hashed JS/CSS assets are unaffected and can still be cached long-term.
const noCacheHtml = (): import("vite").Plugin => ({
  name: "no-cache-html",
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      const url = _req.url ?? "";
      if (url === "/" || url.startsWith("/?") || url.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((_req, res, next) => {
      const url = _req.url ?? "";
      if (url === "/" || url.startsWith("/?") || url.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
      next();
    });
  },
});

export default defineConfig({
  base: basePath,
  plugins: [
    noCacheHtml(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
