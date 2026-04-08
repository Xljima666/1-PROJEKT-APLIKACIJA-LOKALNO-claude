
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

interface LogEntry {
  time: string;
  msg: string;
}

interface LearningPanelProps {
  onClose: () => void;
  agentServerUrl?: string;
}

interface FlowParam {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  env_key?: string;
  default?: string;
}

interface FlowMetadata {
  name: string;
  description: string;
  portal: string;
  tags: string[];
  params: FlowParam[];
  example_inputs: Record<string, string>;
  updated_at?: string;
}

interface FlowSummary {
  name: string;
  file?: string;
  size?: number;
  portal?: string;
  tags?: string[];
  params?: FlowParam[];
  description?: string;
  version_count?: number;
}

interface FlowVersion {
  version_id: string;
  created_at?: string;
  source?: string;
}

type BottomTab = "log" | "preview" | "timeline" | "status";

function defaultMetadata(name = ""): FlowMetadata {
  return {
    name,
    description: "",
    portal: name.toLowerCase().includes("oss") ? "OSS" : name.toLowerCase().includes("sdge") ? "SDGE" : "Ostalo",
    tags: [],
    params: [],
    example_inputs: {},
  };
}

function getLogTone(msg: string): "success" | "error" | "info" {
  const lower = msg.toLowerCase();
  if (msg.includes("✓") || lower.includes("online") || lower.includes("spremljeno") || lower.includes("učitan") || lower.includes("naučen")) {
    return "success";
  }
  if (lower.includes("greška") || lower.includes("error") || lower.includes("nije uspjelo")) {
    return "error";
  }
  return "info";
}

function flowGroup(item: FlowSummary): string {
  return item.portal || (item.name.toLowerCase().includes("oss") ? "OSS" : item.name.toLowerCase().includes("sdge") ? "SDGE" : "Ostalo");
}

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40";
const btnGhost = `${btnBase} border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white`;
const btnBlue = `${btnBase} bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/20 hover:bg-sky-500/25`;
const btnViolet = `${btnBase} bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20 hover:bg-violet-500/25`;
const btnAmber = `${btnBase} bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/20 hover:bg-amber-500/25`;
const btnGreen = `${btnBase} bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/20 hover:bg-emerald-500/25`;
const btnPink = `${btnBase} bg-fuchsia-500/15 text-fuchsia-100 ring-1 ring-fuchsia-400/20 hover:bg-fuchsia-500/25`;
const btnSlate = `${btnBase} bg-white/[0.04] text-white/70 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white`;

