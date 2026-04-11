import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Activity,
  AlertCircle,
  Bot,
  Brain,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  FolderOpen,
  GitBranch,
  Globe,
  Keyboard,
  LayoutPanelTop,
  Loader2,
  MousePointerClick,
  Play,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Sparkles,
  Square,
  TerminalSquare,
  Trash2,
  UploadCloud,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { DevOpsLogEntry, DevOpsSnapshot } from "@/types/devops";
 
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
  projectRoot?: string;
  devOps?: DevOpsSnapshot | null;
  devOpsLoading?: boolean;
  onRunAction?: (action: DevActionType, payload?: ActionPayload) => void;
  onStopAgent?: () => void;
  onClearSteps?: () => void;
  onDeleteStep?: (stepId: string) => void;
  onSelectStep?: (step: DevStep) => void;
  onDescribePreview?: () => void;
  onWaitForLoad?: () => void;
  onRefreshScreenshot?: () => void;
  onRefreshDevOps?: () => void;
  onDeploy?: () => void;
  onStartAgent?: () => void;
  onStartRecording?: () => void;
  onSaveRecording?: () => void;
  onCancelRecording?: () => void;
  onRunSavedAction?: (name: string) => void;
  onRefreshActions?: () => void;
  onCheckHealth?: () => void;
  onPortalAction?: (cmd: string) => void;
  onBackToStellan?: () => void;
};

const quickActions: Array<{
  key: DevActionType;
  label: string;
  placeholder: string;
  description: string;
}> = [
  { key: "open", label: "Open URL", placeholder: "https://...", description: "Otvori novu stranicu u previewu" },
  { key: "click", label: "Click", placeholder: "tekst, selector, gumb...", description: "Klikni element na otvorenoj stranici" },
  { key: "type", label: "Type", placeholder: "upiši vrijednost...", description: "Upiši tekst u aktivno polje" },
  { key: "screenshot", label: "Screenshot", placeholder: "trenutni preview", description: "Osvježi i spremi preview" },
  { key: "learn", label: "Save flow", placeholder: "naziv flowa...", description: "Pokreni snimanje i spremi flow" },
];

const projectActions = [
  { label: "Git status", cmd: "git status", icon: GitBranch },
  { label: "Build", cmd: "pokreni build", icon: Play },
  { label: "Deploy", cmd: "deploy", icon: Rocket },
  { label: "Git push", cmd: "git push", icon: UploadCloud },
];

function statusTone(ok: boolean | null | undefined) {
  if (ok === true) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (ok === false) return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-white/10 bg-white/[0.03] text-white/60";
}

function levelTone(level: DevOpsLogEntry["level"]) {
  switch (level) {
    case "success":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "warning":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "error":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-200";
  }
}

function stepTone(status: StepStatus) {
  switch (status) {
    case "running":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-200";
    case "done":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "error":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-white/10 bg-white/[0.03] text-white/60";
  }
}

function getActionIcon(action: DevActionType) {
  switch (action) {
    case "open":
      return Globe;
    case "click":
      return MousePointerClick;
    case "type":
      return Keyboard;
    case "screenshot":
      return Camera;
    case "learn":
      return Brain;
    default:
      return Sparkles;
  }
}

