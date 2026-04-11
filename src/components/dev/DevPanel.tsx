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
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

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
  icon: string;
  placeholder?: string;
}> = [
  { key: "open", label: "Open", icon: "🌐", placeholder: "https://..." },
  { key: "click", label: "Click", icon: "👆", placeholder: "tekst, selector, gumb..." },
  { key: "type", label: "Type", icon: "⌨️", placeholder: "upiši vrijednost..." },
  { key: "screenshot", label: "Screenshot", icon: "📸" },
  { key: "learn", label: "Learn", icon: "🧠", placeholder: "naziv flowa..." },
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

function formatActionLabel(action: DevActionType) {
  switch (action) {
    case "open": return "Open";
    case "click": return "Click";
    case "type": return "Type";
    case "screenshot": return "Screenshot";
    case "learn": return "Learn";
    default: return action;
  }
}

export default function DevPanel({
  title = "Dev Studio",
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
  const [projectRoot, setProjectRoot] = useState(() => localStorage.getItem("stellan_project_root") || "");
  const [projectFilePath, setProjectFilePath] = useState("");
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectFileContent, setProjectFileContent] = useState("");
  const [projectSearchResults, setProjectSearchResults] = useState<Array<{ path: string; line?: number; text?: string }>>([]);
  const [projectBuildOutput, setProjectBuildOutput] = useState("");
  const [projectBuildOk, setProjectBuildOk] = useState<boolean | null>(null);
  const [projectPatchJson, setProjectPatchJson] = useState('[\n  {\n    "path": "src/components/chat/Example.tsx",\n    "content": "// full file content here"\n  }\n]');
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectNotice, setProjectNotice] = useState("");

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
        headers: { "Content-Type": "application/json", "X-API-Key": agentApiKey, "ngrok-skip-browser-warning": "true" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return await res.json();
    } catch { return null; }
  }, [agentBaseUrl, agentApiKey]);


  useEffect(() => {
    localStorage.setItem("stellan_project_root", projectRoot);
  }, [projectRoot]);

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
      const out = [res.stdout || "", res.stderr || ""].filter(Boolean).join("\n\n");
      setProjectBuildOutput(out || "(nema outputa)");
      setProjectBuildOk(!!res.success);
      markProjectNotice(res.success ? "Build prošao." : "Build pao.");
    } else {
      setProjectBuildOutput("Agent nedostupan");
      setProjectBuildOk(false);
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
        markProjectNotice(`Patch primijenjen. Fileova: ${res.written_files?.length ?? payload.files.length}`);
      } else {
        const buildOut = res?.build ? [res.build.stdout || "", res.build.stderr || ""].filter(Boolean).join("\n\n") : "";
        setProjectBuildOutput(buildOut || JSON.stringify(res || { error: "agent nedostupan" }, null, 2));
        setProjectBuildOk(false);
        markProjectNotice(`Patch greška: ${res?.error || res?.stopped_at || "agent nedostupan"}`);
      }
    } catch (e: any) {
      markProjectNotice(`JSON greška: ${e.message}`);
      setProjectBuildOk(false);
    }
    setProjectBusy(false);
  }, [agentFetch, markProjectNotice, projectPatchJson, projectRoot]);

  const startNetworkCapture = useCallback(async () => {
    const res = await agentFetch("/network/start", "POST");
    if (res?.success) {
      setNetworkCapturing(true);
      setNetworkLogs([]);
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
    const interesting = networkLogs.filter(l => l.status && l.method === "POST");
    const formatted = interesting.map(l => ({
      method: l.method, url: l.url, status: l.status,
      request: l.request_body?.substring(0, 3000),
      response: l.response_body?.substring(0, 3000),
    }));
    const text = `Evo network logovi sa SDGE portala. Napiši edge function koja replicira ove korake programski. Koristi login pattern iz sync-sdge.\n\n\`\`\`json\n${JSON.stringify(formatted, null, 2)}\n\`\`\``;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [networkLogs]);

  // Poll network logs when capturing
  useEffect(() => {
    if (networkCapturing && rightTab === "network") {
      const poll = async () => {
        const res = await agentFetch("/network/logs");
        if (res?.logs) setNetworkLogs(res.logs);
      };
      poll();
      pollRef.current = setInterval(poll, 2000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
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

  const runAction = (action: DevActionType) => {
    const raw = actionValues[action]?.trim();
    if (action === "open") onRunAction?.("open", { url: raw });
    else if (action === "click") onRunAction?.("click", { target: raw });
    else if (action === "type") onRunAction?.("type", { value: raw });
    else if (action === "screenshot") onRunAction?.("screenshot");
    else if (action === "learn") onRunAction?.("learn", { value: raw });
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-[hsl(220,15%,4%)]">

      {/* TOP BAR */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[hsl(220,15%,5%)] px-3 py-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">S</div>
          <div>
            <div className="text-[11px] font-semibold text-white/75 leading-tight">{title}</div>
            <div className="text-[9px] text-white/25 leading-tight">GeoTerra Info</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-medium border",
            agentOnline === true ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : agentOnline === false ? "bg-red-500/10 text-red-400 border-red-500/20"
              : "bg-white/[0.04] text-white/30 border-white/[0.06]"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full",
              agentOnline === true ? "bg-emerald-400 animate-pulse" : agentOnline === false ? "bg-red-400" : "bg-white/20"
            )} />
            {agentOnline === true ? "Online" : agentOnline === false ? "Offline" : "..."}
          </div>
          <div className="flex items-center gap-1 text-[9px] text-white/25">
            <div className="w-1 h-1 rounded-full bg-violet-400" />
            {modelBadge}
          </div>
          {isRecording ? (
            <div className="flex items-center gap-1">
              <button onClick={onSaveRecording}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Spremi
              </button>
              <button onClick={onCancelRecording} className="px-1.5 py-1 rounded-md text-[9px] text-white/30 border border-white/[0.08] hover:bg-red-500/10 hover:text-red-300 transition-all">✕</button>
            </div>
          ) : (
            <button onClick={onStartRecording}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium bg-white/[0.04] text-white/40 border border-white/[0.08] hover:bg-red-500/10 hover:text-red-300 transition-all">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30" /> Učenje
            </button>
          )}
          <button onClick={onStartAgent}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/15 transition-all">
            <Zap className="w-3 h-3" /> Agent
          </button>
          <button onClick={onDeploy} disabled={isDeploying}
            className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium border transition-all",
              isDeploying ? "bg-amber-500/10 text-amber-300 border-amber-500/20 cursor-wait"
                : deployStatus === "success" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                : deployStatus === "error" ? "bg-red-500/10 text-red-300 border-red-500/20"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/15"
            )}>
            <Rocket className="w-3 h-3" />
            {isDeploying ? "Deploy..." : deployStatus === "success" ? "✅" : deployStatus === "error" ? "❌" : "Deploy"}
          </button>
          <button onClick={onCheckHealth} title="Provjeri agent status"
            className="px-1.5 py-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all">
            <HardDrive className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* BODY — 2 columns: Preview + Actions */}
      <div className="flex min-h-0 flex-1">

        {/* Preview */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[hsl(220,15%,5%)] px-3 py-2">
            <Globe className="h-3.5 w-3.5 text-white/30 shrink-0" />
            <div className="flex-1 truncate rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] font-mono text-white/40">
              {preview.url || "Nema aktivnog previewa"}
            </div>
            <div className="flex items-center gap-1.5">
              {preview.url && (
                <a href={preview.url} target="_blank" rel="noreferrer"
                  className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/50 transition hover:bg-white/[0.05]">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button onClick={onRefreshScreenshot} className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/50 transition hover:bg-white/[0.05]">📸</button>
              <button onClick={onWaitForLoad} className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/50 transition hover:bg-white/[0.05]">⏳</button>
              <button onClick={onDescribePreview} className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/50 transition hover:bg-white/[0.05]">👁</button>
              <div className={cn(
                "rounded-full border px-2 py-0.5 text-[9px] font-medium",
                preview.isLive ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/[0.08] bg-white/[0.05] text-white/35"
              )}>
                {preview.isLive ? "LIVE" : "STATIC"}
              </div>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 bg-[#0a0c12] overflow-auto">
            {preview.screenshotUrl ? (
              <img src={preview.screenshotUrl} alt="Preview" className="h-full w-full object-contain bg-[#0a0c12]" />
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <div className="max-w-xs text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
                    <PanelRight className="h-6 w-6 text-white/20" />
                  </div>
                  <div className="text-sm font-semibold text-white/70">Preview</div>
                  <div className="mt-1.5 text-[11px] leading-5 text-white/25">Kada agent otvori stranicu, ovdje se prikazuje stanje.</div>
                </div>
              </div>
            )}
            {preview.summary && (
              <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/[0.08] bg-black/65 px-3 py-2 text-[11px] text-white/65 backdrop-blur">{preview.summary}</div>
            )}
            {isAgentRunning && (
              <div className="absolute top-3 right-3 rounded-xl border border-white/[0.08] bg-black/65 px-3 py-2 text-[11px] font-medium text-white/65 backdrop-blur">Agent izvršava korake...</div>
            )}
          </div>
        </div>

        {/* Actions & Steps */}
        <div className="flex min-h-0 w-[280px] shrink-0 flex-col border-l border-white/[0.06] bg-[hsl(220,15%,5%)]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
            <div>
              <div className="text-[11px] font-semibold text-white/75">Actions</div>
              <div className="text-[9px] text-white/25">DEV akcije i koraci</div>
            </div>
            <button onClick={isAgentRunning ? onStopAgent : undefined}
              className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition",
                isAgentRunning ? "border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15" : "border-white/[0.08] bg-white/[0.04] text-white/35"
              )}>
              {isAgentRunning ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {isAgentRunning ? "Stop" : "Idle"}
            </button>
          </div>

          <div className="border-b border-white/[0.06] p-2.5 space-y-1.5">
            {quickActions.map((action) => {
              const needsInput = action.key !== "screenshot";
              return (
                <div key={action.key} className="flex items-center gap-1.5">
                  <span className="text-[11px] w-4 text-center shrink-0">{action.icon}</span>
                  {needsInput ? (
                    <input value={actionValues[action.key]}
                      onChange={(e) => setActionValues((prev) => ({ ...prev, [action.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") runAction(action.key); }}
                      placeholder={action.placeholder}
                      className="flex-1 h-7 rounded-lg border border-white/[0.08] bg-black/20 px-2 text-[11px] text-white/70 outline-none placeholder:text-white/15" />
                  ) : (
                    <div className="flex-1 h-7 rounded-lg border border-dashed border-white/[0.08] bg-black/10 px-2 flex items-center text-[10px] text-white/15">—</div>
                  )}
                  <button onClick={() => runAction(action.key)}
                    className="h-7 px-2.5 rounded-lg bg-white/[0.06] text-[10px] font-medium text-white/50 hover:bg-white/[0.1] hover:text-white/80 transition-all border border-white/[0.08]">
                    {action.label}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-4 gap-1.5 border-b border-white/[0.06] p-2.5">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 text-center">
              <div className="text-[9px] text-white/25">Ukupno</div><div className="text-sm font-semibold text-white/75">{stats.total}</div>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2 text-center">
              <div className="text-[9px] text-blue-300">Run</div><div className="text-sm font-semibold text-blue-200">{stats.running}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-center">
              <div className="text-[9px] text-emerald-300">Done</div><div className="text-sm font-semibold text-emerald-200">{stats.done}</div>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-center">
              <div className="text-[9px] text-rose-300">Err</div><div className="text-sm font-semibold text-rose-200">{stats.errors}</div>
            </div>
          </div>

          <div className="flex border-b border-white/[0.06] shrink-0">
            {(["steps", "console", "actions", "network", "project"] as const).map((tab) => (
              <button key={tab} onClick={() => setRightTab(tab)}
                className={cn("flex-1 py-2 text-[10px] border-b-[1.5px] transition-all",
                  rightTab === tab ? "text-indigo-300 border-indigo-500" : "text-white/20 border-transparent hover:text-white/40"
                )}>
                {tab === "steps" ? `Koraci (${steps.length})` : tab === "console" ? `Log (${consoleLogs.length})` : tab === "actions" ? `Akcije (${savedActions.length})` : tab === "network" ? `Net (${networkLogs.length})` : "Projekt"}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {rightTab === "steps" && (
              <div className="p-2.5 space-y-2">
                {onClearSteps && steps.length > 0 && (
                  <button onClick={onClearSteps} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors mb-1">
                    <Trash2 className="h-3 w-3" /> Očisti
                  </button>
                )}
                {steps.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.1] p-6 text-center text-[11px] text-white/25">Još nema koraka.</div>
                ) : steps.map((step, index) => {
                  const ActionIcon = getActionIcon(step.action);
                  const StatusIcon = getStatusIcon(step.status);
                  return (
                    <button key={step.id} type="button" onClick={() => onSelectStep?.(step)}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-left transition hover:border-white/[0.14] hover:bg-white/[0.05]">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/65">
                          <ActionIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-[11px] font-semibold text-white/80">{index + 1}. {step.label}</div>
                            <div className="flex items-center gap-1.5">
                              <div className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium", getStatusColor(step.status))}>
                                <StatusIcon className={cn("h-3 w-3", step.status === "running" && "animate-spin")} />
                                {step.status}
                              </div>
                              {onDeleteStep && (
                                <div onClick={(e) => { e.stopPropagation(); onDeleteStep(step.id); }}
                                  className="flex h-5 w-5 items-center justify-center rounded-md text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer">
                                  <Trash2 className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                          </div>
                          {step.target && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] font-medium text-white/35">{formatActionLabel(step.action)}</span>
                              <span className="max-w-full truncate rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] text-white/35">{step.target}</span>
                            </div>
                          )}
                          {step.detail && <div className="mt-2 text-[11px] leading-5 text-white/40">{step.detail}</div>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {rightTab === "console" && (
              <div className="p-2 font-mono text-[9px] leading-loose bg-[hsl(220,15%,3%)] min-h-full">
                {consoleLogs.map((l, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-white/10 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className={
                      l.t === "ok" ? "text-emerald-400" : l.t === "info" ? "text-indigo-300" : l.t === "warn" ? "text-amber-300" : l.t === "err" ? "text-red-400" : "text-white/20"
                    }>{l.msg}</span>
                  </div>
                ))}
                <div ref={consoleEndRef} />
              </div>
            )}

            {rightTab === "actions" && (
              <div className="p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/20">Naučene akcije</span>
                  <button onClick={onRefreshActions} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-white/30 border border-white/[0.08] hover:bg-white/[0.05] transition-all">
                    <RefreshCw className="h-2.5 w-2.5" /> Osvježi
                  </button>
                </div>
                {savedActions.length === 0 ? (
                  <div className="text-[10px] text-white/20 px-1 py-4 text-center">Još nema spremljenih akcija.</div>
                ) : savedActions.map((action) => (
                  <div key={action.file} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <span className="text-[11px]">🎬</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-white/60 truncate">{action.name}</div>
                      <div className="text-[8px] text-white/20 truncate">{action.file}</div>
                    </div>
                    <button onClick={() => onRunSavedAction?.(action.name)}
                      className="px-2 py-1 rounded text-[9px] text-emerald-300 border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                      ▶ Pokreni
                    </button>
                  </div>
                ))}
              </div>
            )}

            {rightTab === "project" && (
              <div className="p-2.5 space-y-2">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 space-y-2">
                  <div className="text-[10px] font-semibold text-white/70">Projekt root</div>
                  <input
                    value={projectRoot}
                    onChange={(e) => setProjectRoot(e.target.value)}
                    placeholder="D:\\1 PROJEKT APLIKACIJA LOKALNO\\..."
                    className="w-full h-8 rounded-lg border border-white/[0.08] bg-black/20 px-2 text-[11px] text-white/70 outline-none placeholder:text-white/15"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={runProjectBuild}
                      disabled={projectBusy}
                      className="flex-1 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      Build
                    </button>
                    <button
                      onClick={runProjectSearch}
                      disabled={projectBusy}
                      className="flex-1 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                    >
                      Search
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 space-y-2">
                  <div className="text-[10px] font-semibold text-white/70">Datoteka</div>
                  <input
                    value={projectFilePath}
                    onChange={(e) => setProjectFilePath(e.target.value)}
                    placeholder="src/components/chat/ChatDialog.tsx"
                    className="w-full h-8 rounded-lg border border-white/[0.08] bg-black/20 px-2 text-[11px] text-white/70 outline-none placeholder:text-white/15"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={readProjectFile}
                      disabled={projectBusy}
                      className="flex-1 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[10px] font-medium text-white/60 hover:bg-white/[0.1] disabled:opacity-50"
                    >
                      Read
                    </button>
                    <button
                      onClick={writeProjectFile}
                      disabled={projectBusy}
                      className="flex-1 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      Write
                    </button>
                  </div>
                  <textarea
                    value={projectFileContent}
                    onChange={(e) => setProjectFileContent(e.target.value)}
                    placeholder="Sadržaj filea..."
                    className="w-full min-h-[150px] rounded-xl border border-white/[0.08] bg-black/20 px-2.5 py-2 text-[10px] font-mono text-white/65 outline-none placeholder:text-white/15"
                  />
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 space-y-2">
                  <div className="text-[10px] font-semibold text-white/70">Pretraga projekta</div>
                  <input
                    value={projectSearchQuery}
                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                    placeholder="npr. BrainPanelTechContext"
                    className="w-full h-8 rounded-lg border border-white/[0.08] bg-black/20 px-2 text-[11px] text-white/70 outline-none placeholder:text-white/15"
                  />
                  <div className="max-h-36 overflow-auto space-y-1">
                    {projectSearchResults.length === 0 ? (
                      <div className="text-[10px] text-white/25">Nema rezultata.</div>
                    ) : projectSearchResults.map((item, idx) => (
                      <button
                        key={`${item.path}-${item.line}-${idx}`}
                        onClick={() => { setProjectFilePath(item.path); }}
                        className="w-full rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-left hover:bg-white/[0.04]"
                      >
                        <div className="text-[9px] font-mono text-blue-300 truncate">{item.path}{item.line ? `:${item.line}` : ""}</div>
                        <div className="text-[9px] text-white/35 truncate">{item.text || ""}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-white/70">Safe patch set</div>
                    <button
                      onClick={applySafePatchSet}
                      disabled={projectBusy}
                      className="h-7 px-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] font-medium text-purple-300 hover:bg-purple-500/20 disabled:opacity-50"
                    >
                      Apply patch
                    </button>
                  </div>
                  <textarea
                    value={projectPatchJson}
                    onChange={(e) => setProjectPatchJson(e.target.value)}
                    placeholder='[{"path":"src/...","content":"full file"}]'
                    className="w-full min-h-[160px] rounded-xl border border-white/[0.08] bg-black/20 px-2.5 py-2 text-[10px] font-mono text-white/65 outline-none placeholder:text-white/15"
                  />
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-white/70">Build output</div>
                    {projectBuildOk !== null && (
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full border",
                        projectBuildOk ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"
                      )}>
                        {projectBuildOk ? "OK" : "ERROR"}
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-white/30">{projectNotice || "—"}</div>
                  <pre className="max-h-48 overflow-auto rounded-xl border border-white/[0.06] bg-black/20 p-2 text-[9px] font-mono text-white/55 whitespace-pre-wrap break-all">
                    {projectBuildOutput || "Još nema build outputa."}
                  </pre>
                </div>
              </div>
            )}

            {rightTab === "network" && (
              <div className="p-2.5 space-y-2">
                {/* Controls */}
                <div className="flex items-center gap-1.5">
                  {!networkCapturing ? (
                    <button onClick={startNetworkCapture}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                      <Wifi className="h-2.5 w-2.5" /> Snimi promet
                    </button>
                  ) : (
                    <button onClick={stopNetworkCapture}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 transition-all">
                      <WifiOff className="h-2.5 w-2.5" /> Zaustavi
                    </button>
                  )}
                  <button onClick={clearNetworkLogs}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[9px] text-white/30 border border-white/[0.08] hover:bg-white/[0.05] transition-all">
                    <Trash2 className="h-2.5 w-2.5" /> Očisti
                  </button>
                  {networkLogs.length > 0 && (
                    <button onClick={copyNetworkForStellen}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-all ml-auto">
                      {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                      {copied ? "Kopirano!" : "Za Stellana"}
                    </button>
                  )}
                </div>

                {networkCapturing && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/15">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] text-emerald-300">Snimam mrežni promet... Navigiraj po stranici.</span>
                  </div>
                )}

                {/* Network log entries */}
                {networkLogs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.1] p-6 text-center">
                    <Wifi className="h-5 w-5 text-white/10 mx-auto mb-2" />
                    <div className="text-[10px] text-white/25">Klikni "Snimi promet", navigiraj SDGE,</div>
                    <div className="text-[10px] text-white/25">i ovdje će se pojaviti svi requesti.</div>
                    <div className="text-[9px] text-white/15 mt-2">Zatim klikni "Za Stellana" i zalijepi u chat.</div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {networkLogs.map((log) => {
                      const isExpanded = expandedLog === log.id;
                      const methodColor = log.method === "POST" ? "text-amber-300" : log.method === "GET" ? "text-emerald-300" : "text-white/40";
                      const statusColor = !log.status ? "text-white/20" : log.status < 300 ? "text-emerald-300" : log.status < 400 ? "text-blue-300" : "text-red-300";
                      const shortUrl = log.url.replace(/https?:\/\/[^/]+/, "").substring(0, 50);

                      return (
                        <div key={log.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                          <button
                            onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-white/[0.03] transition-all"
                          >
                            {isExpanded ? <ChevronDown className="h-2.5 w-2.5 text-white/20 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 text-white/20 shrink-0" />}
                            <span className={cn("text-[9px] font-mono font-bold w-7 shrink-0", methodColor)}>{log.method}</span>
                            <span className="text-[9px] font-mono text-white/40 truncate flex-1">{shortUrl}</span>
                            <span className={cn("text-[9px] font-mono font-medium shrink-0", statusColor)}>{log.status || "..."}</span>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-white/[0.04] px-2 py-2 space-y-2 bg-black/20">
                              <div>
                                <div className="text-[8px] text-white/20 uppercase tracking-wider mb-1">URL</div>
                                <div className="text-[9px] font-mono text-white/50 break-all">{log.url}</div>
                              </div>
                              {log.request_body && (
                                <div>
                                  <div className="text-[8px] text-amber-300/40 uppercase tracking-wider mb-1">Request Body</div>
                                  <pre className="text-[8px] font-mono text-white/35 whitespace-pre-wrap break-all max-h-32 overflow-auto bg-black/30 rounded p-1.5">{log.request_body}</pre>
                                </div>
                              )}
                              {log.response_body && (
                                <div>
                                  <div className="text-[8px] text-emerald-300/40 uppercase tracking-wider mb-1">Response ({log.response_type})</div>
                                  <pre className="text-[8px] font-mono text-white/35 whitespace-pre-wrap break-all max-h-32 overflow-auto bg-black/30 rounded p-1.5">{log.response_body}</pre>
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
          </div>

          {isRecording && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/[0.06] bg-red-500/[0.05] shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[9px] text-red-300">Snimam: {recordingName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
