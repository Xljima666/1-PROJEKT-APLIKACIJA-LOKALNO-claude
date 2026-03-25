import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const APP_BUILD_VERSION = "2026032520"; // INCREMENT ON EACH DEPLOY
const VERSION_KEY = "__app_build_version__";
const PREVIEW_CACHE_BUST_GUARD_KEY = "__preview_cache_bust_done__";
const previewHost = window.location.hostname;
const isPreviewEnvironment =
  previewHost.endsWith(".lovableproject.com") ||
  (previewHost.includes("--") && previewHost.endsWith(".lovable.app"));

async function nukeServiceWorkersAndCaches() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  }
}

(async () => {
  if ("serviceWorker" in navigator) {
    if (isPreviewEnvironment) {
      // Preview: nuke SW + caches, one cache-bust reload per session
      await nukeServiceWorkersAndCaches();
      const hasBusted = sessionStorage.getItem(PREVIEW_CACHE_BUST_GUARD_KEY) === "1";
      if (!hasBusted) {
        sessionStorage.setItem(PREVIEW_CACHE_BUST_GUARD_KEY, "1");
        const url = new URL(window.location.href);
        url.searchParams.set("_preview_cb", String(Date.now()));
        window.location.replace(url.toString());
        return;
      }
    } else {
      // Production: check if version changed → nuke old SW + caches → reload once
      const storedVersion = localStorage.getItem(VERSION_KEY);
      if (storedVersion !== APP_BUILD_VERSION) {
        localStorage.setItem(VERSION_KEY, APP_BUILD_VERSION);
        await nukeServiceWorkersAndCaches();
        // Force a clean reload to fetch fresh assets
        window.location.reload();
        return;
      }
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
})();

