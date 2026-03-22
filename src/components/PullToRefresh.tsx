import { useState, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: React.ReactNode;
}

const THRESHOLD = 80;

export function PullToRefresh({ children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) {
      pulling.current = false;
      setPullDistance(0);
      return;
    }
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      // Dampen the pull
      setPullDistance(Math.min(delta * 0.4, THRESHOLD * 1.5));
    }
  }, [refreshing]);

  const onTouchEnd = useCallback(() => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6);
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pullDistance > 5 ? pullDistance : 0 }}
      >
        <RefreshCw
          className={cn(
            "h-5 w-5 text-primary transition-transform duration-200",
            refreshing && "animate-spin"
          )}
          style={{ transform: `rotate(${progress * 360}deg)`, opacity: progress }}
        />
      </div>
      {children}
    </div>
  );
}
