import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DevOpsLogLevel = "info" | "success" | "warning" | "error";
type DevOpsSource = "agent" | "git" | "vercel" | "github" | "system";

type DevOpsLogEntry = {
  id: string;
  source: DevOpsSource;
  level: DevOpsLogLevel;
  title: string;
  detail?: string;
  at?: string;
  href?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanUrl = (raw?: string | null) => {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

const shortSha = (value?: string | null) => (value ? value.slice(0, 7) : "");

const mapVercelStatus = (value?: string | null) => {
  const normalized = String(value || "UNKNOWN").toUpperCase();
  switch (normalized) {
    case "READY":
      return { status: "ready", label: "Ready" };
    case "BUILDING":
      return { status: "building", label: "Building" };
    case "QUEUED":
    case "INITIALIZING":
      return { status: "queued", label: "Queued" };
    case "ERROR":
    case "FAILED":
      return { status: "error", label: "Error" };
    case "CANCELED":
      return { status: "canceled", label: "Canceled" };
    default:
      return { status: "unknown", label: normalized };
  }
};

const parseGitStatus = (stdout?: string | null) => {
  const raw = String(stdout || "").trim();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines[0] || "";
  const changedFiles = lines
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean);

  let branch = "";
  const branchMatch = header.match(/^##\s+([^\.\s]+)/);
  if (branchMatch?.[1]) branch = branchMatch[1].trim();

  return {
    statusText: raw,
    branch,
    changedFiles,
    dirty: changedFiles.length > 0,
  };
};

const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      data?.error?.message || data?.message || `HTTP ${res.status}`,
    );
  }
  return data;
};

const fetchText = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  return text;
};

