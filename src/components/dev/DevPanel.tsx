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
  PanelRight,
  Rocket,
  Zap,
  RefreshCw,
  HardDrive,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

export type DevChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};

export type ConsoleLog = { t: string; msg: string };

type ActionPayload = {
  url?: string;
  target?: string;
  value?: string;
};

type Props = {
  title?: string;
  messages: DevChatMessage[];
  steps: DevStep[];
  preview: DevPreviewState;
  consoleLogs?: ConsoleLog[];
  isAgentRunning?: boolean;
  isThinking?: boolean;
  agentOnline?: boolean | null;
  modelBadge?: string;
  isRecording?: boolean;
  recordingName?: string;
  isDeploying?: boolean;
  deployStatus?: "idle" | "success" | "error";
  savedActions?: { name: string; file: string }[];
  onSendMessage?: (message: string) => void;
  onRunAction?: (action: DevActionType, payload?: ActionPayload) => void;
  onStopAgent?: () => void;
  onClearSteps?: () => void;
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

/* ──────────────────────────── Quick Actions ──────────────────────────── */

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

/* ──────────────────────────── Helpers ──────────────────────────── */

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

/* ──────────────────────────── Component ──────────────────────────── */

export default function DevPanel({
  title = "Stellan DEV",
  messages,
  steps,
  preview,
  consoleLogs = [],
  isAgentRunning = false,
  isThinking = false,
  agentOnline = null,
  modelBadge = "FAST",
  isRecording = false,
  recordingName = "",
  isDeploying = false,
  deployStatus = "idle",
  savedActions = [],
  onSendMessage,
  onRunAction,
  onStopAgent,
  onClearSteps,
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
  const [input, setInput] = useState("");
  const [actionValues, setActionValues] = useState<Record<DevActionType, string>>({
    open: "", click: "", type: "", screenshot: "", learn: "",
  });
  const [rightTab, setRightTab] = useState<"steps" | "console" | "actions">("steps");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  const stats = useMemo(() => ({
    total: steps.length,
    running: steps.filter((s) => s.status === "running").length,
    done: steps.filter((s) => s.status === "done").length,
    errors: steps.filter((s) => s.status === "error").length,
  }), [steps]);

  const submitMessage = () => {
    const value = input.trim();
    if (!value) return;
    onSendMessage?.(value);
    setInput("");
  };

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
      {/* ═══ TOP BAR ═══ */}
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

      {/* ═══ BODY — 2 columns ═══ */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── CENTER: Browser Preview ── */}
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
              <button onClick={onRefreshScreenshot}
                className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/50 transition hover:bg-white/[0.05]">
                📸
              </button>
              <button onClick={onWaitForLoad}
                className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/50 transition hover:bg-white/[0.05]">
                ⏳
              </button>
              <button onClick={onDescribePreview}
                className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/50 transition hover:bg-white/[0.05]">
                👁
              </button>
              <div className={cn(
                "rounded-full border px-2 py-0.5 text-[9px] font-medium",
                preview.isLive ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/[0.08] bg-white/[0.05] text-white/35"
              )}>
                {preview.isLive ? "LIVE" : "STATIC"}
              </div>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-[#0a0c12] overflow-auto">
            <div className="flex h-full flex-col overflow-hidden rounded-none">
              <div className="relative flex-1 overflow-hidden">
                {preview.screenshotUrl ? (
                  <img src={preview.screenshotUrl} alt="Preview" className="h-full w-full object-contain bg-[#0a0c12]" />
                ) : (
                  <div className="flex h-full items-center justify-center p-8">
                    <div className="max-w-xs text-center">
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
                        <PanelRight className="h-6 w-6 text-white/20" />
                      </div>
                      <div className="text-sm font-semibold text-white/70">Preview</div>
                      <div className="mt-1.5 text-[11px] leading-5 text-white/25">
                        Kada agent otvori stranicu ili napravi screenshot, ovdje se prikazuje stanje.
                      </div>
                    </div>
                  </div>
                )}

                {preview.summary && (
                  <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/[0.08] bg-black/65 px-3 py-2 text-[11px] text-white/65 backdrop-blur">
                    {preview.summary}
                  </div>
                )}

                {isAgentRunning && (
                  <div className="absolute top-3 right-3 rounded-xl border border-white/[0.08] bg-black/65 px-3 py-2 text-[11px] font-medium text-white/65 backdrop-blur">
                    Agent izvršava korake...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Actions & Steps ── */}
        <div className="flex min-h-0 w-[320px] shrink-0 flex-col border-l border-white/[0.06] bg-[hsl(220,15%,5%)]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
            <div>
              <div className="text-[11px] font-semibold text-white/75">Actions</div>
              <div className="text-[9px] text-white/25">DEV akcije i koraci</div>
            </div>
            <button
              onClick={isAgentRunning ? onStopAgent : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition",
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
                    <input
                      value={actionValues[action.key]}
                      onChange={(e) => setActionValues((prev) => ({ ...prev, [action.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") runAction(action.key); }}
                      placeholder={action.placeholder}
                      className="flex-1 h-7 rounded-lg border border-white/[0.08] bg-black/20 px-2 text-[11px] text-white/70 outline-none placeholder:text-white/15"
                    />
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
              <div className="text-[9px] text-white/25">Ukupno</div>
              <div className="text-sm font-semibold text-white/75">{stats.total}</div>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2 text-center">
              <div className="text-[9px] text-blue-300">Run</div>
              <div className="text-sm font-semibold text-blue-200">{stats.running}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-center">
              <div className="text-[9px] text-emerald-300">Done</div>
              <div className="text-sm font-semibold text-emerald-200">{stats.done}</div>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-center">
              <div className="text-[9px] text-rose-300">Err</div>
              <div className="text-sm font-semibold text-rose-200">{stats.errors}</div>
            </div>
          </div>

          <div className="flex border-b border-white/[0.06] shrink-0">
            {(["steps", "console", "actions"] as const).map((tab) => (
              <button key={tab} onClick={() => setRightTab(tab)}
                className={cn("flex-1 py-2 text-[10px] border-b-[1.5px] transition-all capitalize",
                  rightTab === tab ? "text-indigo-300 border-indigo-500" : "text-white/20 border-transparent hover:text-white/40"
                )}>
                {tab === "steps" ? `Koraci (${steps.length})` : tab === "console" ? `Log (${consoleLogs.length})` : `Akcije (${savedActions.length})`}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {rightTab === "steps" && (
              <div className="p-2.5 space-y-2">
                {onClearSteps && steps.length > 0 && (
                  <button onClick={onClearSteps}
                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors mb-1">
                    <Trash2 className="h-3 w-3" /> Očisti
                  </button>
                )}
                {steps.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.1] p-6 text-center text-[11px] text-white/25">
                    Još nema koraka. Pokreni akciju.
                  </div>
                ) : steps.map((step, index) => {
                  const ActionIcon = getActionIcon(step.action);
                  const StatusIcon = getStatusIcon(step.status);
                  return (
                    <button key={step.id} type="button" onClick={() => onSelectStep?.(step)}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-left shadow-sm transition hover:border-white/[0.14] hover:bg-white/[0.05]">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/65">
                          <ActionIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-[11px] font-semibold text-white/80">{index + 1}. {step.label}</div>
                            <div className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium", getStatusColor(step.status))}>
                              <StatusIcon className={cn("h-3 w-3", step.status === "running" && "animate-spin")} />
                              {step.status}
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] font-medium text-white/35">{formatActionLabel(step.action)}</span>
                            {step.target && <span className="max-w-full truncate rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] text-white/35">{step.target}</span>}
                          </div>
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
                      l.t === "ok" ? "text-emerald-400" :
                      l.t === "info" ? "text-indigo-300" :
                      l.t === "warn" ? "text-amber-300" :
                      l.t === "err" ? "text-red-400" :
                      "text-white/20"
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
                  <button onClick={onRefreshActions}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-white/30 border border-white/[0.08] hover:bg-white/[0.05] transition-all">
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
