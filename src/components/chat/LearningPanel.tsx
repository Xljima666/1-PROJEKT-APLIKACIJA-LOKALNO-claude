// LearningPanel.tsx — Učenje tab
// Pokreće Playwright Codegen na PC-u i prikazuje generirani kod

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface LogEntry { time: string; msg: string; }
interface LearningPanelProps { onClose: () => void; agentServerUrl?: string; }

export default function LearningPanel({ onClose, agentServerUrl }: LearningPanelProps) {
  const AGENT_URL = agentServerUrl || import.meta.env.VITE_AGENT_SERVER_URL || "";
  const AGENT_KEY = import.meta.env.VITE_AGENT_API_KEY || "";

  const [url, setUrl] = useState("https://sdge.dgu.hr");
  const [code, setCode] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [codegenRunning, setCodegenRunning] = useState(false);
  const [flows, setFlows] = useState<string[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const log = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(prev => [...prev.slice(-200), { time, msg }]);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  const callAgent = useCallback(async (endpoint: string, body: object = {}, method: "POST" | "GET" = "POST") => {
    if (!AGENT_URL) { log("AGENT_SERVER_URL nije postavljen!"); return null; }
    try {
      const res = await fetch(`${AGENT_URL}/${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json", "X-API-Key": AGENT_KEY, "ngrok-skip-browser-warning": "true" },
        body: method === "GET" ? undefined : JSON.stringify(body),
      });
      return await res.json();
    } catch (e: any) { log(`Agent greška: ${e.message}`); return null; }
  }, [AGENT_URL, AGENT_KEY, log]);

  // Health check
  useEffect(() => {
    if (!AGENT_URL) return;
    (async () => {
      try {
        const res = await fetch(`${AGENT_URL}/health`, { headers: { "ngrok-skip-browser-warning": "true" } });
        setAgentOnline(res.ok);
        if (res.ok) log("Agent online ✓");
      } catch { setAgentOnline(false); }
    })();
  }, [AGENT_URL, log]);

  // Load saved scripts
  const refreshFlows = useCallback(async () => {
    const res = await callAgent("record/list", {}, "GET");
    if (res?.success && Array.isArray(res.actions)) {
      setFlows(res.actions.map((a: any) => a.name || a.file?.replace(".py", "") || "?"));
      log(`Učitano skripti: ${res.actions.length}`);
    }
  }, [callAgent, log]);

  useEffect(() => { if (agentOnline) refreshFlows(); }, [agentOnline, refreshFlows]);

  // ===== CODEGEN =====
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
      log("✓ Kod učitan!");
    } else {
      log(`${res?.error || "Nema koda — zatvori Codegen prozor pa probaj opet."}`);
    }
  };

  // Load flow script
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

  // Save edited code
  const saveCode = async () => {
    const name = selectedFlow || prompt("Spremi kao (ime bez .py):");
    if (!name) return;
    const res = await callAgent("record/write", { name, content: code });
    if (res?.success) { log(`✓ Spremljeno: ${name}.py`); setSelectedFlow(name); await refreshFlows(); }
    else log(`Greška: ${res?.error}`);
  };

  // Run flow
  const runFlow = async () => {
    if (!selectedFlow) { log("Odaberi skriptu."); return; }
    log(`Pokrećem: ${selectedFlow}...`);
    const res = await callAgent("record/run", { name: selectedFlow });
    if (res?.success) { log(`✓ ${selectedFlow} izvršen`); if (res.stdout) log(res.stdout.slice(0, 400)); }
    else log(`Greška: ${res?.error}`);
  };

  // Delete flow
  const deleteFlow = async () => {
    if (!selectedFlow) return;
    if (!confirm(`Obrisati "${selectedFlow}"?`)) return;
    await callAgent("record/delete", { name: selectedFlow });
    setSelectedFlow(null); setCode(""); await refreshFlows();
    log(`Obrisano: ${selectedFlow}`);
  };

  // Styles
  const btn = "px-3 py-1.5 rounded border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] text-[12px] text-white/70 hover:text-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap";
  const btnGreen = "px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-medium transition-colors disabled:opacity-40";
  const input = "bg-white/[0.05] border border-white/[0.10] rounded px-3 py-1.5 text-[13px] text-white/85 placeholder-white/25 focus:outline-none focus:border-emerald-500/50";

  return (
    <div className="flex flex-col h-full bg-[#0a0e17] text-white overflow-hidden">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-[#0d1220]">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span className="text-[13px] font-semibold text-white/90">Učenje</span>
          <div className="flex items-center gap-1.5 ml-2">
            <div className={cn("w-2 h-2 rounded-full", agentOnline ? "bg-emerald-400" : "bg-red-400")} />
            <span className="text-[10px] text-white/35">{agentOnline ? "Agent online" : "Agent offline"}</span>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.08]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* CODEGEN LAUNCHER */}
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

      {/* MAIN: Flows | Code | Log */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* LEFT: Saved Scripts */}
        <div className="w-48 shrink-0 border-r border-white/[0.06] flex flex-col">
          <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Skripte</span>
            <button onClick={refreshFlows} className="text-[10px] text-white/30 hover:text-white/60">↻</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {flows.map((name, i) => (
              <div key={i} onClick={() => selectFlow(name)}
                className={cn("px-3 py-2 text-[12px] cursor-pointer border-b border-white/[0.03] transition-colors",
                  selectedFlow === name ? "bg-emerald-500/10 text-emerald-400" : "text-white/50 hover:bg-white/[0.04]"
                )}>
                {name}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-white/[0.06] flex gap-1.5">
            <button onClick={runFlow} disabled={!selectedFlow || !agentOnline} className={cn(btn, "flex-1 text-center !text-[10px] !px-1")}>▶ Run</button>
            <button onClick={deleteFlow} disabled={!selectedFlow} className={cn(btn, "!text-[10px] !px-2 !text-red-400/70")}>✕</button>
          </div>
        </div>

        {/* CENTER: Code Editor + Log */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Code */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-[11px] text-white/40 font-medium">
                {selectedFlow ? `${selectedFlow}.py` : "Generirani kod"}
              </span>
              {code.trim() && (
                <button onClick={saveCode} className={cn(btn, "!py-0.5 !text-[10px]")}>Spremi</button>
              )}
            </div>
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              className="flex-1 min-h-0 resize-none bg-[#080c14] p-4 font-mono text-[12px] text-emerald-300/80 leading-relaxed focus:outline-none"
              placeholder={"Pokreni Codegen → klikaj po browseru → Učitaj kod\n\nIli klikni na skriptu lijevo."}
              spellCheck={false}
            />
          </div>

          {/* Log */}
          <div className="h-32 shrink-0 border-t border-white/[0.06]">
            <div className="px-3 py-1 border-b border-white/[0.04]">
              <span className="text-[10px] text-white/30 font-medium">Log</span>
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
