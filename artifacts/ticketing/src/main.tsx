import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Vite dispatches this event when a dynamically-imported chunk fails to load
// (e.g. the browser still has a stale HTML shell referencing an asset hash
// that no longer exists on the server after a new deploy). Recover
// automatically with a single reload instead of leaving a blank page, guarded
// so a genuinely broken deploy can't trigger an infinite reload loop.
const RELOAD_GUARD_KEY = "td_stale_asset_reload_at";
const RELOAD_GUARD_WINDOW_MS = 10_000;

window.addEventListener("vite:preloadError", () => {
  const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
  const now = Date.now();
  if (now - last > RELOAD_GUARD_WINDOW_MS) {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
