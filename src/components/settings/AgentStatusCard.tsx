import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Server, RefreshCw, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

type AgentStatus = "loading" | "online" | "offline" | "error";

interface HealthResponse {
  status?: string;
  python?: string;
  workspace?: string;
  timestamp?: string;
  error?: string;
}

export default function AgentStatusCard() {
  const [status, setStatus] = useState<AgentStatus>("loading");
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        setStatus("error");
        setHealthData({ error: "Niste prijavljeni" });
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-health`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        setStatus("offline");
        setHealthData({ error: "Agent server nedostupan" });
        return;
      }

      const data = await res.json();

      if (res.ok && data.status === "ok") {
        setStatus("online");
      } else {
        setStatus("offline");
      }
      setHealthData(data);
    } catch (e) {
      setStatus("offline");
      setHealthData({ error: "Agent server nedostupan" });
    } finally {
      setLastChecked(new Date());
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const statusConfig = {
    loading: {
      icon: <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />,
      label: "Provjera...",
      badgeClass: "bg-muted text-muted-foreground border-border",
      dotClass: "bg-muted-foreground",
    },
    online: {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      label: "Online",
      badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      dotClass: "bg-emerald-500 animate-pulse",
    },
    offline: {
      icon: <XCircle className="w-4 h-4 text-destructive" />,
      label: "Offline",
      badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
      dotClass: "bg-destructive",
    },
    error: {
      icon: <AlertCircle className="w-4 h-4 text-amber-500" />,
      label: "Greška",
      badgeClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      dotClass: "bg-amber-500",
    },
  };

  const cfg = statusConfig[status];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="w-5 h-5" />
            Agent Server
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.dotClass}`} />
              <Badge variant="outline" className={`text-xs ${cfg.badgeClass}`}>
                {cfg.label}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={checkHealth}
              disabled={checking}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Lokalni Python agent za upravljanje datotekama i skriptama na vašem računalu.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {status === "online" && healthData && (
          <div className="grid gap-1.5 text-xs">
            {healthData.workspace && (
              <div className="flex justify-between px-3 py-1.5 rounded-md bg-muted/40 border border-border/50">
                <span className="text-muted-foreground">Workspace</span>
                <span className="font-mono">{healthData.workspace}</span>
              </div>
            )}
            {healthData.python && (
              <div className="flex justify-between px-3 py-1.5 rounded-md bg-muted/40 border border-border/50">
                <span className="text-muted-foreground">Python</span>
                <span className="font-mono">{healthData.python}</span>
              </div>
            )}
            {healthData.timestamp && (
              <div className="flex justify-between px-3 py-1.5 rounded-md bg-muted/40 border border-border/50">
                <span className="text-muted-foreground">Server vrijeme</span>
                <span className="font-mono">
                  {new Date(healthData.timestamp).toLocaleString("hr-HR")}
                </span>
              </div>
            )}
          </div>
        )}

        {(status === "offline" || status === "error") && healthData?.error && (
          <div className="px-3 py-2 rounded-md bg-destructive/5 border border-destructive/20 text-xs text-destructive">
            {healthData.error}
          </div>
        )}

        {lastChecked && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Zadnja provjera: {lastChecked.toLocaleTimeString("hr-HR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}