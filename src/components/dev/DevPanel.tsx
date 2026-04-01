import { cn } from "@/lib/utils";
import {
  Bot,
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
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  isAgentRunning?: boolean;
  isThinking?: boolean;
  onSendMessage?: (message: string) => void;
  onRunAction?: (action: DevActionType, payload?: ActionPayload) => void;
  onStopAgent?: () => void;
  onClearSteps?: () => void;
  onSelectStep?: (step: DevStep) => void;
  onDescribePreview?: () => void;
  onWaitForLoad?: () => void;
  onRefreshScreenshot?: () => void;
};

const quickActions: Array<{
  key: DevActionType;
  label: string;
  placeholder?: string;
}> = [
  { key: "open", label: "Open", placeholder: "https://..." },
  { key: "click", label: "Click", placeholder: "tekst, selector, gumb..." },
  { key: "type", label: "Type", placeholder: "upiši vrijednost..." },
  { key: "screenshot", label: "Screenshot" },
  { key: "learn", label: "Learn", placeholder: "naziv flowa ili napomena..." },
];

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
      return ChevronRight;
  }
}

function getStatusIcon(status: StepStatus) {
  switch (status) {
    case "queued":
      return Clock3;
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

function getStatusTone(status: StepStatus) {
  switch (status) {
    case "queued":
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "running":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";
    case "done":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function formatActionLabel(action: DevActionType) {
  switch (action) {
    case "open":
      return "Open";
    case "click":
      return "Click";
    case "type":
      return "Type";
    case "screenshot":
      return "Screenshot";
    case "learn":
      return "Learn";
    default:
      return action;
  }
}

function MiniActionCard({
  action,
  value,
  onValueChange,
  onRun,
}: {
  action: (typeof quickActions)[number];
  value: string;
  onValueChange: (value: string) => void;
  onRun: () => void;
}) {
  const needsInput = action.key !== "screenshot";

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
        {action.label}
      </div>

      {needsInput ? (
        <input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={action.placeholder}
          className="mb-2 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white/80 outline-none placeholder:text-white/20"
        />
      ) : (
        <div className="mb-2 flex h-10 items-center rounded-xl border border-dashed border-white/[0.08] bg-black/20 px-3 text-xs text-white/20">
          Nema dodatnog unosa
        </div>
      )}

      <button
        onClick={onRun}
        className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-white px-3 text-sm font-medium text-black transition hover:opacity-90"
      >
        {action.label}
      </button>
    </div>
  );
}

export default function DevPanel({
  title = "Stellan DEV",
  messages,
  steps,
  preview,
  isAgentRunning = false,
  isThinking = false,
  onSendMessage,
  onRunAction,
  onStopAgent,
  onClearSteps,
  onSelectStep,
  onDescribePreview,
  onWaitForLoad,
  onRefreshScreenshot,
}: Props) {
  const [input, setInput] = useState("");
  const [actionValue, setActionValue] = useState<Record<DevActionType, string>>({
    open: "",
    click: "",
    type: "",
    screenshot: "",
    learn: "",
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const stats = useMemo(
    () => ({
      total: steps.length,
      running: steps.filter((s) => s.status === "running").length,
      done: steps.filter((s) => s.status === "done").length,
      errors: steps.filter((s) => s.status === "error").length,
    }),
    [steps]
  );

  const submitMessage = () => {
    const value = input.trim();
    if (!value) return;
    onSendMessage?.(value);
    setInput("");
  };

  const runAction = (action: DevActionType) => {
    const raw = actionValue[action]?.trim();

    if (action === "open") {
      onRunAction?.("open", { url: raw });
      return;
    }

    if (action === "click") {
      onRunAction?.("click", { target: raw });
      return;
    }

    if (action === "type") {
      onRunAction?.("type", { value: raw });
      return;
    }

    if (action === "screenshot") {
      onRunAction?.("screenshot");
      return;
    }

    if (action === "learn") {
      onRunAction?.("learn", { value: raw });
      return;
    }
  };

  return (
    <div className="flex h-full min-w-0 bg-[hsl(220,15%,4%)]">
      <div className="grid min-h-0 flex-1 grid-cols-[430px_minmax(0,1fr)_340px]">
        <aside className="flex min-h-0 flex-col border-r border-white/[0.06] bg-[hsl(220,15%,5%)]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black">
                <Bot className="h-5 w-5" />
              </div>

              <div>
                <div className="text-sm font-semibold text-white/85">{title}</div>
                <div className="text-xs text-white/30">C-style DEV panel</div>
              </div>
            </div>

            <div className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-white/45">
              {messages.length} poruka
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-3">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const isAssistant = msg.role === "assistant";

                return (
                  <div key={msg.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                        isUser && "bg-white text-black",
                        isAssistant && "border border-white/[0.08] bg-white/[0.04] text-white/85",
                        msg.role === "system" && "border border-amber-500/20 bg-amber-500/10 text-amber-200"
                      )}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {msg.createdAt && (
                        <div className={cn("mt-2 text-[11px]", isUser ? "text-black/50" : "text-white/25")}>
                          {msg.createdAt}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="flex max-w-[90%] items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Stellan radi...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-white/[0.06] p-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitMessage();
                  }
                }}
                placeholder='Npr. Otvori sdge.hr, klikni prijavu i pokaži mi stanje u previewu.'
                rows={4}
                className="w-full resize-none bg-transparent px-2 py-2 text-sm text-white/85 outline-none placeholder:text-white/20"
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs text-white/25">Enter šalje • Shift+Enter novi red</div>

                <button
                  onClick={submitMessage}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                >
                  <Play className="h-4 w-4" />
                  Pošalji
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col border-r border-white/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 bg-[hsl(220,15%,5%)]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
                <Globe className="h-4 w-4" />
                Browser Preview
              </div>
              <div className="truncate text-xs text-white/30">{preview.url || "Nema aktivnog previewa"}</div>
            </div>

            <div className="flex items-center gap-2">
              {preview.url && (
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.05]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Otvori
                </a>
              )}

              <button
                onClick={onRefreshScreenshot}
                className="rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.05]"
              >
                Screenshot
              </button>

              <button
                onClick={onWaitForLoad}
                className="rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.05]"
              >
                Čekaj
              </button>

              <button
                onClick={onDescribePreview}
                className="rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.05]"
              >
                Opiši
              </button>

              <div
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  preview.isLive
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : "border-white/[0.08] bg-white/[0.05] text-white/45"
                )}
              >
                {preview.isLive ? "LIVE" : "STATIC"}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-[#0a0c12] p-4">
            <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-[26px] border border-white/[0.08] bg-black/20 shadow-inner">
              <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-rose-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <div className="ml-3 truncate rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/35">
                  {preview.title || preview.url || "Playwright preview"}
                </div>
              </div>

              <div className="relative flex-1 overflow-hidden">
                {preview.screenshotUrl ? (
                  <img
                    src={preview.screenshotUrl}
                    alt="Preview screenshot"
                    className="h-full w-full object-contain bg-[#0a0c12]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-8">
                    <div className="max-w-md text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.04]">
                        <PanelRight className="h-7 w-7 text-white/25" />
                      </div>
                      <div className="text-lg font-semibold text-white/85">Preview će biti ovdje</div>
                      <div className="mt-2 text-sm leading-6 text-white/30">
                        Kada agent otvori stranicu ili napravi screenshot, ovdje se prikazuje stanje browsera.
                      </div>
                    </div>
                  </div>
                )}

                {preview.summary && (
                  <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/[0.08] bg-black/65 px-3 py-2 text-xs text-white/70 backdrop-blur">
                    {preview.summary}
                  </div>
                )}

                {isAgentRunning && (
                  <div className="absolute top-4 right-4 rounded-2xl border border-white/[0.08] bg-black/65 px-3 py-2 text-xs font-medium text-white/70 backdrop-blur">
                    Agent izvršava korake...
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <aside className="flex min-h-0 flex-col bg-[hsl(220,15%,5%)]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-white/85">Actions</div>
              <div className="text-xs text-white/30">Brze DEV akcije i koraci agenta</div>
            </div>

            <button
              onClick={isAgentRunning ? onStopAgent : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
                isAgentRunning
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
                  : "border-white/[0.08] bg-white/[0.04] text-white/45"
              )}
            >
              {isAgentRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isAgentRunning ? "Stop" : "Idle"}
            </button>
          </div>

          <div className="border-b border-white/[0.06] p-3">
            <div className="grid grid-cols-1 gap-2">
              {quickActions.map((action) => (
                <MiniActionCard
                  key={action.key}
                  action={action}
                  value={actionValue[action.key]}
                  onValueChange={(value) => setActionValue((prev) => ({ ...prev, [action.key]: value }))}
                  onRun={() => runAction(action.key)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 border-b border-white/[0.06] p-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="text-[11px] text-white/25">Ukupno</div>
              <div className="mt-1 text-base font-semibold text-white/85">{stats.total}</div>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
              <div className="text-[11px] text-blue-300">Run</div>
              <div className="mt-1 text-base font-semibold text-blue-200">{stats.running}</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="text-[11px] text-emerald-300">Done</div>
              <div className="mt-1 text-base font-semibold text-emerald-200">{stats.done}</div>
            </div>
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3">
              <div className="text-[11px] text-rose-300">Err</div>
              <div className="mt-1 text-base font-semibold text-rose-200">{stats.errors}</div>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="text-sm font-semibold text-white/85">Steps</div>

            {onClearSteps && (
              <button
                onClick={onClearSteps}
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.05]"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-3">
              {steps.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/[0.12] p-6 text-center text-sm text-white/30">
                  Još nema koraka. Pokreni open, click, type ili screenshot.
                </div>
              )}

              {steps.map((step, index) => {
                const ActionIcon = getActionIcon(step.action);
                const StatusIcon = getStatusIcon(step.status);

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onSelectStep?.(step)}
                    className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left shadow-sm transition hover:border-white/[0.14] hover:bg-white/[0.05]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-white/75">
                        <ActionIcon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold text-white/85">
                            {index + 1}. {step.label}
                          </div>

                          <div
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium",
                              getStatusTone(step.status)
                            )}
                          >
                            <StatusIcon className={cn("h-3.5 w-3.5", step.status === "running" && "animate-spin")} />
                            {step.status}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/45">
                            {formatActionLabel(step.action)}
                          </span>

                          {step.target && (
                            <span className="max-w-full truncate rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/45">
                              Target: {step.target}
                            </span>
                          )}

                          {step.value && (
                            <span className="max-w-full truncate rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/45">
                              Value: {step.value}
                            </span>
                          )}
                        </div>

                        {step.detail && (
                          <div className="mt-3 text-sm leading-6 text-white/50">{step.detail}</div>
                        )}

                        {step.createdAt && (
                          <div className="mt-3 text-[11px] text-white/20">{step.createdAt}</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
