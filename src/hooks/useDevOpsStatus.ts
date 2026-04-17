import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DevOpsSnapshot } from "@/types/devops";

interface UseDevOpsStatusOptions {
  enabled?: boolean;
  projectRoot?: string | null;
  pollMs?: number;
}
 
const DEV_CONTROL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dev-control`;
const SUPABASE_PUBLIC_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";

export function useDevOpsStatus({
  enabled = true,
  projectRoot,
  pollMs = 0,
}: UseDevOpsStatusOptions) {
  const [snapshot, setSnapshot] = useState<DevOpsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (silent = false) => {
      if (!enabled || inFlightRef.current) return null;

      inFlightRef.current = true;

      if (!silent && mountedRef.current) {
        if (!hasLoadedOnceRef.current) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetch(DEV_CONTROL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
            apikey: SUPABASE_PUBLIC_KEY,
          },
          body: JSON.stringify({
            action: "status",
            projectRoot: projectRoot?.trim() || null,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || `DEV status error (${res.status})`);
        }

        if (mountedRef.current) {
          setSnapshot(data as DevOpsSnapshot);
          setError(null);
          hasLoadedOnceRef.current = true;
        }

        return data as DevOpsSnapshot;
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Ne mogu učitati DEV status.",
          );
        }
        return null;
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current && !silent) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [enabled, projectRoot],
  );

  useEffect(() => {
    if (!enabled) return;

    void refresh(false);

    if (!pollMs || pollMs <= 0) return;

    const interval = window.setInterval(() => {
      void refresh(true);
    }, pollMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, pollMs, refresh]);

  return {
    snapshot,
    loading,
    refreshing,
    error,
    refresh,
  };
}
