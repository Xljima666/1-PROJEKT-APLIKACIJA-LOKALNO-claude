export type DevOpsLevel = "info" | "success" | "warning" | "error";

export interface DevOpsLogEntry {
  id: string;
  source: string;
  level: DevOpsLevel;
  title: string;
  detail?: string;
  at?: string;
  href?: string;
}

export interface DevOpsCommitInfo {
  sha?: string;
  shortSha?: string;
  message?: string;
  at?: string;
}

export interface DevOpsGitSnapshot {
  configured: boolean;
  repo?: string;
  branch?: string;
  dirty?: boolean;
  changedFiles?: string[];
  latestCommit?: DevOpsCommitInfo;
}

export interface DevOpsBuildSnapshot {
  status?: "idle" | "pending" | "building" | "ready" | "error" | "unknown";
  label?: string;
  target?: string;
  branch?: string;
  createdAt?: string;
  commitMessage?: string;
  url?: string;
  inspectorUrl?: string;
}

export interface DevOpsDeploymentItem {
  id: string;
  status: string;
  target?: string;
  branch?: string;
  commitMessage?: string;
  createdAt?: string;
  url?: string;
}

export interface DevOpsAgentSnapshot {
  configured: boolean;
  online: boolean;
  workspace?: string;
}

export interface DevOpsSnapshot {
  agent: DevOpsAgentSnapshot;
  git: DevOpsGitSnapshot;
  build?: DevOpsBuildSnapshot;
  deployments?: DevOpsDeploymentItem[];
  logs?: DevOpsLogEntry[];
  errors?: string[];
}