export default function LearningPanel({ onClose, agentServerUrl }: LearningPanelProps) {
  const AGENT_URL = agentServerUrl || import.meta.env.VITE_AGENT_SERVER_URL || "";
  const AGENT_KEY = import.meta.env.VITE_AGENT_API_KEY || "";

  const [url, setUrl] = useState("https://oss.uredjenazemlja.hr/");
  const [code, setCode] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [codegenRunning, setCodegenRunning] = useState(false);
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [improvingCode, setImprovingCode] = useState(false);
  const [runningPreview, setRunningPreview] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedStepsCount, setRecordedStepsCount] = useState(0);
  const [insertCursorPos, setInsertCursorPos] = useState<number | null>(null);
  const [flowSearch, setFlowSearch] = useState("");
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>("preview");
  const [previewImage, setPreviewImage] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewPath, setPreviewPath] = useState("");
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTimeline, setPreviewTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [metadata, setMetadata] = useState<FlowMetadata>(defaultMetadata());
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [savingMeta, setSavingMeta] = useState(false);
  const [runningInputs, setRunningInputs] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const log = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("hr-HR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs(prev => [...prev.slice(-450), { time, msg }]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const callAgent = useCallback(
    async (endpoint: string, body: object = {}, method: "POST" | "GET" = "POST") => {
      if (!AGENT_URL) {
        log("AGENT_SERVER_URL nije postavljen!");
        return null;
      }

      try {
        const res = await fetch(`${AGENT_URL}/${endpoint}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": AGENT_KEY,
            "ngrok-skip-browser-warning": "true",
          },
          body: method === "GET" ? undefined : JSON.stringify(body),
        });
        return await res.json();
      } catch (e: any) {
        log(`Agent greška: ${e.message}`);
        return null;
      }
    },
    [AGENT_URL, AGENT_KEY, log]
  );

  useEffect(() => {
    if (!AGENT_URL) return;
    (async () => {
      try {
        const res = await fetch(`${AGENT_URL}/health`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        setAgentOnline(res.ok);
        if (res.ok) log("Agent online ✓");
      } catch {
        setAgentOnline(false);
      }
    })();
  }, [AGENT_URL, log]);

  const applyPreview = useCallback((res: any, fallbackTitle = "Preview") => {
    if (res?.screenshot_base64) {
      setPreviewImage(`data:image/png;base64,${res.screenshot_base64}`);
      setPreviewTitle(res.title || fallbackTitle);
      setPreviewUrl(res.url || "");
      setPreviewPath(res.path || res.screenshot_path || "");
      setPreviewUpdatedAt(res.captured_at || new Date().toISOString());
      setActiveBottomTab("preview");
    }
  }, []);

  const loadPreviewTimeline = useCallback(async () => {
    if (!agentOnline) return;
    setTimelineLoading(true);
    const res = await callAgent("preview/timeline", {}, "GET");
    if (res?.success && Array.isArray(res.items)) {
      setPreviewTimeline(res.items);
    } else if (res?.error) {
      log(`Timeline greška: ${res.error}`);
    }
    setTimelineLoading(false);
  }, [agentOnline, callAgent, log]);

  const refreshLivePreview = useCallback(async () => {
    if (!agentOnline) return;
    setPreviewLoading(true);
    const res = await callAgent("preview/current", {}, "GET");
    if (res?.success && res.screenshot_base64) {
      applyPreview(res, res.title || "Live preview");
      loadPreviewTimeline();
    } else if (res?.error) {
      log(`Preview greška: ${res.error}`);
    }
    setPreviewLoading(false);
  }, [agentOnline, callAgent, log, applyPreview, loadPreviewTimeline]);

  const refreshFlows = useCallback(async () => {
    const res = await callAgent("record/list", {}, "GET");
    if (res?.success && Array.isArray(res.actions)) {
      setFlows(res.actions);
      log(`Učitano skripti: ${res.actions.length}`);
    }
  }, [callAgent, log]);

  useEffect(() => {
    if (agentOnline) {
      refreshFlows();
      loadPreviewTimeline();
    }
  }, [agentOnline, refreshFlows, loadPreviewTimeline]);

  const hydrateFlowDetails = useCallback(async (name: string, initial?: any) => {
    const normalized = name;
    let meta = initial?.metadata;
    let versionItems = initial?.versions;

    if (!meta) {
      const metaRes = await callAgent("flow/metadata/read", { name: normalized });
      if (metaRes?.success) meta = metaRes.metadata;
    }
    if (!versionItems) {
      const versionRes = await callAgent("flow/versions", { name: normalized });
      if (versionRes?.success) versionItems = versionRes.versions;
    }

    const nextMeta: FlowMetadata = { ...defaultMetadata(normalized), ...(meta || {}) };
    setMetadata(nextMeta);
    setVersions(Array.isArray(versionItems) ? versionItems : []);

    const nextInputs: Record<string, string> = {};
    (nextMeta.params || []).forEach(param => {
      nextInputs[param.key] = nextMeta.example_inputs?.[param.key] ?? param.default ?? "";
    });
    setInputValues(nextInputs);
  }, [callAgent]);

  const startCodegen = async () => {
    log(`Pokrećem Playwright Codegen: ${url}`);
    setCodegenRunning(true);
    const res = await callAgent("codegen", { url });
    if (res?.success) {
      log("✓ Codegen otvoren — klikaj po Chromiumu!");
      log("Kad završiš, zatvori Codegen prozor i klikni 'Učitaj kod'.");
    } else {
      log(`Greška: ${res?.error || "ne mogu pokrenuti codegen"}`);
      setCodegenRunning(false);
    }
  };

  const loadGeneratedCode = async () => {
    log("Učitavam generirani kod...");
    const res = await callAgent("codegen/read", {});
    if (res?.success && res.content) {
      setCode(res.content);
      setCodegenRunning(false);
      setSelectedFlow(null);
      setMetadata(defaultMetadata());
      setVersions([]);
      log("✓ Kod učitan!");
    } else {
      log(`${res?.error || "Nema koda — zatvori Codegen prozor pa probaj opet."}`);
    }
  };

  const selectFlow = async (name: string) => {
    setSelectedFlow(name);
    const res = await callAgent("record/read", { name });
    if (res?.success && res.content) {
      setCode(res.content);
      log(`Učitan: ${name}`);
      await hydrateFlowDetails(name, res);
    } else {
      log(`Ne mogu učitati: ${name}`);
    }
  };

  const saveCode = async () => {
    const name = selectedFlow || prompt("Spremi kao (ime bez .py):");
    if (!name) return;
    const res = await callAgent("record/write", { name, content: code });
    if (res?.success) {
      log(`✓ Spremljeno: ${name}.py`);
      setSelectedFlow(name);
      await refreshFlows();
      await hydrateFlowDetails(name);
    } else {
      log(`Greška: ${res?.error}`);
    }
  };

  const saveMetadataOnly = async () => {
    const name = selectedFlow || metadata.name || prompt("Ime flowa za metadata:");
    if (!name) return;
    setSavingMeta(true);
    const payload = { ...metadata, name, tags: metadata.tags, example_inputs: { ...inputValues } };
    const res = await callAgent("flow/metadata/write", { name, metadata: payload, content: code });
    if (res?.success) {
      setSelectedFlow(name);
      setMetadata({ ...payload, updated_at: new Date().toISOString() });
      log("✓ Metadata spremljen.");
      await refreshFlows();
      await hydrateFlowDetails(name);
    } else {
      log(`Greška: ${res?.error || "ne mogu spremiti metadata"}`);
    }
    setSavingMeta(false);
  };

  const learnFlow = async () => {
    const suggested = (selectedFlow || metadata.name || "nauceni_flow").replace(/\s+/g, "_").toLowerCase();
    const name = prompt("Ime naučenog flowa:", suggested);
    if (!name) return;
    const payload: FlowMetadata = {
      ...metadata,
      name,
      tags: metadata.tags,
      example_inputs: { ...inputValues },
    };
    const res = await callAgent("flow/learn", {
      name,
      content: code,
      metadata: payload,
      create_version: true,
    });
    if (res?.success) {
      setSelectedFlow(name);
      setMetadata({ ...payload, updated_at: new Date().toISOString() });
      log(`🧠 Naučen flow: ${name}.py`);
      if (Array.isArray(res.notes)) res.notes.forEach((n: string) => log(`• ${n}`));
      await refreshFlows();
      await hydrateFlowDetails(name);
    } else {
      log(`Greška: ${res?.error || "ne mogu naučiti flow"}`);
    }
  };

  const improveCode = async () => {
    if (!code.trim()) {
      log("Nema koda za prepraviti.");
      return;
    }
    setImprovingCode(true);
    log("Stellan prepravlja sirovi Playwright kod...");
    const res = await callAgent("code/clean_playwright", { content: code });
    if (res?.success && res.cleaned_content) {
      setCode(res.cleaned_content);
      log("✓ Kod prepravljen.");
      if (Array.isArray(res.notes)) res.notes.forEach((note: string) => log(`• ${note}`));
    } else {
      log(`Greška: ${res?.error || "ne mogu prepraviti kod"}`);
    }
    setImprovingCode(false);
  };

  const runDraft = async () => {
    if (!code.trim()) {
      log("Nema koda za pokrenuti.");
      return;
    }
    setRunningPreview(true);
    log("Pokrećem probnu verziju trenutnog koda...");
    const res = await callAgent("code/run_temp", { content: code, timeout: 90 });
    if (res?.success) {
      log("✓ Probno izvršavanje završeno.");
      if (res.stdout) log(res.stdout.slice(0, 1400));
      if (res.stderr) log(res.stderr.slice(0, 1400));
      applyPreview(res, "Probni run screenshot");
      loadPreviewTimeline();
    } else {
      log(`Greška: ${res?.error || res?.stderr || "izvršavanje nije uspjelo"}`);
      if (res?.stderr) log(res.stderr.slice(0, 1400));
    }
    setRunningPreview(false);
  };

  const runFlow = async () => {
    if (!selectedFlow) {
      log("Odaberi skriptu.");
      return;
    }
    log(`Pokrećem spremljenu skriptu: ${selectedFlow}...`);
    const res = await callAgent("record/run", { name: selectedFlow });
    if (res?.success) {
      log(`✓ ${selectedFlow} izvršen`);
      if (res.stdout) log(res.stdout.slice(0, 1400));
      if (res.stderr) log(res.stderr.slice(0, 1400));
    } else {
      log(`Greška: ${res?.error || res?.stderr}`);
    }
  };

  const runWithInputs = async () => {
    if (!selectedFlow) {
      log("Odaberi flow za Pokreni s unosima.");
      return;
    }
    setRunningInputs(true);
    log(`Pokrećem '${selectedFlow}' s unosima...`);
    const res = await callAgent("flow/run_with_inputs", {
      name: selectedFlow,
      inputs: inputValues,
      timeout: 90,
    });
    if (res?.success) {
      log("✓ Run with inputs završen.");
      if (res.stdout) log(res.stdout.slice(0, 1400));
      if (res.stderr) log(res.stderr.slice(0, 1400));
      if (Array.isArray(res.notes)) res.notes.forEach((n: string) => log(`• ${n}`));
      applyPreview(res, "Run with inputs");
      loadPreviewTimeline();
    } else {
      log(`Greška: ${res?.error || res?.stderr || "run with inputs nije uspio"}`);
      if (res?.stderr) log(res.stderr.slice(0, 1400));
    }
    setRunningInputs(false);
  };

  const restoreVersion = async (versionId: string) => {
    if (!selectedFlow) return;
    setRestoringVersion(versionId);
    const res = await callAgent("flow/restore", { name: selectedFlow, version_id: versionId });
    if (res?.success) {
      setCode(res.content || "");
      if (res.metadata) setMetadata({ ...defaultMetadata(selectedFlow), ...res.metadata });
      log(`✓ Vraćena verzija: ${versionId}`);
      await hydrateFlowDetails(selectedFlow);
    } else {
      log(`Greška: ${res?.error || "restore nije uspio"}`);
    }
    setRestoringVersion(null);
  };

  const deleteFlow = async () => {
    if (!selectedFlow) return;
    if (!confirm(`Obrisati "${selectedFlow}"?`)) return;
    await callAgent("record/delete", { name: selectedFlow });
    setSelectedFlow(null);
    setCode("");
    setMetadata(defaultMetadata());
    setVersions([]);
    await refreshFlows();
    log(`Obrisano: ${selectedFlow}`);
  };

  const addMarker = () => {
    const marker = "\n# STELLAN_CONTINUE_HERE\n";
    const ta = textareaRef.current;
    if (!ta) {
      setCode(prev => prev + marker);
      log("✓ Marker dodan na kraj koda.");
      return;
    }

    const start = ta.selectionStart ?? code.length;
    const next = code.slice(0, start) + marker + code.slice(start);
    setCode(next);
    setInsertCursorPos(start + marker.length);
    log("✓ Marker dodan u kod.");
  };

  const markContinueHere = () => {
    const ta = textareaRef.current;
    if (!ta) {
      log("Editor nije spreman.");
      return;
    }
    setInsertCursorPos(ta.selectionStart ?? 0);
    log("✓ Zapamćena je pozicija za nastavak u kodu.");
  };

  const startLearning = async () => {
    const name = selectedFlow || "nastavak_flowa";
    const res = await callAgent("record/start", { name });
    if (res?.success) {
      setRecording(true);
      setRecordedStepsCount(0);
      log("✓ Učenje pokrenuto. Nastavi klikati u browseru.");
    } else {
      log(`Greška: ${res?.error || "ne mogu pokrenuti učenje"}`);
    }
  };

  const stopLearning = async () => {
    const res = await callAgent("record/stop", {});
    if (res?.success) {
      setRecording(false);
      log(`✓ Učenje zaustavljeno. Snimljeno koraka: ${res.steps ?? 0}`);
    } else {
      log(`Greška: ${res?.error || "ne mogu zaustaviti učenje"}`);
    }
  };

  const mergeRecordingIntoCode = async () => {
    if (!code.trim()) {
      log("Nema postojećeg koda za spajanje.");
      return;
    }

    log("Spajam snimljene korake u postojeći kod...");
    const res = await callAgent("record/merge_into_code", {
      content: code,
      insert_at: insertCursorPos,
      marker: "# STELLAN_CONTINUE_HERE",
    });

    if (res?.success && res.merged_content) {
      setCode(res.merged_content);
      log(`✓ Spojeno koraka: ${res.steps_used ?? 0}`);
    } else {
      log(`Greška: ${res?.error || "ne mogu spojiti nastavak"}`);
    }
  };

  const pollLearning = useCallback(async () => {
    if (!recording) return;
    const res = await callAgent("record/poll", {}, "GET");
    if (res?.success) {
      setRecordedStepsCount(res.total_steps || 0);
      if (Array.isArray(res.new_events) && res.new_events.length > 0) {
        res.new_events.slice(-5).forEach((evt: any) => {
          const suffix = evt.selector || evt.value || evt.url || "";
          log(`+ ${evt.action} ${suffix}`.trim());
        });
      }
    }
  }, [recording, callAgent, log]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      pollLearning();
    }, 1500);
    return () => clearInterval(id);
  }, [recording, pollLearning]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      refreshLivePreview();
    }, 5000);
    return () => clearInterval(id);
  }, [recording, refreshLivePreview]);

  const filteredFlows = useMemo(() => {
    const q = flowSearch.trim().toLowerCase();
    return flows.filter(item => !q || item.name.toLowerCase().includes(q) || (item.description || "").toLowerCase().includes(q));
  }, [flows, flowSearch]);

  const groupedFlows = useMemo(() => {
    return {
      OSS: filteredFlows.filter(item => flowGroup(item) === "OSS"),
      SDGE: filteredFlows.filter(item => flowGroup(item) === "SDGE"),
      Ostalo: filteredFlows.filter(item => flowGroup(item) === "Ostalo"),
    };
  }, [filteredFlows]);

  const codeStatus = useMemo(() => {
    if (!code.trim()) return "Prazno";
    if (code.includes("STELLAN_CONTINUE_HERE")) return "Ima marker";
    if (selectedFlow) return "Spremljeni flow";
    return "Sirovi / uređeni kod";
  }, [code, selectedFlow]);

  const updateParam = (idx: number, patch: Partial<FlowParam>) => {
    setMetadata(prev => {
      const next = [...prev.params];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, params: next };
    });
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-[#050816] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.09),transparent_30%),radial-gradient(circle_at_right,rgba(59,130,246,0.08),transparent_25%)]" />

      <div className="relative flex h-full flex-col">
        <div className="border-b border-white/10 bg-[#081225]/90 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/90 transition hover:bg-white/[0.08]">
                ← Nazad na Stellana
              </button>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-sky-500 shadow-[0_0_24px_rgba(16,185,129,0.18)]">
                  <span className="text-base">⚡</span>
                </div>
                <div>
                  <div className="text-[18px] font-semibold tracking-tight">Učenje — Paket 1</div>
                  <div className="text-[12px] text-white/45">Run with inputs · metadata · version history</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70">
                <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", agentOnline ? "bg-emerald-400" : "bg-red-400")} />
                {agentOnline ? "Agent online" : "Agent offline"}
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70">
                Status koda: <span className="text-white/95">{codeStatus}</span>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70">
                Flowovi: <span className="text-white/95">{flows.length}</span>
              </div>
            </div>
          </div>

          <div className="px-5 pb-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="h-11 flex-1 rounded-xl border border-white/10 bg-[#0b1326] px-4 text-[14px] text-white/90 placeholder-white/25 outline-none transition focus:border-emerald-400/40"
                placeholder="URL za snimanje..."
              />
              <button onClick={startCodegen} disabled={!agentOnline || codegenRunning} className={btnGreen}>
                {codegenRunning ? "⏺ Codegen aktivan..." : "▶ Pokreni Codegen"}
              </button>
              {codegenRunning && (
                <button onClick={loadGeneratedCode} className={btnGhost}>
                  Učitaj kod
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] gap-4 p-4">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#08101f]/85 shadow-[0_16px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="border-b border-white/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white/95">Skripte</div>
                  <div className="text-xs text-white/40">Brzi pristup naučenim flowovima</div>
                </div>
                <button onClick={refreshFlows} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/65 hover:bg-white/[0.08] hover:text-white">
                  ↻
                </button>
              </div>

              <input
                value={flowSearch}
                onChange={e => setFlowSearch(e.target.value)}
                placeholder="Pretraži flowove..."
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 text-sm text-white/90 placeholder-white/25 outline-none focus:border-sky-400/40"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {(["OSS", "SDGE", "Ostalo"] as const).map(group => {
                const items = groupedFlows[group];
                if (!items.length) return null;

                return (
                  <div key={group} className="mb-5">
                    <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">{group}</div>
                    <div className="space-y-1.5">
                      {items.map(item => {
                        const active = selectedFlow === item.name;
                        return (
                          <button
                            key={item.name}
                            onClick={() => selectFlow(item.name)}
                            className={cn(
                              "w-full rounded-2xl border px-3 py-3 text-left transition-all",
                              active
                                ? "border-emerald-400/25 bg-emerald-500/10 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                                : "border-white/8 bg-white/[0.03] text-white/65 hover:border-white/12 hover:bg-white/[0.06] hover:text-white"
                            )}
                          >
                            <div className="truncate text-[13px] font-medium">{item.name}</div>
                            <div className="mt-1 line-clamp-2 text-[11px] text-white/35">{item.description || `${group} flow`}</div>
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-white/30">
                              <span>{item.version_count || 0} verzija</span>
                              {!!item.params?.length && <span>{item.params.length} inputa</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-3 text-sm font-semibold text-white/92">Flow metadata</div>
                <div className="space-y-3">
                  <input
                    value={metadata.name || selectedFlow || ""}
                    onChange={e => setMetadata(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ime flowa"
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 text-sm text-white/90 placeholder-white/25 outline-none"
                  />
                  <textarea
                    value={metadata.description}
                    onChange={e => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Opis što flow radi..."
                    className="min-h-[72px] w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-sm text-white/90 placeholder-white/25 outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={metadata.portal}
                      onChange={e => setMetadata(prev => ({ ...prev, portal: e.target.value }))}
                      className="h-10 rounded-xl border border-white/10 bg-[#0b1326] px-3 text-sm text-white/90 outline-none"
                    >
                      <option value="OSS">OSS</option>
                      <option value="SDGE">SDGE</option>
                      <option value="Ostalo">Ostalo</option>
                    </select>
                    <input
                      value={metadata.tags.join(", ")}
                      onChange={e => setMetadata(prev => ({ ...prev, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
                      placeholder="tag1, tag2"
                      className="h-10 rounded-xl border border-white/10 bg-[#0b1326] px-3 text-sm text-white/90 placeholder-white/25 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/35">Inputs</div>
                      <button
                        onClick={() => setMetadata(prev => ({ ...prev, params: [...prev.params, { key: "", label: "", type: "text", required: false, env_key: "", default: "" }] }))}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70 hover:bg-white/[0.08]"
                      >
                        + Dodaj input
                      </button>
                    </div>

                    {metadata.params.length ? metadata.params.map((param, idx) => (
                      <div key={`${param.key}-${idx}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={param.key}
                            onChange={e => updateParam(idx, { key: e.target.value })}
                            placeholder="key"
                            className="h-9 rounded-xl border border-white/10 bg-[#0b1326] px-3 text-sm text-white/90 outline-none"
                          />
                          <input
                            value={param.label || ""}
                            onChange={e => updateParam(idx, { label: e.target.value })}
                            placeholder="label"
                            className="h-9 rounded-xl border border-white/10 bg-[#0b1326] px-3 text-sm text-white/90 outline-none"
                          />
                          <input
                            value={param.env_key || ""}
                            onChange={e => updateParam(idx, { env_key: e.target.value })}
                            placeholder="ENV_KEY"
                            className="h-9 rounded-xl border border-white/10 bg-[#0b1326] px-3 text-sm text-white/90 outline-none"
                          />
                          <input
                            value={inputValues[param.key] ?? ""}
                            onChange={e => setInputValues(prev => ({ ...prev, [param.key]: e.target.value }))}
                            placeholder="example value"
                            className="h-9 rounded-xl border border-white/10 bg-[#0b1326] px-3 text-sm text-white/90 outline-none"
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs text-white/60">
                            <input
                              type="checkbox"
                              checked={!!param.required}
                              onChange={e => updateParam(idx, { required: e.target.checked })}
                            />
                            Required
                          </label>
                          <button
                            onClick={() => {
                              setMetadata(prev => ({ ...prev, params: prev.params.filter((_, i) => i !== idx) }));
                            }}
                            className="text-xs text-red-300/80 hover:text-red-200"
                          >
                            Ukloni
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-xs text-white/35">
                        Još nema definiranih inputa. Dodaj barem npr. katastarska_opcina i cestica.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={saveMetadataOnly} disabled={savingMeta || !code.trim()} className={btnGhost}>
                      {savingMeta ? "Spremam..." : "💾 Spremi metadata"}
                    </button>
                    <button onClick={learnFlow} disabled={!code.trim()} className={btnPink}>
                      🧠 Nauči flow
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white/92">Version history</div>
                  {selectedFlow && (
                    <button onClick={() => hydrateFlowDetails(selectedFlow)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/65 hover:bg-white/[0.08] hover:text-white">
                      ↻
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {versions.length ? versions.map(v => (
                    <div key={v.version_id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <div className="text-xs text-white/35">{v.created_at ? new Date(v.created_at).toLocaleString("hr-HR") : v.version_id}</div>
                      <div className="mt-1 text-sm text-white/90">{v.source || "manual"}</div>
                      <button
                        onClick={() => restoreVersion(v.version_id)}
                        disabled={!selectedFlow || restoringVersion === v.version_id}
                        className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/75 hover:bg-white/[0.08] hover:text-white"
                      >
                        {restoringVersion === v.version_id ? "Vraćam..." : "Vrati ovu verziju"}
                      </button>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-xs text-white/35">
                      Još nema spremljenih verzija.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 p-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={runFlow} disabled={!selectedFlow || !agentOnline} className={btnGhost}>
                  ▶ Run
                </button>
                <button onClick={deleteFlow} disabled={!selectedFlow} className={cn(btnGhost, "text-red-300 hover:text-red-200")}>
                  ✕ Obriši
                </button>
              </div>
            </div>
          </aside>

          <section className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_260px] overflow-hidden rounded-[28px] border border-white/10 bg-[#08101f]/85 shadow-[0_16px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-100">Snimanje</div>
                <button onClick={startLearning} disabled={!agentOnline || recording} className={btnAmber}>
                  {recording ? "⏺ Učenje aktivno..." : "⏺ Snimaj nastavak"}
                </button>
                <button onClick={stopLearning} disabled={!agentOnline || !recording} className={btnSlate}>
                  ⏹ Zaustavi
                </button>
                {recording && (
                  <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">
                    Snimljeno koraka: {recordedStepsCount}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100">Obrada</div>
                <button onClick={improveCode} disabled={!agentOnline || !code.trim() || improvingCode} className={btnBlue}>
                  {improvingCode ? "Prepravljam..." : "✨ Stellan prepravi kod"}
                </button>
                <button onClick={addMarker} disabled={!code.trim()} className={btnGhost}>
                  # Dodaj marker
                </button>
                <button onClick={markContinueHere} disabled={!code.trim()} className={btnGhost}>
                  📍 Nastavi ovdje
                </button>
                <button onClick={mergeRecordingIntoCode} disabled={!code.trim()} className={btnViolet}>
                  ➕ Spoji nastavak u kod
                </button>
                <button onClick={runDraft} disabled={!agentOnline || !code.trim() || runningPreview} className={btnGreen}>
                  {runningPreview ? "Pokrećem..." : "▶ Pokreni probno"}
                </button>
                <button onClick={runWithInputs} disabled={!agentOnline || !selectedFlow || runningInputs || !metadata.params.length} className={btnPink}>
                  {runningInputs ? "Pokrećem..." : "🧩 Pokreni s unosima"}
                </button>
                <button onClick={saveCode} disabled={!code.trim()} className={btnGhost}>
                  💾 Spremi flow
                </button>
              </div>
            </div>

            <div className="border-b border-white/10 px-5 py-3">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">Run with inputs</div>
                  {metadata.params.length ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {metadata.params.map(param => (
                        <div key={param.key}>
                          <div className="mb-1 text-[11px] text-white/45">{param.label || param.key}</div>
                          <input
                            value={inputValues[param.key] ?? ""}
                            onChange={e => setInputValues(prev => ({ ...prev, [param.key]: e.target.value }))}
                            placeholder={param.key}
                            className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 text-sm text-white/90 placeholder-white/25 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-white/45">Definiraj inpute u lijevom panelu i klikni “Nauči flow”.</div>
                  )}
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">Aktivni flow</div>
                  <div className="space-y-2 text-sm text-white/70">
                    <div>Naziv: <span className="text-white/95">{selectedFlow || metadata.name || "—"}</span></div>
                    <div>Portal: <span className="text-white/95">{metadata.portal || "—"}</span></div>
                    <div>Tagovi: <span className="text-white/95">{metadata.tags.join(", ") || "—"}</span></div>
                    <div>Verzija: <span className="text-white/95">{versions[0]?.version_id || "—"}</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <div>
                  <div className="text-sm font-semibold text-white/95">{selectedFlow ? `${selectedFlow}.py` : "Generirani / sirovi kod"}</div>
                  <div className="text-xs text-white/35">Codegen → Prepravi → Run with inputs → Nauči flow → Restore po potrebi</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/50">
                  Cursor marker: {insertCursorPos ?? "nije postavljen"}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={code}
                onChange={e => setCode(e.target.value)}
                className="h-full w-full resize-none bg-[#07101f] p-5 font-mono text-[13px] leading-6 text-emerald-200/90 outline-none"
                placeholder={`Pokreni Codegen → klikaj po browseru → Učitaj kod
Zatim klikni: Stellan prepravi kod → definiraj metadata/inpute → Nauči flow ili Pokreni s unosima`}
                spellCheck={false}
              />
            </div>

            <div className="min-h-0 border-t border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {(["log", "preview", "timeline", "status"] as BottomTab[]).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveBottomTab(tab)}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs transition",
                        activeBottomTab === tab ? "bg-white/[0.08] text-white" : "text-white/45 hover:text-white/80"
                      )}
                    >
                      {tab === "log" ? "Log" : tab === "preview" ? "Preview" : tab === "timeline" ? "Timeline" : "Status"}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-white/35">{logs.length} zapisa</div>
              </div>

              {activeBottomTab === "log" ? (
                <div ref={logRef} className="h-[calc(100%-46px)] overflow-y-auto px-4 py-3">
                  <div className="space-y-2">
                    {logs.map((entry, i) => {
                      const tone = getLogTone(entry.msg);
                      return (
                        <div
                          key={`${entry.time}-${i}`}
                          className={cn(
                            "flex items-start gap-3 rounded-2xl border px-3 py-2.5",
                            tone === "success" && "border-emerald-400/12 bg-emerald-500/[0.06]",
                            tone === "error" && "border-red-400/12 bg-red-500/[0.06]",
                            tone === "info" && "border-white/8 bg-white/[0.03]"
                          )}
                        >
                          <div className="mt-0.5 text-[11px] text-white/30">{entry.time}</div>
                          <div className={cn(
                            "text-[12px] leading-6",
                            tone === "success" && "text-emerald-200/90",
                            tone === "error" && "text-red-200/90",
                            tone === "info" && "text-white/72"
                          )}>
                            {entry.msg}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeBottomTab === "preview" ? (
                <div className="grid h-[calc(100%-46px)] grid-cols-[minmax(0,1fr)_320px] gap-3 p-4">
                  <div className="min-h-0 overflow-hidden rounded-2xl border border-white/8 bg-[#030814]">
                    {previewImage ? (
                      <img src={previewImage} alt="preview" className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/35">Još nema preview screenshota.</div>
                    )}
                  </div>
                  <div className="space-y-3 overflow-y-auto">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">Preview</div>
                      <div className="space-y-2 text-sm text-white/70">
                        <div>Naslov: <span className="text-white/95">{previewTitle || "—"}</span></div>
                        <div className="break-all">URL / putanja: <span className="text-white/95">{previewUrl || previewPath || "—"}</span></div>
                        <div>Osvježeno: <span className="text-white/95">{previewUpdatedAt ? new Date(previewUpdatedAt).toLocaleTimeString("hr-HR") : "—"}</span></div>
                      </div>
                    </div>
                    <button onClick={refreshLivePreview} disabled={!agentOnline || previewLoading} className={cn(btnGhost, "w-full")}>
                      {previewLoading ? "Osvježavam preview..." : "📸 Osvježi live preview"}
                    </button>
                    <button onClick={loadPreviewTimeline} disabled={!agentOnline || timelineLoading} className={cn(btnGhost, "w-full")}>
                      {timelineLoading ? "Učitavam timeline..." : "🧷 Osvježi timeline"}
                    </button>
                  </div>
                </div>
              ) : activeBottomTab === "timeline" ? (
                <div className="h-[calc(100%-46px)] overflow-y-auto p-4">
                  {previewTimeline.length ? (
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {previewTimeline.map((item: any, idx: number) => (
                        <button
                          key={item.id || idx}
                          onClick={() => {
                            if (item.screenshot_base64) setPreviewImage(`data:image/png;base64,${item.screenshot_base64}`);
                            setPreviewTitle(item.title || item.label || `Korak ${idx + 1}`);
                            setPreviewUrl(item.url || "");
                            setPreviewPath(item.path || "");
                            setPreviewUpdatedAt(item.captured_at || "");
                            setActiveBottomTab("preview");
                          }}
                          className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] text-left transition hover:border-emerald-400/30 hover:bg-white/[0.05]"
                        >
                          <div className="aspect-[16/9] w-full bg-[#030814]">
                            {item.screenshot_base64 ? (
                              <img src={`data:image/png;base64,${item.screenshot_base64}`} alt={item.label || `Korak ${idx + 1}`} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-white/35">Nema slike</div>
                            )}
                          </div>
                          <div className="space-y-1 p-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-white/35">{item.label || `Korak ${idx + 1}`}</div>
                            <div className="line-clamp-1 text-sm text-white/90">{item.title || item.url || item.path || "Preview"}</div>
                            <div className="line-clamp-1 text-xs text-white/45">{item.captured_at ? new Date(item.captured_at).toLocaleTimeString("hr-HR") : "—"}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-sm text-white/35">Još nema timeline screenshotova.</div>
                  )}
                </div>
              ) : (
                <div className="grid h-[calc(100%-46px)] grid-cols-2 gap-3 p-4 text-sm">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">Session</div>
                    <div className="space-y-2 text-white/70">
                      <div>Agent: <span className="text-white/95">{agentOnline ? "online" : "offline"}</span></div>
                      <div>Codegen: <span className="text-white/95">{codegenRunning ? "aktivan" : "ugašen"}</span></div>
                      <div>Recording: <span className="text-white/95">{recording ? "aktivan" : "ugašen"}</span></div>
                      <div>Koraci: <span className="text-white/95">{recordedStepsCount}</span></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">Metadata</div>
                    <div className="space-y-2 text-white/70">
                      <div>Aktivni flow: <span className="text-white/95">{selectedFlow || "nije odabran"}</span></div>
                      <div>Portal: <span className="text-white/95">{metadata.portal || "—"}</span></div>
                      <div>Inputs: <span className="text-white/95">{metadata.params.length}</span></div>
                      <div>Verzija: <span className="text-white/95">{versions[0]?.version_id || "—"}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
