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
  Rocket,
  Zap,
  RefreshCw,
  HardDrive,
  Copy,
  Check,
  Search,
  FolderOpen,
  Sparkles,
  Activity,
  TerminalSquare,
  Bug,
  Eye,
  LayoutPanelTop,
  GitBranch,
  UploadCloud,
  PanelRight,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

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
  { key: "screenshot", label: "Capture preview", hint: "osvježi screenshot", accent: "text-pink-300 border-pink-500/20 bg-pink-500/10" },
  { key: "learn", label: "Save flow", hint: "naziv flowa...", accent: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10" },
];

const projectActions = [
  { label: "Git status", cmd: "git status", icon: GitBranch, tone: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200" },
  { label: "Git pull --rebase", cmd: "git pull --rebase", icon: RefreshCw, tone: "border-violet-500/20 bg-violet-500/10 text-violet-200" },
  { label: "Git push", cmd: "git push", icon: UploadCloud, tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" },
  { label: "Build", cmd: "pokreni build", icon: Play, tone: "border-amber-500/20 bg-amber-500/10 text-amber-200" },
];

function getActionIcon(action: DevActionType) {
  switch (action) {
    case "open": return Globe;
    case "click": return MousePointerClick;
    case "type": return Keyboard;
    case "screenshot": return Camera;
    case "learn": return Brain;
    default: return Sparkles;
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

function getStatusTone(status: StepStatus) {
  switch (status) {
    case "queued": return "border-white/[0.08] bg-white/[0.03] text-white/45";
    case "running": return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case "done": return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "error": return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    default: return "border-white/[0.08] bg-white/[0.03] text-white/45";
  }
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
      style={{ boxShadow: "0 18px 44px rgba(0,0,0,0.22)" }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-white/90">{title}</p>
          {subtitle && <p className="mt-0.5 text-[10px] text-white/30">{subtitle}</p>}
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
  onPortalAction,
}: Props) {
  const [actionValues, setActionValues] = useState<Record<DevActionType, string>>({
    open: "",
    click: "",
    type: "",
    screenshot: "",
    learn: "",
  });
  const [centerTab, setCenterTab] = useState<"preview" | "errors" | "deploy">("preview");
  const [rightTab, setRightTab] = useState<"steps" | "console" | "actions">("steps");
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

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

    const logErrors = consoleLogs
      .filter((l) => l.t === "err" || l.t === "warn")
      .map((l) => l.msg);

    return [...stepErrors, ...logErrors].slice(-20);
  }, [steps, consoleLogs]);

  const recentEvents = useMemo(() => {
    const interesting = consoleLogs.filter((l) => /deploy|build|push|pull|commit|error|warning|agent|preview/i.test(l.msg));
    return interesting.slice(-10).reverse();
  }, [consoleLogs]);

  const runQuickAction = (action: DevActionType) => {
    const value = actionValues[action]?.trim();
    if (action === "open") onRunAction?.("open", { url: value });
    if (action === "click") onRunAction?.("click", { target: value });
    if (action === "type") onRunAction?.("type", { value });
    if (action === "screenshot") onRunAction?.("screenshot");
    if (action === "learn") onRunAction?.("learn", { value });
  };

  const copyCommand = async (cmd: string) => {
    await navigator.clipboard.writeText(cmd);
    setCopiedCommand(cmd);
    setTimeout(() => setCopiedCommand(null), 1500);
  };

  return (
    <div
      className="relative flex h-full w-full min-w-0 flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 120% 80% at 50% 35%, rgba(32,23,57,1) 0%, rgba(13,11,26,1) 55%, rgba(8,8,16,1) 100%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[8%] left-[16%] h-[460px] w-[460px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(167,139,250,1), transparent 70%)" }} />
        <div className="absolute top-[48%] right-[12%] h-[380px] w-[380px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, rgba(34,211,238,1), transparent 70%)" }} />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/[0.06] px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/20">
            <LayoutPanelTop className="h-5 w-5 text-violet-300" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white/92">{title}</div>
            <div className="truncate text-[11px] text-white/32">
              Profesionalni DEV workspace za preview, akcije, greške i deploy stanje
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge tone={agentOnline === true ? "success" : agentOnline === false ? "error" : "neutral"}>
            <div className={cn("h-1.5 w-1.5 rounded-full", agentOnline === true ? "bg-emerald-400 animate-pulse" : agentOnline === false ? "bg-red-400" : "bg-white/20")} />
            {agentOnline === true ? "Agent online" : agentOnline === false ? "Agent offline" : "Provjera..."}
          </StatusBadge>
          <StatusBadge tone="info">
            <Activity className="h-3 w-3" />
            {modelBadge}
          </StatusBadge>
          <StatusBadge tone={isDeploying ? "warning" : deployStatus === "success" ? "success" : deployStatus === "error" ? "error" : "neutral"}>
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
              Učenje
            </button>
          )}

          <button
            onClick={onStartAgent}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-[11px] font-medium text-violet-200 hover:bg-violet-500/20"
          >
            <Zap className="h-3.5 w-3.5" />
            Pokreni agent
          </button>

          <button
            onClick={onDeploy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20"
          >
            <Rocket className="h-3.5 w-3.5" />
            Deploy
          </button>

          <button
            onClick={onCheckHealth}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 hover:bg-white/[0.08] hover:text-white/75"
            title="Provjeri agent"
          >
            <HardDrive className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_360px] gap-4 p-4">
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <SectionCard title="Command Center" subtitle="Brze tipke bez chat sučelja.">
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter") runQuickAction(action.key);
                        }}
                        placeholder={action.hint}
                        className="mb-2 h-10 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] text-white/70 outline-none placeholder:text-white/18"
                      />
                    ) : (
                      <div className="mb-2 flex h-10 items-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-3 text-[10px] text-white/18">
                        {action.hint}
                      </div>
                    )}
                    <button
                      onClick={() => runQuickAction(action.key)}
                      className="h-10 w-full rounded-2xl border border-white/[0.08] bg-white/[0.06] text-[11px] font-medium text-white/65 hover:bg-white/[0.1] hover:text-white"
                    >
                      Pokreni
                    </button>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Projektne akcije" subtitle="Git i build tipke na jednom mjestu.">
            <div className="grid grid-cols-2 gap-2">
              {projectActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.cmd}
                    onClick={() => onPortalAction?.(item.cmd)}
                    className={cn("flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-[11px] font-medium", item.tone)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-2xl border border-white/[0.08] bg-black/20 p-3">
              <div className="mb-2 text-[10px] text-white/28">Kopiraj komandu</div>
              <div className="grid grid-cols-2 gap-2">
                {["git status", "git pull --rebase", "git push", "pokreni build"].map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => copyCommand(cmd)}
                    className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/60 hover:bg-white/[0.06]"
                  >
                    <span className="truncate">{cmd}</span>
                    {copiedCommand === cmd ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5 text-white/25" />}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Sistem" subtitle="Brzi pregled stanja.">
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

            {isRecording && (
              <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-100">
                Snimam: <span className="font-semibold">{recordingName || "novi flow"}</span>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="min-h-0 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "preview", label: "Browser Preview", sub: "Što agent trenutno vidi", icon: Eye, active: centerTab === "preview", activeCls: "border-violet-500/20 bg-violet-500/10" },
              { key: "errors", label: "Errors & Warnings", sub: "Greške iz koraka i logova", icon: Bug, active: centerTab === "errors", activeCls: "border-rose-500/20 bg-rose-500/10" },
              { key: "deploy", label: "Build & Deploy", sub: "Status i zadnji događaji", icon: Rocket, active: centerTab === "deploy", activeCls: "border-cyan-500/20 bg-cyan-500/10" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setCenterTab(item.key as "preview" | "errors" | "deploy")}
                  className={cn("rounded-2xl border px-4 py-3 text-left", item.active ? item.activeCls : "border-white/[0.08] bg-white/[0.03]")}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-white/85">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                  <div className="mt-1 text-[10px] text-white/30">{item.sub}</div>
                </button>
              );
            })}
          </div>

          {centerTab === "preview" && (
            <SectionCard
              title="Live Preview"
              subtitle={preview.title || "Pregled onoga što agent trenutno vidi"}
              className="flex min-h-0 flex-1 flex-col"
              right={
                <div className="flex items-center gap-1.5">
                  <button onClick={onRefreshScreenshot} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 hover:bg-white/[0.08] hover:text-white/75" title="Osvježi screenshot">
                    <Camera className="h-4 w-4" />
                  </button>
                  <button onClick={onWaitForLoad} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 hover:bg-white/[0.08] hover:text-white/75" title="Pričekaj učitavanje">
                    <Clock3 className="h-4 w-4" />
                  </button>
                  <button onClick={onDescribePreview} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 hover:bg-white/[0.08] hover:text-white/75" title="Opiši preview">
                    <Sparkles className="h-4 w-4" />
                  </button>
                  {preview.url && (
                    <a href={preview.url} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 hover:bg-white/[0.08] hover:text-white/75" title="Otvori preview">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              }
            >
              <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-2">
                <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
                  <Globe className="h-4 w-4 shrink-0 text-white/25" />
                  <div className="truncate font-mono text-[11px] text-white/45">{preview.url || "Nema aktivnog previewa"}</div>
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
                  <div className="absolute right-3 top-3 rounded-2xl border border-violet-500/20 bg-black/65 px-3 py-2 text-[11px] text-violet-100 backdrop-blur">
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
              subtitle="Jedno mjesto za step greške, warninge i agent probleme"
              className="flex min-h-0 flex-1 flex-col"
              right={<StatusBadge tone={errorMessages.length ? "error" : "success"}>{errorMessages.length ? `${errorMessages.length} problema` : "Nema aktivnih grešaka"}</StatusBadge>}
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
                  Zadnji logovi
                </div>
                <div className="max-h-56 space-y-2 overflow-auto rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 font-mono text-[10px]">
                  {consoleLogs.length === 0 ? (
                    <div className="text-white/25">Nema logova.</div>
                  ) : (
                    consoleLogs.slice(-30).map((log, idx) => (
                      <div key={idx} className={cn(
                        log.t === "ok" ? "text-emerald-300" :
                        log.t === "warn" ? "text-amber-300" :
                        log.t === "err" ? "text-rose-300" :
                        log.t === "info" ? "text-cyan-300" :
                        "text-white/35"
                      )}>
                        {log.msg}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          {centerTab === "deploy" && (
            <SectionCard
              title="Build & Deploy Center"
              subtitle="Status deploya i zadnji događaji"
              className="flex min-h-0 flex-1 flex-col"
              right={
                <div className="flex items-center gap-2">
                  <button onClick={() => onPortalAction?.("pokreni build")} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20">
                    Build now
                  </button>
                  <button onClick={onDeploy} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20">
                    Deploy
                  </button>
                </div>
              }
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/25">Deploy status</div>
                  <div className="mt-2">
                    <StatusBadge tone={isDeploying ? "warning" : deployStatus === "success" ? "success" : deployStatus === "error" ? "error" : "neutral"}>
                      {isDeploying ? "U tijeku" : deployStatus === "success" ? "Uspješan" : deployStatus === "error" ? "Neuspješan" : "Idle"}
                    </StatusBadge>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/25">Agent</div>
                  <div className="mt-2">
                    <StatusBadge tone={agentOnline === true ? "success" : agentOnline === false ? "error" : "neutral"}>
                      {agentOnline === true ? "Online" : agentOnline === false ? "Offline" : "Provjera"}
                    </StatusBadge>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/25">Mode</div>
                  <div className="mt-2">
                    <StatusBadge tone="info">{modelBadge}</StatusBadge>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid min-h-0 flex-1 grid-cols-[1fr_1.1fr] gap-4">
                <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="mb-2 text-sm text-white/82">Zadnji događaji</div>
                  <div className="max-h-[360px] space-y-2 overflow-auto">
                    {recentEvents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/[0.08] px-3 py-6 text-center text-[11px] text-white/25">
                        Još nema build/deploy događaja.
                      </div>
                    ) : (
                      recentEvents.map((item, idx) => (
                        <div key={idx} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                          <div className="text-[11px] text-white/80">{item.msg}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="mb-2 text-sm text-white/82">Preporučeni sljedeći koraci</div>
                  <div className="space-y-2">
                    {["git status", "git pull --rebase", "git push", "deploy"].map((cmd) => (
                      <button
                        key={cmd}
                        onClick={() => onPortalAction?.(cmd)}
                        className="flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-left text-[11px] text-white/70 hover:bg-white/[0.06]"
                      >
                        <span>{cmd}</span>
                        <Play className="h-3.5 w-3.5 text-white/30" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        <div className="min-h-0 flex flex-col">
          <SectionCard title="Diagnostics" subtitle="Koraci, logovi i spremljene akcije" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mb-3 flex rounded-2xl border border-white/[0.08] bg-black/20 p-1">
              {([
                ["steps", "Koraci"],
                ["console", "Log"],
                ["actions", "Akcije"],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={cn(
                    "flex-1 rounded-xl px-2 py-2 text-[10px] font-medium transition-all",
                    rightTab === tab ? "border border-violet-500/20 bg-violet-500/15 text-violet-200" : "text-white/30 hover:text-white/60"
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
                    <span className="text-[10px] text-white/30">Sve akcije iz trenutnog flowa</span>
                    {onClearSteps && steps.length > 0 && (
                      <button onClick={onClearSteps} className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] text-white/35 hover:bg-white/[0.08] hover:text-white/70">
                        <Trash2 className="h-3 w-3" />
                        Očisti
                      </button>
                    )}
                  </div>

                  {steps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/[0.08] px-3 py-6 text-center text-[11px] text-white/25">
                      Još nema koraka.
                    </div>
                  ) : (
                    steps.map((step, index) => {
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
                                <div className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium", getStatusTone(step.status))}>
                                  <StatusIcon className={cn("h-3 w-3", step.status === "running" && "animate-spin")} />
                                  {step.status}
                                </div>
                              </div>
                              {step.target && <div className="mt-1 truncate text-[10px] text-white/30">{step.target}</div>}
                              {step.detail && <div className="mt-2 text-[10px] leading-5 text-white/45">{step.detail}</div>}
                            </div>
                            {onDeleteStep && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteStep(step.id);
                                }}
                                className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg text-white/15 hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {rightTab === "console" && (
                <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-black/20 p-3 font-mono text-[10px]">
                  {consoleLogs.length === 0 ? (
                    <div className="text-white/20">Nema logova.</div>
                  ) : (
                    consoleLogs.slice(-60).map((log, index) => (
                      <div
                        key={`${log.msg}-${index}`}
                        className={cn(
                          log.t === "ok" ? "text-emerald-300" :
                          log.t === "warn" ? "text-amber-300" :
                          log.t === "err" ? "text-rose-300" :
                          log.t === "info" ? "text-cyan-300" :
                          "text-white/35"
                        )}
                      >
                        {log.msg}
                      </div>
                    ))
                  )}
                </div>
              )}

              {rightTab === "actions" && (
                <div className="space-y-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] text-white/30">Naučene akcije</span>
                    <button onClick={onRefreshActions} className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] text-white/35 hover:bg-white/[0.08] hover:text-white/70">
                      <RefreshCw className="h-3 w-3" />
                      Osvježi
                    </button>
                  </div>

                  {savedActions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/[0.08] px-3 py-6 text-center text-[11px] text-white/25">
                      Još nema spremljenih akcija.
                    </div>
                  ) : (
                    savedActions.map((action) => (
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
                        <button onClick={() => onRunSavedAction?.(action.name)} className="mt-2 h-9 w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/20">
                          Pokreni akciju
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {isAgentRunning && (
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-violet-500/20 bg-violet-500/10 px-3 py-2.5 text-[11px] text-violet-100">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Agent trenutno radi
                </div>
                <button onClick={onStopAgent} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/10">
                  Zaustavi
                </button>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