const agentRequest = async (
  agentBaseUrl: string,
  agentApiKey: string,
  endpoint: string,
  body: Record<string, unknown>,
) => {
  const res = await fetch(`${agentBaseUrl}/${endpoint.replace(/^\/+/, "")}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": agentApiKey,
      "ngrok-skip-browser-warning": "true",
      "User-Agent": "GeoTerra-Dev-Control/1.0",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || data?.detail || `Agent HTTP ${res.status}`);
  }
  return data;
};

const normalizeMessage = (value?: string | null) =>
  String(value || "")
    .trim()
    .replace(/^['"`]|['"`]$/g, "");

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const body =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const projectRoot =
      typeof body?.projectRoot === "string" ? body.projectRoot.trim() : "";

    const rawAgentUrl = Deno.env.get("AGENT_SERVER_URL");
    const agentBaseUrl = cleanUrl(rawAgentUrl);
    const agentApiKey = Deno.env.get("AGENT_API_KEY") || "";

    const githubToken = Deno.env.get("GITHUB_TOKEN") || "";
    const githubOwner =
      Deno.env.get("GITHUB_OWNER") || Deno.env.get("DEV_GITHUB_OWNER") || "";
    const githubRepo =
      Deno.env.get("GITHUB_REPO") || Deno.env.get("DEV_GITHUB_REPO") || "";

    const vercelToken = Deno.env.get("VERCEL_TOKEN") || "";
    const vercelProjectId = Deno.env.get("VERCEL_PROJECT_ID") || "";
    const vercelTeamId = Deno.env.get("VERCEL_TEAM_ID") || "";

    const action =
      typeof body?.action === "string" ? body.action.trim() : "status";

    if (action && action !== "status") {
      if (!projectRoot)
        return json(
          { success: false, error: "Project root nije postavljen." },
          400,
        );
      if (!agentBaseUrl || !agentApiKey)
        return json({ success: false, error: "Agent nije konfiguriran." }, 500);

      try {
        if (action === "git_status") {
          const result = await agentRequest(
            agentBaseUrl,
            agentApiKey,
            "git_status",
            { repo_path: projectRoot },
          );
          return json({
            success: true,
            action,
            message: "Git status dohvaćen.",
            result,
            summary: result?.stdout || "",
          });
        }
        if (action === "git_commit") {
          const message = normalizeMessage(body?.message as string);
          if (!message)
            return json(
              { success: false, error: "Commit poruka je obavezna." },
              400,
            );
          const result = await agentRequest(
            agentBaseUrl,
            agentApiKey,
            "git_commit",
            { repo_path: projectRoot, message },
          );
          return json({
            success: true,
            action,
            message: `Commit spremljen: ${message}`,
            result,
            summary: [result?.stdout, result?.stderr]
              .filter(Boolean)
              .join("\n\n"),
          });
        }
        if (action === "git_push") {
          const branch = normalizeMessage(body?.branch as string) || undefined;
          const result = await agentRequest(
            agentBaseUrl,
            agentApiKey,
            "git_push",
            { repo_path: projectRoot, branch },
          );
          return json({
            success: true,
            action,
            message: branch
              ? `Git push na ${branch} prošao.`
              : "Git push prošao.",
            result,
            summary: [result?.stdout, result?.stderr]
              .filter(Boolean)
              .join("\n\n"),
          });
        }
        if (action === "git_pull_rebase") {
          const branch = normalizeMessage(body?.branch as string) || undefined;
          const result = await agentRequest(
            agentBaseUrl,
            agentApiKey,
            "git_pull_rebase",
            { repo_path: projectRoot, branch },
          );
          return json({
            success: true,
            action,
            message: "Git pull --rebase prošao.",
            result,
            summary: [result?.stdout, result?.stderr]
              .filter(Boolean)
              .join("\n\n"),
          });
        }
        if (action === "build") {
          const result = await agentRequest(
            agentBaseUrl,
            agentApiKey,
            "run_build",
            { cwd: projectRoot },
          );
          return json({
            success: true,
            action,
            message: "Build je prošao.",
            result,
            summary: [result?.stdout, result?.stderr]
              .filter(Boolean)
              .join("\n\n"),
          });
        }
        if (action === "backup_project") {
          return json(
            {
              success: false,
              error:
                "Backup projekta još nema backend endpoint u dev-control funkciji.",
            },
            501,
          );
        }
        if (action === "deploy") {
          const message =
            normalizeMessage(body?.message as string) ||
            `deploy ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
          const buildResult = await agentRequest(
            agentBaseUrl,
            agentApiKey,
            "run_build",
            { cwd: projectRoot },
          );
          const commitResult = await agentRequest(
            agentBaseUrl,
            agentApiKey,
            "git_commit",
            { repo_path: projectRoot, message },
          );
          const pushResult = await agentRequest(
            agentBaseUrl,
            agentApiKey,
            "git_push",
            { repo_path: projectRoot },
          );
          return json({
            success: true,
            action,
            message: `Deploy flow završen: ${message}`,
            result: { buildResult, commitResult, pushResult },
            summary: [
              buildResult?.stdout,
              commitResult?.stdout,
              pushResult?.stdout,
            ]
              .filter(Boolean)
              .join("\n\n"),
          });
        }

        return json(
          { success: false, error: `Nepoznata DEV akcija: ${action}` },
          400,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "DEV akcija nije uspjela.";
        return json({ success: false, error: message }, 500);
      }
    }

    const logs: DevOpsLogEntry[] = [];
    const errors: string[] = [];
    const missingConfig: string[] = [];

    const snapshot = {
      ok: true,
      timestamp: new Date().toISOString(),
      projectRoot: projectRoot || null,
      agent: {
        configured: !!(agentBaseUrl && agentApiKey),
        online: false,
        baseUrl: agentBaseUrl,
        workspace: null,
        python: null,
        timestamp: null,
        error: null,
      },
      git: {
        configured: !!(githubOwner && githubRepo),
        source: "none" as "agent" | "github" | "none",
        repo: githubOwner && githubRepo ? `${githubOwner}/${githubRepo}` : null,
        repoUrl:
          githubOwner && githubRepo
            ? `https://github.com/${githubOwner}/${githubRepo}`
            : null,
        branch: null,
        statusText: null,
        dirty: false,
        changedFiles: [] as string[],
        latestCommit: null,
        error: null,
      },
      build: {
        configured: !!(vercelToken && vercelProjectId),
        status: "unknown",
        label: "Unknown",
        url: null,
        inspectorUrl: null,
        target: null,
        branch: null,
        commitSha: null,
        commitMessage: null,
        createdAt: null,
        error: null,
      },
      deployments: [] as Array<{
        id: string;
        status: string;
        url?: string | null;
        inspectorUrl?: string | null;
        target?: string | null;
        branch?: string | null;
        commitSha?: string | null;
        commitMessage?: string | null;
        createdAt?: string | null;
      }>,
      backups: [] as Array<{
        name: string;
        path?: string | null;
        size?: number | null;
        modifiedAt?: string | null;
      }>,
      logs,
      errors,
      missingConfig,
    };

    if (!snapshot.agent.configured) {
      missingConfig.push("AGENT_SERVER_URL", "AGENT_API_KEY");
      logs.push({
        id: "system-agent-missing",
        source: "system",
        level: "warning",
        title: "Agent nije konfiguriran",
        detail: "Postavi AGENT_SERVER_URL i AGENT_API_KEY u Supabase secrets.",
      });
    }

    if (!snapshot.git.configured) {
      missingConfig.push("GITHUB_OWNER", "GITHUB_REPO", "GITHUB_TOKEN");
      logs.push({
        id: "system-github-missing",
        source: "system",
        level: "warning",
        title: "GitHub status nije konfiguriran",
        detail:
          "Postavi GITHUB_OWNER, GITHUB_REPO i GITHUB_TOKEN za repo status.",
      });
    }

    if (!snapshot.build.configured) {
      missingConfig.push("VERCEL_TOKEN", "VERCEL_PROJECT_ID");
      logs.push({
        id: "system-vercel-missing",
        source: "system",
        level: "warning",
        title: "Vercel status nije konfiguriran",
        detail:
          "Postavi VERCEL_TOKEN i VERCEL_PROJECT_ID za build/deploy status.",
      });
    }

    if (snapshot.agent.configured && agentBaseUrl) {
      try {
        const healthText = await fetchText(`${agentBaseUrl}/health`, {
          headers: {
            "X-API-Key": agentApiKey,
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "GeoTerra-Dev-Control/1.0",
          },
        });
        const healthData = JSON.parse(healthText);

        snapshot.agent.online = true;
        snapshot.agent.workspace = healthData?.workspace || null;
        snapshot.agent.python = healthData?.python || null;
        snapshot.agent.timestamp = healthData?.timestamp || null;

        logs.push({
          id: "agent-online",
          source: "agent",
          level: "success",
          title: "Agent online",
          detail: healthData?.workspace || agentBaseUrl,
          at: healthData?.timestamp || undefined,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Agent nije dostupan.";
        snapshot.agent.error = message;
        errors.push(message);
        logs.push({
          id: "agent-offline",
          source: "agent",
          level: "error",
          title: "Agent offline",
          detail: message,
        });
      }
    }

    if (githubToken && githubOwner && githubRepo) {
      try {
        const headers = {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "GeoTerra-Dev-Control/1.0",
        };

        const repoData = await fetchJson(
          `https://api.github.com/repos/${githubOwner}/${githubRepo}`,
          { headers },
        );
        const defaultBranch = repoData?.default_branch || "main";
        const commitData = await fetchJson(
          `https://api.github.com/repos/${githubOwner}/${githubRepo}/commits/${defaultBranch}`,
          { headers },
        );

        snapshot.git.source =
          snapshot.agent.online && projectRoot ? "agent" : "github";
        snapshot.git.branch = defaultBranch;
        snapshot.git.latestCommit = {
          sha: commitData?.sha || "",
          shortSha: shortSha(commitData?.sha),
          message: String(commitData?.commit?.message || "").split("\n")[0],
          author: commitData?.commit?.author?.name || null,
          date: commitData?.commit?.author?.date || null,
          url: commitData?.html_url || null,
        };

        logs.push({
          id: `github-${commitData?.sha || "latest"}`,
          source: "github",
          level: "info",
          title: `GitHub commit ${shortSha(commitData?.sha)}`,
          detail: String(commitData?.commit?.message || "").split("\n")[0],
          at: commitData?.commit?.author?.date || undefined,
          href: commitData?.html_url || undefined,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "GitHub status nije dostupan.";
        snapshot.git.error = message;
        errors.push(message);
        logs.push({
          id: "github-error",
          source: "github",
          level: "error",
          title: "GitHub status error",
          detail: message,
        });
      }
    }

    if (snapshot.agent.online && projectRoot) {
      try {
        const agentHeaders = {
          "Content-Type": "application/json",
          "X-API-Key": agentApiKey,
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "GeoTerra-Dev-Control/1.0",
        };

        const statusData = await fetchJson(`${agentBaseUrl}/git_status`, {
          method: "POST",
          headers: agentHeaders,
          body: JSON.stringify({ repo_path: projectRoot }),
        });

        if (statusData?.success) {
          const parsed = parseGitStatus(statusData?.stdout || "");
          snapshot.git.source = "agent";
          snapshot.git.branch = parsed.branch || snapshot.git.branch || null;
          snapshot.git.statusText = parsed.statusText || null;
          snapshot.git.changedFiles = parsed.changedFiles;
          snapshot.git.dirty = parsed.dirty;

          logs.push({
            id: "git-status",
            source: "git",
            level: parsed.dirty ? "warning" : "success",
            title: parsed.dirty ? "Git ima lokalne promjene" : "Git clean",
            detail: parsed.statusText || "Repo clean",
          });
        } else {
          throw new Error(statusData?.error || "Git status nije uspio.");
        }

        const buildLogs = await fetchJson(`${agentBaseUrl}/read_logs`, {
          method: "POST",
          headers: agentHeaders,
          body: JSON.stringify({
            cwd: projectRoot,
            log_name: "build",
            max_chars: 5000,
          }),
        }).catch(() => null);

        const logDetail = [buildLogs?.stdout, buildLogs?.stderr]
          .filter(Boolean)
          .join("\n\n")
          .trim();
        if (logDetail) {
          logs.push({
            id: "agent-build-log",
            source: "agent",
            level: /error|failed|fail|vite build/i.test(logDetail)
              ? "warning"
              : "info",
            title: "Zadnji local build log",
            detail: logDetail.slice(-4000),
          });
        }

        const backupsData = await fetchJson(`${agentBaseUrl}/list_backups`, {
          method: "POST",
          headers: agentHeaders,
          body: JSON.stringify({ repo_path: projectRoot, limit: 8 }),
        }).catch(() => null);

        if (backupsData?.success && Array.isArray(backupsData.items)) {
          snapshot.backups = backupsData.items.map((item: any) => ({
            name: item?.name || "backup.zip",
            path: item?.path || null,
            size: typeof item?.size === "number" ? item.size : null,
            modifiedAt: item?.modified_at || null,
          }));
          if (snapshot.backups[0]) {
            logs.push({
              id: "backup-latest",
              source: "system",
              level: "info",
              title: `Zadnji backup: ${snapshot.backups[0].name}`,
              detail: snapshot.backups[0].path || undefined,
              at: snapshot.backups[0].modifiedAt || undefined,
            });
          }
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Agent git status nije dostupan.";
        snapshot.git.error = snapshot.git.error || message;
        errors.push(message);
        logs.push({
          id: "git-agent-error",
          source: "git",
          level: "error",
          title: "Local git status error",
          detail: message,
        });
      }
    }

    if (vercelToken && vercelProjectId) {
      try {
        const vercelUrl = new URL("https://api.vercel.com/v6/deployments");
        vercelUrl.searchParams.set("projectId", vercelProjectId);
        vercelUrl.searchParams.set("limit", "6");
        if (vercelTeamId) vercelUrl.searchParams.set("teamId", vercelTeamId);

        const deploymentData = await fetchJson(vercelUrl.toString(), {
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            "User-Agent": "GeoTerra-Dev-Control/1.0",
          },
        });

        const deployments = Array.isArray(deploymentData?.deployments)
          ? deploymentData.deployments
          : [];
        snapshot.deployments = deployments.slice(0, 6).map((item: any) => {
          const state = mapVercelStatus(item?.state || item?.readyState);
          return {
            id: item?.uid || "",
            status: state.status,
            url: item?.url ? `https://${item.url}` : null,
            inspectorUrl: item?.inspectorUrl || null,
            target: item?.target || null,
            branch: item?.meta?.githubCommitRef || null,
            commitSha:
              item?.meta?.githubCommitSha || item?.meta?.githubSha || null,
            commitMessage: item?.meta?.githubCommitMessage || null,
            createdAt: item?.createdAt
              ? new Date(item.createdAt).toISOString()
              : null,
          };
        });

        const latest = snapshot.deployments[0];
        if (latest) {
          const label = mapVercelStatus(latest.status).label;
          snapshot.build.status = latest.status;
          snapshot.build.label = label;
          snapshot.build.url = latest.url || null;
          snapshot.build.inspectorUrl = latest.inspectorUrl || null;
          snapshot.build.target = latest.target || null;
          snapshot.build.branch = latest.branch || null;
          snapshot.build.commitSha = latest.commitSha || null;
          snapshot.build.commitMessage = latest.commitMessage || null;
          snapshot.build.createdAt = latest.createdAt || null;

          logs.push({
            id: `vercel-${latest.id}`,
            source: "vercel",
            level:
              latest.status === "ready"
                ? "success"
                : latest.status === "error"
                  ? "error"
                  : latest.status === "building"
                    ? "warning"
                    : "info",
            title: `Vercel ${label}`,
            detail: latest.commitMessage || latest.url || "Zadnji deployment",
            at: latest.createdAt || undefined,
            href: latest.inspectorUrl || latest.url || undefined,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Vercel status nije dostupan.";
        snapshot.build.error = message;
        errors.push(message);
        logs.push({
          id: "vercel-error",
          source: "vercel",
          level: "error",
          title: "Vercel status error",
          detail: message,
        });
      }
    }

    snapshot.ok = errors.length === 0;
    logs.sort((a, b) => {
      const left = a.at ? new Date(a.at).getTime() : 0;
      const right = b.at ? new Date(b.at).getTime() : 0;
      return right - left;
    });

    return json(snapshot);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "DEV control error";
    return json({ error: message }, 500);
  }
});
