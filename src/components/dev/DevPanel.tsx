import { cn } from "@/lib/utils";
import {
  Globe,
  MousePointerClick,
  Keyboard,
  Camera,
  Brain,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Loader2,
  Trash2,
  Play,
  Square,
  ChevronRight,
  ChevronDown,
  PanelRight,
  Rocket,
  Zap,
  RefreshCw,
  HardDrive,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Search,
  FolderOpen,
  FileText,
  Sparkles,
  Activity,
  TerminalSquare,
  Bug,
  Eye,
  LayoutPanelTop,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";

/* ──────────────────────────── Types ──────────────────────────── */

export type DevActionType = "open" | "click" | "type" | "screenshot" | "learn";
export type StepStatus = "queued" | "running" | "done" | "error";

export type DevStep = {
  id: string;
  action: DevActionType;
  label: string;
  status: StepStatus;
  detail?: string;
  target?: string;
  value?: string;
  createdAt?: string;
};

export type DevPreviewState = {
  url?: string;
  title?: string;
  screenshotUrl?: string | null;
  isLive?: boolean;
  summary?: string;
};

export type ConsoleLog = { t: string; msg: string };

type ActionPayload = {
  url?: string;
  target?: string;
  value?: string;
};

type Props = {
  title?: string;
  steps: DevStep[];
  preview: DevPreviewState;
  consoleLogs?: ConsoleLog[];
  isAgentRunning?: boolean;
  agentOnline?: boolean | null;
  modelBadge?: string;
  isRecording?: boolean;
  recordingName?: string;
  isDeploying?: boolean;
  deployStatus?: "idle" | "success" | "error";
  savedActions?: { name: string; file: string }[];
  onRunAction?: (action: DevActionType, payload?: ActionPayload) => void;
  onStopAgent?: () => void;
  onClearSteps?: () => void;
  onDeleteStep?: (stepId: string) => void;
  onSelectStep?: (step: DevStep) => void;
  onDescribePreview?: () => void;
  onWaitForLoad?: () => void;
  onRefreshScreenshot?: () => void;
  onDeploy?: () => void;
  onStartAgent?: () => void;
  onStartRecording?: () => void;
  onSaveRecording?: () => void;
  onCancelRecording?: () => void;
  onRunSavedAction?: (name: string) => void;
  onRefreshActions?: () => void;
  onCheckHealth?: () => void;
  onPortalAction?: (cmd: string) => void;
};

const quickActions: Array<{
  key: DevActionType;
  label: string;
  hint: string;
  accent: string;
}> = [
  { key: "open", label: "Open URL", hint: "https://...", accent: "text-cyan-300 border-cyan-500/20 bg-cyan-500/10" },
  { key: "click", label: "Click element", hint: "tekst, selector, gumb...", accent: "text-violet-300 border-violet-500/20 bg-violet-500/10" },
  { key: "type", label: "Type value", hint: "upiši vrijednost...", accent: "text-amber-300 border-amber-500/20 bg-amber-500/10" },
  { key: "screenshot", label: "Capture preview", hint: "snimi aktivni preview", accent: "text-pink-300 border-pink-500/20 bg-pink-500/10" },
  { key: "learn", label: "Save flow", hint: "naziv flowa...", accent: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10" },
];

function getActionIcon(action: DevActionType) {
  switch (action) {
    case "open": return Globe;
    case "click": return MousePointerClick;
    case "type": return Keyboard;
    case "screenshot": return Camera;
    case "learn": return Brain;
    default: return ChevronRight;
  }
}

function getStatusIcon(status: StepStatus) {
  switch (status) {
    case "queued": return Clock3;
    case "running": return Loader2;
    case "done": return CheckCircle2;
    case "error": return AlertCircle;
    default: return Clock3;
  }
}

function getStatusColor(status: StepStatus) {
  switch (status) {
    case "queued": return "border-white/[0.08] bg-white/[0.03] text-white/45";
    case "running": return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case "done": return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "error": return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    default: return "border-white/[0.08] bg-white/[0.03] text-white/45";
  }
}

function getLogTone(log: ConsoleLog) {
  if (log.t === "ok") return "text-emerald-300";
  if (log.t === "warn") return "text-amber-300";
  if (log.t === "err") return "text-red-300";
  if (log.t === "info") return "text-cyan-300";
  return "text-white/35";
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl", className)}
      style={{ boxShadow: "0 16px 44px rgba(0,0,0,0.18)" }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-white/90">{title}</p>
          {subtitle && <p className="text-[10px] text-white/30 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "warning" | "error" | "info";
  children: ReactNode;
}) {
  const styles = {
    neutral: "border-white/[0.08] bg-white/[0.04] text-white/45",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    error: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    info: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  }[tone];

  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium", styles)}>{children}</span>;
}

export default function DevPanel({
  title = "DEV Workspace",
  steps,
  preview,
  consoleLogs = [],
  isAgentRunning = false,
  agentOnline = null,
  modelBadge = "FAST",
  isRecording = false,
  recordingName = "",
  isDeploying = false,
  deployStatus = "idle",
  savedActions = [],
  onRunAction,
  onStopAgent,
  onClearSteps,
  onDeleteStep,
  onSelectStep,
  onDescribePreview,
  onWaitForLoad,
  onRefreshScreenshot,
  onDeploy,
  onStartAgent,
  onStartRecording,
  onSaveRecording,
  onCancelRecording,
  onRunSavedAction,
  onRefreshActions,
  onCheckHealth,
}: Props) {
  const [actionValues, setActionValues] = useState<Record<DevActionType, string>>({
    open: "", click: "", type: "", screenshot: "", learn: "",
  });
  const [rightTab, setRightTab] = useState<"steps" | "console" | "actions" | "network" | "project">("steps");
  const [centerTab, setCenterTab] = useState<"preview" | "errors" | "deploy">("preview");
  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  // ─── Network capture state ──────────────────────────────
  const [networkCapturing, setNetworkCapturing] = useState(false);
  const [networkLogs, setNetworkLogs] = useState<Array<{
    id: number; timestamp: string; method: string; url: string;
    request_body?: string | null; status?: number | null;
    response_body?: string | null; response_type?: string | null;
  }>>([]);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const networkEndRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Project state ──────────────────────────────────────
  const [projectRoot, setProjectRoot] = useState(() => localStorage.getItem("stellan_project_root") || "");
  const [projectFilePath, setProjectFilePath] = useState("");
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectFileContent, setProjectFileContent] = useState("");
  const [projectSearchResults, setProjectSearchResults] = useState<Array<{ path: string; line?: number; text?: string }>>([]);
  const [projectBuildOutput, setProjectBuildOutput] = useState("");
  const [projectBuildOk, setProjectBuildOk] = useState<boolean | null>(null);
  const [projectPatchJson, setProjectPatchJson] = useState(
    '[\n  {\n    "path": "src/components/chat/Example.tsx",\n    "content": "// full file content here"\n  }\n]'
  );
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectNotice, setProjectNotice] = useState("");
  const [deployHistory, setDeployHistory] = useState<Array<{ at: string; status: "success" | "error" | "running"; detail: string }>>([]);

  // Agent URL from env
  const agentBaseUrl = useMemo(() => {
    try { return (import.meta as any).env?.VITE_AGENT_SERVER_URL || ""; } catch { return ""; }
  }, []);
  const agentApiKey = useMemo(() => {
    try { return (import.meta as any).env?.VITE_AGENT_API_KEY || "promijeni-me-na-siguran-kljuc-123"; } catch { return "promijeni-me-na-siguran-kljuc-123"; }
  }, []);

  const agentFetch = useCallback(async (path: string, method: string = "GET", body?: any) => {
    if (!agentBaseUrl) return null;
    try {
      const res = await fetch(`${agentBaseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": agentApiKey,
          "ngrok-skip-browser-warning": "true",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return await res.json();
    } catch {
      return null;
    }
  }, [agentBaseUrl, agentApiKey]);

  useEffect(() => {
    localStorage.setItem("stellan_project_root", projectRoot);
  }, [projectRoot]);

  useEffect(() => {
    if (isDeploying) {
      setCenterTab("deploy");
      setDeployHistory((prev) => [
        { at: new Date().toLocaleString("hr-HR"), status: "running", detail: "Deploy pokrenut..." },
        ...prev.slice(0, 9),
      ]);
    }
  }, [isDeploying]);

  useEffect(() => {
    if (deployStatus === "success") {
      setDeployHistory((prev) => [
        { at: new Date().toLocaleString("hr-HR"), status: "success", detail: "Deploy uspješan." },
        ...prev.slice(0, 9),
      ]);
    } else if (deployStatus === "error") {
      setDeployHistory((prev) => [
        { at: new Date().toLocaleString("hr-HR"), status: "error", detail: "Deploy nije uspio." },
        ...prev.slice(0, 9),
      ]);
      setCenterTab("errors");
    }
  }, [deployStatus]);

  const markProjectNotice = useCallback((message: string) => {
    setProjectNotice(message);
  }, []);

  const runProjectSearch = useCallback(async () => {
    if (!projectRoot.trim() || !projectSearchQuery.trim()) {
      markProjectNotice("Upiši root folder i search query.");
      return;
    }
    setProjectBusy(true);
    markProjectNotice("Tražim po projektu...");
    const res = await agentFetch("/search_in_files", "POST", {
      root: projectRoot.trim(),
      query: projectSearchQuery.trim(),
      extensions: [".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".css", ".html", ".md"],
      recursive: true,
    });
    if (res?.success) {
      setProjectSearchResults(Array.isArray(res.matches) ? res.matches : []);
      markProjectNotice(`Nađeno: ${res.count ?? res.matches?.length ?? 0}`);
    } else {
      setProjectSearchResults([]);
      markProjectNotice(`Search greška: ${res?.error || "agent nedostupan"}`);
    }
    setProjectBusy(false);
  }, [agentFetch, markProjectNotice, projectRoot, projectSearchQuery]);

  const readProjectFile = useCallback(async () => {
    if (!projectFilePath.trim()) {
      markProjectNotice("Upiši path datoteke.");
      return;
    }
    setProjectBusy(true);
    markProjectNotice("Čitam datoteku...");
    const res = await agentFetch("/read_file", "POST", { path: projectFilePath.trim() });
    if (res?.success) {
      setProjectFileContent(res.content || "");
      markProjectNotice(`Učitano: ${projectFilePath.trim()}`);
    } else {
      setProjectFileContent("");
      markProjectNotice(`Read greška: ${res?.error || "agent nedostupan"}`);
    }
    setProjectBusy(false);
  }, [agentFetch, markProjectNotice, projectFilePath]);

  const writeProjectFile = useCallback(async () => {
    if (!projectFilePath.trim()) {
      markProjectNotice("Upiši path datoteke.");
      return;
    }
    setProjectBusy(true);
    markProjectNotice("Spremam datoteku...");
    const res = await agentFetch("/write_file", "POST", {
      path: projectFilePath.trim(),
      content: projectFileContent,
      backup_first: true,
    });
    if (res?.success) {
      markProjectNotice(`Spremljeno: ${projectFilePath.trim()}`);
    } else {
      markProjectNotice(`Write greška: ${res?.error || "agent nedostupan"}`);
      setCenterTab("errors");
    }
    setProjectBusy(false);
  }, [agentFetch, markProjectNotice, projectFileContent, projectFilePath]);

  const runProjectBuild = useCallback(async () => {
    if (!projectRoot.trim()) {
      markProjectNotice("Upiši root folder projekta.");
      return;
    }
    setProjectBusy(true);
    setProjectBuildOutput("");
    setProjectBuildOk(null);
    markProjectNotice("Pokrećem build...");
    const res = await agentFetch("/run_build", "POST", {
      cwd: projectRoot.trim(),
      command: ["npm", "run", "build"],
      timeout: 300,
    });
    if (res) {
      const out = [res.error ? `ERROR: ${res.error}` : "", res.stdout || "", res.stderr || ""]
        .filter(Boolean)
        .join("\n\n");
      setProjectBuildOutput(out || "(nema outputa)");
      setProjectBuildOk(!!res.success);
      setCenterTab(res.success ? "deploy" : "errors");
      markProjectNotice(res.success ? "Build prošao." : "Build pao.");
    } else {
      setProjectBuildOutput("Agent nedostupan");
      setProjectBuildOk(false);
      setCenterTab("errors");
      markProjectNotice("Agent nedostupan.");
    }
    setProjectBusy(false);
  }, [agentFetch, markProjectNotice, projectRoot]);

  const applySafePatchSet = useCallback(async () => {
    if (!projectRoot.trim()) {
      markProjectNotice("Upiši root folder projekta.");
      return;
    }
    setProjectBusy(true);
    markProjectNotice("Primjenjujem patch set...");
    try {
      const parsed = JSON.parse(projectPatchJson);
      const payload = Array.isArray(parsed)
        ? {
            cwd: projectRoot.trim(),
            files: parsed,
            run_build: true,
            git_commit: false,
            git_push: false,
          }
        : {
            cwd: parsed.cwd || projectRoot.trim(),
            files: parsed.files || [],
            run_build: parsed.run_build ?? true,
            build_command: parsed.build_command,
            build_timeout: parsed.build_timeout,
            git_commit: parsed.git_commit ?? false,
            commit_message: parsed.commit_message || "agent patch",
            git_push: parsed.git_push ?? false,
            git_branch: parsed.git_branch || "main",
          };

      const res = await agentFetch("/safe_apply_patch_set", "POST", payload);
      if (res?.success) {
        const buildOut = res.build ? [res.build.stdout || "", res.build.stderr || ""].filter(Boolean).join("\n\n") : "";
        setProjectBuildOutput(buildOut || JSON.stringify(res, null, 2));
        setProjectBuildOk(res.build ? !!res.build.success : true);
        setCenterTab("deploy");
        markProjectNotice(`Patch primijenjen. Fileova: ${res.written_files?.length ?? payload.files.length}`);
      } else {
        const buildOut = res?.build ? [res.build.stdout || "", res.build.stderr || ""].filter(Boolean).join("\n\n") : "";
        setProjectBuildOutput(buildOut || JSON.stringify(res || { error: "agent nedostupan" }, null, 2));
        setProjectBuildOk(false);
        setCenterTab("errors");
        markProjectNotice(`Patch greška: ${res?.error || res?.stopped_at || "agent nedostupan"}`);
      }
    } catch (e: any) {
      markProjectNotice(`JSON greška: ${e.message}`);
      setProjectBuildOk(false);
      setCenterTab("errors");
    }
    setProjectBusy(false);
  }, [agentFetch, markProjectNotice, projectPatchJson, projectRoot]);

  const startNetworkCapture = useCallback(async () => {
    const res = await agentFetch("/network/start", "POST");
    if (res?.success) {
      setNetworkCapturing(true);
      setNetworkLogs([]);
      setRightTab("network");
    }
  }, [agentFetch]);

  const stopNetworkCapture = useCallback(async () => {
    await agentFetch("/network/stop", "POST");
    setNetworkCapturing(false);
  }, [agentFetch]);

  const clearNetworkLogs = useCallback(async () => {
    await agentFetch("/network/clear", "POST");
    setNetworkLogs([]);
  }, [agentFetch]);

  const copyNetworkForStellen = useCallback(() => {
    const interesting = networkLogs.filter((l) => l.status && l.method === "POST");
    const formatted = interesting.map((l) => ({
      method: l.method,
      url: l.url,
      status: l.status,
      request: l.request_body?.substring(0, 3000),
      response: l.response_body?.substring(0, 3000),
    }));
    const text = `Evo network logovi sa SDGE portala. Napiši edge function koja replicira ove korake programski. Koristi login pattern iz sync-sdge.\n\n\`\`\`json\n${JSON.stringify(formatted, null, 2)}\n\`\`\``;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [networkLogs]);

  useEffect(() => {
    if (networkCapturing && rightTab === "network") {
      const poll = async () => {
        const res = await agentFetch("/network/logs");
        if (res?.logs) setNetworkLogs(res.logs);
      };
      poll();
      pollRef.current = setInterval(poll, 2000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
    if (pollRef.current) clearInterval(pollRef.current);
  }, [networkCapturing, rightTab, agentFetch]);

  useEffect(() => {
    networkEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [networkLogs]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  const stats = useMemo(() => ({
    total: steps.length,
    running: steps.filter((s) => s.status === "running").length,
    done: steps.filter((s) => s.status === "done").length,
    errors: steps.filter((s) => s.status === "error").length,
  }), [steps]);

  const errorMessages = useMemo(() => {
    const stepErrors = steps
      .filter((s) => s.status === "error")
      .map((s) => `${s.label}${s.detail ? ` — ${s.detail}` : ""}`);

    const consoleErrors = consoleLogs
      .filter((l) => l.t === "err" || l.t == "warn")
      .map((l) => l.msg);

    const buildErrors = projectBuildOk === false and projectBuildOutput.strip() and [projectBuildOutput] || []
    return [...stepErrors, ...consoleErrors, *buildErrors][-20:];
  }, [steps, consoleLogs, projectBuildOk, projectBuildOutput]);

  const recentEvents = useMemo(() => {
    const fromLogs = consoleLogs
      .filter((l) => /deploy|build|push|pull|commit|error|warning/i.test(l.msg))
      .slice(-8)
      .map((l) => ({ at: "sada", status: l.t === "err" ? "error" : l.t === "warn" ? "error" : "success", detail: l.msg }));

    return [...deployHistory, ...fromLogs].slice(0, 10);
  }, [consoleLogs, deployHistory]);

  const runAction = (action: DevActionType) => {
    const raw = actionValues[action]?.trim();
    if (action === "open") onRunAction?.("open", { url: raw });
    else if (action === "click") onRunAction?.("click", { target: raw });
    else if (action === "type") onRunAction?.("type", { value: raw });
    else if (action === "screenshot") onRunAction?.("screenshot");
    else if (action === "learn") onRunAction?.("learn", { value: raw });
  };

  return (
    <div
      className="flex h-full min-w-0 flex-col"
      style={{
        background:
          "radial-gradient(ellipse 120% 80% at 50% 35%, rgba(32,23,57,1) 0%, rgba(13,11,26,1) 55%, rgba(8,8,16,1) 100%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[18%] h-[480px] w-[480px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(167,139,250,1), transparent 70%)" }} />
        <div className="absolute top-[48%] right-[10%] h-[380px] w-[380px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, rgba(34,211,238,1), transparent 70%)" }} />
        <div className="absolute bottom-[4%] left-[38%] h-[340px] w-[340px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, rgba(244,114,182,1), transparent 70%)" }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/20 border border-violet-400/20">
            <LayoutPanelTop className="h-5 w-5 text-violet-300" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-white/92 truncate">{title}</div>
            <div className="text-[11px] text-white/32 truncate">Profesionalni DEV workspace za preview, automatizaciju, greške i deploy status</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <StatusBadge tone={agentOnline === true ? "success" : agentOnline === false ? "error" : "neutral"}>
            <div className={cn(
              "h-1.5 w-1.5 rounded-full",
              agentOnline === true ? "bg-emerald-400 animate-pulse" : agentOnline === false ? "bg-red-400" : "bg-white/20"
            )} />
            {agentOnline === true ? "Agent online" : agentOnline === false ? "Agent offline" : "Provjera..."}
          </StatusBadge>

          <StatusBadge tone="info">
            <Activity className="h-3 w-3" />
            {modelBadge}
          </StatusBadge>

          <StatusBadge tone={deployStatus === "success" ? "success" : deployStatus === "error" ? "error" : isDeploying ? "warning" : "neutral"}>
            <Rocket className="h-3 w-3" />
            {isDeploying ? "Deploy u tijeku" : deployStatus === "success" ? "Zadnji deploy OK" : deployStatus === "error" ? "Deploy error" : "Deploy idle"}
          </StatusBadge>

          {isRecording ? (
            <>
              <button
                onClick={onSaveRecording}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Spremi recording
              </button>
              <button
                onClick={onCancelRecording}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-medium text-red-200 hover:bg-red-500/20"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </button>
            </>
          ) : (
            <button
              onClick={onStartRecording}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20"
            >
              <Brain className="h-3.5 w-3.5" />
              Record / Učenje
            </button>
          )}

          <button
            onClick={onStartAgent}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-[11px] font-medium text-violet-200 hover:bg-violet-500/20"
          >
            <Zap className="h-3.5 w-3.5" />
            Pokreni agenta
          </button>

          <button
            onClick={onDeploy}
            disabled={isDeploying}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium transition-all",
              isDeploying
                ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                : deployStatus === "success"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                  : deployStatus === "error"
                    ? "border-red-500/20 bg-red-500/10 text-red-200"
                    : "border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
            )}
          >
            <Rocket className="h-3.5 w-3.5" />
            {isDeploying ? "Deploy..." : "Deploy"}
          </button>

          <button
            onClick={onCheckHealth}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 hover:text-white/70 hover:bg-white/[0.08]"
            title="Provjeri agent"
          >
            <HardDrive className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_390px] gap-4 p-4">
        {/* Left rail */}
        <div className="min-h-0 overflow-y-auto space-y-4 pr-1">
          <SectionCard title="Command Center" subtitle="Tipke za najčešće akcije bez Stellan chat dojma.">
            <div className="space-y-2.5">
              {quickActions.map((action) => {
                const ActionIcon = getActionIcon(action.key);
                const needsInput = action.key !== "screenshot";
                return (
                  <div key={action.key} className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium", action.accent)}>
                        <ActionIcon className="h-3.5 w-3.5" />
                        {action.label}
                      </div>
                    </div>
                    {needsInput ? (
                      <input
                        value={actionValues[action.key]}
                        onChange={(e) => setActionValues((prev) => ({ ...prev, [action.key]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") runAction(action.key); }}
                        placeholder={action.hint}
                        className="mb-2 h-10 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] text-white/70 outline-none placeholder:text-white/18 focus:border-white/[0.14]"
                      />
                    ) : (
                      <div className="mb-2 flex h-10 items-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-3 text-[10px] text-white/18">
                        {action.hint}
                      </div>
                    )}
                    <button
                      onClick={() => runAction(action.key)}
                      className="h-10 w-full rounded-2xl border border-white/[0.08] bg-white/[0.06] text-[11px] font-medium text-white/65 hover:bg-white/[0.1] hover:text-white"
                    >
                      Pokreni
                    </button>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Sistem" subtitle="Brzi pregled rada agenta i deploy stanja.">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="text-[10px] text-white/25">Koraci</div>
                <div className="mt-1 text-xl font-semibold text-white/85">{stats.total}</div>
              </div>
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="text-[10px] text-blue-200/70">Active</div>
                <div className="mt-1 text-xl font-semibold text-blue-200">{stats.running}</div>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <div className="text-[10px] text-emerald-200/70">Done</div>
                <div className="mt-1 text-xl font-semibold text-emerald-200">{stats.done}</div>
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3">
                <div className="text-[10px] text-rose-200/70">Errors</div>
                <div className="mt-1 text-xl font-semibold text-rose-200">{stats.errors}</div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-[11px] text-white/60">
                Agent: <span className="text-white/85">{agentOnline === true ? "online" : agentOnline === false ? "offline" : "provjera..."}</span>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-[11px] text-white/60">
                Deploy: <span className="text-white/85">{isDeploying ? "u tijeku" : deployStatus === "success" ? "zadnji uspješan" : deployStatus === "error" ? "zadnji neuspješan" : "nema novog statusa"}</span>
              </div>
              {isRecording && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-100">
                  Snimam: <span className="font-semibold">{recordingName || "novi flow"}</span>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Spremljene akcije"
            subtitle="Brzo pokretanje naučenih flowova."
            right={
              <button
                onClick={onRefreshActions}
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] text-white/40 hover:text-white/70 hover:bg-white/[0.08]"
              >
                <RefreshCw className="h-3 w-3" />
                Osvježi
              </button>
            }
          >
            {savedActions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] px-3 py-5 text-center text-[11px] text-white/25">
                Još nema spremljenih akcija.
              </div>
            ) : (
              <div className="space-y-2">
                {savedActions.map((action) => (
                  <div key={action.file} className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300">
                        <Brain className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-medium text-white/80">{action.name}</div>
                        <div className="truncate text-[9px] text-white/25">{action.file}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => onRunSavedAction?.(action.name)}
                      className="mt-2 h-9 w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                    >
                      Pokreni akciju
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Center */}
        <div className="min-h-0 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setCenterTab("preview")}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left",
                centerTab === "preview" ? "border-violet-500/20 bg-violet-500/10" : "border-white/[0.08] bg-white/[0.03]"
              )}
            >
              <div className="flex items-center gap-2 text-white/85 text-sm font-medium">
                <Eye className="h-4 w-4 text-violet-300" />
                Browser Preview
              </div>
              <div className="mt-1 text-[10px] text-white/30">Što agent trenutno vidi</div>
            </button>

            <button
              onClick={() => setCenterTab("errors")}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left",
                centerTab === "errors" ? "border-rose-500/20 bg-rose-500/10" : "border-white/[0.08] bg-white/[0.03]"
              )}
            >
              <div className="flex items-center gap-2 text-white/85 text-sm font-medium">
                <Bug className="h-4 w-4 text-rose-300" />
                Errors & Warnings
              </div>
              <div className="mt-1 text-[10px] text-white/30">Greške iz koraka, loga i builda</div>
            </button>

            <button
              onClick={() => setCenterTab("deploy")}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left",
                centerTab === "deploy" ? "border-cyan-500/20 bg-cyan-500/10" : "border-white/[0.08] bg-white/[0.03]"
              )}
            >
              <div className="flex items-center gap-2 text-white/85 text-sm font-medium">
                <Rocket className="h-4 w-4 text-cyan-300" />
                Build & Deploy
              </div>
              <div className="mt-1 text-[10px] text-white/30">Build output, status i zadnji događaji</div>
            </button>
          </div>

          {centerTab === "preview" && (
            <SectionCard
              title="Live Preview"
              subtitle={preview.title || "Pregled onoga što agent trenutno vidi."}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              right={
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={onRefreshScreenshot}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 hover:text-white/75 hover:bg-white/[0.08]"
                    title="Osvježi preview"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onWaitForLoad}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 hover:text-white/75 hover:bg-white/[0.08]"
                    title="Pričekaj učitavanje"
                  >
                    <Clock3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onDescribePreview}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 hover:text-white/75 hover:bg-white/[0.08]"
                    title="Opiši preview"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                  {preview.url && (
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 hover:text-white/75 hover:bg-white/[0.08]"
                      title="Otvori preview u novom tabu"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              }
            >
              <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2.5 min-w-0">
                  <Globe className="h-4 w-4 text-white/25 shrink-0" />
                  <div className="truncate text-[11px] font-mono text-white/45">{preview.url || "Nema aktivnog previewa"}</div>
                </div>
                <StatusBadge tone={preview.isLive ? "success" : "neutral"}>{preview.isLive ? "LIVE" : "STATIC"}</StatusBadge>
                <StatusBadge tone={isAgentRunning ? "info" : "neutral"}>{isAgentRunning ? "Agent radi" : "Idle"}</StatusBadge>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#090b13]">
                {preview.screenshotUrl ? (
                  <img src={preview.screenshotUrl} alt="Preview" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center p-8">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                        <PanelRight className="h-7 w-7 text-white/15" />
                      </div>
                      <div className="text-sm font-semibold text-white/70">Preview će biti ovdje</div>
                      <div className="mt-1 text-[11px] text-white/25">Kada agent otvori stranicu, ovdje vidiš screenshot i stanje.</div>
                    </div>
                  </div>
                )}
                {isAgentRunning && (
                  <div className="absolute top-3 right-3 rounded-2xl border border-violet-500/20 bg-black/65 px-3 py-2 text-[11px] text-violet-100 backdrop-blur">
                    Agent izvršava korake...
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/25">Naslov</div>
                  <div className="mt-1 text-sm text-white/80">{preview.title || "—"}</div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/25">Sažetak</div>
                  <div className="mt-1 text-sm text-white/80">{preview.summary || "Još nema AI opisa previewa."}</div>
                </div>
              </div>
            </SectionCard>
          )}

          {centerTab === "errors" && (
            <SectionCard
              title="Errors & Warnings"
              subtitle="Jedno mjesto za build greške, step greške i warninge."
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              right={<StatusBadge tone={errorMessages.length > 0 ? "error" : "success"}>{errorMessages.length > 0 ? `${errorMessages.length} problema` : "Nema aktivnih grešaka"}</StatusBadge>}
            >
              {errorMessages.length === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-dashed border-white/[0.08] bg-black/20 text-sm text-white/25">
                  Trenutno nema aktivnih grešaka ni warninga.
                </div>
              ) : (
                <div className="space-y-2 overflow-auto">
                  {errorMessages.map((msg, idx) => (
                    <div key={idx} className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.06] px-3 py-3 text-[11px] leading-6 text-rose-100/90">
                      {msg}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-3xl border border-white/[0.08] bg-black/20 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm text-white/82">
                  <TerminalSquare className="h-4 w-4 text-white/45" />
                  Build / diagnostic output
                </div>
                <pre className="max-h-52 overflow-auto rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-[10px] font-mono text-white/60 whitespace-pre-wrap break-all">
                  {projectBuildOutput || "Još nema build ili diagnostic outputa."}
                </pre>
              </div>
            </SectionCard>
          )}

          {centerTab === "deploy" && (
            <SectionCard
              title="Build & Deploy Center"
              subtitle="Status deploya, zadnji eventi i build output."
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              right={
                <div className="flex items-center gap-2">
                  <button
                    onClick={runProjectBuild}
                    disabled={projectBusy}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    Build now
                  </button>
                  <button
                    onClick={onDeploy}
                    disabled={isDeploying}
                    className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
                  >
                    Deploy
                  </button>
                </div>
              }
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/25">Deploy status</div>
                  <div className="mt-2">
                    <StatusBadge tone={isDeploying ? "warning" : deployStatus === "success" ? "success" : deployStatus == "error" ? "error" : "neutral"}>
                      {isDeploying ? "U tijeku" : deployStatus === "success" ? "Uspješan" : deployStatus === "error" ? "Neuspješan" : "Idle"}
                    </StatusBadge>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/25">Build</div>
                  <div className="mt-2">
                    <StatusBadge tone={projectBuildOk === true ? "success" : projectBuildOk === false ? "error" : "neutral"}>
                      {projectBuildOk === true ? "Build OK" : projectBuildOk === false ? "Build error" : "Nije pokrenut"}
                    </StatusBadge>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/25">Projekt root</div>
                  <div className="mt-2 truncate text-[11px] text-white/72">{projectRoot || "nije postavljen"}</div>
                </div>
              </div>

              <div className="mt-4 grid min-h-0 flex-1 grid-cols-[1fr_1.1fr] gap-4">
                <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-3 min-h-0">
                  <div className="mb-2 text-sm text-white/82">Zadnji događaji</div>
                  <div className="space-y-2 overflow-auto max-h-[340px]">
                    {recentEvents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/[0.08] px-3 py-6 text-center text-[11px] text-white/25">
                        Još nema deploy događaja.
                      </div>
                    ) : recentEvents.map((item, idx) => (
                      <div key={idx} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] text-white/80">{item.detail}</div>
                          <StatusBadge tone={item.status === "success" ? "success" : item.status === "error" ? "error" : "warning"}>{item.status}</StatusBadge>
                        </div>
                        <div className="mt-1 text-[10px] text-white/25">{item.at}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-3 min-h-0">
                  <div className="mb-2 text-sm text-white/82">Build / deploy output</div>
                  <pre className="max-h-[340px] overflow-auto rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-[10px] font-mono text-white/60 whitespace-pre-wrap break-all">
                    {projectBuildOutput || "Još nema build ili deploy outputa."}
                  </pre>
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        {/* Right rail */}
        <div className="min-h-0 flex flex-col">
          <SectionCard
            title="Diagnostics"
            subtitle="Koraci, logovi, mreža i projekt u jednom mjestu."
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="mb-3 flex rounded-2xl border border-white/[0.08] bg-black/20 p-1">
              {([
                ["steps", "Koraci"],
                ["console", "Log"],
                ["actions", "Akcije"],
                ["network", "Mreža"],
                ["project", "Projekt"],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={cn(
                    "flex-1 rounded-xl px-2 py-2 text-[10px] font-medium transition-all",
                    rightTab === tab
                      ? "bg-violet-500/15 text-violet-200 border border-violet-500/20"
                      : "text-white/30 hover:text-white/60"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {rightTab === "steps" && (
                <div className="space-y-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] text-white/30">Sve akcije iz trenutnog flowa.</span>
                    {onClearSteps && steps.length > 0 && (
                      <button
                        onClick={onClearSteps}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] text-white/35 hover:text-white/70 hover:bg-white/[0.08]"
                      >
                        <Trash2 className="h-3 w-3" />
                        Očisti
                      </button>
                    )}
                  </div>
                  {steps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/[0.08] px-3 py-6 text-center text-[11px] text-white/25">
                      Još nema koraka.
                    </div>
                  ) : steps.map((step, index) => {
                    const ActionIcon = getActionIcon(step.action);
                    const StatusIcon = getStatusIcon(step.status);
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => onSelectStep?.(step)}
                        className="w-full rounded-2xl border border-white/[0.08] bg-black/20 p-3 text-left hover:bg-white/[0.04]"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/60">
                            <ActionIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate text-[11px] font-semibold text-white/80">
                                {index + 1}. {step.label}
                              </div>
                              <div className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium", getStatusColor(step.status))}>
                                <StatusIcon className={cn("h-3 w-3", step.status === "running" && "animate-spin")} />
                                {step.status}
                              </div>
                            </div>
                            {step.target && (
                              <div className="mt-1 truncate text-[10px] text-white/30">{step.target}</div>
                            )}
                            {step.detail && (
                              <div className="mt-2 text-[10px] leading-5 text-white/45">{step.detail}</div>
                            )}
                          </div>
                          {onDeleteStep && (
                            <div
                              onClick={(e) => { e.stopPropagation(); onDeleteStep(step.id); }}
                              className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {rightTab === "console" && (
                <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-black/20 p-3 font-mono text-[10px]">
                  {consoleLogs.length === 0 ? (
                    <div className="text-white/20">Nema logova.</div>
                  ) : consoleLogs.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="shrink-0 text-white/12">{String(i + 1).padStart(2, "0")}</span>
                      <span className={getLogTone(l)}>{l.msg}</span>
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              )}

              {rightTab === "actions" && (
                <div className="space-y-2">
                  {savedActions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/[0.08] px-3 py-6 text-center text-[11px] text-white/25">
                      Još nema spremljenih akcija.
                    </div>
                  ) : savedActions.map((action) => (
                    <div key={action.file} className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium text-white/80">{action.name}</div>
                          <div className="truncate text-[9px] text-white/25">{action.file}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => onRunSavedAction?.(action.name)}
                          className="flex-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                        >
                          Pokreni
                        </button>
                        <button
                          onClick={onRefreshActions}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[10px] text-white/35 hover:text-white/70 hover:bg-white/[0.08]"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {rightTab === "network" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {!networkCapturing ? (
                      <button
                        onClick={startNetworkCapture}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                      >
                        <Wifi className="h-3.5 w-3.5" />
                        Snimi promet
                      </button>
                    ) : (
                      <button
                        onClick={stopNetworkCapture}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-medium text-red-200 hover:bg-red-500/20"
                      >
                        <WifiOff className="h-3.5 w-3.5" />
                        Zaustavi
                      </button>
                    )}
                    <button
                      onClick={clearNetworkLogs}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[10px] text-white/35 hover:text-white/70 hover:bg-white/[0.08]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Očisti
                    </button>
                    {networkLogs.length > 0 && (
                      <button
                        onClick={copyNetworkForStellen}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[10px] font-medium text-blue-200 hover:bg-blue-500/20"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Kopirano" : "Za analizu"}
                      </button>
                    )}
                  </div>

                  {networkLogs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/[0.08] px-3 py-6 text-center text-[11px] text-white/25">
                      Klikni “Snimi promet”, prođi portal i ovdje će se pojaviti requesti.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {networkLogs.map((log) => {
                        const isExpanded = expandedLog === log.id;
                        const statusColor = !log.status ? "text-white/25" : log.status < 300 ? "text-emerald-300" : log.status < 400 ? "text-blue-300" : "text-red-300";
                        return (
                          <div key={log.id} className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
                            <button
                              onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03]"
                            >
                              {isExpanded ? <ChevronDown className="h-3 w-3 text-white/25" /> : <ChevronRight className="h-3 w-3 text-white/25" />}
                              <span className="w-8 shrink-0 text-[10px] font-mono text-violet-300">{log.method}</span>
                              <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-white/40">{log.url.replace(/https?:\/\/[^/]+/, "")}</span>
                              <span className={cn("text-[10px] font-mono", statusColor)}>{log.status || "..."}</span>
                            </button>
                            {isExpanded && (
                              <div className="space-y-2 border-t border-white/[0.06] px-3 py-3">
                                <div>
                                  <div className="mb-1 text-[9px] uppercase tracking-wider text-white/20">URL</div>
                                  <div className="break-all text-[10px] font-mono text-white/50">{log.url}</div>
                                </div>
                                {log.request_body && (
                                  <div>
                                    <div className="mb-1 text-[9px] uppercase tracking-wider text-amber-200/50">Request</div>
                                    <pre className="max-h-32 overflow-auto rounded-xl border border-white/[0.06] bg-black/30 p-2 text-[9px] font-mono text-white/45 whitespace-pre-wrap break-all">{log.request_body}</pre>
                                  </div>
                                )}
                                {log.response_body && (
                                  <div>
                                    <div className="mb-1 text-[9px] uppercase tracking-wider text-emerald-200/50">Response</div>
                                    <pre className="max-h-32 overflow-auto rounded-xl border border-white/[0.06] bg-black/30 p-2 text-[9px] font-mono text-white/45 whitespace-pre-wrap break-all">{log.response_body}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div ref={networkEndRef} />
                    </div>
                  )}
                </div>
              )}

              {rightTab === "project" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-cyan-300" />
                      <div className="text-[11px] font-semibold text-white/80">Projekt root</div>
                    </div>
                    <input
                      value={projectRoot}
                      onChange={(e) => setProjectRoot(e.target.value)}
                      placeholder="D:\\1 PROJEKT APLIKACIJA LOKALNO\\..."
                      className="mb-2 h-10 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] text-white/70 outline-none placeholder:text-white/18"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={runProjectBuild}
                        disabled={projectBusy}
                        className="h-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        Build
                      </button>
                      <button
                        onClick={runProjectSearch}
                        disabled={projectBusy}
                        className="h-10 rounded-2xl border border-blue-500/20 bg-blue-500/10 text-[10px] font-medium text-blue-200 hover:bg-blue-500/20 disabled:opacity-50"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-violet-300" />
                      <div className="text-[11px] font-semibold text-white/80">Datoteka</div>
                    </div>
                    <input
                      value={projectFilePath}
                      onChange={(e) => setProjectFilePath(e.target.value)}
                      placeholder="src/components/chat/ChatDialog.tsx"
                      className="mb-2 h-10 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] text-white/70 outline-none placeholder:text-white/18"
                    />
                    <div className="mb-2 grid grid-cols-2 gap-2">
                      <button
                        onClick={readProjectFile}
                        disabled={projectBusy}
                        className="h-10 rounded-2xl border border-white/[0.08] bg-white/[0.06] text-[10px] font-medium text-white/70 hover:bg-white/[0.1] disabled:opacity-50"
                      >
                        Read
                      </button>
                      <button
                        onClick={writeProjectFile}
                        disabled={projectBusy}
                        className="h-10 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-[10px] font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        Write
                      </button>
                    </div>
                    <textarea
                      value={projectFileContent}
                      onChange={(e) => setProjectFileContent(e.target.value)}
                      placeholder="Sadržaj filea..."
                      className="min-h-[140px] w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-mono text-white/65 outline-none placeholder:text-white/15"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Search className="h-4 w-4 text-emerald-300" />
                      <div className="text-[11px] font-semibold text-white/80">Pretraga projekta</div>
                    </div>
                    <input
                      value={projectSearchQuery}
                      onChange={(e) => setProjectSearchQuery(e.target.value)}
                      placeholder="npr. BrainPanelTechContext"
                      className="mb-2 h-10 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] text-white/70 outline-none placeholder:text-white/18"
                    />
                    <div className="max-h-36 space-y-1 overflow-auto">
                      {projectSearchResults.length === 0 ? (
                        <div className="text-[10px] text-white/25">Nema rezultata.</div>
                      ) : projectSearchResults.map((item, idx) => (
                        <button
                          key={`${item.path}-${item.line}-${idx}`}
                          onClick={() => { setProjectFilePath(item.path); }}
                          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-left hover:bg-white/[0.05]"
                        >
                          <div className="truncate text-[9px] font-mono text-cyan-300">{item.path}{item.line ? `:${item.line}` : ""}</div>
                          <div className="truncate text-[9px] text-white/35">{item.text || ""}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-white/80">Safe patch set</div>
                      <button
                        onClick={applySafePatchSet}
                        disabled={projectBusy}
                        className="h-8 rounded-xl border border-purple-500/20 bg-purple-500/10 px-3 text-[10px] font-medium text-purple-200 hover:bg-purple-500/20 disabled:opacity-50"
                      >
                        Apply patch
                      </button>
                    </div>
                    <textarea
                      value={projectPatchJson}
                      onChange={(e) => setProjectPatchJson(e.target.value)}
                      placeholder='[{"path":"src/...","content":"full file"}]'
                      className="min-h-[150px] w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-mono text-white/65 outline-none placeholder:text-white/15"
                    />
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
