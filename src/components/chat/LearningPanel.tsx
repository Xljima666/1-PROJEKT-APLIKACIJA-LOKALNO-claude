// LearningPanel.tsx — Učenje tab
// Radi s agent_server.py (port 8432 / ngrok)
// Browser se otvara VIDLJIV na PC-u, klikovi se snimaju

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface FlowData { name: string; steps: any[]; }
interface LogEntry { time: string; msg: string; }
interface LearningPanelProps { onClose: () => void; agentServerUrl?: string; }

export default function LearningPanel({ onClose, agentServerUrl }: LearningPanelProps) {
  const AGENT_URL = agentServerUrl || import.meta.env.VITE_AGENT_SERVER_URL || "";
  const AGENT_KEY = import.meta.env.VITE_AGENT_API_KEY || "";

  const [url, setUrl] = useState("https://oss.uredjenazemlja.hr");
  const [chatInput, setChatInput] = useState("");
  const [selectorInput, setSelectorInput] = useState("text=Poslovni korisnici");
  const [textInput, setTextInput] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [flows, setFlows] = useState<FlowData[]>([]);
  const [selectedFlowName, setSelectedFlowName] = useState<string | null>(null);
  const [currentFlowData, setCurrentFlowData] = useState<FlowData>({ name: "", steps: [] });
  const [isRecording, setIsRecording] = useState(false);
  const [recordStepCount, setRecordStepCount] = useState(0);
  const [preview, setPreview] = useState("");
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<any>(null);

  const log = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(prev => [...prev.slice(-300), { time, msg }]);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  // --- Agent API ---
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

  // --- Health check ---
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

  // --- Load flows ---
  const refreshFlows = useCallback(async () => {
    const result = await callAgent("record/list", {}, "GET");
    if (result?.success && Array.isArray(result.actions)) {
      setFlows(result.actions.map((a: any) => ({ name: a.name || a.file?.replace(".py", "") || "?", steps: [] })));
      log(`Učitano akcija: ${result.actions.length}`);
    }
  }, [callAgent, log]);

  useEffect(() => { if (agentOnline) refreshFlows(); }, [agentOnline, refreshFlows]);

  const setPreviewData = (data: any) => setPreview(typeof data === "string" ? data : JSON.stringify(data, null, 2));

  // ============ RECORDING POLL — snima klikove iz browsera ============

  useEffect(() => {
    if (isRecording) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await callAgent("record/poll", {}, "GET");
          if (res?.success && res.new_events?.length > 0) {
            for (const evt of res.new_events) {
              const desc = evt.action === "click" ? `CLICK: ${evt.selector}` :
                           evt.action === "fill" ? `TYPE: ${evt.selector} = "${evt.value}"` :
                           `${evt.action}: ${evt.selector || ""}`;
              log(`🔴 ${desc}`);
            }
            setRecordStepCount(res.total_steps || 0);
          }
        } catch { /* silent */ }
      }, 1500);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRecording, callAgent, log]);

  // ============ BROWSER ACTIONS ============

  const openBrowser = async () => {
    setBusy(true);
    log(`Otvaram browser: ${url}`);
    const res = await callAgent("playwright", { action: "navigate", url, timeout: 30000 });
    if (res?.success) log(`Browser otvoren: ${res.url || url}`);
    else log(`Greška: ${res?.error || "agent nedostupan"}`);
    setBusy(false);
  };

  const startRecording = async () => {
    const name = prompt("Ime akcije koju snimas (npr. sdge_login):");
    if (!name) return;
    setBusy(true);
    setCurrentFlowData({ name, steps: [] });
    log("Pokrećem snimanje...");
    const res = await callAgent("record/start", { name });
    if (res?.success) {
      setIsRecording(true);
      setRecordStepCount(0);
      log(`🔴 Snimanje pokrenuto: ${name} — klikaj po Chromiumu!`);
    } else {
      log(`Greška: ${res?.error || "agent nedostupan"}`);
    }
    setBusy(false);
  };

  const stopRecording = async () => {
    setIsRecording(false);
    log("Zaustavljam snimanje...");
    await callAgent("record/stop", {});
    if (currentFlowData.name) {
      const res = await callAgent("record/save", { name: currentFlowData.name });
      if (res?.success) {
        log(`✓ Akcija "${currentFlowData.name}" spremljena (${res.steps || 0} koraka)`);
        if (res.script) setPreviewData(res.script);
        setSelectedFlowName(currentFlowData.name);  // Auto-select
      } else {
        log(`Greška pri spremanju: ${res?.error || "nepoznato"}`);
      }
    }
    await refreshFlows();
  };

  const saveAs = async () => {
    const name = prompt("Spremi flow kao:");
    if (!name) return;
    const safeName = name.trim().replace(/\s+/g, "_");
    const res = await callAgent("record/save", { name: safeName });
    if (res?.success) { log(`Flow spremljen: ${name}`); if (res.script) setPreviewData(res.script); setSelectedFlowName(safeName); await refreshFlows(); }
    else log(`Greška: ${res?.error || "nepoznato"}`);
  };

  // Load script content when selecting a flow
  const selectFlow = async (name: string) => {
    setSelectedFlowName(name);
    log(`Odabran: ${name}`);
    const res = await callAgent("record/read", { name });
    if (res?.success && res.content) {
      setPreview(res.content);
    } else {
      setPreview(`# Flow: ${name}\n# Nije moguće učitati kod.\n# ${res?.error || ""}`);
    }
  };

  // Save edited code back to file
  const saveFlowCode = async () => {
    if (!selectedFlowName || !preview.trim()) { log("Nema što spremiti."); return; }
    const res = await callAgent("record/write", { name: selectedFlowName, content: preview });
    if (res?.success) log(`✓ Kod spremljen: ${selectedFlowName}.py`);
    else log(`Greška: ${res?.error || "nepoznato"}`);
  };

  const runSelectedFlow = async () => {
    if (!selectedFlowName) { log("Odaberi flow za pokretanje."); return; }
    setBusy(true);
    log(`Pokrećem flow: ${selectedFlowName}`);
    const res = await callAgent("record/run", { name: selectedFlowName });
    if (res?.success) { log(`Flow "${selectedFlowName}" izvršen ✓`); if (res.stdout) log(res.stdout.slice(0, 500)); }
    else log(`Greška: ${res?.error || "nepoznato"}`);
    setBusy(false);
  };

  const deleteFlow = async () => {
    if (!selectedFlowName) { log("Odaberi flow."); return; }
    if (!confirm(`Obrisati "${selectedFlowName}"?`)) return;
    const res = await callAgent("record/delete", { name: selectedFlowName });
    if (res?.success) { log(`Obrisano: ${selectedFlowName}`); setSelectedFlowName(null); setPreview(""); await refreshFlows(); }
    else log(`Greška: ${res?.error || "nepoznato"}`);
  };

  // ============ MANUAL CONTROLS ============

  const manualClick = async () => {
    if (!selectorInput.trim()) return;
    setBusy(true); log(`Manual click: ${selectorInput}`);
    const res = await callAgent("playwright", { action: "click", selector: selectorInput, timeout: 15000 });
    if (res?.success) log(`Kliknuto: ${selectorInput}`);
    else log(`Greška: ${res?.error || "klik nije uspio"}`);
    setBusy(false);
  };

  const manualType = async () => {
    if (!selectorInput.trim()) return;
    setBusy(true); log(`Manual type: ${selectorInput} = ${textInput}`);
    const res = await callAgent("playwright", { action: "type", selector: selectorInput, value: textInput, timeout: 15000 });
    if (res?.success) log(`Upisano: ${selectorInput}`);
    else log(`Greška: ${res?.error || "unos nije uspio"}`);
    setBusy(false);
  };

  const pageState = async () => {
    setBusy(true);
    const res = await callAgent("playwright", { action: "extract", timeout: 15000 });
    if (res?.success) { setPreviewData({ url: res.url || "", title: res.title || "", text: (res.content || "").slice(0, 3000) }); log("Prikazano stanje stranice."); }
    else log(`Greška: ${res?.error || "ne mogu očitati"}`);
    setBusy(false);
  };

  // ============ AI CHAT PARSER — razumije hr + en ============

  const parseAndExecute = async (text: string) => {
    const t = text.trim();
    const low = t.toLowerCase();
    if (!t) return;
    log(`TI: ${t}`);

    // Open browser
    if (/^(open|open browser|otvori browser|pokreni browser)$/i.test(low)) {
      await openBrowser(); return;
    }

    // Navigate — idi na / odi na / otvori
    const navMatch = t.match(/^(idi na|odi na|otvori|go to|navigate)\s+(.+)$/i);
    if (navMatch) {
      let navUrl = navMatch[2].trim();
      if (!/^https?:\/\//.test(navUrl)) {
        if (navUrl.includes(".")) navUrl = "https://" + navUrl;
        else if (/oss/i.test(navUrl)) navUrl = "https://oss.uredjenazemlja.hr";
        else if (/sdge/i.test(navUrl)) navUrl = "https://sdge.dgu.hr";
        else navUrl = "https://" + navUrl;
      }
      setUrl(navUrl); setBusy(true);
      const res = await callAgent("playwright", { action: "navigate", url: navUrl, timeout: 30000 });
      if (res?.success) log(`STELLAN: Otvorio ${res.url || navUrl}`);
      else log(`STELLAN: Greška — ${res?.error || "navigacija nije uspjela"}`);
      setBusy(false); return;
    }

    // Start recording
    if (/snimaj|pokreni snimanje|start record/i.test(low)) { await startRecording(); return; }

    // Stop recording
    if (/zaustavi snimanje|stop record|^stop$/i.test(low)) { await stopRecording(); return; }

    // Click
    const clickMatch = t.match(/^(klikni|klikni na|click|pritisni)\s+(.+)$/i);
    if (clickMatch) {
      const label = clickMatch[2].trim();
      setSelectorInput(`text=${label}`); setBusy(true);
      const res = await callAgent("playwright", { action: "click", selector: `text=${label}`, timeout: 15000 });
      if (res?.success) log(`STELLAN: Kliknuo ${label}`);
      else log(`STELLAN: Greška — ${res?.error || "klik nije uspio"}`);
      setBusy(false); return;
    }

    // Type: "upiši VALUE u SELECTOR"
    const typeMatch = t.match(/^(upi[sš]i|unesi|type)\s+(.+?)\s+(u|in|into)\s+(.+)$/i);
    if (typeMatch) {
      const value = typeMatch[2].trim().replace(/^"|"$/g, "");
      const selector = typeMatch[4].trim();
      setSelectorInput(selector); setTextInput(value); setBusy(true);
      const res = await callAgent("playwright", { action: "type", selector, value, timeout: 15000 });
      if (res?.success) log(`STELLAN: Upisao "${value}" u ${selector}`);
      else log(`STELLAN: Greška — ${res?.error}`);
      setBusy(false); return;
    }

    // Page state
    if (/stanje|page state|^state$/i.test(low)) { await pageState(); return; }

    // Run flow
    const flowMatch = t.match(/^(pokreni flow|run flow|pokreni)\s+(.+)$/i);
    if (flowMatch) {
      const name = flowMatch[2].trim().replace(/\s+/g, "_");
      setBusy(true); log(`STELLAN: Pokrećem flow ${name}...`);
      const res = await callAgent("record/run", { name });
      if (res?.success) log(`STELLAN: Flow ${name} izvršen ✓`);
      else log(`STELLAN: Greška — ${res?.error || "flow nije pronađen"}`);
      setBusy(false); return;
    }

    // Save flow
    if (low.startsWith("spremi flow kao ") || low.startsWith("save flow ")) {
      const name = t.split(" ").slice(3).join("_").trim();
      const res = await callAgent("record/save", { name });
      if (res?.success) { log(`STELLAN: Spremio flow: ${name}`); await refreshFlows(); }
      return;
    }

    // Screenshot
    if (/^(screenshot|snimku|snimka)$/i.test(low)) {
      setBusy(true);
      const res = await callAgent("playwright", { action: "screenshot", timeout: 15000 });
      if (res?.success) log("STELLAN: Screenshot ✓");
      else log(`STELLAN: Greška — ${res?.error}`);
      setBusy(false); return;
    }

    log("STELLAN: Ne kužim. Primjeri: 'idi na sdge.dgu.hr', 'odi na oss.uredjenazemlja.hr', 'klikni Prijava', 'upiši marko u [name=\"username\"]', 'pokreni snimanje', 'pokreni flow demo_oss'");
  };

  const sendChat = () => { const t = chatInput.trim(); if (!t) return; setChatInput(""); parseAndExecute(t); };

  // ============ STYLES ============
  const inputStyle = "w-full bg-white/[0.05] border border-white/[0.10] rounded px-3 py-1.5 text-[13px] text-white/85 placeholder-white/25 focus:outline-none focus:border-emerald-500/50 transition-colors";
  const btnStyle = "px-3 py-1.5 rounded border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] text-[12px] text-white/70 hover:text-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap";
  const labelStyle = "text-[12px] text-white/50 font-medium";
  const sectionBorder = "border border-white/[0.08] rounded-lg";

  // ============ RENDER ============
  return (
    <div className="flex flex-col h-full bg-[#0a0e17] text-white overflow-hidden select-none">
      {/* TITLE BAR */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] bg-[#0d1220]">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span className="text-[13px] font-semibold text-white/90">Stellan AI Chat Suite</span>
          <div className="flex items-center gap-1.5 ml-3">
            <div className={cn("w-2 h-2 rounded-full", agentOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : agentOnline === false ? "bg-red-400" : "bg-white/20")} />
            <span className="text-[10px] text-white/35">{agentOnline ? "Agent online" : agentOnline === false ? "Agent offline" : "..."}</span>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.08] transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* URL BAR */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06]">
        <span className={labelStyle}>URL</span>
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && openBrowser()} className={cn(inputStyle, "flex-1")} />
        <button onClick={openBrowser} disabled={busy || !agentOnline} className={btnStyle}>Open Browser</button>
      </div>

      {/* RECORDING CONTROLS */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
        <button onClick={startRecording} disabled={busy || !agentOnline || isRecording} className={cn(btnStyle, isRecording && "opacity-40")}>Start Recording</button>
        <button onClick={stopRecording} disabled={!isRecording} className={cn(btnStyle, isRecording && "!border-red-500/40 !text-red-400 !bg-red-500/10")}>Stop Recording</button>
        <button onClick={saveAs} disabled={busy || !agentOnline} className={btnStyle}>Save As</button>
        <button onClick={runSelectedFlow} disabled={busy || !agentOnline || !selectedFlowName} className={btnStyle}>Run Selected Flow</button>
        <button onClick={deleteFlow} disabled={!selectedFlowName} className={btnStyle}>Delete Flow</button>
        {isRecording && (
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] text-red-400 font-medium">REC · {recordStepCount} koraka</span>
          </div>
        )}
        {busy && !isRecording && (
          <div className="ml-auto flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-emerald-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span className="text-[11px] text-emerald-400/60">Radi...</span>
          </div>
        )}
      </div>

      {/* AI CHAT */}
      <div className={cn("mx-4 mt-3 p-3", sectionBorder)}>
        <div className="text-[11px] text-white/40 mb-2 font-medium">AI Chat (upišeš → on radi)</div>
        <div className="flex items-center gap-2">
          <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} disabled={busy} className={cn(inputStyle, "flex-1")} placeholder="'idi na sdge.dgu.hr', 'klikni Prijava', 'pokreni flow demo_oss'" />
          <button onClick={sendChat} disabled={busy || !chatInput.trim()} className={btnStyle}>Pošalji</button>
        </div>
      </div>

      {/* MANUAL CONTROLS */}
      <div className={cn("mx-4 mt-2.5 p-3", sectionBorder)}>
        <div className="text-[11px] text-white/40 mb-2 font-medium">Manual Controls</div>
        <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 items-center">
          <span className={labelStyle}>Selector</span>
          <input type="text" value={selectorInput} onChange={e => setSelectorInput(e.target.value)} className={inputStyle} />
          <button onClick={manualClick} disabled={busy || !agentOnline || !selectorInput.trim()} className={btnStyle}>Click</button>
          <span className={labelStyle}>Text</span>
          <input type="text" value={textInput} onChange={e => setTextInput(e.target.value)} className={inputStyle} />
          <div className="flex gap-2">
            <button onClick={manualType} disabled={busy || !agentOnline || !selectorInput.trim()} className={btnStyle}>Type</button>
            <button onClick={pageState} disabled={busy || !agentOnline} className={btnStyle}>Page State</button>
          </div>
        </div>
      </div>

      {/* SAVED FLOWS | PREVIEW | LOG */}
      <div className="flex-1 flex mx-4 mt-2.5 mb-3 gap-3 min-h-0 overflow-hidden">
        {/* Saved Flows */}
        <div className="w-48 flex flex-col shrink-0">
          <div className="text-[11px] text-white/40 font-medium mb-1.5">Saved Flows</div>
          <div className={cn("flex-1 overflow-y-auto min-h-0", sectionBorder)}>
            {flows.length === 0 ? (
              <div className="p-3 text-[11px] text-white/20 text-center">Nema flowova</div>
            ) : flows.map((flow, i) => (
              <div key={i} onClick={() => selectFlow(flow.name)}
                className={cn("px-3 py-2 text-[12px] cursor-pointer border-b border-white/[0.04] transition-colors",
                  selectedFlowName === flow.name ? "bg-emerald-500/10 text-emerald-400" : "text-white/55 hover:bg-white/[0.04]"
                )}>
                {flow.name}
              </div>
            ))}
          </div>
          <button onClick={refreshFlows} disabled={!agentOnline} className={cn(btnStyle, "mt-1.5 w-full text-center")}>Refresh</button>
        </div>

        {/* Preview + Log */}
        <div className="flex-1 flex flex-col min-w-0 gap-2.5">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-white/40 font-medium">Flow / State Preview</span>
              {selectedFlowName && preview.trim() && (
                <button onClick={saveFlowCode} className={cn(btnStyle, "!py-0.5 !px-2 !text-[10px]")}>
                  Spremi kod
                </button>
              )}
            </div>
            <textarea value={preview} onChange={e => setPreview(e.target.value)}
              className={cn("flex-1 min-h-0 resize-none font-mono text-[12px] text-white/60 leading-relaxed p-3", sectionBorder, "bg-white/[0.02] focus:outline-none focus:border-emerald-500/30")}
              placeholder="Odaberi flow ili klikni Page State..." spellCheck={false} />
          </div>
          <div className="h-[35%] flex flex-col min-h-0 shrink-0">
            <div className="text-[11px] text-white/40 font-medium mb-1.5">Log</div>
            <div ref={logRef} className={cn("flex-1 min-h-0 overflow-y-auto p-3 font-mono text-[11px] leading-[1.7]", sectionBorder, "bg-white/[0.02]")}>
              {logs.length === 0 ? <span className="text-white/15">Spreman za rad.</span> :
                logs.map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-white/20 shrink-0">{e.time}</span>
                    <span className={cn("break-words",
                      e.msg.startsWith("TI:") ? "text-amber-400/80" :
                      e.msg.startsWith("STELLAN:") ? "text-emerald-400/80" :
                      e.msg.startsWith("🔴") ? "text-red-400/90" :
                      e.msg.includes("Greška") || e.msg.includes("error") ? "text-red-400/80" :
                      e.msg.includes("✓") || e.msg.includes("online") ? "text-emerald-400/70" :
                      "text-white/50"
                    )}>{e.msg}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
