/**
 * StellanLearningPanel.tsx — v3 clean rewrite
 * Tabovi: Flowovi | Snimanje | Pokretanje | CAD
 * Koristi Stellanov dizajn sustav (bg-card, border-border, text-foreground, gradient-primary)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Inject scroll styles once
if (typeof document !== "undefined" && !document.getElementById("stellan-scroll-style")) {
  const s = document.createElement("style");
  s.id = "stellan-scroll-style";
  s.textContent = `
    .stellan-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
    .stellan-scroll::-webkit-scrollbar-track { background: transparent; }
    .stellan-scroll::-webkit-scrollbar-thumb { background: rgba(var(--primary-rgb, 139,92,246), 0.25); border-radius: 99px; }
    .stellan-scroll::-webkit-scrollbar-thumb:hover { background: rgba(var(--primary-rgb, 139,92,246), 0.5); }
    .stellan-scroll { scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.25) transparent; }
  `;
  document.head.appendChild(s);
}
import { supabase } from "@/integrations/supabase/client";
import { useCad } from "@/cad/store";
import type { LineShape, Point, Shape } from "@/cad/types";
import { exportDXF, importDXF } from "@/cad/dxf";
import { defaultOsnap, findOSnap, type OSnapSettings, type SnapHit } from "@/cad/osnap";
import { parseCoord } from "@/cad/coords";
import { extendLine, mirrorShape, offsetShape, trimLine } from "@/cad/modify";
import {
  AlertCircle, ArrowLeft, ArrowLeftRight, ArrowRight, Calendar,
  CheckCircle2, Circle, Clock, Copy, Download, Eye, EyeOff, FileUp,
  FlipHorizontal2, Hexagon, Keyboard, Layers as LayersIcon, Loader2,
  Lock, LockOpen, Maximize2, Minus, MoreVertical, MousePointer2, Move,
  Pencil, Play, Plus, Redo2, RotateCw, Ruler, Save, Scissors, Send,
  Slash, Sparkles, Spline, Square, Trash2, Type as TypeIcon, Undo2,
  Waypoints, Workflow, X, ZoomIn,
} from "lucide-react";

// ─── Tipovi ───────────────────────────────────────────────────────────────────

type PanelTab = "flows" | "record" | "run" | "cad";

export interface FlowStep {
  id: string;
  type: "navigate" | "click" | "type" | "submit" | "wait" | string;
  target?: string;
  value?: string;
  url?: string;
  timestamp?: number;
}

export interface SavedFlow {
  id: string;
  name: string;
  startUrl?: string;
  steps: FlowStep[];
  params?: string[];
  status: "raw" | "polished" | "ready" | "failing";
  rawCode?: string;
  polishedCode?: string;
  activeVariant?: "raw" | "polished";
  createdAt?: number;
  updatedAt?: number;
  lastRun?: number;
}

interface ShadowInsight {
  summary: string;
  portal: string;
  flow_type: string;
  suggested_name: string;
  phases: string[];
  checklist: string[];
  risks: string[];
  tags: string[];
  stats?: {
    step_count?: number;
    page_count?: number;
    duration_ms?: number;
    counts?: Record<string, number>;
  };
}

interface Props {
  onClose: () => void;
  agentServerUrl: string;
  apiKey: string;
}

type RecordingMode = "replace" | "append" | "shadow";
type CodeEditorKind = "raw" | "ai";

function pyQuote(value?: string) {
  return JSON.stringify(String(value ?? ""));
}

function recordedStepsToSnippet(steps: FlowStep[]) {
  return (Array.isArray(steps) ? steps : []).map(step => {
    if (step.type === "navigate" && step.url) return `        await page.goto(${pyQuote(step.url)}, wait_until="domcontentloaded")`;
    if (step.type === "click" && step.target) return `        await page.click(${pyQuote(step.target)})`;
    if ((step.type === "type" || step.type === "fill") && step.target) {
      return `        await page.fill(${pyQuote(step.target)}, ${pyQuote(step.value)})`;
    }
    if (step.type === "submit" && step.target) return `        await page.press(${pyQuote(step.target)}, "Enter")`;
    if (step.type === "wait") return `        await page.wait_for_timeout(${Number(step.value || 1000) || 1000})`;
    if (step.target || step.url) return `        # ${step.type}: ${step.target || step.url || ""}`;
    return "";
  }).filter(Boolean).join("\n");
}

// ─── callAgent helper ─────────────────────────────────────────────────────────

const DEFAULT_AGENT_API_KEY = "stellan-agent-2026-v2-x7k9m2p";
const DEFAULT_AGENT_BASES = [
  "http://localhost:8432",
  "http://127.0.0.1:8432",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
];

function normalizeAgentBase(value?: string) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getAgentBaseCandidates(agentServerUrl: string) {
  const envBase =
    typeof import.meta !== "undefined"
      ? normalizeAgentBase(import.meta.env.VITE_AGENT_SERVER_URL)
      : "";
  return [normalizeAgentBase(agentServerUrl), envBase, ...DEFAULT_AGENT_BASES].filter(
    (base, index, arr) => !!base && arr.indexOf(base) === index
  );
}

function getAgentKeyCandidates(apiKey: string) {
  const envKey =
    typeof import.meta !== "undefined"
      ? String(import.meta.env.VITE_AGENT_API_KEY || "").trim()
      : "";
  return [String(apiKey || "").trim(), envKey, DEFAULT_AGENT_API_KEY].filter(
    (key, index, arr) => !!key && arr.indexOf(key) === index
  );
}

function makeCallAgent(agentServerUrl: string, apiKey: string) {
  return async (endpoint: string, body?: object) => {
    const bases = getAgentBaseCandidates(agentServerUrl);
    const keys = getAgentKeyCandidates(apiKey);
    if (!bases.length) throw new Error("Agent server URL nije postavljen");

    let lastError = "Agent server nije dostupan";

    for (const base of bases) {
      for (const key of keys) {
        try {
          const res = await fetch(`${base}/${endpoint}`, {
            method: body !== undefined ? "POST" : "GET",
            headers: {
              ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
              "X-API-Key": key,
              "ngrok-skip-browser-warning": "true",
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          });
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            lastError = `${res.status} [${base}/${endpoint}] ${txt.slice(0, 160)}`;
            continue;
          }
          return res.json();
        } catch (error: any) {
          lastError = error?.message ? `${base}: ${error.message}` : `${base}: network error`;
        }
      }
    }

    throw new Error(lastError);
  };
}

// ─── Glavni panel ─────────────────────────────────────────────────────────────

export default function StellanLearningPanel({ onClose, agentServerUrl, apiKey }: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>("flows");
  const [editFlow, setEditFlow] = useState<SavedFlow | null>(null);

  const callAgent = useCallback(
    makeCallAgent(agentServerUrl, apiKey),
    [agentServerUrl, apiKey]
  );

  const openEdit = (flow: SavedFlow) => {
    setEditFlow(flow);
    setActiveTab("record");
  };

  const navigate = (tab: PanelTab) => {
    if (tab === "record") setEditFlow(null);
    setActiveTab(tab);
  };

  const tabs = [
    { id: "flows" as PanelTab,  label: "Flowovi",    icon: <Workflow className="w-3.5 h-3.5" /> },
    { id: "record" as PanelTab, label: "Snimanje",   icon: <Circle   className="w-3.5 h-3.5" /> },
    { id: "run" as PanelTab,    label: "Pokretanje", icon: <Play     className="w-3.5 h-3.5" /> },
    { id: "cad" as PanelTab,    label: "CAD",        icon: <Slash    className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 shrink-0 bg-card">
        <button onClick={onClose} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Natrag
        </button>
        <div className="h-4 w-px bg-border" />
        <nav className="flex items-center gap-1 flex-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => navigate(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </nav>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "flows"  && <FlowsTab  callAgent={callAgent} onEdit={openEdit} onNavigate={navigate} />}
        {activeTab === "record" && <RecordTab key={editFlow?.id ?? "new"} callAgent={callAgent} editFlow={editFlow}
          onSaved={() => { setEditFlow(null); setActiveTab("flows"); }} />}
        {activeTab === "run"    && <RunTab    callAgent={callAgent} />}
        {activeTab === "cad"    && <CADTab />}
      </div>
    </div>
  );
}

// ─── FLOWOVI TAB ──────────────────────────────────────────────────────────────

function FlowsTab({ callAgent, onEdit, onNavigate }: {
  callAgent: ReturnType<typeof makeCallAgent>;
  onEdit: (f: SavedFlow) => void;
  onNavigate: (t: PanelTab) => void;
}) {
  const [flows, setFlows] = useState<SavedFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await callAgent("flows/list");
      setFlows(Array.isArray(d?.flows) ? d.flows : Array.isArray(d?.actions) ? d.actions : []);
    } catch { setFlows([]); }
    finally { setLoading(false); }
  }, [callAgent]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Obrisati flow?")) return;
    try { await callAgent(`flows/delete/${id}`, {}); } catch {}
    load();
  };

  const fmt = (t?: number) => {
    if (!t) return "nikada";
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return "upravo sad";
    if (m < 60) return `prije ${m} min`;
    if (m < 1440) return `prije ${Math.floor(m / 60)} h`;
    return new Date(t).toLocaleDateString("hr");
  };

  const statusCfg = {
    polished: { label: "AI poliran", cls: "text-primary border-primary/30 bg-primary/10",   Icon: Sparkles      },
    ready:    { label: "Spreman",    cls: "text-green-400 border-green-500/30 bg-green-500/10", Icon: CheckCircle2 },
    raw:      { label: "Sirov",      cls: "text-muted-foreground border-border bg-muted",    Icon: Circle        },
    failing:  { label: "Greška",     cls: "text-destructive border-destructive/30 bg-destructive/10", Icon: AlertCircle },
  } as const;

  return (
    <div className="h-full overflow-y-auto px-5 py-5">
      {/* Hero */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="mb-2 inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              <Sparkles className="h-3 w-3" /> AI Web Automation
            </span>
            <h1 className="text-xl font-bold">Tvoji <span className="text-gradient">flowovi</span></h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Snimi klikove jednom, AI ih ulašti, pokreni kad trebaš.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => onNavigate("record")}
              className="inline-flex items-center gap-2 rounded-lg gradient-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              <Plus className="h-4 w-4" /> Snimi novi
            </button>
            <button onClick={() => onNavigate("run")}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-accent">
              <Play className="h-4 w-4" /> Pokreni
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { l: "Ukupno",   v: flows.length },
            { l: "AI verzija", v: flows.filter(f => !!f.polishedCode).length },
            { l: "Spremni",  v: flows.filter(f => f.status === "ready").length },
            { l: "Raw verzija",   v: flows.filter(f => !!f.rawCode || f.status === "raw").length },
          ].map(s => (
            <div key={s.l} className="rounded-lg border border-border bg-background/50 p-2.5">
              <div className="text-xl font-bold">{s.v}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : flows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Workflow className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="font-medium">Još nema flowova</p>
          <p className="mt-1 text-sm text-muted-foreground">Otvori Snimanje i počni.</p>
          <button onClick={() => onNavigate("record")}
            className="mt-3 inline-flex items-center gap-2 rounded-lg gradient-primary px-4 py-2 text-sm text-white">
            <Plus className="h-4 w-4" /> Snimi prvi flow
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {flows.map(flow => {
            const s = statusCfg[flow.status as keyof typeof statusCfg] ?? statusCfg.raw;
            return (
              <div key={flow.id} className="group relative rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{flow.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{flow.startUrl}</div>
                  </div>
                  <div className="relative shrink-0">
                    <button onClick={() => setMenuFor(menuFor === flow.id ? null : flow.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuFor === flow.id && (
                      <div className="absolute right-0 top-7 z-10 w-40 rounded-lg border border-border bg-card p-1 shadow-lg">
                        <button onClick={() => remove(flow.id)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" /> Obriši
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${s.cls}`}>
                    <s.Icon className="h-2.5 w-2.5" /> {s.label}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                    flow.rawCode ? "border-border bg-muted/60 text-muted-foreground" : "border-border/40 bg-background/40 text-muted-foreground/40"
                  )}>
                    <Circle className="h-2.5 w-2.5" /> Raw
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                    flow.polishedCode ? "border-primary/30 bg-primary/10 text-primary" : "border-border/40 bg-background/40 text-muted-foreground/40"
                  )}>
                    <Sparkles className="h-2.5 w-2.5" /> AI
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <Workflow className="h-2.5 w-2.5" /> {flow.steps?.length ?? 0} koraka
                  </span>
                </div>
                {(flow.params?.length ?? 0) > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {flow.params!.map(p => (
                      <span key={p} className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">{`{${p}}`}</span>
                    ))}
                  </div>
                )}
                <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {fmt(flow.lastRun)}
                  </span>
                  <button onClick={() => onEdit(flow)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                    <Pencil className="h-3 w-3" /> Uredi
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SNIMANJE TAB ─────────────────────────────────────────────────────────────

const STEP_ICONS: Record<string, any> = {
  navigate: MousePointer2, click: MousePointer2, type: Keyboard,
  submit: Send, wait: Clock,
};

function RecordTab({ callAgent, editFlow, onSaved }: {
  callAgent: ReturnType<typeof makeCallAgent>;
  editFlow?: SavedFlow | null;
  onSaved: () => void;
}) {
  const isEditing = !!editFlow;
  const [url, setUrl]         = useState(editFlow?.startUrl || "https://oss.uredjenazemlja.hr/");
  const [name, setName]       = useState(editFlow?.name || "Novi flow");
  const [steps, setSteps]     = useState<FlowStep[]>(Array.isArray(editFlow?.steps) ? editFlow!.steps : []);
  const [recordMode, setRecordMode] = useState<RecordingMode>(isEditing ? "append" : "replace");
  const [recording, setRec]   = useState(false);
  const [browserOnline, setBo] = useState(false);
  const [learningContext, setLearningContext] = useState("");
  const [shadowInsight, setShadowInsight] = useState<ShadowInsight | null>(null);
  const [shadowSavedPath, setShadowSavedPath] = useState("");
  const [polishing, setPol]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [saving, setSav]      = useState(false);
  const [testUpTo, setTestUpTo]     = useState<number>(-1);
  const [testRunning, setTestRunning] = useState<boolean>(false);
  const [editedCode, setEditedCode]   = useState<string>("");
  const [codeEdited, setCodeEdited]   = useState<boolean>(false);
  const [savedCode, setSavedCode]     = useState<string>("");
  const [aiCode, setAiCode]           = useState<string>("");
  const [aiCodeOriginal, setAiCodeOriginal] = useState<string>(""); // za reset
  const [aiCodeSaved, setAiCodeSaved] = useState<string>(""); // zadnja spremljena verzija
  const [lastRecordedSteps, setLastRecordedSteps] = useState<FlowStep[]>([]);
  const stopTestRef = useRef<boolean>(false);
  const recordBaseStepsRef = useRef<FlowStep[]>([]);
  const rawEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const aiEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<Record<CodeEditorKind, { start: number; end: number }>>({
    raw: { start: 0, end: 0 },
    ai: { start: 0, end: 0 },
  });
  const [logs, setLogs]       = useState<string[]>(
    isEditing ? [`📂 Učitan: "${editFlow!.name}" (${editFlow!.steps?.length ?? 0} koraka)`] : []
  );

  const safe = Array.isArray(steps) ? steps : [];
  const lastRecordedSnippet = useMemo(() => recordedStepsToSnippet(lastRecordedSteps), [lastRecordedSteps]);
  const addLog = (m: string) => setLogs(p => [...p.slice(-50), m]);
  const formatShadowDuration = (durationMs?: number) => {
    if (!durationMs || durationMs < 1000) return "kratka sesija";
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;
  };

  // Status browsera pri otvaranju
  useEffect(() => {
    callAgent("browser/status").then(r => {
      setBo(r?.online || false);
    }).catch(() => setBo(false));
  }, [callAgent]);

  // Učitaj korake I .py kod iz agenta pri edit modu
  useEffect(() => {
    if (!editFlow) return;
    callAgent("record/read", { name: editFlow.id }).then(r => {
      if (r?.success) {
        const loaded = Array.isArray(r.metadata?.steps) ? r.metadata.steps
          : Array.isArray(editFlow.steps) ? editFlow.steps : [];
        setSteps(loaded);
        addLog(`✓ Učitano ${loaded.length} koraka`);
        // Učitaj .py kod u editor
        if (typeof r.content === "string" && r.content.trim()) {
          setEditedCode(r.content);
          setSavedCode(r.content);
          setCodeEdited(true);
          addLog(`📝 Učitan kod (${r.content.length} znakova)`);
        }
      } else {
        // Ako nema .py, bar učitaj korake iz editFlow
        const loaded = Array.isArray(editFlow.steps) ? editFlow.steps : [];
        setSteps(loaded);
        if (loaded.length) addLog(`✓ Učitano ${loaded.length} koraka (iz cache-a)`);
      }
    }).catch(() => {
      // Fallback
      const loaded = Array.isArray(editFlow.steps) ? editFlow.steps : [];
      setSteps(loaded);
    });
  }, [editFlow]);

  useEffect(() => {
    if (!editFlow) return;
    callAgent("record/read", { name: editFlow.id }).then(r => {
      if (!r?.success) return;
      const loadedRaw = typeof r.metadata?.rawCode === "string" && r.metadata.rawCode.trim()
        ? r.metadata.rawCode
        : typeof r.metadata?.raw_code === "string" && r.metadata.raw_code.trim()
          ? r.metadata.raw_code
          : typeof editFlow.rawCode === "string" && editFlow.rawCode.trim()
            ? editFlow.rawCode
            : "";
      const loadedAi = typeof r.metadata?.polishedCode === "string" && r.metadata.polishedCode.trim()
        ? r.metadata.polishedCode
        : typeof r.metadata?.polished_code === "string" && r.metadata.polished_code.trim()
          ? r.metadata.polished_code
          : typeof editFlow.polishedCode === "string" && editFlow.polishedCode.trim()
            ? editFlow.polishedCode
            : "";
      if (loadedRaw.trim()) {
        setEditedCode(loadedRaw);
        setSavedCode(loadedRaw);
        setCodeEdited(true);
      }
      if (loadedAi.trim()) {
        setAiCode(loadedAi);
        setAiCodeOriginal(loadedAi);
        setAiCodeSaved(loadedAi);
      }
    }).catch(() => {});
  }, [callAgent, editFlow]);

  // Live poll dok snima
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(async () => {
      try {
        const r = await callAgent("record/poll");
        if (r?.new_events?.length > 0) {
          const newSteps: FlowStep[] = r.new_events.map((e: any, i: number) => ({
            id: e.id || String(Date.now() + i),
            type: e.action === "fill" ? "type" : (e.action || "click"),
            target: e.selector || e.target || "",
            value: e.value || "",
            url: e.url || "",
            timestamp: e.ts || Date.now(),
          }));
          setSteps(prev => [...(Array.isArray(prev) ? prev : []), ...newSteps]);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(id);
  }, [recording, callAgent]);

  const openBrowser = async () => {
    addLog(`🌐 Otvaranje: ${url}`);
    try {
      const r = await callAgent("browser/reset", { url });
      if (r?.success) { setBo(true); addLog(`✓ Browser otvoren: ${r.url}`); }
      else addLog(`✗ ${r?.error}`);
    } catch (e: any) { addLog(`✗ ${e.message}`); }
  };

  const goBack = async () => {
    try {
      await callAgent("browser/back", {});
      if (recording && safe.length > 0) {
        setSteps(prev => (Array.isArray(prev) ? prev : []).slice(0, -1));
        addLog("← Unazad — zadnji korak uklonjen");
      }
    } catch {}
  };

  const analyzeShadowSession = async (recorded: FlowStep[]) => {
    try {
      const r = await callAgent("record/analyze", {
        name,
        url,
        context: learningContext,
        steps: recorded,
        auto_save: true,
      });
      if (r?.analysis) {
        setShadowInsight(r.analysis);
        setShadowSavedPath(r?.saved?.path || "");
        addLog(`🧠 Shadow analiza: ${r.analysis.portal} / ${r.analysis.flow_type}`);
        addLog(`🧾 Checklist: ${(r.analysis.checklist || []).length} stavki`);
      }
    } catch (e: any) {
        addLog(`Shadow analiza nije uspjela: ${e.message}`);
    }
  };

  const toggleRec = async (mode: RecordingMode = recordMode) => {
    if (recording) {
      try {
        const r = await callAgent("record/stop", {});
        const arr: FlowStep[] = Array.isArray(r?.steps) ? r.steps : [];
        const cleanArr = (mode === "append" || mode === "shadow") && arr[0]?.type === "navigate" ? arr.slice(1) : arr;
        const mergedSteps = mode === "append" ? [...recordBaseStepsRef.current, ...cleanArr] : cleanArr;
        setLastRecordedSteps(cleanArr);
        setSteps(mergedSteps);
        addLog(`⏹ Zaustavljeno — ${arr.length} koraka`);
        if (!codeEdited) setSavedCode("");
        addLog(`Zaustavljeno: ${cleanArr.length} novih koraka`);
        if (mode === "shadow") {
          await analyzeShadowSession(cleanArr);
        }
        // Auto-save
        if (mode !== "shadow" && mergedSteps.length > 0) {
          const saveId = isEditing ? editFlow!.id : name.replace(/\s+/g, "_").toLowerCase();
          try {
            await callAgent("record/save", { name: saveId, display_name: name, url, steps: mergedSteps, status: "raw" });
            addLog(`💾 Auto-spremljeno: "${saveId}"`);
          } catch (e: any) { addLog(`⚠ Auto-save: ${e.message}`); }
        }
      } catch (e: any) { addLog(`✗ ${e.message}`); }
      setRec(false);
    } else {
      try {
        recordBaseStepsRef.current = mode === "append" ? safe : [];
        setRecordMode(mode);
        if (mode !== "append") setSteps([]);
        setLastRecordedSteps([]);
        if (mode === "shadow") {
          setShadowInsight(null);
          setShadowSavedPath("");
        }
        await callAgent("record/start", { name, url });
        setRec(true);
        if (mode === "append") addLog(`Nastavak snimanja: ${url}`);
        if (mode === "shadow") addLog(`🧠 Shadow učenje: ${url}`);
        addLog(`▶ Snimanje: ${url}`);
        if (!browserOnline) setBo(true);
      } catch (e: any) { addLog(`✗ ${e.message}`); }
    }
  };

  const polish = async () => {
    const codeToPolish = rawCurrentCode;
    if (!codeToPolish.trim() || codeToPolish.startsWith("# Koraci")) return addLog("Nema koda za ulašti.");
    setPol(true);
    addLog("🤖 AI usavršava kod...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Izvuci sve stvarne selektore — moraju ostati nepromijenjeni
      const existingSelectors = codeToPolish.split("\n")
        .filter(l => /page\.(click|fill|press|hover|wait_for_selector)\(/.test(l))
        .map(l => l.trim());

      const prompt = `Ti si Playwright Python expert. Usavrši ovaj kod za automatizaciju web portala.

NAJVAŽNIJE PRAVILO: SELEKTORI SE NE SMIJU MIJENJATI.
Ovi selektori su snimljeni sa stvarnog portala i MORAJU ostati točno isti znak po znak:
${existingSelectors.map(l => `  ${l}`).join("\n")}

SMIJE SE SAMO:
1. Dodati await page.wait_for_timeout(1500) nakon page.click() gdje portal treba vremena
2. Dodati await page.wait_for_selector("...", state="visible") ISPRED click/fill — koristiti ISTE selektore
3. Zamijeniti hardkodirane lozinke s os.environ.get("OSS_USERNAME") i os.environ.get("OSS_PASSWORD")
4. Dodati "import os" na vrh ako koristiš os.environ
5. Dodati wait_until="domcontentloaded" u page.goto() ako nema

NE SMIJE:
- Promijeniti IKOJI selektor (makar i jedan znak)
- Dodati try/except
- Promijeniti redoslijed koraka
- Dodati ništa drugo

Vrati SAMO čisti Python kod, bez markdown backtickova, bez objašnjenja.

KOD:
${codeToPolish}`;

      const res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          conversation_id: `stellan-polish-${Date.now()}`,
          provider: "anthropic", provider_model: "claude-sonnet-4-20250514", model: "pro", mode: "chat",
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const reader = res.body?.getReader();
      let fullText = "";
      if (reader) {
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value, { stream: true }).split("\n")) {
            const t = line.trim();
            if (!t.startsWith("data: ") || t === "data: [DONE]") continue;
            try {
              const j = JSON.parse(t.slice(6));
              if (typeof j.content === "string") fullText += j.content;
              else if (j.delta?.content) fullText += j.delta.content;
              else if (j.choices?.[0]?.delta?.content) fullText += j.choices[0].delta.content;
            } catch {}
          }
        }
      }
      const fdMatch = fullText.match(/%%FILE_DOWNLOAD:(\{[^%]+\})%%/);
      if (fdMatch) { try { const m = JSON.parse(fdMatch[1]); if (m.url) { const fr = await fetch(m.url); if (fr.ok) fullText = await fr.text(); } } catch {} }
      let result = fullText.trim().replace(/^```python\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      if (!result || !result.includes("await")) {
        addLog(`⚠ AI nije vratio validan Python (${fullText.length} znakova)`); return;
      }

      // Provjeri jesu li selektori sačuvani
      const broken: string[] = [];
      for (const line of existingSelectors) {
        const m = line.match(/\(["']([^"']+)["']/);
        if (m && !result.includes(m[1])) broken.push(m[1].slice(0, 50));
      }
      if (broken.length > 0) {
        addLog(`⚠ AI promijenio ${broken.length} selektor(a) — odbacujem rezultat!`);
        broken.forEach(s => addLog(`  ✗ ${s}`));
        return;
      }

      setAiCode(result);
      setAiCodeOriginal(result);
      setAiCodeSaved(result);
      addLog(`✨ AI kod spreman (${result.split("\n").length} linija) — svi selektori sačuvani ✓`);

      // Spremi kao polished verziju na disk
      const saveId = isEditing ? editFlow!.id : name.replace(/\s+/g, "_").toLowerCase();
      if (saveId) {
        try {
          await callAgent("record/save", { name: saveId, display_name: name, url, steps: safe, code: result, status: "polished" });
          addLog(`💾 AI verzija spremljena`);
        } catch {}
      }
    } catch (e: any) { addLog(`✗ AI: ${e.message}`); }
    finally { setPol(false); }
  };

  // Spremi AI kod (kad ga korisnik ručno edita)
  const saveAiCode = async () => {
    if (!aiCode.trim()) return;
    const saveId = isEditing ? editFlow!.id : name.replace(/\s+/g, "_").toLowerCase();
    if (!saveId) { addLog("⚠ Nema ID-a"); return; }
    try {
      await callAgent("record/save", { name: saveId, display_name: name, url, steps: safe, code: aiCode, status: "polished" });
      setAiCodeSaved(aiCode);
      addLog(`💾 AI kod spremljen (${aiCode.split("\n").length} linija)`);
    } catch (e: any) { addLog(`✗ Save AI: ${e.message}`); }
  };


  const runCode = async (code: string, label: string, setRunning: (v: boolean) => void) => {
    const saveId = isEditing ? editFlow!.id : name.replace(/\s+/g, "_").toLowerCase();
    if (!saveId) { addLog("⚠ Spremi flow prvo"); return; }
    const tempName = `${saveId}_test_${label === "Sirovi" ? "raw" : "ai"}`;
    if (!browserOnline) { addLog("⚠ Otvori Chromium prvo"); return; }
    setRunning(true);
    addLog(`🧪 Testiram ${label}...`);
    try {
      await callAgent("record/save", {
        name: tempName,
        display_name: `${name} [${label}]`,
        url,
        steps: safe,
        code,
        status: label === "AI" ? "polished" : "raw",
        temporary: true,
      });
      const r = await callAgent("record/run", { name: tempName, stop_on_error: false });
      if (r?.success) {
        const failed = (r.results || []).filter((x: string) => x.startsWith("✗")).length;
        const passed = (r.results || []).filter((x: string) => x.startsWith("✓")).length;
        addLog(failed === 0 ? `✅ ${label}: svi ${passed} koraci OK` : `⚠ ${label}: ${passed} OK, ${failed} FAILED`);
        (r.results || []).forEach((x: string) => addLog(`  ${x}`));
        if (r.url) addLog(`📍 ${r.url}`);
      } else { addLog(`✗ ${r?.error}`); }
    } catch (e: any) { addLog(`✗ ${e.message}`); }
    finally {
      try { await callAgent(`flows/delete/${tempName}`, {}); } catch {}
      setRunning(false);
    }
  };

  const save = async (status: "raw" | "polished", closeAfter = false) => {
    if (!safe.length && !rawCurrentCode.trim() && !(status === "polished" && aiCode.trim())) {
      addLog("⚠ Nema što spremiti"); return;
    }
    setSav(true);
    try {
      const saveId = isEditing ? editFlow!.id : name.replace(/\s+/g, "_").toLowerCase();
      if (!saveId) { addLog("⚠ Postavi ime flowa"); return; }
      const payload: any = { name: saveId, display_name: name, url, steps: safe, status };
      // Ako je korisnik editirao kod ručno, spremi i to
      if (status === "polished" && aiCode.trim()) payload.code = aiCode;
      else if (rawCurrentCode.trim()) payload.code = rawCurrentCode;
      const r = await callAgent("record/save", payload);
      if (r?.success) {
        if (status === "polished" && aiCode.trim()) {
          setAiCodeSaved(aiCode);
          setAiCodeOriginal(aiCode);
        } else if (rawCurrentCode.trim()) {
          setSavedCode(rawCurrentCode);
        }
        addLog(`✅ Spremljeno — ${safe.length} koraka (${status})`);
        if (closeAfter) onSaved();
      } else {
        addLog(`✗ ${r?.error || "greška pri spremi"}`);
      }
    } catch (e: any) { addLog(`✗ ${e.message}`); }
    finally { setSav(false); }
  };

  const rememberSelection = (kind: CodeEditorKind, target: HTMLTextAreaElement) => {
    selectionRef.current[kind] = {
      start: target.selectionStart ?? 0,
      end: target.selectionEnd ?? 0,
    };
  };

  const applyRecordedBlock = (kind: CodeEditorKind, mode: "insert" | "replace") => {
    if (!lastRecordedSnippet.trim()) {
      addLog("Nema zadnjeg snimljenog bloka za ubacivanje.");
      return;
    }
    const textarea = kind === "raw" ? rawEditorRef.current : aiEditorRef.current;
    const currentSelection = textarea ? {
      start: textarea.selectionStart ?? 0,
      end: textarea.selectionEnd ?? 0,
    } : selectionRef.current[kind];
    const currentValue = kind === "raw" ? resolvedRawCode : aiCode;
    if (mode === "replace" && currentSelection.start === currentSelection.end) {
      addLog("Označi dio koda koji želiš zamijeniti.");
      return;
    }
    const nextValue = `${currentValue.slice(0, currentSelection.start)}${lastRecordedSnippet}${currentValue.slice(currentSelection.end)}`;
    if (kind === "raw") {
      setEditedCode(nextValue);
      setCodeEdited(true);
    } else {
      setAiCode(nextValue);
    }
    requestAnimationFrame(() => {
      const editor = kind === "raw" ? rawEditorRef.current : aiEditorRef.current;
      if (!editor) return;
      const caret = currentSelection.start + lastRecordedSnippet.length;
      editor.focus();
      editor.selectionStart = caret;
      editor.selectionEnd = caret;
      rememberSelection(kind, editor);
    });
  };

  // Live kod generacija
  const liveCode = useMemo(() => {
    if (!safe.length) return "# Koraci će se prikazati ovdje...\n# Snimaj klikove, AI ih pretvori u čist kod.";
    const fn = name.toLowerCase().replace(/\s+/g, "_") || "flow";
    const lines = [
      "import asyncio",
      "from playwright.async_api import async_playwright",
      "",
      `async def run_${fn}():`,
      "    async with async_playwright() as p:",
      "        browser = await p.chromium.launch(headless=False)",
      "        page = await browser.new_page()",
      "",
      ...safe.map(s => {
        if (s.type === "navigate") return `        await page.goto("${s.url || ""}")`;
        if (s.type === "click")    return `        await page.click("${s.target || ""}")`;
        if (s.type === "type" || s.type === "fill")
          return `        await page.fill("${s.target || ""}", "${s.value || ""}")`;
        if (s.type === "submit")   return `        await page.press("${s.target || ""}", "Enter")`;
        if (s.type === "wait")     return `        await page.wait_for_timeout(${s.value || 1000})`;
        return `        # ${s.type}: ${s.target || s.url || ""}`;
      }),
      "",
      "        await browser.close()",
      "",
      `asyncio.run(run_${fn}())`,
    ];
    return lines.join("\n");
  }, [safe, name]);

  const rawCurrentCode = (codeEdited && editedCode.trim()) ? editedCode : (savedCode.trim() ? savedCode : liveCode);
  const resolvedRawCode = rawCurrentCode;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-4 gap-3">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold">
            {isEditing ? "Uređivanje" : "Snimanje"} <span className="text-gradient">flowa</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEditing ? `"${editFlow!.name}" · nastavi snimati ili ulašti` : `Klikni Snimaj, radi po portalu, zaustavi i spremi.`}
          </p>
        </div>
        {isEditing && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">✏️ Uređivanje</span>
        )}
      </div>

      {/* Browser toolbar */}
      <div className="flex gap-1.5 items-center shrink-0">
        <button onClick={goBack} title="Unazad"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent transition-colors shrink-0">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => callAgent("browser/forward", {}).catch(() => {})} title="Naprijed"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent transition-colors shrink-0">
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        {/* URL bar — Enter ili klik zelene tipke za navigaciju */}
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 h-8">
          <span className={cn("h-2 w-2 rounded-full shrink-0", browserOnline ? "bg-green-500" : "bg-red-500/60")} />
          <input value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") browserOnline ? callAgent("browser/navigate", { url }).catch(() => {}) : openBrowser(); }}
            className="flex-1 bg-transparent text-xs font-mono outline-none"
            placeholder="https://... (Enter za navigaciju)"
          />
          {/* Jedna tipka: ako browser nije otvoren → "Otvori Chromium", inače → navigira na URL */}
          <button
            onClick={browserOnline ? () => callAgent("browser/navigate", { url }).catch(() => {}) : openBrowser}
            title={browserOnline ? "Idi na URL" : "Otvori Chromium browser"}
            className={cn("shrink-0 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
              browserOnline ? "text-primary hover:bg-primary/10" : "text-green-400 hover:bg-green-500/10")}>
            {browserOnline ? "Idi" : "Otvori"}
          </button>
        </div>
        {/* Snimanje — jedina tipka za snimanje */}
        {!recording && safe.length > 0 && (
          <button onClick={() => toggleRec("append")} disabled={!browserOnline}
            title="Nastavi snimati i dodaj novi blok na postojeći flow"
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 h-8 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-40 shrink-0">
            <Redo2 className="h-3 w-3" /> Nastavi
          </button>
        )}
        {!recording && (
          <button onClick={() => toggleRec("shadow")} disabled={!browserOnline}
            title="Pasivno ucenje: snimi tvoje korake i napravi playbook i checklistu"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 h-8 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 shrink-0">
            <Sparkles className="h-3 w-3" /> Shadow
          </button>
        )}
        <button onClick={() => toggleRec(recording ? recordMode : "replace")} disabled={!browserOnline && !recording}
          title={recording ? "Zaustavi snimanje" : "Počni snimati klikove u browseru"}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-medium transition-all shrink-0",
            recording ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "gradient-primary text-white hover:opacity-90 disabled:opacity-40"
          )}>
          {recording ? <><Square className="h-3 w-3" /> Zaustavi</> : <><Circle className="h-3 w-3 fill-current" /> Snimaj</>}
        </button>
      </div>

      {/* Main grid: [koraci | sirovi kod | AI kod | kontrole] */}
      <div className="grid flex-1 min-h-0 grid-cols-[220px_1fr_1fr_190px] gap-2 overflow-hidden">

        {/* KORACI — uži panel */}
        <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="shrink-0 border-b border-border px-2.5 py-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Koraci {safe.length > 0 && <span className="ml-1 rounded-full bg-primary/15 text-primary px-1.5 text-[9px]">{safe.length}</span>}
            </span>
            {recording && <span className="flex items-center gap-1 text-[9px] text-destructive"><Circle className="h-1.5 w-1.5 fill-current animate-pulse" /> REC</span>}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1.5 stellan-scroll">
            {safe.length === 0
              ? <div className="py-8 text-center text-[11px] text-muted-foreground/40">Klikni Snimaj<br/>pa radi po portalu</div>
              : safe.map((step, i) => {
                  const Icon = STEP_ICONS[step.type] || Circle;
                  return (
                    <div key={step.id || i} className="flex items-start gap-1.5 rounded-md border border-border/60 bg-background/50 p-2 group hover:border-primary/30 transition-colors">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary mt-0.5">
                        <Icon className="h-2.5 w-2.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{i+1} · {step.type}</div>
                        <div className="truncate font-mono text-[10px] leading-tight mt-0.5">{step.url || step.target}</div>
                        {step.value && <div className="truncate text-[10px] text-primary/80 mt-0.5">→ {step.value}</div>}
                      </div>
                      <button onClick={() => setSteps(safe.filter((_, idx) => idx !== i))}
                        className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })
            }
          </div>
          {/* Log */}
          <div className="shrink-0 border-t border-border">
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/40 font-semibold">Log</div>
            <div className="h-24 overflow-y-auto px-2 pb-1 font-mono text-[10px] text-muted-foreground/60 space-y-0.5 stellan-scroll">
              {logs.slice(-25).map((l, i) => <div key={i} className="break-all leading-tight">{l}</div>)}
            </div>
          </div>
        </div>

        {/* SIROVI KOD */}
        <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="shrink-0 border-b border-border px-2.5 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sirovi kod</span>
              <span className="text-[9px] text-muted-foreground/40">{codeEdited ? "✏" : "auto"}</span>
            </div>
            <div className="flex items-center gap-1">
              {codeEdited && (
                <>
                  <button onClick={() => save("raw")}
                    className="flex items-center gap-1 text-[9px] text-green-400 border border-green-500/30 bg-green-500/10 rounded px-1.5 py-0.5 hover:bg-green-500/20">
                    <Save className="h-2 w-2" /> Spremi
                  </button>
                  <button onClick={() => { setCodeEdited(false); setEditedCode(""); setSavedCode(""); }}
                    className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">
                    ↺
                  </button>
                </>
              )}
              {lastRecordedSnippet && (
                <>
                  <button onClick={() => applyRecordedBlock("raw", "insert")}
                    title="Ubaci zadnji snimljeni blok na trenutni kursor"
                    className="flex items-center gap-1 text-[9px] border border-border/60 text-muted-foreground rounded px-1.5 py-0.5 hover:bg-accent">
                    <Plus className="h-2 w-2" /> Ubaci
                  </button>
                  <button onClick={() => applyRecordedBlock("raw", "replace")}
                    title="Zamijeni označeni dio zadnjim snimljenim blokom"
                    className="flex items-center gap-1 text-[9px] border border-border/60 text-muted-foreground rounded px-1.5 py-0.5 hover:bg-accent">
                    <Scissors className="h-2 w-2" /> Zamijeni
                  </button>
                </>
              )}
              <button
                disabled={testing || !browserOnline}
                onClick={() => runCode(rawCurrentCode, "Sirovi", setTesting)}
                title="Testiraj sirovi kod u Chromium-u"
                className="flex items-center gap-1 text-[9px] border border-primary/30 bg-primary/10 text-primary rounded px-1.5 py-0.5 hover:bg-primary/20 disabled:opacity-40">
                {testing ? <Loader2 className="h-2 w-2 animate-spin" /> : <Play className="h-2 w-2" />}
                {testing ? "Teče" : "Test"}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <textarea
              ref={rawEditorRef}
              value={rawCurrentCode}
              onChange={e => { setEditedCode(e.target.value); setCodeEdited(true); rememberSelection("raw", e.currentTarget); }}
              onClick={e => rememberSelection("raw", e.currentTarget)}
              onSelect={e => rememberSelection("raw", e.currentTarget)}
              onFocus={e => rememberSelection("raw", e.currentTarget)}
              onKeyDown={e => {
                if (e.key === "Tab") { e.preventDefault(); const t = e.currentTarget, s = t.selectionStart; const v = rawCurrentCode; const nv = v.slice(0,s)+"    "+v.slice(t.selectionEnd); setEditedCode(nv); setCodeEdited(true); requestAnimationFrame(()=>{t.selectionStart=t.selectionEnd=s+4; rememberSelection("raw", t);}); }
                if ((e.ctrlKey||e.metaKey)&&e.key==="s") { e.preventDefault(); save("raw"); }
              }}
              spellCheck={false}
              className="absolute inset-0 w-full h-full resize-none bg-transparent p-3 font-mono text-[10px] text-muted-foreground leading-relaxed outline-none focus:outline-none border-0 stellan-scroll"
              style={{ fontFamily: "ui-monospace,'Cascadia Code',monospace" }}
              placeholder="# Sirovi kod — auto-generiran iz koraka"
            />
          </div>
        </div>

        {/* AI KOD */}
        <div className="flex flex-col rounded-xl border border-primary/20 bg-card overflow-hidden">
          <div className="shrink-0 border-b border-primary/20 px-2.5 py-2 flex items-center justify-between gap-2 bg-primary/5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[10px] uppercase tracking-wider text-primary/80 font-semibold">AI kod</span>
              {aiCode && <span className="text-[9px] text-muted-foreground/50">{aiCode.split("\n").length}L</span>}
              {aiCode && aiCode !== aiCodeSaved && <span className="text-[9px] text-yellow-400">✏</span>}
            </div>
            <div className="flex items-center gap-1">
              <button disabled={polishing} onClick={polish}
                className="flex items-center gap-1 text-[9px] gradient-primary text-white rounded px-1.5 py-0.5 hover:opacity-90 disabled:opacity-40">
                {polishing ? <Loader2 className="h-2 w-2 animate-spin" /> : <Sparkles className="h-2 w-2" />}
                {polishing ? "..." : "Ulašti"}
              </button>
              {aiCode && aiCode !== aiCodeSaved && (
                <button onClick={saveAiCode}
                  title="Spremi AI kod"
                  className="flex items-center gap-1 text-[9px] text-green-400 border border-green-500/30 bg-green-500/10 rounded px-1.5 py-0.5 hover:bg-green-500/20">
                  <Save className="h-2 w-2" /> Spremi
                </button>
              )}
              {lastRecordedSnippet && (
                <>
                  <button onClick={() => applyRecordedBlock("ai", "insert")}
                    title="Ubaci zadnji snimljeni blok u AI kod"
                    className="flex items-center gap-1 text-[9px] border border-border/60 text-muted-foreground rounded px-1.5 py-0.5 hover:bg-accent">
                    <Plus className="h-2 w-2" /> Ubaci
                  </button>
                  <button onClick={() => applyRecordedBlock("ai", "replace")}
                    title="Zamijeni označeni AI blok zadnjim snimljenim koracima"
                    className="flex items-center gap-1 text-[9px] border border-border/60 text-muted-foreground rounded px-1.5 py-0.5 hover:bg-accent">
                    <Scissors className="h-2 w-2" /> Zamijeni
                  </button>
                </>
              )}
              {aiCode && aiCode !== aiCodeOriginal && (
                <button
                  onClick={() => { setAiCode(aiCodeOriginal); addLog("↺ AI kod vraćen na originalni"); }}
                  title="Vrati na AI originalni"
                  className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">
                  ↺
                </button>
              )}
              {aiCode && (
                <button
                  disabled={testingAi || !browserOnline}
                  onClick={() => runCode(aiCode, "AI", setTestingAi)}
                  title="Testiraj AI kod u Chromium-u"
                  className="flex items-center gap-1 text-[9px] border border-green-500/30 bg-green-500/10 text-green-400 rounded px-1.5 py-0.5 hover:bg-green-500/20 disabled:opacity-40">
                  {testingAi ? <Loader2 className="h-2 w-2 animate-spin" /> : <Play className="h-2 w-2" />}
                  {testingAi ? "Teče" : "Test"}
                </button>
              )}
              {aiCode && (
                <button
                  onClick={() => { setEditedCode(aiCode); setCodeEdited(true); addLog("← AI kod prebačen u Sirovi"); }}
                  title="Kopiraj AI kod u Sirovi panel"
                  className="text-[9px] border border-border/60 text-muted-foreground rounded px-1.5 py-0.5 hover:bg-accent">
                  ← Sirovi
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden relative">
            {aiCode ? (
              <textarea
                ref={aiEditorRef}
                value={aiCode}
                onChange={e => { setAiCode(e.target.value); rememberSelection("ai", e.currentTarget); }}
                onClick={e => rememberSelection("ai", e.currentTarget)}
                onSelect={e => rememberSelection("ai", e.currentTarget)}
                onFocus={e => rememberSelection("ai", e.currentTarget)}
                onKeyDown={e => {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const t = e.currentTarget, s = t.selectionStart;
                    const nv = aiCode.slice(0,s) + "    " + aiCode.slice(t.selectionEnd);
                    setAiCode(nv);
                    requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s+4; rememberSelection("ai", t); });
                  }
                  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                    e.preventDefault();
                    saveAiCode();
                  }
                }}
                spellCheck={false}
                className="absolute inset-0 w-full h-full resize-none bg-transparent p-3 font-mono text-[10px] text-muted-foreground leading-relaxed outline-none focus:outline-none border-0 stellan-scroll"
                style={{ fontFamily: "ui-monospace,'Cascadia Code',monospace" }}
                placeholder="# AI usavršen kod"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-4">
                <Sparkles className="h-6 w-6 text-primary/20" />
                <p className="text-[10px] text-muted-foreground/40">Klikni "Ulašti" da AI<br/>poboljša sirovi kod</p>
              </div>
            )}
          </div>
        </div>

        {/* KONTROLE — desni panel */}
        <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="shrink-0 border-b border-border p-2.5">
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground">Ime flowa</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              placeholder="Novi flow"
            />
            <div className="mt-1.5 grid grid-cols-2 gap-1 text-center">
              {[
                { l: "Koraci", v: safe.length },
                { l: "Status", v: recording ? "🔴 REC" : safe.length > 0 ? "✓" : "—" },
              ].map(s => (
                <div key={s.l} className="rounded border border-border bg-background/50 p-1">
                  <div className={cn("text-xs font-bold", recording && s.l === "Status" ? "text-destructive" : "")}>{s.v}</div>
                  <div className="text-[8px] uppercase text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 stellan-scroll">
            <div className="grid grid-cols-1 gap-1.5">
              <div className="rounded-lg border border-border bg-background/40 p-2">
                <label className="text-[9px] uppercase tracking-wider text-muted-foreground">Kontekst učenja</label>
                <textarea
                  value={learningContext}
                  onChange={e => setLearningContext(e.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-primary"
                  placeholder="npr. parcelacija, upis, predaja priloga, kontrola PDF-a..."
                />
              </div>
              <button disabled={saving} onClick={() => save("raw")}
                className="flex items-center justify-center gap-1 rounded-lg border border-border bg-card py-2 text-xs hover:bg-accent disabled:opacity-40">
                <Save className="h-3 w-3" /> Spremi
              </button>
              <button disabled={saving} onClick={() => save("polished", true)}
                className="flex items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary/10 py-2 text-xs text-primary hover:bg-primary/20 disabled:opacity-40">
                <Save className="h-3 w-3" /> Spremi i zatvori
              </button>
            </div>
            {shadowInsight && (
              <div className="border-t border-border/60 pt-1.5 space-y-1.5">
                <p className="text-[9px] uppercase tracking-wider text-emerald-400">Shadow učenje</p>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 space-y-1.5">
                  <div className="text-[10px] font-semibold text-foreground">{shadowInsight.summary}</div>
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">{shadowInsight.portal}</span>
                    <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">{shadowInsight.flow_type}</span>
                    <span className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">{shadowInsight.stats?.step_count || 0} koraka</span>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Faze</div>
                    <div className="mt-1 space-y-1">
                      {shadowInsight.phases.slice(0, 4).map(phase => <div key={phase} className="text-[10px] text-muted-foreground">• {phase}</div>)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Checklist</div>
                    <div className="mt-1 space-y-1">
                      {shadowInsight.checklist.slice(0, 5).map(item => <div key={item} className="text-[10px] text-muted-foreground">• {item}</div>)}
                    </div>
                  </div>
                  {!!shadowInsight.risks?.length && (
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Rizici</div>
                      <div className="mt-1 space-y-1">
                        {shadowInsight.risks.slice(0, 3).map(item => <div key={item} className="text-[10px] text-amber-300">• {item}</div>)}
                      </div>
                    </div>
                  )}
                  <div className="text-[9px] text-muted-foreground/60">Predloženi naziv: <span className="font-mono text-foreground">{shadowInsight.suggested_name}</span></div>
                  {shadowSavedPath && <div className="text-[9px] text-muted-foreground/50 break-all">{shadowSavedPath}</div>}
                  <div className="text-[9px] text-muted-foreground/50">Trajanje: {formatShadowDuration(shadowInsight.stats?.duration_ms)}</div>
                </div>
              </div>
            )}
            <div className="border-t border-border/60 pt-1.5 space-y-1">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Savjeti</p>
              {["← briše zadnji korak", "Enter = navigiraj URL", "Snimaj = snima klikove", "Tab = indent u editoru", "Ctrl+S = spremi kod"]
                .map(t => <div key={t} className="flex gap-1.5 text-[9px] text-muted-foreground/50"><span className="text-primary/60">›</span>{t}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── POKRETANJE TAB ───────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "done" | "error";

function RunTab({ callAgent }: { callAgent: ReturnType<typeof makeCallAgent> }) {
  const [flows, setFlows]       = useState<SavedFlow[]>([]);
  const [selectedId, setSelId]  = useState("");
  const [params, setParams]     = useState<Record<string, string>>({});
  const [running, setRunning]   = useState(false);
  const [statuses, setStatuses] = useState<StepStatus[]>([]);
  const [errors, setErrors]     = useState<Record<number, string>>({});
  const [elapsed, setElapsed]   = useState("00:00.0");
  const [logs, setLogs]         = useState<string[]>([]);
  const startRef  = useRef<number>(0);
  const stopRef   = useRef<boolean>(false);  // Signal za zaustavljanje
  const addLog = (m: string) => setLogs(p => [...p.slice(-60), m]);
  const flow = flows.find(f => f.id === selectedId);

  useEffect(() => {
    callAgent("flows/list").then(d => {
      const list = Array.isArray(d?.flows) ? d.flows : Array.isArray(d?.actions) ? d.actions : [];
      setFlows(list);
      if (list.length) setSelId(list[0].id);
    }).catch(() => {});
  }, [callAgent]);

  useEffect(() => {
    setStatuses(flow ? flow.steps.map(() => "pending") : []);
    setErrors({});
    setLogs([]);
  }, [selectedId]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const ms = Date.now() - startRef.current, s = Math.floor(ms / 1000);
      setElapsed(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`);
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  // Provjeri jesu li svi params popunjeni
  const missingParams = (flow?.params || []).filter(p => !params[p]?.trim());

  const run = async () => {
    if (!flow || missingParams.length > 0) {
      addLog(`⚠ Upiši parametre: ${missingParams.join(", ")}`);
      return;
    }
    stopRef.current = false;
    setRunning(true);
    startRef.current = Date.now();
    setStatuses(flow.steps.map(() => "pending"));
    setErrors({});
    addLog(`▶ Pokrećem: ${flow.name}`);

    for (let i = 0; i < flow.steps.length; i++) {
      // Provjeri je li korisnik pritisnuo Stop
      if (stopRef.current) {
        addLog("⏹ Zaustavljeno od korisnika");
        // Reset preostalih koraka na pending
        setStatuses(p => p.map((s, idx) => idx >= i ? "pending" : s));
        break;
      }

      setStatuses(p => { const c = [...p]; c[i] = "running"; return c; });
      const s = flow.steps[i];
      // Prikaži vrijednost s resolvanim parametrima
      const resolvedTarget = s.target?.replace(/\{(\w+)\}/g, (_: string, k: string) => params[k] || `{${k}}`);
      const resolvedValue  = s.value?.replace(/\{(\w+)\}/g, (_: string, k: string) => params[k] || `{${k}}`);
      addLog(`  ${i + 1}/${flow.steps.length} · ${s.type}${resolvedTarget ? ` → ${resolvedTarget.slice(0, 40)}` : ""}${resolvedValue ? ` = ${resolvedValue.slice(0, 30)}` : ""}`);

      try {
        const res = await callAgent("flows/run_step", {
          flow_id: flow.id,
          step_index: i,
          params,  // Pravi params, ne {username} string
        });
        setStatuses(p => { const c = [...p]; c[i] = "done"; return c; });
        if (res?.url) addLog(`     📍 ${res.url.slice(0, 60)}`);
      } catch (e: any) {
        setStatuses(p => { const c = [...p]; c[i] = "error"; return c; });
        setErrors(p => ({ ...p, [i]: e.message }));
        addLog(`     ✗ ${e.message.slice(0, 80)}`);
        // Nastavi dalje — ne prekidaj cijeli flow zbog jedne greške
      }
    }

    if (!stopRef.current) addLog("✅ Završeno");
    setRunning(false);
  };

  const stop = () => {
    stopRef.current = true;
    addLog("⏹ Zaustavljam...");
  };

  const done = statuses.filter(s => s === "done").length;
  const total = statuses.length || 1;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-4">
      <div className="mb-4 shrink-0">
        <h1 className="text-lg font-bold">Pokretanje <span className="text-gradient">flowa</span></h1>
        <p className="text-xs text-muted-foreground">Odaberi flow, upiši parametre i pokreni.</p>
      </div>

      {missingParams.length > 0 && (
        <div className="mb-2 shrink-0 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
          ⚠ Upiši parametre prije pokretanja: <strong>{missingParams.join(", ")}</strong>
        </div>
      )}

      <div className="mb-3 flex shrink-0 flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Flow</label>
          <select value={selectedId} onChange={e => setSelId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary">
            {flows.length === 0 ? <option>Nema flowova</option>
              : flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        {flow?.params?.map(p => (
          <div key={p} className="min-w-[120px]">
            <label className="font-mono text-[10px] text-primary">{`{${p}}`}</label>
            <input value={params[p] ?? ""} onChange={e => setParams({ ...params, [p]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-sm outline-none focus:border-primary"
              placeholder={p} />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <span className="invisible text-[10px]">.</span>
          <div className="flex gap-1.5">
            {!running ? (
              <button disabled={!flow} onClick={run}
                className="flex min-w-[120px] items-center justify-center gap-2 rounded-lg gradient-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                <Play className="h-4 w-4 fill-current" /> Pokreni
              </button>
            ) : (
              <button onClick={stop}
                className="flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90">
                <Square className="h-4 w-4" /> Zaustavi
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-[1fr_280px] gap-2 overflow-hidden">
        {/* Log */}
        <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="shrink-0 border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Log</div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-muted-foreground space-y-0.5">
            {logs.length === 0
              ? <div className="py-6 text-center opacity-30">Pokreni flow...</div>
              : logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>

        {/* Progress */}
        <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="shrink-0 border-b border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
                <div className="text-sm font-semibold">
                  {running ? `${done + 1}/${total}` : done === total && total > 1 ? "Gotovo ✓" : "Spremno"}
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {elapsed}
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full gradient-primary transition-all" style={{ width: `${(done / total) * 100}%` }} />
            </div>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {flow?.steps.map((step, i) => {
              const st = statuses[i] || "pending";
              return (
                <div key={step.id || i} className={cn(
                  "flex items-start gap-2 rounded-lg border p-2 text-xs transition-all",
                  st === "done"    ? "border-green-500/20 bg-green-500/5"
                  : st === "running" ? "border-primary/30 bg-primary/10"
                  : st === "error"   ? "border-destructive/30 bg-destructive/10"
                  : "border-border bg-background/30 opacity-50"
                )}>
                  <div className="h-4 w-4 shrink-0 mt-0.5 flex items-center justify-center">
                    {st === "done"    && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {st === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {st === "error"   && <AlertCircle className="h-4 w-4 text-destructive" />}
                    {st === "pending" && <Circle className="h-4 w-4 text-muted-foreground/30" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] uppercase text-muted-foreground">{i + 1} • {step.type}</div>
                    <div className="truncate font-mono text-[10px]">{step.url || step.target}</div>
                    {errors[i] && <div className="text-[10px] text-destructive mt-0.5">{errors[i].slice(0, 60)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CAD TAB ──────────────────────────────────────────────────────────────────

type DrawTool   = "select"|"line"|"rect"|"circle"|"arc"|"polyline"|"polygon"|"text"|"dim";
type ModifyTool = "move"|"copy"|"rotate"|"scale"|"trim"|"extend"|"offset"|"mirror";
type Tool       = DrawTool | ModifyTool;

const DRAW_TOOLS = [
  { id: "select"   as DrawTool, name: "Select (S)",   icon: MousePointer2, key: "s" },
  { id: "line"     as DrawTool, name: "Line (L)",     icon: Slash,         key: "l" },
  { id: "polyline" as DrawTool, name: "Polyline (P)", icon: Spline,        key: "p" },
  { id: "rect"     as DrawTool, name: "Rect (R)",     icon: Square,        key: "r" },
  { id: "circle"   as DrawTool, name: "Circle (C)",   icon: Circle,        key: "c" },
  { id: "arc"      as DrawTool, name: "Arc (A)",      icon: Waypoints,     key: "a" },
  { id: "polygon"  as DrawTool, name: "Polygon (G)",  icon: Hexagon,       key: "g" },
  { id: "text"     as DrawTool, name: "Text (T)",     icon: TypeIcon,      key: "t" },
  { id: "dim"      as DrawTool, name: "Dim (D)",      icon: Ruler,         key: "d" },
];

const MOD_TOOLS = [
  { id: "move"   as ModifyTool, name: "Move (M)",    icon: Move,          key: "m" },
  { id: "copy"   as ModifyTool, name: "Copy (Y)",    icon: Copy,          key: "y" },
  { id: "rotate" as ModifyTool, name: "Rotate (O)",  icon: RotateCw,      key: "o" },
  { id: "scale"  as ModifyTool, name: "Scale (E)",   icon: Maximize2,     key: "e" },
  { id: "trim"   as ModifyTool, name: "Trim (X)",    icon: Scissors,      key: "x" },
  { id: "extend" as ModifyTool, name: "Extend (W)",  icon: ZoomIn,        key: "w" },
  { id: "offset" as ModifyTool, name: "Offset (F)",  icon: ArrowLeftRight, key: "f" },
  { id: "mirror" as ModifyTool, name: "Mirror (I)",  icon: FlipHorizontal2, key: "i" },
];

function CADTab() {
  const svgRef  = useRef<SVGSVGElement|null>(null);
  const dxfRef  = useRef<HTMLInputElement|null>(null);

  const doc           = useCad(s=>s.doc);
  const selectedIds   = useCad(s=>s.selectedIds);
  const setSelection  = useCad(s=>s.setSelection);
  const addShape      = useCad(s=>s.addShape);
  const updateShape   = useCad(s=>s.updateShape);
  const deleteShapes  = useCad(s=>s.deleteShapes);
  const clearAll      = useCad(s=>s.clearAll);
  const undo          = useCad(s=>s.undo);
  const redo          = useCad(s=>s.redo);
  const setDoc        = useCad(s=>s.setDoc);
  const loadDoc       = useCad(s=>s.loadDoc);
  const setActiveLayer = useCad(s=>s.setActiveLayer);
  const updateLayer   = useCad(s=>s.updateLayer);
  const addLayer      = useCad(s=>s.addLayer);
  const removeLayer   = useCad(s=>s.removeLayer);

  const [tool,    setTool]   = useState<Tool>("line");
  const [snap,    setSnap]   = useState(true);
  const [ortho,   setOrtho]  = useState(false);
  const [shiftDn, setShiftDn] = useState(false);
  const [start,   setStart]  = useState<Point|null>(null);
  const [polyPts, setPolyPts] = useState<Point[]>([]);
  const [polySides, setPolySides] = useState(6);
  const [cursor,  setCursor] = useState<Point>({x:0,y:0});
  const [snapHit, setSnapHit] = useState<SnapHit|null>(null);
  const [hist,    setHist]   = useState<string[]>(["StellanCAD · F8 Ortho · F9 Snap · Space pan · Wheel zoom"]);
  const [osnap]              = useState<OSnapSettings>(defaultOsnap);
  const [offDist, setOffDist] = useState(20);
  const [mirAxis, setMirAxis] = useState<Point|null>(null);
  const [sc,      setSc]     = useState(1);
  const [pan,     setPan]    = useState<Point>({x:0,y:0});
  const [panning, setPanning] = useState<{start:Point;pan0:Point}|null>(null);
  const [spaceDn, setSpaceDn] = useState(false);
  const [drag,    setDrag]   = useState<{base:Point;ids:string[];orig:Shape[];moved:boolean}|null>(null);
  const [selBox,  setSelBox] = useState<{a:Point;b:Point}|null>(null);

  const orthoA = ortho || shiftDn;
  const log = useCallback((l:string)=>setHist(h=>[...h.slice(-50),l]),[]);

  const toRaw = useCallback((cx:number,cy:number):Point=>{
    const svg=svgRef.current; if(!svg) return{x:0,y:0};
    const r=svg.getBoundingClientRect();
    return{x:(cx-r.left)/sc-pan.x,y:(cy-r.top)/sc-pan.y};
  },[sc,pan]);

  const resolve = useCallback((cx:number,cy:number):{p:Point;hit:SnapHit|null}=>{
    const raw=toRaw(cx,cy);
    const hit=findOSnap(doc.shapes,raw,12/sc,osnap);
    if(hit) return{p:hit.p,hit};
    if(snap) return{p:{x:Math.round(raw.x/20)*20,y:Math.round(raw.y/20)*20},hit:null};
    return{p:raw,hit:null};
  },[toRaw,osnap,doc.shapes,snap,sc]);

  const applyOrtho = useCallback((p0:Point,p:Point)=>{
    if(!orthoA) return p;
    return Math.abs(p.x-p0.x)>Math.abs(p.y-p0.y)?{x:p.x,y:p0.y}:{x:p0.x,y:p.y};
  },[orthoA]);

  useEffect(()=>{
    const dn=(e:KeyboardEvent)=>{
      const tag=(e.target as HTMLElement|null)?.tagName;
      if(tag==="INPUT"||tag==="TEXTAREA") return;
      if(e.key==="Shift") setShiftDn(true);
      if(e.code==="Space"){e.preventDefault();setSpaceDn(true);}
      if(e.key==="Escape"){setStart(null);setPolyPts([]);setSelection([]);}
      if(e.key==="Delete"||e.key==="Backspace"){if(selectedIds.length){deleteShapes(selectedIds);log(`Del ${selectedIds.length}`);}}
      const m=e.ctrlKey||e.metaKey;
      if(m&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?(redo(),log("Redo")):(undo(),log("Undo"));return;}
      if(m&&e.key.toLowerCase()==="y"){e.preventDefault();redo();log("Redo");return;}
      const k=e.key.toLowerCase();
      if(k==="f8"){e.preventDefault();setOrtho(v=>{log(`Ortho ${!v?"ON":"OFF"}`);return!v;});}
      if(k==="f9"){e.preventDefault();setSnap(v=>{log(`Snap ${!v?"ON":"OFF"}`);return!v;});}
      const dt=DRAW_TOOLS.find(t=>t.key===k),mt=MOD_TOOLS.find(t=>t.key===k);
      if(dt){setTool(dt.id);setStart(null);setPolyPts([]);log(`Cmd: ${dt.id.toUpperCase()}`);}
      else if(mt){if(!selectedIds.length)log(`${mt.id.toUpperCase()}: select first`);else{setTool(mt.id);setStart(null);log(`Cmd: ${mt.id.toUpperCase()}`);}}
    };
    const up=(e:KeyboardEvent)=>{if(e.key==="Shift")setShiftDn(false);if(e.code==="Space")setSpaceDn(false);};
    window.addEventListener("keydown",dn);window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",dn);window.removeEventListener("keyup",up);};
  },[selectedIds,undo,redo,deleteShapes]);

  const onPD=(e:React.PointerEvent)=>{
    if(e.button===1||(e.button===0&&spaceDn)){setPanning({start:{x:e.clientX,y:e.clientY},pan0:{...pan}});(e.target as Element).setPointerCapture?.(e.pointerId);return;}
    if(e.button!==0||tool!=="select") return;
    const{p}=resolve(e.clientX,e.clientY);
    const hit=pickShape(doc.shapes,p,6/sc);
    if(hit){
      const isSelected=selectedIds.includes(hit);
      const next=isSelected?selectedIds:e.shiftKey?[...selectedIds,hit]:[hit];
      if(!isSelected) setSelection(next);
      setDrag({base:p,ids:next,orig:doc.shapes.filter(s=>next.includes(s.id)),moved:false});
      (e.target as Element).setPointerCapture?.(e.pointerId);return;
    }
    setSelBox({a:p,b:p});(e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPM=(e:React.PointerEvent)=>{
    if(panning){const dx=(e.clientX-panning.start.x)/sc,dy=(e.clientY-panning.start.y)/sc;setPan({x:panning.pan0.x+dx,y:panning.pan0.y+dy});return;}
    const{p:w,hit}=resolve(e.clientX,e.clientY);setSnapHit(hit);setCursor(start?applyOrtho(start,w):w);
    if(drag){
      const dx=w.x-drag.base.x,dy=w.y-drag.base.y;
      if(!drag.moved&&Math.hypot(dx,dy)<2/sc) return;
      const mv=drag.orig.map(s=>translate(s,dx,dy));const map=new Map(mv.map(s=>[s.id,s]));
      setDoc({...doc,shapes:doc.shapes.map(s=>map.get(s.id)??s)});
      if(!drag.moved) setDrag({...drag,moved:true});return;
    }
    if(selBox) setSelBox({...selBox,b:w});
  };

  const onPU=(e:React.PointerEvent)=>{
    setPanning(null);
    if(drag){if(drag.moved)log("MOVE");setDrag(null);return;}
    if(selBox){
      const dx=selBox.b.x-selBox.a.x;
      if(Math.hypot(dx,selBox.b.y-selBox.a.y)>3/sc){
        const mnX=Math.min(selBox.a.x,selBox.b.x),mxX=Math.max(selBox.a.x,selBox.b.x);
        const mnY=Math.min(selBox.a.y,selBox.b.y),mxY=Math.max(selBox.a.y,selBox.b.y);
        const cross=dx<0;
        const ids=doc.shapes.filter(s=>shapeInBox(s,mnX,mnY,mxX,mxY,cross)).map(s=>s.id);
        setSelection(e.shiftKey?[...new Set([...selectedIds,...ids])]:ids);
        log(`${cross?"Crossing":"Window"} sel: ${ids.length}`);
      }
      setSelBox(null);
    }
  };

  const onWheel=(e:React.WheelEvent)=>{
    e.preventDefault();
    const f=e.deltaY<0?1.15:1/1.15,svg=svgRef.current!,r=svg.getBoundingClientRect();
    const cx=(e.clientX-r.left)/sc-pan.x,cy=(e.clientY-r.top)/sc-pan.y;
    const ns=Math.max(0.1,Math.min(10,sc*f));setSc(ns);setPan({x:(e.clientX-r.left)/ns-cx,y:(e.clientY-r.top)/ns-cy});
  };

  const zoomExt=()=>{
    const svg=svgRef.current;if(!svg||!doc.shapes.length){setSc(1);setPan({x:0,y:0});return;}
    const r=svg.getBoundingClientRect(),b=bbox(doc.shapes);if(!b)return;
    const pad=60,ns=Math.max(0.1,Math.min(10,Math.min((r.width-pad*2)/Math.max(1,b.w),(r.height-pad*2)/Math.max(1,b.h))));
    setSc(ns);setPan({x:pad/ns-b.x,y:pad/ns-b.y});
  };

  const onClick=(e:React.MouseEvent)=>{
    if(panning||spaceDn||tool==="select") return;
    const{p:raw}=resolve(e.clientX,e.clientY);
    runAt(start?applyOrtho(start,raw):raw,e.shiftKey);
  };

  const fakeClick=(p:Point)=>runAt(p,false);

  function runAt(p:Point,sh:boolean){
    if(tool==="select"){const h=pickShape(doc.shapes,p,6/sc);h?setSelection(sh?[...selectedIds.includes(h)?selectedIds.filter(x=>x!==h):[...selectedIds,h]]:[h]):setSelection([]);return;}
    if(tool==="trim"||tool==="extend"){const id=pickShape(doc.shapes,p,8/sc);const t=doc.shapes.find(s=>s.id===id);if(!t||t.type!=="line"){log(`${tool}: pick LINE`);return;}const nx=tool==="trim"?trimLine(t as LineShape,doc.shapes,p):extendLine(t as LineShape,doc.shapes,p);if(!nx){log("no boundary");return;}updateShape(t.id,nx as Partial<Shape>);return;}
    if(tool==="offset"){if(!selectedIds.length){const id=pickShape(doc.shapes,p,8/sc);if(id)setSelection([id]);return;}const src=doc.shapes.find(s=>s.id===selectedIds[0]);if(!src)return;const cl=offsetShape(src,offDist,p);if(!cl)return;addShape(cl as never);return;}
    if(tool==="mirror"){if(!selectedIds.length){log("MIRROR: select first");setTool("select");return;}if(!mirAxis){setMirAxis(p);return;}const cl=doc.shapes.filter(s=>selectedIds.includes(s.id)).map(s=>mirrorShape(s,mirAxis,p));setDoc({...doc,shapes:[...doc.shapes,...cl]});setSelection(cl.map(c=>c.id));setMirAxis(null);return;}
    if(tool==="move"||tool==="copy"||tool==="rotate"||tool==="scale"){if(!selectedIds.length){setTool("select");return;}if(!start){setStart(p);return;}applyMod(tool as any,start,p);setStart(null);return;}
    if(tool==="dim"){if(!start){setStart(p);return;}if(!polyPts.length){setPolyPts([p]);return;}const a=start,b2=polyPts[0],dx=b2.x-a.x,dy2=b2.y-a.y,len=Math.hypot(dx,dy2)||1,nx2=-dy2/len,ny2=dx/len,off=(p.x-a.x)*nx2+(p.y-a.y)*ny2;addShape({type:"dim-linear",x1:a.x,y1:a.y,x2:b2.x,y2:b2.y,offset:off,layerId:doc.activeLayerId}as never);setStart(null);setPolyPts([]);return;}
    if(tool==="line"){if(!start){setStart(p);return;}addShape({type:"line",x1:start.x,y1:start.y,x2:p.x,y2:p.y}as never);setStart(p);return;}
    if(tool==="rect"){if(!start){setStart(p);return;}addShape({type:"rect",x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)}as never);setStart(null);return;}
    if(tool==="circle"){if(!start){setStart(p);return;}addShape({type:"circle",cx:start.x,cy:start.y,r:Math.hypot(p.x-start.x,p.y-start.y)}as never);setStart(null);return;}
    if(tool==="arc"){if(!start){setStart(p);return;}if(!polyPts.length){setPolyPts([p]);return;}const r=Math.hypot(polyPts[0].x-start.x,polyPts[0].y-start.y),sa=(Math.atan2(polyPts[0].y-start.y,polyPts[0].x-start.x)*180)/Math.PI,ea=(Math.atan2(p.y-start.y,p.x-start.x)*180)/Math.PI;addShape({type:"arc",cx:start.x,cy:start.y,r,startAngle:sa,endAngle:ea}as never);setStart(null);setPolyPts([]);return;}
    if(tool==="polyline"){setPolyPts(pp=>[...pp,p]);return;}
    if(tool==="polygon"){if(!start){setStart(p);return;}const r=Math.hypot(p.x-start.x,p.y-start.y),a0=Math.atan2(p.y-start.y,p.x-start.x);addShape({type:"polyline",points:Array.from({length:polySides},(_,i)=>{const a=a0+(i*2*Math.PI)/polySides;return{x:start.x+r*Math.cos(a),y:start.y+r*Math.sin(a)};}),closed:true}as never);setStart(null);return;}
    if(tool==="text"){const t=window.prompt("Text:","Tekst");if(t)addShape({type:"text",x:p.x,y:p.y,text:t,size:24}as never);}
  }

  function applyMod(t:"move"|"copy"|"rotate"|"scale",base:Point,tgt:Point){
    const dx=tgt.x-base.x,dy=tgt.y-base.y,ids=selectedIds;
    if(t==="move")setDoc({...doc,shapes:doc.shapes.map(s=>ids.includes(s.id)?translate(s,dx,dy):s)});
    else if(t==="copy"){const cl=doc.shapes.filter(s=>ids.includes(s.id)).map(s=>({...translate(s,dx,dy),id:Math.random().toString(36).slice(2,9)}));setDoc({...doc,shapes:[...doc.shapes,...cl]});setSelection(cl.map(c=>c.id));}
    else if(t==="rotate"){const ang=Math.atan2(dy,dx);setDoc({...doc,shapes:doc.shapes.map(s=>ids.includes(s.id)?rotate(s,base,ang):s)});}
    else if(t==="scale"){const f=Math.max(0.05,Math.hypot(dx,dy)/100);setDoc({...doc,shapes:doc.shapes.map(s=>ids.includes(s.id)?scaleShape(s,base,f):s)});}
  }

  const preview=useMemo(()=>{
    const ps="oklch(0.78 0.16 80)";
    if(tool==="polyline"&&polyPts.length){const d=polyPts.map((p,i)=>`${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ")+` L ${cursor.x} ${cursor.y}`;return<path d={d} fill="none" stroke={ps} strokeWidth={1.5/sc} strokeDasharray={`${6/sc} ${4/sc}`}/>;}
    if(!start) return null;
    const sw=1.5/sc,da=`${6/sc} ${4/sc}`;
    if(tool==="line") return<line x1={start.x} y1={start.y} x2={cursor.x} y2={cursor.y} stroke={ps} strokeWidth={sw} strokeDasharray={da}/>;
    if(tool==="rect") return<rect x={Math.min(start.x,cursor.x)} y={Math.min(start.y,cursor.y)} width={Math.abs(cursor.x-start.x)} height={Math.abs(cursor.y-start.y)} fill="none" stroke={ps} strokeWidth={sw} strokeDasharray={da}/>;
    if(tool==="circle") return<circle cx={start.x} cy={start.y} r={Math.hypot(cursor.x-start.x,cursor.y-start.y)} fill="none" stroke={ps} strokeWidth={sw} strokeDasharray={da}/>;
    return null;
  },[tool,start,cursor,polyPts,sc]);

  const layerById=useMemo(()=>new Map(doc.layers.map(l=>[l.id,l])),[doc.layers]);
  const visShapes=useMemo(()=>doc.shapes.filter(s=>layerById.get(s.layerId)?.visible!==false),[doc.shapes,layerById]);

  const dlDxf=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([exportDXF(doc)],{type:"application/dxf"}));a.download=`drawing-${Date.now()}.dxf`;a.click();};
  const onLoadDxf=(e:React.ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const{shapes,layers}=importDXF(String(r.result),doc.layers);loadDoc({...doc,layers,shapes});log(`Import ${f.name}`);}catch{log("DXF error");}};r.readAsText(f);e.target.value="";};

  return(
    <div className="grid h-full grid-cols-[52px_minmax(0,1fr)_240px]">
      {/* Tools */}
      <aside className="flex flex-col items-center gap-0.5 overflow-y-auto border-r border-border bg-card py-2">
        {DRAW_TOOLS.map(it=>(
          <button key={it.id} title={it.name} onClick={()=>{setTool(it.id);setStart(null);setPolyPts([]);}}
            className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",tool===it.id&&"bg-primary/15 text-primary border border-primary/30")}>
            <it.icon className="h-4 w-4"/>
          </button>
        ))}
        <div className="my-1 h-px w-8 bg-border"/>
        {MOD_TOOLS.map(it=>(
          <button key={it.id} title={it.name}
            onClick={()=>{if(!selectedIds.length){log(`${it.id}: select first`);return;}setTool(it.id);setStart(null);}}
            className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",tool===it.id&&"bg-primary/15 text-primary border border-primary/30",!selectedIds.length&&"opacity-30")}>
            <it.icon className="h-4 w-4"/>
          </button>
        ))}
        <div className="my-1 h-px w-8 bg-border"/>
        <button title="Delete" onClick={()=>deleteShapes(selectedIds)} className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10",!selectedIds.length&&"opacity-30")}><Trash2 className="h-4 w-4"/></button>
        <button title="Undo Ctrl+Z" onClick={()=>{undo();log("Undo");}} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"><Undo2 className="h-4 w-4"/></button>
        <button title="Redo Ctrl+Y" onClick={()=>{redo();log("Redo");}} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"><Redo2 className="h-4 w-4"/></button>
      </aside>

      {/* Canvas */}
      <section className="relative min-h-0 overflow-hidden border-r border-border select-none" style={{background:"oklch(0.10 0.02 265)"}}>
        <svg ref={svgRef}
          className={cn("absolute inset-0 h-full w-full",spaceDn||panning?"cursor-grab":tool==="select"?"cursor-default":"cursor-crosshair")}
          onClick={onClick}
          onDoubleClick={()=>{if(tool==="polyline"&&polyPts.length>=2){addShape({type:"polyline",points:polyPts,closed:false}as never);setPolyPts([]);}}}
          onContextMenu={e=>{e.preventDefault();if(tool==="polyline"&&polyPts.length>=2){addShape({type:"polyline",points:polyPts,closed:false}as never);setPolyPts([]);return;}if(start){setStart(null);return;}setSelection([]);}}
          onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onWheel={onWheel}
        >
          <defs>
            <pattern id="cgm" width={20*sc} height={20*sc} patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x*sc} ${pan.y*sc})`}>
              <path d={`M ${20*sc} 0 L 0 0 0 ${20*sc}`} fill="none" stroke="oklch(0.5 0.05 265/20%)" strokeWidth="1"/>
            </pattern>
            <pattern id="cgM" width={100*sc} height={100*sc} patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x*sc} ${pan.y*sc})`}>
              <path d={`M ${100*sc} 0 L 0 0 0 ${100*sc}`} fill="none" stroke="oklch(0.5 0.05 265/40%)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cgm)"/>
          <rect width="100%" height="100%" fill="url(#cgM)"/>
          <g transform={`scale(${sc}) translate(${pan.x} ${pan.y})`}>
            {visShapes.map(s=><ShapeNode key={s.id} shape={s} color={layerById.get(s.layerId)?.color??"#fff"} selected={selectedIds.includes(s.id)} scale={sc}/>)}
            {snapHit?<SnapMarker hit={snapHit} scale={sc}/>:snap?<rect x={cursor.x-4/sc} y={cursor.y-4/sc} width={8/sc} height={8/sc} fill="none" stroke="oklch(0.78 0.16 80)" strokeWidth={1/sc}/>:null}
            {tool==="mirror"&&mirAxis&&<g><circle cx={mirAxis.x} cy={mirAxis.y} r={4/sc} fill="oklch(0.78 0.16 80)"/><line x1={mirAxis.x} y1={mirAxis.y} x2={cursor.x} y2={cursor.y} stroke="oklch(0.78 0.16 80)" strokeWidth={1/sc} strokeDasharray={`${6/sc} ${4/sc}`}/></g>}
            {preview}
            {selBox&&(()=>{const x=Math.min(selBox.a.x,selBox.b.x),y=Math.min(selBox.a.y,selBox.b.y),w=Math.abs(selBox.b.x-selBox.a.x),h=Math.abs(selBox.b.y-selBox.a.y),cr=selBox.b.x<selBox.a.x;return<rect x={x} y={y} width={w} height={h} fill={cr?"oklch(0.78 0.18 145/12%)":"oklch(0.7 0.18 250/12%)"} stroke={cr?"oklch(0.78 0.18 145)":"oklch(0.7 0.18 250)"} strokeWidth={1/sc} strokeDasharray={cr?`${5/sc} ${4/sc}`:undefined}/>;})()}
          </g>
          <g pointerEvents="none" stroke="oklch(0.68 0.22 295/40%)" strokeWidth="0.6">
            <line x1={0} y1={(cursor.y+pan.y)*sc} x2="100%" y2={(cursor.y+pan.y)*sc}/>
            <line x1={(cursor.x+pan.x)*sc} y1={0} x2={(cursor.x+pan.x)*sc} y2="100%"/>
          </g>
        </svg>

        {/* Top bar */}
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-lg border border-border/60 bg-card/90 p-1 backdrop-blur text-xs">
          {[{l:"Snap",v:snap,f:()=>setSnap(v=>!v)},{l:"Ortho",v:orthoA,f:()=>setOrtho(v=>!v)}].map(c=>(
            <button key={c.l} onClick={c.f} className={cn("rounded px-2 py-0.5 font-medium",c.v?"bg-primary/15 text-primary":"text-muted-foreground hover:bg-accent")}>{c.l}</button>
          ))}
          <button onClick={zoomExt} className="rounded px-2 py-0.5 text-muted-foreground hover:bg-accent">
            <ArrowLeftRight className="inline h-3 w-3"/> Fit
          </button>
          {tool==="polygon"&&<input type="number" min={3} max={32} value={polySides} onChange={e=>setPolySides(Math.max(3,+e.target.value||3))} className="w-10 rounded border border-border bg-background/50 text-center font-mono text-[10px] outline-none"/>}
          {tool==="offset"&&<input type="number" min={0.1} step={1} value={offDist} onChange={e=>setOffDist(Math.max(0.1,+e.target.value||1))} className="w-14 rounded border border-border bg-background/50 text-center font-mono text-[10px] outline-none"/>}
        </div>

        {/* File menu */}
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-border/60 bg-card/90 p-1 backdrop-blur text-xs">
          <button onClick={dlDxf} className="flex items-center gap-1 rounded px-2 py-0.5 text-muted-foreground hover:bg-accent"><Download className="h-3 w-3"/> DXF</button>
          <button onClick={()=>dxfRef.current?.click()} className="flex items-center gap-1 rounded px-2 py-0.5 text-muted-foreground hover:bg-accent"><FileUp className="h-3 w-3"/> Import</button>
          <button onClick={()=>{if(confirm("Obrisati?"))clearAll();}} className="rounded px-2 py-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10">Clear</button>
          <input ref={dxfRef} type="file" accept=".dxf" hidden onChange={onLoadDxf}/>
        </div>

        {/* HUD */}
        <div className="pointer-events-none absolute right-3 bottom-20 rounded-lg border border-border/60 bg-card/90 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur">
          <div>X {cursor.x.toFixed(1)}  Y {cursor.y.toFixed(1)}</div>
          <div>Zoom {(sc*100).toFixed(0)}%<span className={cn("ml-1",snap?"text-primary":"")}> SNAP</span><span className={cn("ml-1",orthoA?"text-primary":"")}> ORTHO</span><span className="ml-1 uppercase text-foreground"> {tool}</span></div>
        </div>

        {/* Command line */}
        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
          <div className="max-h-16 overflow-y-auto px-3 py-1 font-mono text-[10px] text-muted-foreground">
            {hist.slice(-3).map((h,i)=><div key={i}>{h}</div>)}
          </div>
          <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
            <span className="font-mono text-[11px] text-primary">Command:</span>
            <input placeholder="L R C A D X F · koordinate: 100,200 ili @50,0"
              className="flex-1 bg-transparent font-mono text-[12px] outline-none placeholder:text-muted-foreground/30"
              onKeyDown={e=>{
                if(e.key!=="Enter") return;
                const raw=e.currentTarget.value.trim();e.currentTarget.value="";if(!raw) return;
                const lp=start??polyPts[polyPts.length-1]??null;
                const coord=parseCoord(raw,lp);
                if(coord){setCursor(coord);fakeClick(coord);return;}
                const all=[...DRAW_TOOLS,...MOD_TOOLS];
                const t=all.find(tt=>tt.key===raw[0]||tt.id===raw);
                if(t){setTool(t.id);setStart(null);setPolyPts([]);setMirAxis(null);log(`Cmd: ${t.id.toUpperCase()}`);}
                else if(raw==="clear")clearAll();
                else if(raw==="undo")undo();
                else if(raw==="redo")redo();
                else if(raw==="dxf")dlDxf();
                else log(`Unknown: "${raw}"`);
              }}/>
          </div>
        </div>
      </section>

      {/* Layers */}
      <aside className="flex h-full min-h-0 flex-col bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <LayersIcon className="h-3 w-3"/> Slojevi
          </span>
          <button onClick={()=>{const n=prompt("Ime sloja:");if(n)addLayer(n);}} className="text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5"/></button>
        </div>
        <div className="max-h-[45%] overflow-y-auto px-2 py-1.5">
          {doc.layers.map(l=>(
            <div key={l.id} onClick={()=>setActiveLayer(l.id)}
              className={cn("group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-accent cursor-pointer",doc.activeLayerId===l.id&&"bg-primary/10 ring-1 ring-primary/20")}>
              <button onClick={e=>{e.stopPropagation();updateLayer(l.id,{visible:!l.visible});}} className="text-muted-foreground hover:text-foreground">
                {l.visible?<Eye className="h-3.5 w-3.5"/>:<EyeOff className="h-3.5 w-3.5"/>}
              </button>
              <button onClick={e=>{e.stopPropagation();updateLayer(l.id,{locked:!l.locked});}} className="text-muted-foreground hover:text-foreground">
                {l.locked?<Lock className="h-3.5 w-3.5"/>:<LockOpen className="h-3.5 w-3.5"/>}
              </button>
              <span className="h-3 w-3 rounded-sm border border-border" style={{background:l.color}}/>
              <span className={cn("flex-1 truncate font-mono",doc.activeLayerId===l.id&&"text-primary font-semibold")}>{l.name}</span>
              <button onClick={e=>{e.stopPropagation();if(doc.layers.length>1)removeLayer(l.id);}} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Minus className="h-3 w-3"/></button>
            </div>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto border-t border-border px-3 py-2 font-mono text-[10px] text-muted-foreground/40 space-y-0.5">
          {["L Line · P Poly · R Rect","C Circle · A Arc · G Poly","S Sel · M Move · Y Copy","F8 Ortho · F9 Snap · ⎵ Pan","Ctrl+Z Undo · DXF export"].map(h=><div key={h}>{h}</div>)}
        </div>
      </aside>
    </div>
  );
}

// ─── CAD Helpers ──────────────────────────────────────────────────────────────

function ShapeNode({shape,color,selected,scale}:{shape:Shape;color:string;selected:boolean;scale:number}){
  const st=selected?"oklch(0.68 0.22 295)":color,sw=(selected?2:1.6)/scale,da=selected?`${6/scale} ${4/scale}`:undefined;
  if(shape.type==="line") return<line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={st} strokeWidth={sw} strokeDasharray={da}/>;
  if(shape.type==="rect") return<rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill="none" stroke={st} strokeWidth={sw} strokeDasharray={da}/>;
  if(shape.type==="circle") return<circle cx={shape.cx} cy={shape.cy} r={shape.r} fill="none" stroke={st} strokeWidth={sw} strokeDasharray={da}/>;
  if(shape.type==="arc"){const sa=(shape.startAngle*Math.PI)/180,ea=(shape.endAngle*Math.PI)/180;const x1=shape.cx+shape.r*Math.cos(sa),y1=shape.cy+shape.r*Math.sin(sa),x2=shape.cx+shape.r*Math.cos(ea),y2=shape.cy+shape.r*Math.sin(ea);let d=shape.endAngle-shape.startAngle;while(d<0)d+=360;while(d>360)d-=360;return<path d={`M ${x1} ${y1} A ${shape.r} ${shape.r} 0 ${d>180?1:0} 1 ${x2} ${y2}`} fill="none" stroke={st} strokeWidth={sw} strokeDasharray={da}/>;}
  if(shape.type==="polyline"){const d=shape.points.map((p,i)=>`${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ")+(shape.closed?" Z":"");return<path d={d} fill="none" stroke={st} strokeWidth={sw} strokeDasharray={da}/>;}
  if(shape.type==="text") return<text x={shape.x} y={shape.y} fill={st} fontSize={shape.size} fontFamily="ui-sans-serif,system-ui">{shape.text}</text>;
  return null;
}

function SnapMarker({hit,scale}:{hit:SnapHit;scale:number}){
  const s=8/scale,sw=1.5/scale,c="oklch(0.78 0.16 80)";
  return<g stroke={c} fill="none" strokeWidth={sw} pointerEvents="none">
    {hit.kind==="endpoint"&&<rect x={hit.p.x-s} y={hit.p.y-s} width={s*2} height={s*2}/>}
    {hit.kind==="midpoint"&&<polygon points={`${hit.p.x},${hit.p.y-s} ${hit.p.x+s},${hit.p.y+s} ${hit.p.x-s},${hit.p.y+s}`}/>}
    {hit.kind==="center"&&<circle cx={hit.p.x} cy={hit.p.y} r={s}/>}
    {hit.kind==="intersection"&&<g><line x1={hit.p.x-s} y1={hit.p.y-s} x2={hit.p.x+s} y2={hit.p.y+s}/><line x1={hit.p.x-s} y1={hit.p.y+s} x2={hit.p.x+s} y2={hit.p.y-s}/></g>}
  </g>;
}

function bbox(shapes:Shape[]){
  let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
  const e=(x:number,y:number)=>{mnX=Math.min(mnX,x);mnY=Math.min(mnY,y);mxX=Math.max(mxX,x);mxY=Math.max(mxY,y);};
  for(const s of shapes){
    if(s.type==="line"){e(s.x1,s.y1);e(s.x2,s.y2);}
    else if(s.type==="rect"){e(s.x,s.y);e(s.x+s.w,s.y+s.h);}
    else if(s.type==="circle"||s.type==="arc"){e(s.cx-s.r,s.cy-s.r);e(s.cx+s.r,s.cy+s.r);}
    else if(s.type==="polyline"){for(const p of s.points)e(p.x,p.y);}
  }
  if(!Number.isFinite(mnX)) return null;
  return{x:mnX,y:mnY,w:mxX-mnX||1,h:mxY-mnY||1};
}

function translate(s:Shape,dx:number,dy:number):Shape{
  if(s.type==="line") return{...s,x1:s.x1+dx,y1:s.y1+dy,x2:s.x2+dx,y2:s.y2+dy};
  if(s.type==="rect") return{...s,x:s.x+dx,y:s.y+dy};
  if(s.type==="circle"||s.type==="arc") return{...s,cx:s.cx+dx,cy:s.cy+dy};
  if(s.type==="polyline") return{...s,points:s.points.map(p=>({x:p.x+dx,y:p.y+dy}))};
  if(s.type==="text") return{...s,x:s.x+dx,y:s.y+dy};
  return{...s,x1:(s as any).x1+dx,y1:(s as any).y1+dy,x2:(s as any).x2+dx,y2:(s as any).y2+dy};
}

function rot(p:Point,c:Point,a:number):Point{const cs=Math.cos(a),sn=Math.sin(a),x=p.x-c.x,y=p.y-c.y;return{x:c.x+x*cs-y*sn,y:c.y+x*sn+y*cs};}

function rotate(s:Shape,c:Point,a:number):Shape{
  if(s.type==="line"){const p1=rot({x:s.x1,y:s.y1},c,a),p2=rot({x:s.x2,y:s.y2},c,a);return{...s,x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y};}
  if(s.type==="circle"){const np=rot({x:s.cx,y:s.cy},c,a);return{...s,cx:np.x,cy:np.y};}
  if(s.type==="polyline") return{...s,points:s.points.map(p=>rot(p,c,a))};
  return s;
}

function scaleShape(s:Shape,c:Point,f:number):Shape{
  const sc2=(p:Point)=>({x:c.x+(p.x-c.x)*f,y:c.y+(p.y-c.y)*f});
  if(s.type==="line"){const p1=sc2({x:s.x1,y:s.y1}),p2=sc2({x:s.x2,y:s.y2});return{...s,x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y};}
  if(s.type==="circle"){const np=sc2({x:s.cx,y:s.cy});return{...s,cx:np.x,cy:np.y,r:s.r*f};}
  if(s.type==="polyline") return{...s,points:s.points.map(p=>sc2(p))};
  return s;
}

function pickShape(shapes:Shape[],p:Point,tol:number):string|null{
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i];
    if(s.type==="line"&&distSeg(p,{x:s.x1,y:s.y1},{x:s.x2,y:s.y2})<=tol) return s.id;
    if(s.type==="rect"){const oV=(Math.abs(p.x-s.x)<=tol||Math.abs(p.x-(s.x+s.w))<=tol)&&p.y>=s.y-tol&&p.y<=s.y+s.h+tol;const oH=(Math.abs(p.y-s.y)<=tol||Math.abs(p.y-(s.y+s.h))<=tol)&&p.x>=s.x-tol&&p.x<=s.x+s.w+tol;if(oV||oH) return s.id;}
    if((s.type==="circle"||s.type==="arc")&&Math.abs(Math.hypot(p.x-s.cx,p.y-s.cy)-s.r)<=tol) return s.id;
    if(s.type==="polyline"){for(let j=0;j<s.points.length-1;j++)if(distSeg(p,s.points[j],s.points[j+1])<=tol) return s.id;}
  }
  return null;
}

function distSeg(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(!l2) return Math.hypot(p.x-a.x,p.y-a.y);let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;t=Math.max(0,Math.min(1,t));return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}

function shapeInBox(s:Shape,mnX:number,mnY:number,mxX:number,mxY:number,cross:boolean):boolean{
  const ptIn=(x:number,y:number)=>x>=mnX&&x<=mxX&&y>=mnY&&y<=mxY;
  if(s.type==="line"){const a={x:s.x1,y:s.y1},b={x:s.x2,y:s.y2};return cross?ptIn(a.x,a.y)||ptIn(b.x,b.y):ptIn(a.x,a.y)&&ptIn(b.x,b.y);}
  if(s.type==="rect"){const cs=[{x:s.x,y:s.y},{x:s.x+s.w,y:s.y},{x:s.x+s.w,y:s.y+s.h},{x:s.x,y:s.y+s.h}];return cross?cs.some(c=>ptIn(c.x,c.y)):cs.every(c=>ptIn(c.x,c.y));}
  return false;
}
