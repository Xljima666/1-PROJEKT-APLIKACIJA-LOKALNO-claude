import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

const APP_VERSION = Date.now().toString(); // Changes on each build

export function UpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleNewSW = (worker: ServiceWorker) => {
      setWaitingWorker(worker);
      setShowUpdate(true);
      // Auto-update after 5 seconds
      let count = 5;
      const timer = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(timer);
          worker.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        }
      }, 1000);
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      if (reg.waiting) {
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

      // Force check for updates every 30 seconds
      const interval = setInterval(() => {
        reg.update().catch(() => {});
      }, 30000);
      return () => clearInterval(interval);
    });

    // Listen for controller change (another tab triggered update)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
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
