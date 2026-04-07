// LearningPanel.tsx — Učenje tab
// Pokreće Playwright Codegen, prepravlja sirovi kod, spaja nastavke i probno ga izvršava

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
.
interface LogEntry { time: string; msg: string; }
interface LearningPanelProps { onClose: () => void; agentServerUrl?: string; }

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
  const logRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const log = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(prev => [...prev.slice(-400), { time, msg }]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const callAgent = useCallback(async (endpoint: string, body: object = {}, method: "POST" | "GET" = "POST") => {
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
  }, [AGENT_URL, AGENT_KEY, log]);

  useEffect(() => {
    if (!AGENT_URL) return;
    (async () => {
      try {
        const res = await fetch(`${AGENT_URL}/health`, { headers: { "ngrok-skip-browser-warning": "true" } });
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

  const saveCode = async (preferredName?: string) => {
    const name = preferredName || selectedFlow || prompt("Spremi kao (ime bez .py):");
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
    if (!code.trim()) {
      log("Nema koda za naučiti.");
      return;
    }
    const suggested = selectedFlow || "nauceni_flow";
    const name = prompt("Ime flowa za naučiti:", suggested);
    if (!name) return;
    await saveCode(name);
    log(`🧠 Flow naučen/spremljen kao: ${name}.py`);
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
    log("Pokrećem probnu verziju trenutnog koda...");
    const res = await callAgent("code/run_temp", { content: code, timeout: 90 });
    if (res?.success) {
      log("✓ Probno izvršavanje završeno.");
      if (res.stdout) log(res.stdout.slice(0, 1200));
      if (res.stderr) log(res.stderr.slice(0, 1200));
      if (res.screenshot_path) log(`Screenshot: ${res.screenshot_path}`);
    } else {
      log(`Greška: ${res?.error || res?.stderr || "izvršavanje nije uspjelo"}`);
      if (res?.stderr) log(res.stderr.slice(0, 1200));
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
      if (res.stdout) log(res.stdout.slice(0, 1200));
      if (res.stderr) log(res.stderr.slice(0, 1200));
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

  const markContinueHere = () => {
    const ta = textareaRef.current;
    if (!ta) {
      log("Editor nije spreman.");
      return;
    }
    const pos = ta.selectionStart ?? 0;
    setInsertCursorPos(pos);
    log(`✓ Zapamćena pozicija za nastavak (znak ${pos}).`);
  };

  const insertMarkerHere = () => {
    const ta = textareaRef.current;
    const marker = "\n# STELLAN_CONTINUE_HERE\n";
    if (!ta) {
      setCode(prev => `${prev}${marker}`);
      log("Marker dodan na kraj koda.");
      return;
    }

    const pos = ta.selectionStart ?? code.length;
    const next = code.slice(0, pos) + marker + code.slice(pos);
    setCode(next);
    setInsertCursorPos(pos + marker.length);
    log("✓ Marker # STELLAN_CONTINUE_HERE dodan u kod.");
  };

  const startLearning = async () => {
    const name = selectedFlow || "nastavak_flowa";
    const res = await callAgent("record/start", { name });
    if (res?.success) {
      setRecording(true);
      setRecordedStepsCount(0);
      log("✓ Učenje pokrenuto. Radi nove klikove u browseru.");
    } else {
      log(`Greška: ${res?.error || "ne mogu pokrenuti učenje"}`);
    }
  };

  const stopLearning = async () => {
    const res = await callAgent("record/stop", {});
    if (res?.success) {
      setRecording(false);
      setRecordedStepsCount(res.steps ?? recordedStepsCount);
      log(`✓ Učenje zaustavljeno. Snimljeno koraka: ${res.steps ?? 0}`);
    } else {
      log(`Greška: ${res?.error || "ne mogu zaustaviti učenje"}`);
    }
  };

  const mergeLearningIntoCode = async () => {
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
      log(`✓ Spojeno ${res.steps_used ?? 0} novih koraka u kod.`);
      if (res.merge_mode) log(`Način spajanja: ${res.merge_mode}`);
    } else {
      log(`Greška: ${res?.error || "ne mogu spojiti snimljene korake"}`);
    }
  };

  const pollLearning = useCallback(async () => {
    if (!recording) return;
    const res = await callAgent("record/poll", {}, "GET");
    if (res?.success) {
      setRecordedStepsCount(res.total_steps || 0);
      if (Array.isArray(res.new_events) && res.new_events.length > 0) {
        res.new_events.forEach((evt: any) => {
          const detail = evt.selector || evt.value || evt.url || "";
          log(`+ ${evt.action}${detail ? ` → ${detail}` : ""}`);
        });
      }
    }
  }, [recording, callAgent, log]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      pollLearning();
    }, 1500);
    return () => window.clearInterval(id);
  }, [recording, pollLearning]);

  const btn = "px-3 py-1.5 rounded border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] text-[12px] text-white/70 hover:text-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap";
  const btnGreen = "px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-medium transition-colors disabled:opacity-40";
  const btnBlue = "px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[13px] font-medium transition-colors disabled:opacity-40";
  const btnViolet = "px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-medium transition-colors disabled:opacity-40";
  const btnAmber = "px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[13px] font-medium transition-colors disabled:opacity-40";
  const input = "bg-white/[0.05] border border-white/[0.10] rounded px-3 py-1.5 text-[13px] text-white/85 placeholder-white/25 focus:outline-none focus:border-emerald-500/50";

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0a0e17] text-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-[#0d1220]">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.10] bg-white/[0.05] text-[12px] text-white/80 hover:bg-white/[0.10]"
          >
            ← Nazad na Stellana
          </button>
          <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          </div>
          <span className="text-[13px] font-semibold text-white/90">Učenje — fullscreen</span>
          <div className="flex items-center gap-1.5 ml-2">
            <div className={cn("w-2 h-2 rounded-full", agentOnline ? "bg-emerald-400" : "bg-red-400")} />
            <span className="text-[10px] text-white/35">{agentOnline ? "Agent online" : "Agent offline"}</span>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.08]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3">
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} className={cn(input, "flex-1")} placeholder="URL za snimanje..." />
        <button onClick={startCodegen} disabled={!agentOnline || codegenRunning} className={btnGreen}>
          {codegenRunning ? "⏺ Codegen aktivan..." : "▶ Pokreni Codegen"}
        </button>
        {codegenRunning && (
          <button onClick={loadGeneratedCode} className={cn(btn, "!border-emerald-500/40 !text-emerald-400")}>
            Učitaj kod
          </button>
        )}
      </div>

      <div className="px-4 py-3 border-b border-white/[0.06] flex flex-wrap items-center gap-2 bg-white/[0.02]">
        <button onClick={improveCode} disabled={!agentOnline || !code.trim() || improvingCode} className={btnBlue}>
          {improvingCode ? "Prepravljam..." : "✨ Stellan prepravi kod"}
        </button>

        <button onClick={runDraft} disabled={!agentOnline || !code.trim() || runningPreview} className={btnViolet}>
          {runningPreview ? "Pokrećem..." : "▶ Pokreni probno"}
        </button>

        <button onClick={insertMarkerHere} disabled={!code.trim()} className={btn}>
          # Dodaj marker
        </button>

        <button onClick={markContinueHere} disabled={!code.trim()} className={btn}>
          📍 Nastavi ovdje
        </button>

        <button onClick={startLearning} disabled={!agentOnline || recording} className={btnAmber}>
          {recording ? "⏺ Učenje aktivno..." : "⏺ Snimaj nastavak"}
        </button>

        <button onClick={stopLearning} disabled={!agentOnline || !recording} className={btn}>
          ⏹ Zaustavi
        </button>

        <button onClick={mergeLearningIntoCode} disabled={!agentOnline || !code.trim()} className={cn(btn, "!text-white/85")}>
          ➕ Spoji nastavak u kod
        </button>

        <button onClick={saveCode} disabled={!code.trim()} className={cn(btn, "!text-white/85")}>
          💾 Spremi flow
        </button>

        <button onClick={learnFlow} disabled={!code.trim()} className={cn(btn, "!text-emerald-300")}>
          🧠 Nauči flow
        </button>

        {recording && (
          <span className="text-[11px] text-emerald-400/80">
            Snimljeno koraka: {recordedStepsCount}
          </span>
        )}

        {selectedFlow && <span className="text-[11px] text-white/35">Odabrano: {selectedFlow}.py</span>}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="w-56 shrink-0 border-r border-white/[0.06] flex flex-col bg-[#0b101b]">
          <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Skripte</span>
            <button onClick={refreshFlows} className="text-[10px] text-white/30 hover:text-white/60">↻</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {flows.map((name, i) => (
              <div
                key={i}
                onClick={() => selectFlow(name)}
                className={cn(
                  "px-3 py-2 text-[12px] cursor-pointer border-b border-white/[0.03] transition-colors",
                  selectedFlow === name ? "bg-emerald-500/10 text-emerald-400" : "text-white/50 hover:bg-white/[0.04]"
                )}
              >
                {name}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-white/[0.06] flex gap-1.5">
            <button onClick={runFlow} disabled={!selectedFlow || !agentOnline} className={cn(btn, "flex-1 text-center !text-[10px] !px-1")}>▶ Run</button>
            <button onClick={deleteFlow} disabled={!selectedFlow} className={cn(btn, "!text-[10px] !px-2 !text-red-400/70")}>✕</button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-[11px] text-white/40 font-medium">
                {selectedFlow ? `${selectedFlow}.py` : "Generirani / sirovi kod"}
              </span>
              <span className="text-[10px] text-white/25">
                Codegen → Prepravi → Označi nastavak → Snimaj → Spoji → Probno → Spremi
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              className="flex-1 min-h-0 resize-none bg-[#080c14] p-4 font-mono text-[12px] text-emerald-300/80 leading-relaxed focus:outline-none"
              placeholder={"Pokreni Codegen → klikaj po browseru → Učitaj kod\nZatim klikni: Stellan prepravi kod → Dodaj marker ili Nastavi ovdje → Snimaj nastavak → Spoji nastavak u kod → Pokreni probno → Spremi flow"}
              spellCheck={false}
            />
          </div>

          <div className="h-44 shrink-0 border-t border-white/[0.06]">
            <div className="px-3 py-1 border-b border-white/[0.04] flex items-center justify-between">
              <span className="text-[10px] text-white/30 font-medium">Log</span>
              {insertCursorPos !== null && (
                <span className="text-[10px] text-white/25">Pozicija nastavka: {insertCursorPos}</span>
              )}
            </div>
            <div ref={logRef} className="h-[calc(100%-24px)] overflow-y-auto px-3 py-1 font-mono text-[11px] leading-[1.6]">
              {logs.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-white/15 shrink-0">{e.time}</span>
                  <span className={cn(
                    e.msg.includes("✓") || e.msg.includes("online") ? "text-emerald-400/70" :
                    e.msg.includes("Greška") || e.msg.includes("error") ? "text-red-400/70" :
                    "text-white/40"
                  )}>{e.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
