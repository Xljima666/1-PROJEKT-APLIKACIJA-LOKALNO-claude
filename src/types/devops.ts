export type DevOpsLogLevel = "info" | "success" | "warning" | "error";
export type DevOpsSource = "agent" | "git" | "vercel" | "github" | "system";

export interface DevOpsLogEntry {
  id: string;
  source: DevOpsSource;
  level: DevOpsLogLevel;
  title: string;
  detail?: string;
  at?: string;
  href?: string;
}

export interface AgentSnapshot {
  configured: boolean;
  online: boolean;
  baseUrl?: string | null;
  workspace?: string | null;
  python?: string | null;
  timestamp?: string | null;
  error?: string | null;
}

export interface GitCommitSnapshot {
  sha: string;
  shortSha: string;
  message: string;
  author?: string | null;
  date?: string | null;
  url?: string | null;
}

export interface GitSnapshot {
  configured: boolean;
  source: "agent" | "github" | "none";
  repo?: string | null;
  repoUrl?: string | null;
  branch?: string | null;
  statusText?: string | null;
  dirty: boolean;
  changedFiles: string[];
  latestCommit?: GitCommitSnapshot | null;
  error?: string | null;
}

export interface DeploymentSnapshot {
  id: string;
  status: string;
  url?: string | null;
  inspectorUrl?: string | null;
  target?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  commitMessage?: string | null;
  createdAt?: string | null;
}

export interface BuildSnapshot {
  configured: boolean;
  status: string;
  label: string;
  url?: string | null;
  inspectorUrl?: string | null;
  target?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  commitMessage?: string | null;
  createdAt?: string | null;
  error?: string | null;
}

export interface DevOpsSnapshot {
  ok: boolean;
  timestamp: string;
  projectRoot?: string | null;
  agent: AgentSnapshot;
  git: GitSnapshot;
  build: BuildSnapshot;
  deployments: DeploymentSnapshot[];
  logs: DevOpsLogEntry[];
  errors: string[];
  missingConfig: string[];
}
