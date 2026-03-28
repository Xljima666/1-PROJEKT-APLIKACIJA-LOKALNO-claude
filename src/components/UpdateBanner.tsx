import { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";

const RELOAD_GUARD_KEY = "__update_reload_ts__";
const RELOAD_COOLDOWN_MS = 30000; // Don't reload more than once per 30s

export function UpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [countdown, setCountdown] = useState(5);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Guard against reload loops
    const isInCooldown = () => {
      const lastReload = parseInt(sessionStorage.getItem(RELOAD_GUARD_KEY) || "0", 10);
      return Date.now() - lastReload < RELOAD_COOLDOWN_MS;
    };

    const doReload = () => {
      if (isInCooldown()) return;
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      window.location.reload();
    };

    const handleNewSW = (worker: ServiceWorker) => {
      if (handledRef.current || isInCooldown()) return;
      handledRef.current = true;
      setWaitingWorker(worker);
      setShowUpdate(true);
      let count = 5;
      const timer = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(timer);
          worker.postMessage({ type: "SKIP_WAITING" });
          doReload();
        }
      }, 1000);
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      if (reg.waiting && !isInCooldown()) {
        handleNewSW(reg.waiting);
        return;
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            handleNewSW(newWorker);
          }
        });
      });

      // Check for updates every 60 seconds
      const interval = setInterval(() => {
        reg.update().catch(() => {});
      }, 60000);
      return () => clearInterval(interval);
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      doReload();
    });
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-600 text-white px-4 py-2.5 flex items-center justify-center gap-3 shadow-lg animate-in slide-in-from-top duration-300">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span className="text-sm font-medium">Nova verzija dostupna! Ažuriranje za {countdown}s...</span>
      <button
        onClick={handleUpdate}
        className="bg-white text-emerald-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-emerald-50 transition-colors"
      >
        Ažuriraj odmah
      </button>
    </div>
  );
}
