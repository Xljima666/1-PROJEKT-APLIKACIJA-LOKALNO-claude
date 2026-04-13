import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
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
  onSaveProjectRoot?: (value: string) => void;
  onBackToStellan?: () => void;
  onBack?: () => void;
};

function statusTone(ok: boolean | null | undefined) {
  if (ok === true)
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
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

function formatBytes(value?: number | null) {
  if (!value || value <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
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
    <div className="rounded-[26px] border border-emerald-400/10 bg-[linear-gradient(180deg,rgba(8,18,16,0.9),rgba(8,14,18,0.86))] shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3.5">
        <div>
          <div className="text-sm font-semibold text-white/92">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-[11px] text-white/42">{subtitle}</div>
          ) : null}
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
    <div
      className={cn(
        "rounded-[24px] border px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
        tone || "border-white/10 bg-white/[0.03] text-white/80",
      )}
    >
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/42">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2.5 text-[18px] font-semibold tracking-tight text-white/94">
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 break-words text-[11px] leading-5 text-white/42">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-white/36">
        {label}
      </div>
      <div className="mt-1 break-words text-sm text-white/84">
        {value || "—"}
      </div>
    </div>
  );
}

export default function DevPanel({
  title = "DEV Studio",
  steps = [],
  preview,
  consoleLogs = [],
  isAgentRunning = false,
  agentOnline = null,
  modelBadge = "FAST",
  isDeploying = false,
  deployStatus = "idle",
  projectRoot,
  devOps,
  devOpsLoading = false,
  onDescribePreview,
  onWaitForLoad,
  onRefreshScreenshot,
  onRefreshDevOps,
  onDeploy,
  onStartAgent,
  onStopAgent,
  onCheckHealth,
  onPortalAction,
  onSaveProjectRoot,
  onBackToStellan,
  onBack,
}: Props) {
  const [commitMessage, setCommitMessage] = useState("");
  const [projectRootInput, setProjectRootInput] = useState(projectRoot || "");
  const backHandler = onBackToStellan || onBack;

  useEffect(() => {
    setProjectRootInput(projectRoot || "");
  }, [projectRoot]);

  const mergedLogs = useMemo(() => {
    const localLogs: DevOpsLogEntry[] = consoleLogs
      .slice(-20)
      .map((log, index) => ({
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
    <div
      className="relative flex h-full flex-col overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse 120% 90% at 20% 0%, rgba(16,185,129,0.10) 0%, transparent 32%), radial-gradient(ellipse 90% 70% at 80% 0%, rgba(34,211,238,0.08) 0%, transparent 28%), linear-gradient(180deg, rgba(4,14,12,1) 0%, rgba(5,11,18,1) 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(52,211,153,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.08) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.75), transparent 90%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)",
            backgroundSize: "126px 126px",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent 95%)",
          }}
        />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="border-b border-white/8 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {backHandler ? (
                  <>
                    <button
                      onClick={backHandler}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-[12px] font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Nazad na Stellan
                    </button>
                    <div className="h-6 w-px bg-white/10" />
                  </>
                ) : null}

                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                  {title}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px]",
                    statusTone(agentOnline),
                  )}
                >
                  <Activity className="mr-1 h-3 w-3" />
                  Agent{" "}
                  {agentOnline === true
                    ? "online"
                    : agentOnline === false
                      ? "offline"
                      : "..."}
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-100"
                >
                  <Wrench className="mr-1 h-3 w-3" />
                  Commit / Build / Deploy
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70"
                >
                  {modelBadge}
                </Badge>
              </div>
              <div className="mt-3 text-sm text-white/68">
                DEV je sada fokusiran samo na git, commit, build, deploy, status
                i logove.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-white hover:bg-white/[0.08]"
                onClick={onRefreshDevOps}
              >
                {devOpsLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
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
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-10 rounded-2xl px-4"
                  onClick={onStopAgent}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-10 rounded-2xl bg-cyan-400 px-4 text-slate-950 hover:bg-cyan-300"
                  onClick={onStartAgent}
                >
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
              value={
                devOps?.agent?.online
                  ? "Online"
                  : devOps?.agent?.configured
                    ? "Offline"
                    : "Not configured"
              }
              tone={statusTone(devOps?.agent?.online)}
              hint={devOps?.agent?.workspace || undefined}
            />
            <StatCard
              icon={GitBranch}
              label="Git"
              value={gitValue}
              tone={statusTone(devOps ? !devOps.git.dirty : null)}
              hint={
                devOps?.git?.latestCommit?.shortSha
                  ? `${devOps.git.latestCommit.shortSha} • ${devOps.git.latestCommit.message}`
                  : undefined
              }
            />
            <StatCard
              icon={Rocket}
              label="Build / Deploy"
              value={buildValue}
              tone={statusTone(
                devOps?.build?.status === "ready"
                  ? true
                  : devOps?.build?.status === "error"
                    ? false
                    : null,
              )}
              hint={devOps?.build?.branch || undefined}
            />
            <StatCard
              icon={FolderOpen}
              label="Project root"
              value={projectRoot || "Not set"}
              hint={
                projectRoot
                  ? "Lokalni root za git/build/deploy akcije"
                  : "Upiši lokalni root projekta ispod i spremi ga."
              }
            />
          </div>
        </div>

        <div className="relative z-10 grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="min-h-0 space-y-4">
            <Section
              title="Project root"
              subtitle="Lokalni repo koji DEV koristi za build, backup i deploy"
              right={projectRoot ? <CopyChip value={projectRoot} /> : undefined}
            >
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={projectRootInput}
                    onChange={(e) => setProjectRootInput(e.target.value)}
                    placeholder="D:/1 PROJEKT APLIKACIJA LOKALNO/..."
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25"
                  />
                  <Button
                    className="h-11 rounded-2xl bg-white px-4 text-slate-950 hover:bg-white/90"
                    onClick={() => onSaveProjectRoot?.(projectRootInput.trim())}
                    disabled={!projectRootInput.trim()}
                  >
                    Spremi root
                  </Button>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12px] leading-5 text-white/58">
                  Ovdje upiši lokalni folder repozitorija. Sve DEV akcije —
                  backup, build, commit, push i deploy — vrte se nad tim
                  folderom.
                </div>
              </div>
            </Section>

            <Section
              title="Commit / backup / deploy"
              subtitle="Glavne akcije za lokalni repo"
              right={
                projectRoot ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-emerald-400/20 bg-emerald-400/10 text-[10px] text-emerald-100"
                  >
                    One-click cockpit
                  </Badge>
                ) : undefined
              }
            >
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-12 justify-start rounded-2xl border-emerald-400/12 bg-emerald-400/[0.03] text-white hover:bg-emerald-400/[0.08]"
                    onClick={() => onPortalAction?.("git status")}
                  >
                    <GitBranch className="mr-2 h-4 w-4 text-emerald-300" />
                    Git status
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 justify-start rounded-2xl border-cyan-400/12 bg-cyan-400/[0.03] text-white hover:bg-cyan-400/[0.08]"
                    onClick={() => onPortalAction?.("git pull rebase")}
                  >
                    <RefreshCw className="mr-2 h-4 w-4 text-cyan-300" />
                    Pull / rebase
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 justify-start rounded-2xl border-amber-400/12 bg-amber-400/[0.03] text-white hover:bg-amber-400/[0.08]"
                    onClick={() => onPortalAction?.("backup project")}
                  >
                    <FolderOpen className="mr-2 h-4 w-4 text-amber-300" />
                    Backup projekta
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 justify-start rounded-2xl border-cyan-400/12 bg-cyan-400/[0.03] text-white hover:bg-cyan-400/[0.08]"
                    onClick={() => onPortalAction?.("pokreni build")}
                  >
                    <Play className="mr-2 h-4 w-4 text-cyan-300" />
                    Build
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 justify-start rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    onClick={() => onPortalAction?.("git push")}
                  >
                    <UploadCloud className="mr-2 h-4 w-4 text-white/80" />
                    Git push
                  </Button>
                  <Button
                    className="h-12 justify-start rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    onClick={handleDeployWithMessage}
                  >
                    <Rocket className="mr-2 h-4 w-4" />
                    One-click deploy
                  </Button>
                </div>

                <div className="rounded-[22px] border border-emerald-400/10 bg-black/15 p-3.5">
                  <div className="mb-2 text-sm font-medium text-white/92">
                    Commit poruka
                  </div>
                  <div className="mb-3 text-[11px] leading-5 text-white/42">
                    Upiši poruku pa klikni <strong>Commit</strong>. Kod{" "}
                    <strong>One-click deploy</strong> prvo se radi backup, zatim
                    build, commit i push.
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="npr. feat: dev tab full cockpit"
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25"
                    />
                    <Button
                      className="h-11 rounded-2xl bg-white px-4 text-slate-950 hover:bg-white/90"
                      onClick={handleCommit}
                      disabled={!commitMessage.trim()}
                    >
                      Commit
                    </Button>
                  </div>
                </div>
              </div>
            </Section>

            <Section
              title="Repo status"
              subtitle="Brzi pregled repozitorija i zadnjih promjena"
            >
              <div className="space-y-3 text-sm text-white/75">
                <div className="grid gap-2">
                  <MiniInfo label="Repo" value={devOps?.git?.repo || "—"} />
                  <MiniInfo label="Branch" value={devOps?.git?.branch || "—"} />
                  <MiniInfo
                    label="State"
                    value={devOps?.git?.dirty ? "Dirty" : "Clean"}
                  />
                  {devOps?.git?.latestCommit ? (
                    <MiniInfo
                      label="Latest commit"
                      value={`${devOps.git.latestCommit.shortSha || devOps.git.latestCommit.sha || "—"} • ${devOps.git.latestCommit.message || "—"}`}
                    />
                  ) : null}
                </div>

                <div className="rounded-[22px] border border-emerald-400/10 bg-black/15 p-3.5">
                  <div className="mb-2 text-sm font-medium text-white/92">
                    Promijenjeni fileovi
                  </div>
                  {!devOps?.git?.changedFiles?.length ? (
                    <div className="text-[12px] text-white/42">
                      Trenutno nema popisa promijenjenih fileova.
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-[12px]">
                      {devOps.git.changedFiles.slice(0, 12).map((file) => (
                        <div
                          key={file}
                          className="rounded-2xl border border-white/8 bg-white/[0.03] px-2.5 py-2 font-mono text-white/84"
                        >
                          {file}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>

            <Section
              title="Backupi"
              subtitle="Zadnji snapshoti lokalnog projekta"
            >
              {(devOps?.backups || []).length === 0 ? (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/42">
                  Još nema backupova. Klikni <strong>Backup projekta</strong>{" "}
                  prije većih izmjena ili deploya.
                </div>
              ) : (
                <div className="space-y-2">
                  {devOps!.backups!.slice(0, 6).map((backup) => (
                    <div
                      key={backup.path || backup.name}
                      className="rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/75"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white/92">
                            {backup.name}
                          </div>
                          <div className="truncate text-[11px] text-white/42">
                            {backup.path || "_agent_backups"}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-amber-400/18 bg-amber-400/10 text-[10px] text-amber-100"
                        >
                          {formatBytes(backup.size)}
                        </Badge>
                      </div>
                      <div className="mt-1 text-[11px] text-white/42">
                        {formatTime(backup.modifiedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {derivedErrors.length > 0 ? (
              <Section
                title="Greške"
                subtitle="Aktivni problemi iz DEV statusa"
              >
                <div className="space-y-2">
                  {derivedErrors.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-[22px] border border-rose-400/18 bg-rose-400/10 p-3 text-sm text-rose-100"
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="whitespace-pre-wrap leading-6">
                          {item}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}
          </div>

          <div className="min-h-0 space-y-4">
            <Section
              title="Preview"
              subtitle="Aktivni Playwright prikaz i zadnji sažetak"
              right={
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-2xl border-white/10 bg-white/[0.04] px-3 text-white hover:bg-white/[0.08]"
                    onClick={onRefreshScreenshot}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Screenshot
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-2xl border-white/10 bg-white/[0.04] px-3 text-white hover:bg-white/[0.08]"
                    onClick={onWaitForLoad}
                  >
                    <Loader2 className="mr-2 h-4 w-4" />
                    Pričekaj load
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-2xl border-white/10 bg-white/[0.04] px-3 text-white hover:bg-white/[0.08]"
                    onClick={onDescribePreview}
                  >
                    <TerminalSquare className="mr-2 h-4 w-4" />
                    Opiši
                  </Button>
                </div>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-3">
                  {preview?.screenshotUrl ? (
                    <img
                      src={preview.screenshotUrl}
                      alt={preview?.title || "Preview"}
                      className="h-[320px] w-full rounded-[18px] border border-white/8 object-cover"
                    />
                  ) : (
                    <div className="flex h-[320px] items-center justify-center rounded-[18px] border border-dashed border-white/10 text-sm text-white/40">
                      Nema screenshot previewa
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <MiniInfo label="URL" value={preview?.url || "—"} />
                  <MiniInfo
                    label="Naslov"
                    value={preview?.title || "Playwright preview"}
                  />
                  <MiniInfo
                    label="Status"
                    value={preview?.isLive ? "Live" : "Offline"}
                  />
                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/36">
                      Sažetak
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/78">
                      {preview?.summary || "Još nema sažetka previewa."}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section
              title="Koraci"
              subtitle="Što je DEV stvarno napravio zadnje"
            >
              <div className="space-y-2">
                {steps.length === 0 ? (
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/42">
                    Još nema zabilježenih koraka.
                  </div>
                ) : (
                  steps
                    .slice(-8)
                    .reverse()
                    .map((step) => (
                      <div
                        key={step.id}
                        className="rounded-[22px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/78"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-white/92">
                              {step.label}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-white/42">
                              {step.detail || step.target || step.action}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full text-[10px]",
                              step.status === "done"
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                : step.status === "error"
                                  ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                                  : step.status === "running"
                                    ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                                    : "border-white/10 bg-white/[0.03] text-white/60",
                            )}
                          >
                            {step.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </Section>

            <Section
              title="Build & deploy status"
              subtitle="Zadnji build i deployment podaci"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-cyan-400/10 bg-black/15 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/92">
                    <Rocket className="h-4 w-4 text-cyan-300" />
                    Zadnji build
                  </div>
                  <div className="space-y-2 text-sm text-white/75">
                    <div>
                      <span className="text-white/42">Status:</span>{" "}
                      {devOps?.build?.label || "—"}
                    </div>
                    <div>
                      <span className="text-white/42">Target:</span>{" "}
                      {devOps?.build?.target || "—"}
                    </div>
                    <div>
                      <span className="text-white/42">Branch:</span>{" "}
                      {devOps?.build?.branch || "—"}
                    </div>
                    <div>
                      <span className="text-white/42">Time:</span>{" "}
                      {formatTime(devOps?.build?.createdAt)}
                    </div>
                    {devOps?.build?.commitMessage ? (
                      <div>
                        <span className="text-white/42">Commit:</span>{" "}
                        {devOps.build.commitMessage}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {devOps?.build?.url ? (
                      <a
                        href={devOps.build.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-cyan-400/16 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-400/18"
                      >
                        Open deployment <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {devOps?.build?.inspectorUrl ? (
                      <a
                        href={devOps.build.inspectorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/75 hover:bg-white/[0.06]"
                      >
                        Inspector <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[24px] border border-emerald-400/10 bg-black/15 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/92">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    Zadnji deploymenti
                  </div>
                  <div className="space-y-2">
                    {(devOps?.deployments || []).length === 0 ? (
                      <div className="text-sm text-white/42">
                        Još nema deployment podataka.
                      </div>
                    ) : (
                      devOps!.deployments!.slice(0, 6).map((deployment) => (
                        <div
                          key={deployment.id}
                          className="rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/75"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-white/92">
                                {deployment.branch ||
                                  deployment.target ||
                                  deployment.id}
                              </div>
                              <div className="truncate text-[11px] text-white/42">
                                {deployment.commitMessage ||
                                  deployment.url ||
                                  "Deployment"}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full border-white/10 bg-white/[0.03] text-white/75",
                                statusTone(
                                  deployment.status === "ready"
                                    ? true
                                    : deployment.status === "error"
                                      ? false
                                      : null,
                                ),
                              )}
                            >
                              {deployment.status}
                            </Badge>
                          </div>
                          <div className="mt-1 text-[11px] text-white/42">
                            {formatTime(deployment.createdAt)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Section>

            <Section
              title="Logs"
              subtitle="DEV logovi, build output i status događaji"
            >
              <ScrollArea className="h-[540px] pr-3">
                <div className="space-y-3">
                  {mergedLogs.length === 0 ? (
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/42">
                      Još nema logova.
                    </div>
                  ) : (
                    mergedLogs.map((log) => (
                      <div
                        key={log.id}
                        className={cn(
                          "rounded-[22px] border p-3.5",
                          levelTone(log.level),
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              <TerminalSquare className="h-4 w-4" />
                              <span>{log.title}</span>
                              <Badge
                                variant="outline"
                                className="rounded-full border-current/20 bg-transparent text-[10px] text-current"
                              >
                                {log.source}
                              </Badge>
                            </div>
                            {log.detail ? (
                              <div className="mt-2 whitespace-pre-wrap text-[12px] leading-5 opacity-90">
                                {log.detail}
                              </div>
                            ) : null}
                            {log.at ? (
                              <div className="mt-2 text-[11px] opacity-70">
                                {formatTime(log.at)}
                              </div>
                            ) : null}
                          </div>
                          {log.href ? (
                            <a
                              href={log.href}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-current opacity-80 hover:opacity-100"
                            >
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
