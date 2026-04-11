import { useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  FolderOpen,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  Rocket,
  Server,
  Square,
  TerminalSquare,
  UploadCloud,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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

function statusTone(ok: boolean | null | undefined) {
  if (ok === true) return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (ok === false) return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  return "border-white/10 bg-white/[0.03] text-white/60";
}

function levelTone(level: DevOpsLogEntry["level"]) {
  switch (level) {
    case "success":
      return "border-emerald-400/18 bg-emerald-400/10 text-emerald-100";
    case "warning":
      return "border-amber-400/18 bg-amber-400/10 text-amber-100";
    case "error":
      return "border-rose-400/18 bg-rose-400/10 text-rose-100";
    default:
      return "border-cyan-400/18 bg-cyan-400/10 text-cyan-100";
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
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/65 transition hover:bg-white/[0.06]"
    >
      <Copy className="h-3 w-3" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="dev-surface dev-glow-border rounded-[26px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3.5">
        <div>
          <div className="text-sm font-semibold text-white/92">{title}</div>
          {subtitle ? <div className="mt-0.5 text-[11px] text-white/42">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className={cn("dev-glow-border rounded-[24px] border px-4 py-3.5", tone || "border-white/10 bg-white/[0.03] text-white/80")}>
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/42">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2.5 text-[18px] font-semibold tracking-tight text-white/94">{value}</div>
      {hint ? <div className="mt-1.5 break-words text-[11px] leading-5 text-white/42">{hint}</div> : null}
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-white/36">{label}</div>
      <div className="mt-1 break-words text-sm text-white/84">{value || "—"}</div>
    </div>
  );
}

export default function DevPanel({
  title = "DEV Studio",
  consoleLogs = [],
  isAgentRunning = false,
  agentOnline = null,
  modelBadge = "FAST",
  isDeploying = false,
  deployStatus = "idle",
  projectRoot,
  devOps,
  devOpsLoading = false,
  onRefreshDevOps,
  onDeploy,
  onStartAgent,
  onStopAgent,
  onCheckHealth,
  onPortalAction,
  onBackToStellan,
}: Props) {
  const [commitMessage, setCommitMessage] = useState("");

  const mergedLogs = useMemo(() => {
    const localLogs: DevOpsLogEntry[] = consoleLogs.slice(-20).map((log, index) => ({
      id: `console-${index}-${log.msg.slice(0, 20)}`,
      source: "system",
      level:
        log.t === "warn" || log.t === "err"
          ? "warning"
          : log.t === "ok"
            ? "success"
            : "info",
      title: log.msg,
    }));

    return [...(devOps?.logs || []), ...localLogs].slice(0, 40);
  }, [consoleLogs, devOps?.logs]);

  const derivedErrors = useMemo(() => {
    return [...(devOps?.errors || [])].filter(Boolean).slice(0, 12);
  }, [devOps?.errors]);

  const gitValue = devOps?.git?.branch
    ? `${devOps.git.branch}${devOps.git.dirty ? " · dirty" : " · clean"}`
    : devOps?.git?.configured
      ? "Repo connected"
      : "Repo not configured";

  const buildValue = isDeploying
    ? "Deploy running"
    : devOps?.build?.label
      ? devOps.build.label
      : deployStatus === "success"
        ? "Success"
        : deployStatus === "error"
          ? "Error"
          : "Unknown";

  const handleCommit = () => {
    const message = commitMessage.trim();
    if (!message) return;
    const safeMessage = message.replace(/"/g, "'");
    onPortalAction?.(`git commit \"${safeMessage}\"`);
  };

  const handleDeployWithMessage = () => {
    const message = commitMessage.trim().replace(/"/g, "'");
    if (message) {
      onPortalAction?.(`deploy \"${message}\"`);
      return;
    }
    onDeploy?.();
  };

  return (
    <div className="dev-flow-bg relative flex h-full flex-col overflow-hidden text-white">
      <div className="relative z-10 flex h-full flex-col">
        <div className="border-b border-white/8 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="dev-pill rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                  {title}
                </div>
                <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[11px]", statusTone(agentOnline))}>
                  <Activity className="mr-1 h-3 w-3" />
                  Agent {agentOnline === true ? "online" : agentOnline === false ? "offline" : "..."}
                </Badge>
                <Badge variant="outline" className="rounded-full border-violet-400/16 bg-violet-400/10 px-3 py-1 text-[11px] text-violet-100">
                  <Wrench className="mr-1 h-3 w-3" />
                  Commit / Build / Deploy
                </Badge>
                <Badge variant="outline" className="dev-pill-muted rounded-full px-3 py-1 text-[11px]">
                  {modelBadge}
                </Badge>
              </div>
              <div className="mt-3 text-sm text-white/68">
                DEV je sada fokusiran samo na git, commit, build, deploy, status i logove.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-white hover:bg-white/[0.08]"
                onClick={onRefreshDevOps}
              >
                {devOpsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh status
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-white hover:bg-white/[0.08]"
                onClick={onCheckHealth}
              >
                <Bot className="mr-2 h-4 w-4" />
                Check agent
              </Button>
              {isAgentRunning ? (
                <Button size="sm" variant="destructive" className="h-10 rounded-2xl px-4" onClick={onStopAgent}>
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              ) : (
                <Button size="sm" className="h-10 rounded-2xl bg-emerald-400 px-4 text-slate-950 hover:bg-emerald-300" onClick={onStartAgent}>
                  <Play className="mr-2 h-4 w-4" />
                  Start agent
                </Button>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Server}
              label="Agent"
              value={devOps?.agent?.online ? "Online" : devOps?.agent?.configured ? "Offline" : "Not configured"}
              tone={statusTone(devOps?.agent?.online)}
              hint={devOps?.agent?.workspace || undefined}
            />
            <StatCard
              icon={GitBranch}
              label="Git"
              value={gitValue}
              tone={statusTone(devOps ? !devOps.git.dirty : null)}
              hint={devOps?.git?.latestCommit?.shortSha ? `${devOps.git.latestCommit.shortSha} • ${devOps.git.latestCommit.message}` : undefined}
            />
            <StatCard
              icon={Rocket}
              label="Build / Deploy"
              value={buildValue}
              tone={statusTone(devOps?.build?.status === "ready" ? true : devOps?.build?.status === "error" ? false : null)}
              hint={devOps?.build?.branch || undefined}
            />
            <StatCard
              icon={FolderOpen}
              label="Project root"
              value={projectRoot || "Not set"}
              hint={projectRoot ? "Lokalni root za git/build/deploy akcije" : "Postavi ga kroz chat ili DEV naredbu"}
            />
          </div>
        </div>

        <div className="relative z-10 grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="min-h-0 space-y-4">
            <Section title="Commit & deploy" subtitle="Glavne DEV akcije za repo" right={projectRoot ? <CopyChip value={projectRoot} /> : undefined}>
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" className="h-12 justify-start rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => onPortalAction?.("git status")}>
                    <GitBranch className="mr-2 h-4 w-4" />
                    Git status
                  </Button>
                  <Button variant="outline" className="h-12 justify-start rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => onPortalAction?.("pokreni build")}>
                    <Play className="mr-2 h-4 w-4" />
                    Build
                  </Button>
                  <Button variant="outline" className="h-12 justify-start rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => onPortalAction?.("git push")}>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Git push
                  </Button>
                  <Button className="h-12 justify-start rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={handleDeployWithMessage}>
                    <Rocket className="mr-2 h-4 w-4" />
                    Deploy
                  </Button>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/15 p-3.5">
                  <div className="mb-2 text-sm font-medium text-white/92">Commit poruka</div>
                  <div className="mb-3 text-[11px] leading-5 text-white/42">
                    Upiši poruku i klikni commit. Ista poruka se može koristiti i za deploy.
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="npr. fix: dev panel visuals polish"
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25"
                    />
                    <Button className="h-11 rounded-2xl bg-white px-4 text-slate-950 hover:bg-white/90" onClick={handleCommit} disabled={!commitMessage.trim()}>
                      Commit
                    </Button>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Repo status" subtitle="Brzi pregled repozitorija i zadnjih promjena">
              <div className="space-y-3 text-sm text-white/75">
                <div className="grid gap-2">
                  <MiniInfo label="Repo" value={devOps?.git?.repo || "—"} />
                  <MiniInfo label="Branch" value={devOps?.git?.branch || "—"} />
                  <MiniInfo label="State" value={devOps?.git?.dirty ? "Dirty" : "Clean"} />
                  {devOps?.git?.latestCommit ? (
                    <MiniInfo
                      label="Latest commit"
                      value={`${devOps.git.latestCommit.shortSha || devOps.git.latestCommit.sha || "—"} • ${devOps.git.latestCommit.message || "—"}`}
                    />
                  ) : null}
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/15 p-3.5">
                  <div className="mb-2 text-sm font-medium text-white/92">Promijenjeni fileovi</div>
                  {!devOps?.git?.changedFiles?.length ? (
                    <div className="text-[12px] text-white/42">Trenutno nema popisa promijenjenih fileova.</div>
                  ) : (
                    <div className="space-y-1.5 text-[12px]">
                      {devOps.git.changedFiles.slice(0, 12).map((file) => (
                        <div key={file} className="rounded-2xl border border-white/8 bg-white/[0.03] px-2.5 py-2 font-mono text-white/84">
                          {file}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {derivedErrors.length > 0 ? (
              <Section title="Greške" subtitle="Aktivni problemi iz DEV statusa">
                <div className="space-y-2">
                  {derivedErrors.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-[22px] border border-rose-400/18 bg-rose-400/10 p-3 text-sm text-rose-100">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="whitespace-pre-wrap leading-6">{item}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}
          </div>

          <div className="min-h-0 space-y-4">
            <Section title="Build & deploy status" subtitle="Zadnji build i deployment podaci">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/92">
                    <Rocket className="h-4 w-4 text-emerald-300" />
                    Zadnji build
                  </div>
                  <div className="space-y-2 text-sm text-white/75">
                    <div><span className="text-white/42">Status:</span> {devOps?.build?.label || "—"}</div>
                    <div><span className="text-white/42">Target:</span> {devOps?.build?.target || "—"}</div>
                    <div><span className="text-white/42">Branch:</span> {devOps?.build?.branch || "—"}</div>
                    <div><span className="text-white/42">Time:</span> {formatTime(devOps?.build?.createdAt)}</div>
                    {devOps?.build?.commitMessage ? (
                      <div><span className="text-white/42">Commit:</span> {devOps.build.commitMessage}</div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {devOps?.build?.url ? (
                      <a href={devOps.build.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-emerald-400/16 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-400/18">
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

                <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/92">
                    <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                    Zadnji deploymenti
                  </div>
                  <div className="space-y-2">
                    {(devOps?.deployments || []).length === 0 ? (
                      <div className="text-sm text-white/42">Još nema deployment podataka.</div>
                    ) : (
                      devOps!.deployments!.slice(0, 6).map((deployment) => (
                        <div key={deployment.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/75">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-white/92">{deployment.branch || deployment.target || deployment.id}</div>
                              <div className="truncate text-[11px] text-white/42">{deployment.commitMessage || deployment.url || "Deployment"}</div>
                            </div>
                            <Badge variant="outline" className={cn("rounded-full border-white/10 bg-white/[0.03] text-white/75", statusTone(deployment.status === "ready" ? true : deployment.status === "error" ? false : null))}>
                              {deployment.status}
                            </Badge>
                          </div>
                          <div className="mt-1 text-[11px] text-white/42">{formatTime(deployment.createdAt)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Logs" subtitle="DEV logovi, build output i status događaji">
              <ScrollArea className="h-[540px] pr-3">
                <div className="space-y-3">
                  {mergedLogs.length === 0 ? (
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/42">
                      Još nema logova.
                    </div>
                  ) : (
                    mergedLogs.map((log) => (
                      <div key={log.id} className={cn("rounded-[22px] border p-3.5", levelTone(log.level))}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              <TerminalSquare className="h-4 w-4" />
                              <span>{log.title}</span>
                              <Badge variant="outline" className="rounded-full border-current/20 bg-transparent text-[10px] text-current">
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
          </div>
        </div>
      </div>
    </div>
  );
}
