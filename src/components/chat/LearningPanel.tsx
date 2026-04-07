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

type LogTone = "success" | "error" | "info";

function getLogTone(msg: string): LogTone {
  const lower = msg.toLowerCase();
  if (msg.includes("✓") || lower.includes("online") || lower.includes("spremljeno") || lower.includes("učitan")) {
    return "success";
  }
  if (lower.includes("greška") || lower.includes("error") || lower.includes("nije uspjelo")) {
    return "error";
  }
  return "info";
}

function scriptCategory(name: string) {
  const n = name.toLowerCase();
  if (n.includes("oss")) return "OSS";
  if (n.includes("sdge")) return "SDGE";
  return "Ostalo";
}

export default function LearningPanel({ onClose, agentServerUrl }: LearningPanelProps) {
  const AGENT_URL = agentServerUrl || import.meta.env.VITE_AGENT_SERVER_URL || "";
  const AGENT_KEY = import.meta.env.VITE_AGENT_API_KEY || "";

  const [url, setUrl] = useState("https://oss.uredjenazemlja.hr/");
  const [code, setCode] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [codegenRunning, setCodegenRunning] = useState(false);
  const [flows, setFlows] = useState<string[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [improvingCode, setImprovingCode] = useState(false);
  const [runningPreview, setRunningPreview] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedStepsCount, setRecordedStepsCount] = useState(0);
  const [insertCursorPos, setInsertCursorPos] = useState<number | null>(null);
  const [flowSearch, setFlowSearch] = useState("");
  const [activeLogTab, setActiveLogTab] = useState<"log" | "status">("log");

  const logRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const log = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("hr-HR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs(prev => [...prev.slice(-400), { time, msg }]);
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

  const refreshFlows = useCallback(async () => {
    const res = await callAgent("record/list", {}, "GET");
    if (res?.success && Array.isArray(res.actions)) {
      setFlows(res.actions.map((a: any) => a.name || a.file?.replace(".py", "") || "?"));
      log(`Učitano skripti: ${res.actions.length}`);
    }
  }, [callAgent, log]);

  useEffect(() => {
    if (agentOnline) refreshFlows();
  }, [agentOnline, refreshFlows]);

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
    } else {
      log(`Greška: ${res?.error}`);
    }
  };

  const learnFlow = async () => {
    let suggested = selectedFlow || "nauceni_flow";
    suggested = suggested.replace(/\s+/g, "_").toLowerCase();
    const name = prompt("Ime naučenog flowa:", suggested);
    if (!name) return;
    const res = await callAgent("record/write", { name, content: code });
    if (res?.success) {
      setSelectedFlow(name);
      log(`🧠 Naučen flow: ${name}.py`);
      await refreshFlows();
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
      if (Array.isArray(res.notes)) {
        res.notes.forEach((note: string) => log(`• ${note}`));
      }
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
    setActiveLogTab("log");
    log("Pokrećem probnu verziju trenutnog koda...");
    const res = await callAgent("code/run_temp", { content: code, timeout: 90 });
    if (res?.success) {
      log("✓ Probno izvršavanje završeno.");
      if (res.stdout) log(res.stdout.slice(0, 1400));
      if (res.stderr) log(res.stderr.slice(0, 1400));
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

  const deleteFlow = async () => {
    if (!selectedFlow) return;
    if (!confirm(`Obrisati "${selectedFlow}"?`)) return;
    await callAgent("record/delete", { name: selectedFlow });
    setSelectedFlow(null);
    setCode("");
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

  const filteredFlows = useMemo(() => {
    const q = flowSearch.trim().toLowerCase();
    return flows.filter(name => !q || name.toLowerCase().includes(q));
  }, [flows, flowSearch]);

  const groupedFlows = useMemo(() => {
    return {
      OSS: filteredFlows.filter(name => scriptCategory(name) === "OSS"),
      SDGE: filteredFlows.filter(name => scriptCategory(name) === "SDGE"),
      Ostalo: filteredFlows.filter(name => scriptCategory(name) === "Ostalo"),
    };
  }, [filteredFlows]);

  const codeStatus = useMemo(() => {
    if (!code.trim()) return "Prazno";
    if (code.includes("STELLAN_CONTINUE_HERE")) return "Ima marker";
    if (selectedFlow) return "Spremljeni flow";
    return "Sirovi / uređeni kod";
  }, [code, selectedFlow]);

  const btnBase =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40";
  const btnGhost = `${btnBase} border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white`;
  const btnBlue = `${btnBase} bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/20 hover:bg-sky-500/25`;
  const btnViolet = `${btnBase} bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20 hover:bg-violet-500/25`;
  const btnAmber = `${btnBase} bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/20 hover:bg-amber-500/25`;
  const btnGreen = `${btnBase} bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/20 hover:bg-emerald-500/25`;
  const btnPink = `${btnBase} bg-fuchsia-500/15 text-fuchsia-100 ring-1 ring-fuchsia-400/20 hover:bg-fuchsia-500/25`;
  const btnSlate = `${btnBase} bg-white/[0.04] text-white/70 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white`;

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
                  <div className="text-[18px] font-semibold tracking-tight">Učenje</div>
                  <div className="text-[12px] text-white/45">Fullscreen editor za Codegen, doradu i spajanje nastavaka</div>
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

        <div className="grid min-h-0 flex-1 grid-cols-[290px_minmax(0,1fr)] gap-4 p-4">
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
                      {items.map(name => {
                        const active = selectedFlow === name;
                        return (
                          <button
                            key={name}
                            onClick={() => selectFlow(name)}
                            className={cn(
                              "w-full rounded-2xl border px-3 py-3 text-left transition-all",
                              active
                                ? "border-emerald-400/25 bg-emerald-500/10 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                                : "border-white/8 bg-white/[0.03] text-white/65 hover:border-white/12 hover:bg-white/[0.06] hover:text-white"
                            )}
                          >
                            <div className="truncate text-[13px] font-medium">{name}</div>
                            <div className="mt-1 text-[11px] text-white/35">{group} flow</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 p-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={runFlow} disabled={!selectedFlow || !agentOnline} className={btnGhost}>
                  ▶ Run
                </button>
                <button onClick={deleteFlow} disabled={!selectedFlow} className={cn(btnGhost, "text-red-300 hover:text-red-200") }>
                  ✕ Obriši
                </button>
              </div>
            </div>
          </aside>

          <section className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_240px] overflow-hidden rounded-[28px] border border-white/10 bg-[#08101f]/85 shadow-[0_16px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
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
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100">Spremanje</div>
                <button onClick={saveCode} disabled={!code.trim()} className={btnGhost}>
                  💾 Spremi flow
                </button>
                <button onClick={learnFlow} disabled={!code.trim()} className={btnPink}>
                  🧠 Nauči flow
                </button>
                {selectedFlow && <div className="text-xs text-white/40">Aktivno: {selectedFlow}.py</div>}
                {insertCursorPos !== null && <div className="text-xs text-white/40">Pozicija nastavka: {insertCursorPos}</div>}
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div>
                <div className="text-sm font-semibold text-white/95">{selectedFlow ? `${selectedFlow}.py` : "Generirani / sirovi kod"}</div>
                <div className="mt-1 text-xs text-white/40">Codegen → Prepravi → Označi nastavak → Snimaj → Spoji → Probno → Spremi</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60">
                {code.trim() ? `${code.split("\n").length} linija` : "Bez koda"}
              </div>
            </div>

            <div className="min-h-0 bg-[#050c18] p-4">
              <textarea
                ref={textareaRef}
                value={code}
                onChange={e => setCode(e.target.value)}
                className="h-full w-full resize-none rounded-[24px] border border-white/8 bg-[#060d1c] px-5 py-4 font-mono text-[13px] leading-7 text-emerald-200/85 outline-none transition focus:border-emerald-400/30"
                placeholder={"Pokreni Codegen → klikaj po browseru → Učitaj kod\nZatim klikni: Stellan prepravi kod → Dodaj marker ili Nastavi ovdje → Snimaj nastavak → Spoji nastavak u kod → Pokreni probno → Spremi flow"}
                spellCheck={false}
              />
            </div>

            <div className="min-h-0 border-t border-white/10 bg-[#07101e]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveLogTab("log")}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-xs transition",
                      activeLogTab === "log" ? "bg-white/[0.08] text-white" : "text-white/45 hover:text-white/80"
                    )}
                  >
                    Log
                  </button>
                  <button
                    onClick={() => setActiveLogTab("status")}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-xs transition",
                      activeLogTab === "status" ? "bg-white/[0.08] text-white" : "text-white/45 hover:text-white/80"
                    )}
                  >
                    Status
                  </button>
                </div>
                <div className="text-xs text-white/35">{logs.length} zapisa</div>
              </div>

              {activeLogTab === "log" ? (
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
                          <div
                            className={cn(
                              "text-[12px] leading-6",
                              tone === "success" && "text-emerald-200/90",
                              tone === "error" && "text-red-200/90",
                              tone === "info" && "text-white/72"
                            )}
                          >
                            {entry.msg}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                    <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">Editor</div>
                    <div className="space-y-2 text-white/70">
                      <div>Aktivni flow: <span className="text-white/95">{selectedFlow || "nije odabran"}</span></div>
                      <div>Status: <span className="text-white/95">{codeStatus}</span></div>
                      <div>Cursor marker: <span className="text-white/95">{insertCursorPos ?? "nije postavljen"}</span></div>
                      <div>Pretraga flowova: <span className="text-white/95">{flowSearch || "—"}</span></div>
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