function getStepStatusIcon(status: StepStatus) {
  switch (status) {
    case "running":
      return Loader2;
    case "done":
      return CheckCircle2;
    case "error":
      return AlertCircle;
    default:
      return Clock3;
  }
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("hr-HR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-white/65 hover:bg-white/[0.06]"
    >
      <Copy className="h-3 w-3" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Section({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] shadow-[0_16px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-white/92">{title}</div>
          {subtitle ? <div className="mt-0.5 text-[11px] text-white/45">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone, hint }: { icon: any; label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3", tone || "border-white/10 bg-white/[0.03] text-white/80")}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-white/45">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-white/92">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-white/45">{hint}</div> : null}
    </div>
  );
}

export default function DevPanel({
  title = "DEV Studio",
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
  projectRoot,
  devOps,
  devOpsLoading = false,
  onRunAction,
  onStopAgent,
  onClearSteps,
  onDeleteStep,
  onSelectStep,
  onDescribePreview,
  onWaitForLoad,
  onRefreshScreenshot,
  onRefreshDevOps,
  onDeploy,
  onStartAgent,
  onStartRecording,
  onSaveRecording,
  onCancelRecording,
  onRunSavedAction,
  onRefreshActions,
  onCheckHealth,
  onPortalAction,
  onBackToStellan,
}: Props) {
  const [centerTab, setCenterTab] = useState<"preview" | "status" | "errors">("preview");
  const [rightTab, setRightTab] = useState<"steps" | "logs" | "actions">("steps");
  const [actionValues, setActionValues] = useState<Record<DevActionType, string>>({
    open: "",
    click: "",
    type: "",
    screenshot: "",
    learn: "",
  });

  const derivedErrors = useMemo(() => {
    const stepErrors = steps
      .filter((step) => step.status === "error")
      .map((step) => `${step.label}${step.detail ? ` — ${step.detail}` : ""}`);

    const consoleErrors = consoleLogs
      .filter((item) => item.t === "warn" || item.t === "err")
      .map((item) => item.msg);

    const statusErrors = devOps?.errors || [];

    return [...statusErrors, ...stepErrors, ...consoleErrors].filter(Boolean).slice(0, 20);
  }, [consoleLogs, devOps?.errors, steps]);

  const mergedLogs = useMemo(() => {
    const localLogs: DevOpsLogEntry[] = consoleLogs.slice(-20).map((log, index) => ({
      id: `console-${index}-${log.msg.slice(0, 20)}`,
      source: "system",
      level: log.t === "warn" || log.t === "err" ? "warning" : log.t === "ok" ? "success" : "info",
      title: log.msg,
    }));

    return [...(devOps?.logs || []), ...localLogs].slice(0, 30);
  }, [consoleLogs, devOps?.logs]);

  const gitValue = devOps?.git?.branch
    ? `${devOps.git.branch}${devOps.git.dirty ? " • dirty" : " • clean"}`
    : devOps?.git?.configured
      ? "Repo connected"
      : "Repo not configured";

  const buildValue = isDeploying
    ? "Deploy running"
    : devOps?.build?.label
      ? `${devOps.build.label}`
      : deployStatus === "success"
        ? "Success"
        : deployStatus === "error"
          ? "Error"
          : "Idle";

  const stats = {
    total: steps.length,
    running: steps.filter((step) => step.status === "running").length,
    done: steps.filter((step) => step.status === "done").length,
    errors: steps.filter((step) => step.status === "error").length,
  };

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_right,rgba(16,185,129,0.06),transparent_24%),#0b1020] text-white">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {onBackToStellan ? (
                <button
                  onClick={onBackToStellan}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70 transition-all hover:bg-white/[0.10] hover:text-white"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Nazad na Stellan
                </button>
              ) : null}
              <div className="h-5 w-px bg-white/[0.08]" />
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                {title}
              </div>
              <Badge variant="outline" className={cn("border-white/10 bg-white/[0.03] text-white/70", statusTone(agentOnline))}>
                <Activity className="mr-1 h-3 w-3" />
                Agent {agentOnline === true ? "online" : agentOnline === false ? "offline" : "..."}
              </Badge>
              <Badge variant="outline" className="border-violet-500/20 bg-violet-500/10 text-violet-200">
                <Zap className="mr-1 h-3 w-3" />
                {modelBadge}
              </Badge>
              {isRecording ? (
                <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-200">
                  <Brain className="mr-1 h-3 w-3" />
                  Recording{recordingName ? ` • ${recordingName}` : ""}
                </Badge>
              ) : null}
            </div>
            <div className="mt-3 text-sm text-white/70">
              Čisti DEV workspace za preview, git, build, deploy, greške i akcije na jednom mjestu.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]" onClick={onRefreshDevOps}>
              {devOpsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh status
            </Button>
            <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]" onClick={onRefreshScreenshot}>
              <Camera className="mr-2 h-4 w-4" />
              Refresh preview
            </Button>
            {isAgentRunning ? (
              <Button size="sm" variant="destructive" onClick={onStopAgent}>
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button size="sm" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={onStartAgent}>
                <Play className="mr-2 h-4 w-4" />
                Start agent
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={Server} label="Agent" value={devOps?.agent?.online ? "Online" : devOps?.agent?.configured ? "Offline" : "Not configured"} tone={statusTone(devOps?.agent?.online)} hint={devOps?.agent?.workspace || undefined} />
          <StatCard icon={GitBranch} label="Git" value={gitValue} tone={statusTone(devOps ? !devOps.git.dirty : null)} hint={devOps?.git?.latestCommit?.shortSha ? `${devOps.git.latestCommit.shortSha} • ${devOps.git.latestCommit.message}` : undefined} />
          <StatCard icon={Rocket} label="Build / Deploy" value={buildValue} tone={statusTone(devOps?.build?.status === "ready" ? true : devOps?.build?.status === "error" ? false : null)} hint={devOps?.build?.branch || undefined} />
          <StatCard icon={FolderOpen} label="Project root" value={projectRoot || "Not set"} hint={projectRoot ? "Lokalni root za git/build akcije" : "Postavi ga kroz chat ili DEV naredbu"} />
          <StatCard icon={LayoutPanelTop} label="Steps" value={`${stats.done}/${stats.total} done`} hint={stats.errors ? `${stats.errors} error` : stats.running ? `${stats.running} running` : "Spremno"} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[360px_minmax(0,1fr)_380px]">
        <div className="min-h-0 space-y-4">
          <Section title="Quick actions" subtitle="Najbrže DEV akcije za preview i flow">
            <div className="space-y-3">
              {quickActions.map((item) => {
                const Icon = getActionIcon(item.key);
                const currentValue = actionValues[item.key];
                return (
                  <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white/90">
                      <Icon className="h-4 w-4 text-cyan-200" />
                      {item.label}
                    </div>
                    <div className="mb-2 text-[11px] text-white/45">{item.description}</div>
                    {item.key !== "screenshot" ? (
                      <Input
                        value={currentValue}
                        onChange={(e) => setActionValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                        placeholder={item.placeholder}
                        className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
                      />
                    ) : null}
                    <Button
                      className="mt-3 w-full bg-white text-slate-950 hover:bg-white/90"
                      onClick={() =>
                        onRunAction?.(item.key, {
                          url: item.key === "open" ? currentValue : undefined,
                          target: item.key === "click" ? currentValue : undefined,
                          value: item.key === "type" || item.key === "learn" ? currentValue : undefined,
                        })
                      }
                    >
                      <ChevronRight className="mr-2 h-4 w-4" />
                      Pokreni
                    </Button>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Workspace actions" subtitle="Git, build i deploy naredbe za projekt root">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {projectActions.map((item) => (
                <Button
                  key={item.cmd}
                  variant="outline"
                  className="justify-start border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                  onClick={() => onPortalAction?.(item.cmd)}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              ))}
            </div>
            <Separator className="my-4 bg-white/10" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]" onClick={onCheckHealth}>
                <Bot className="mr-2 h-4 w-4" />
                Check agent
              </Button>
              <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]" onClick={onDeploy}>
                <Rocket className="mr-2 h-4 w-4" />
                Deploy flow
              </Button>
            </div>
          </Section>
        </div>

        <div className="min-h-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "preview", label: "Preview", icon: Globe },
              { key: "status", label: "Status", icon: Activity },
              { key: "errors", label: "Errors", icon: AlertCircle },
            ].map((tab) => (
              <Button
                key={tab.key}
                variant="outline"
                size="sm"
                className={cn(
                  "border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]",
                  centerTab === tab.key && "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                )}
                onClick={() => setCenterTab(tab.key as typeof centerTab)}
              >
                <tab.icon className="mr-2 h-4 w-4" />
                {tab.label}
              </Button>
            ))}
          </div>

          {centerTab === "preview" ? (
            <Section
              title="Browser preview"
              subtitle={preview.url || "Preview nije pokrenut"}
              right={preview.url ? <CopyChip value={preview.url} /> : undefined}
            >
              <div className="rounded-2xl border border-white/10 bg-[#050816] p-3">
                <div className="mb-3 flex items-center justify-between gap-2 text-[11px] text-white/55">
                  <div className="truncate">{preview.title || "Stellan preview"}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-white/70">
                      {preview.isLive ? "LIVE" : "Static"}
                    </Badge>
                    {preview.url ? (
                      <a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100">
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  {preview.screenshotUrl ? (
                    <img src={preview.screenshotUrl} alt="Preview screenshot" className="h-[420px] w-full object-contain bg-black/50" />
                  ) : (
                    <div className="flex h-[420px] items-center justify-center text-sm text-white/35">
                      Nema screenshota. Osvježi preview ili pokreni screenshot.
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]" onClick={onDescribePreview}>
                    <Search className="mr-2 h-4 w-4" />
                    Opiši preview
                  </Button>
                  <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]" onClick={onWaitForLoad}>
                    <Clock3 className="mr-2 h-4 w-4" />
                    Wait / reload
                  </Button>
                </div>

                {preview.summary ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-white/75">
                    {preview.summary}
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}

          {centerTab === "status" ? (
            <Section title="Deploy, build i repo status" subtitle="Stvarni snapshot iz GitHub, Vercel i local agent layera">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
                    <GitBranch className="h-4 w-4 text-cyan-200" />
                    Git status
                  </div>
                  <div className="space-y-2 text-sm text-white/75">
                    <div><span className="text-white/45">Repo:</span> {devOps?.git?.repo || "—"}</div>
                    <div><span className="text-white/45">Branch:</span> {devOps?.git?.branch || "—"}</div>
                    <div><span className="text-white/45">State:</span> {devOps?.git?.dirty ? "Dirty" : "Clean"}</div>
                    {devOps?.git?.latestCommit ? (
                      <div>
                        <span className="text-white/45">Latest commit:</span> {devOps.git.latestCommit.shortSha} • {devOps.git.latestCommit.message}
                      </div>
                    ) : null}
                  </div>

                  {devOps?.git?.changedFiles?.length ? (
                    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                      <div className="mb-2 font-semibold">Promijenjeni fileovi</div>
                      <div className="space-y-1">
                        {devOps.git.changedFiles.slice(0, 8).map((file) => (
                          <div key={file} className="font-mono">{file}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
                    <Rocket className="h-4 w-4 text-cyan-200" />
                    Build & deploy
                  </div>
                  <div className="space-y-2 text-sm text-white/75">
                    <div><span className="text-white/45">Status:</span> {devOps?.build?.label || "—"}</div>
                    <div><span className="text-white/45">Target:</span> {devOps?.build?.target || "—"}</div>
                    <div><span className="text-white/45">Branch:</span> {devOps?.build?.branch || "—"}</div>
                    <div><span className="text-white/45">Time:</span> {formatTime(devOps?.build?.createdAt)}</div>
                    {devOps?.build?.commitMessage ? (
                      <div><span className="text-white/45">Commit:</span> {devOps.build.commitMessage}</div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {devOps?.build?.url ? (
                      <a href={devOps.build.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20">
                        Open deployment <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {devOps?.build?.inspectorUrl ? (
                      <a href={devOps.build.inspectorUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/75 hover:bg-white/[0.06]">
                        Inspector <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 text-sm font-semibold text-white/90">Zadnji deploymenti</div>
                <div className="space-y-2">
                  {(devOps?.deployments || []).length === 0 ? (
                    <div className="text-sm text-white/45">Još nema deployment podataka.</div>
                  ) : (
                    devOps!.deployments.map((deployment) => (
                      <div key={deployment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/75">
                        <div>
                          <div className="font-medium text-white/90">{deployment.branch || deployment.target || deployment.id}</div>
                          <div className="text-[11px] text-white/45">{deployment.commitMessage || deployment.url || "Deployment"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("border-white/10 bg-white/[0.03] text-white/75", statusTone(deployment.status === "ready" ? true : deployment.status === "error" ? false : null))}>
                            {deployment.status}
                          </Badge>
                          <div className="text-[11px] text-white/45">{formatTime(deployment.createdAt)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Section>
          ) : null}

          {centerTab === "errors" ? (
            <Section title="Errors & warnings" subtitle="Koraci, console i status problemi na jednom mjestu">
              {derivedErrors.length === 0 ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  Trenutno nema aktivnih grešaka. DEV status izgleda uredno.
                </div>
              ) : (
                <div className="space-y-3">
                  {derivedErrors.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                      <div className="flex items-start gap-3">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="whitespace-pre-wrap leading-6">{item}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          ) : null}
        </div>

        <div className="min-h-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "steps", label: "Steps", icon: LayoutPanelTop },
              { key: "logs", label: "Logs", icon: TerminalSquare },
              { key: "actions", label: "Saved actions", icon: Brain },
            ].map((tab) => (
              <Button
                key={tab.key}
                variant="outline"
                size="sm"
                className={cn(
                  "border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]",
                  rightTab === tab.key && "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                )}
                onClick={() => setRightTab(tab.key as typeof rightTab)}
              >
                <tab.icon className="mr-2 h-4 w-4" />
                {tab.label}
              </Button>
            ))}
          </div>

          {rightTab === "steps" ? (
            <Section title="Execution steps" subtitle="Klikni korak za detalj ili obriši nepotrebne korake" right={steps.length ? <Button variant="ghost" size="sm" className="text-white/70 hover:text-white" onClick={onClearSteps}><Trash2 className="mr-2 h-4 w-4" />Clear</Button> : undefined}>
              <ScrollArea className="h-[700px] pr-3">
                <div className="space-y-3">
                  {steps.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                      Još nema koraka. Pokreni DEV akciju ili flow.
                    </div>
                  ) : (
                    steps.map((step) => {
                      const Icon = getActionIcon(step.action);
                      const StatusIcon = getStepStatusIcon(step.status);
                      return (
                        <div key={step.id} className={cn("rounded-2xl border p-3", stepTone(step.status))}>
                          <div className="flex items-start justify-between gap-3">
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectStep?.(step)}>
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Icon className="h-4 w-4" />
                                <span className="truncate">{step.label}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[11px] opacity-80">
                                <StatusIcon className={cn("h-3.5 w-3.5", step.status === "running" && "animate-spin")} />
                                <span>{step.status}</span>
                                {step.target ? <span className="truncate">• {step.target}</span> : null}
                              </div>
                              {step.detail ? <div className="mt-2 whitespace-pre-wrap text-[12px] leading-5 opacity-90">{step.detail}</div> : null}
                            </button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white/60 hover:text-white" onClick={() => onDeleteStep?.(step.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </Section>
          ) : null}

          {rightTab === "logs" ? (
            <Section title="Logs" subtitle="Console, GitHub, Vercel i local build logovi">
              <ScrollArea className="h-[700px] pr-3">
                <div className="space-y-3">
                  {mergedLogs.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                      Još nema logova.
                    </div>
                  ) : (
                    mergedLogs.map((log) => (
                      <div key={log.id} className={cn("rounded-2xl border p-3", levelTone(log.level))}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              <span>{log.title}</span>
                              <Badge variant="outline" className="border-current/20 bg-transparent text-[10px] text-current">
                                {log.source}
                              </Badge>
                            </div>
                            {log.detail ? <div className="mt-2 whitespace-pre-wrap text-[12px] leading-5 opacity-90">{log.detail}</div> : null}
                            {log.at ? <div className="mt-2 text-[11px] opacity-70">{formatTime(log.at)}</div> : null}
                          </div>
                          {log.href ? (
                            <a href={log.href} target="_blank" rel="noreferrer" className="shrink-0 text-current opacity-80 hover:opacity-100">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Section>
          ) : null}

          {rightTab === "actions" ? (
            <Section title="Saved actions & learning" subtitle="Pokreni spremljene flowove ili upravljaj snimanjem">
              <div className="flex flex-wrap gap-2">
                {!isRecording ? (
                  <Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={onStartRecording}>
                    <Brain className="mr-2 h-4 w-4" />
                    Start recording
                  </Button>
                ) : (
                  <>
                    <Button className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={onSaveRecording}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save recording
                    </Button>
                    <Button variant="outline" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]" onClick={onCancelRecording}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                )}
                <Button variant="outline" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]" onClick={onRefreshActions}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh actions
                </Button>
              </div>

              <Separator className="my-4 bg-white/10" />

              <ScrollArea className="h-[580px] pr-3">
                <div className="space-y-3">
                  {savedActions.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                      Još nema spremljenih akcija.
                    </div>
                  ) : (
                    savedActions.map((action) => (
                      <div key={action.file} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white/90">{action.name}</div>
                            <div className="mt-1 truncate text-[11px] text-white/45">{action.file}</div>
                          </div>
                          <Button size="sm" className="bg-white text-slate-950 hover:bg-white/90" onClick={() => onRunSavedAction?.(action.name)}>
                            <Play className="mr-2 h-4 w-4" />
                            Run
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
