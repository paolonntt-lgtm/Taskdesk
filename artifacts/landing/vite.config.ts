import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { sitemapPlugin } from "./vite-plugin-sitemap";
import { SITEMAP_ROUTE_META, SITEMAP_BASE_URL } from "./sitemap-routes";

/**
 * Automatically injects a <link rel="preload"> for the Inter WOFF2 font into
 * the built index.html so the browser can begin fetching it before it parses
 * the CSS bundle. The href is derived from the Vite output bundle, so it stays
 * in sync with the content-hashed filename across rebuilds.
 */
function interFontPreloadPlugin(): Plugin {
  return {
    name: "inter-font-preload",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const fontFile = Object.keys(ctx.bundle).find(
          (f) => /inter.*wght.*normal.*\.woff2$/i.test(f),
        );
        if (!fontFile) return html;
        const preload = `    <link rel="preload" as="font" type="font/woff2" href="/${fontFile}" crossorigin />\n`;
        return html.replace(/(\s*<!-- Preload asset critici -->)/, `\n${preload}$1`);
      },
    },
  };
}

// PORT and BASE_PATH are provided by the workflow at dev time.
// During a production build (vite build) they are not set — use safe defaults
// so the config file loads without throwing.
const port = Number(process.env.PORT ?? 3000);
const basePath = process.env.BASE_PATH ?? "/";

// Prevents browsers from caching index.html so deploys take effect immediately.
function noCacheHtml(): Plugin {
  const mw = (server: { middlewares: { use: (fn: (req: any, res: any, next: any) => void) => void } }) => {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url: string = req.url ?? "";
      if (url === "/" || url.startsWith("/?") || url.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
      next();
    });
  };
  return { name: "no-cache-html", configureServer: mw, configurePreviewServer: mw };
}

export default defineConfig({
  base: basePath,
  plugins: [
    noCacheHtml(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    interFontPreloadPlugin(),
    sitemapPlugin({
      appRouterPath: path.resolve(import.meta.dirname, "src/App.tsx"),
      routeMeta: SITEMAP_ROUTE_META,
      baseUrl: SITEMAP_BASE_URL,
    }),
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
    dedupe: ["react", "react-dom"],
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
