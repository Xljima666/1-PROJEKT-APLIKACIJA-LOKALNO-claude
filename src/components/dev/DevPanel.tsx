import React, { useState, useEffect, useCallback } from "react";
import { 
  Play, Square, Download, Trash2, PlayCircle, Save, RefreshCw, 
  FileText, List, Terminal, Brain, Zap, ExternalLink, Eye, Plus 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ConsoleLog } from "./DevPanel";

interface DevPanelProps {
  consoleLogs: { t: string; msg: string }[];
  addLog?: (type: string, message: string) => void;
  devSteps?: Array<{
    id: string;
    action: string;
    label: string;
    status: "queued" | "running" | "done" | "error";
    detail?: string;
    target?: string;
  }>;
  onAction?: (action: "open" | "click" | "type" | "screenshot" | "learn", payload?: any) => void;
  isRecording?: boolean;
  setIsRecording?: (recording: boolean) => void;
  recordingName?: string;
  setRecordingName?: (name: string) => void;
  recordedSteps?: Array<{ n: number; url: string; desc: string; screenshot?: string }>;
  savedActions?: { name: string; description?: string; stepsCount?: number }[];
  onRunAction?: (name: string) => void;
  onSaveAction?: (name: string, description: string) => void;
  studioTab?: string;
  setStudioTab?: (tab: string) => void;
  projectRoot?: string;
  devPanelPreview?: any;
  onRefreshPreview?: () => void;
}

const DevPanel: React.FC<DevPanelProps> = ({
  consoleLogs = [],
  addLog,
  devSteps = [],
  onAction,
  isRecording = false,
  setIsRecording,
  recordingName = "",
  setRecordingName,
  recordedSteps = [],
  savedActions = [],
  onRunAction,
  onSaveAction,
  studioTab = "playwright",
  setStudioTab,
  projectRoot = "",
  devPanelPreview,
  onRefreshPreview,
}) => {
  const [activeTab, setActiveTab] = useState<"recorder" | "actions" | "console" | "memory">("recorder");
  const [newActionName, setNewActionName] = useState("");
  const [newActionDesc, setNewActionDesc] = useState("");

  const currentTab = setStudioTab ? studioTab : activeTab;
  const setCurrentTab = setStudioTab || ((tab: any) => setActiveTab(tab));

  const handleStartRecording = () => {
    const name = newActionName.trim() || recordingName || "nova_akcija_" + Date.now();
    if (setRecordingName) setRecordingName(name);
    if (setIsRecording) setIsRecording(true);
    if (onAction) onAction("learn");
    
    if (addLog) {
      addLog("info", `🎥 Počinje snimanje akcije: ${name}`);
      addLog("ok", "→ Pokreni u terminalu: npx playwright codegen https://sdge.dgu.hr");
      addLog("ok", "→ Radi normalno mišem i tipkovnicom. Sve se snima.");
      addLog("dim", "Kad završiš, zaustavi snimanje ovdje i akcija će biti spremljena.");
    }
  };

  const handleStopRecording = () => {
    if (setIsRecording) setIsRecording(false);
    
    if (addLog) {
      addLog("info", "⏹ Snimanje zaustavljeno");
      if (newActionName || recordingName) {
        addLog("success", `✅ Akcija "${newActionName || recordingName}" je spremljena i dostupna u "Saved Actions"`);
      }
    }

    if (onSaveAction && (newActionName || recordingName)) {
      onSaveAction(
        newActionName || recordingName, 
        newActionDesc || `Automatski snimljena akcija (${recordedSteps.length} koraka)`
      );
    }

    setNewActionName("");
    setNewActionDesc("");
  };

  const runSavedAction = (name: string) => {
    if (onRunAction) onRunAction(name);
    if (addLog) addLog("ok", `🚀 Pokrećem spremljenu akciju: ${name}`);
  };

  const clearConsole = () => {
    if (addLog) addLog("dim", "Konzola očišćena — novi logovi će se pojavljivati");
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-white overflow-hidden border-t border-white/10">
      <div className="border-b border-white/10 bg-zinc-900/80 backdrop-blur-lg p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-emerald-400" />
          <div>
            <h2 className="font-semibold text-xl tracking-tight">Dev Tab</h2>
            <p className="text-xs text-emerald-400/70 -mt-0.5">Visual Action Recorder + Runner</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {projectRoot && (
            <div className="px-3 py-1 bg-zinc-800 rounded-full font-mono text-emerald-300/70">
              {projectRoot.split("/").pop()}
            </div>
          )}
          <Button 
            onClick={onRefreshPreview}
            variant="outline" 
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-60 border-r border-white/10 bg-zinc-900 p-3 flex flex-col">
          <div className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 px-3 mb-2 mt-2">RECORDER</div>
          
          <button
            onClick={() => setCurrentTab("recorder")}
            className={cn(
              "w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 text-sm mb-1 transition-all",
              (currentTab === "recorder" || currentTab === "playwright") 
                ? "bg-white text-zinc-950 shadow-inner" 
                : "hover:bg-white/5"
            )}
          >
            <PlayCircle className="w-4 h-4" />
            Snimi novu akciju
          </button>

          <button
            onClick={() => setCurrentTab("actions")}
            className={cn(
              "w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 text-sm mb-1 transition-all",
              currentTab === "actions" 
                ? "bg-white text-zinc-950 shadow-inner" 
                : "hover:bg-white/5"
            )}
          >
            <List className="w-4 h-4" />
            Spremljene akcije
            {savedActions.length > 0 && <Badge className="ml-auto bg-emerald-500">{savedActions.length}</Badge>}
          </button>

          <div className="mt-auto">
            <div className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 px-3 mb-2">SYSTEM</div>
            <button
              onClick={() => setCurrentTab("console")}
              className={cn(
                "w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 text-sm mb-1 transition-all",
                currentTab === "console" 
                  ? "bg-white text-zinc-950 shadow-inner" 
                  : "hover:bg-white/5"
              )}
            >
              <Terminal className="w-4 h-4" />
              Console
            </button>
            <button
              onClick={() => setCurrentTab("memory")}
              className={cn(
                "w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 text-sm transition-all",
                currentTab === "memory" 
                  ? "bg-white text-zinc-950 shadow-inner" 
                  : "hover:bg-white/5"
              )}
            >
              <Brain className="w-4 h-4" />
              Memorija projekta
            </button>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {currentTab === "recorder" && (
            <div className="flex-1 p-8 overflow-auto bg-[radial-gradient(#27272a_0.8px,transparent_1px)] bg-[length:20px_20px]">
              <div className="max-w-[620px] mx-auto">
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-xs px-4 h-7 rounded-full mb-3">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    NOVI VISUAL RECORDER
                  </div>
                  <h1 className="text-4xl font-semibold tracking-tighter">Snimi što radiš</h1>
                  <p className="text-zinc-400 mt-3 text-lg">
                    Više ne moraš meni objašnjavati korake. Samo klikni "Start", otvori Chromium, radi normalno po portalima, a ja ću to pretvoriti u ponovljivu akciju.
                  </p>
                </div>

                <Card className="bg-zinc-900 border-white/10 shadow-2xl">
                  <CardContent className="p-8">
                    <div className="space-y-6">
                      <div>
                        <Label className="text-zinc-400">Ime akcije</Label>
                        <Input
                          value={newActionName}
                          onChange={(e) => setNewActionName(e.target.value)}
                          placeholder="sdge_povratnice_predmet"
                          className="mt-2 text-lg font-medium bg-zinc-950 border-white/20 h-14 placeholder:text-zinc-600"
                        />
                      </div>

                      <Button
                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                        className={cn(
                          "w-full h-16 text-lg font-medium transition-all",
                          isRecording 
                            ? "bg-red-600 hover:bg-red-700" 
                            : "bg-emerald-600 hover:bg-emerald-500"
                        )}
                        size="lg"
                      >
                        {isRecording ? (
                          <>
                            <Square className="mr-3 w-6 h-6" />
                            ZAUSTAVI SNIMANJE I SPREMI AKCIJU
                          </>
                        ) : (
                          <>
                            <Play className="mr-3 w-6 h-6" />
                            START RECORDING (Otvori Chromium)
                          </>
                        )}
                      </Button>

                      {isRecording && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center text-red-400">
                          Snimanje je aktivno.<br />
                          <span className="text-sm text-red-400/70 mt-2 block">Radi što trebaš u SDGE ili OSS portalu. Kad završiš klikni "Zaustavi snimanje".</span>
                        </div>
                      )}

                      {recordedSteps.length > 0 && (
                        <div className="pt-4 border-t border-white/10">
                          <div className="text-sm uppercase tracking-widest text-zinc-500 mb-4">Snimljeni koraci • {recordedSteps.length}</div>
                          <ScrollArea className="max-h-80 rounded-2xl border border-white/10 bg-black p-4 text-sm font-mono">
                            {recordedSteps.map((step, idx) => (
                              <div key={idx} className="py-2.5 border-b border-white/5 last:border-none flex gap-4">
                                <div className="text-emerald-400/70 font-medium w-6 flex-shrink-0">#{step.n}</div>
                                <div>{step.desc}</div>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {currentTab === "actions" && (
            <div className="p-8 overflow-auto">
              <div className="max-w-3xl mx-auto">
                <div className="flex justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-semibold">Spremljene akcije</h3>
                    <p className="text-zinc-400">Jedan klik = cijeli flow</p>
                  </div>
                  <Button onClick={() => setCurrentTab("recorder")} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Nova akcija
                  </Button>
                </div>

                {savedActions.length === 0 ? (
                  <Card className="p-16 text-center border-dashed border-white/20">
                    <PlayCircle className="w-16 h-16 mx-auto text-zinc-700 mb-6" />
                    <p className="text-xl text-zinc-400">Još nema akcija</p>
                    <p className="text-zinc-500 mt-2">Snimi prvu akciju gore</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {savedActions.map((action, i) => (
                      <Card key={i} className="bg-zinc-900 border-white/10 hover:border-emerald-500/30 group">
                        <CardContent className="p-6 flex items-center justify-between">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                              ▶
                            </div>
                            <div>
                              <div className="font-mono text-lg font-medium">{action.name}</div>
                              {action.description && <div className="text-zinc-400 text-sm mt-1">{action.description}</div>}
                            </div>
                          </div>
                          <Button onClick={() => runSavedAction(action.name)} size="lg" className="bg-emerald-600 hover:bg-emerald-500 px-8">
                            Pokreni
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentTab === "console" && (
            <div className="flex flex-col h-full">
              <div className="px-8 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900">
                <div className="font-medium flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> Live Console
                </div>
                <Button variant="ghost" size="sm" onClick={clearConsole}>Očisti</Button>
              </div>
              <ScrollArea className="flex-1 p-8 font-mono text-sm bg-zinc-950">
                {consoleLogs.map((log, i) => (
                  <div key={i} className={cn(
                    "py-1 px-3 -mx-3 rounded-xl",
                    log.t === "ok" && "text-emerald-400",
                    log.t === "error" && "text-red-400",
                    log.t === "info" && "text-sky-400",
                    log.t === "dim" && "text-zinc-500"
                  )}>
                    {log.msg}
                  </div>
                ))}
                {consoleLogs.length === 0 && (
                  <div className="text-zinc-600 italic text-center py-12">Konzola čeka prve logove...</div>
                )}
              </ScrollArea>
            </div>
          )}

          {currentTab === "memory" && (
            <div className="p-10">
              <Card className="max-w-2xl mx-auto bg-zinc-900 border-emerald-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Brain className="text-emerald-400" /> Projektna memorija
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-sm leading-relaxed">
                  <p>Od ovog trenutka pamtim cijeli kontekst ovog projekta:</p>
                  <ul className="list-disc pl-5 space-y-2 text-zinc-300">
                    <li>ChatDialog.tsx arhitektura i sve stateove za Dev Studio</li>
                    <li>Tvoja frustracija s ponavljanjem i želja za pravim vizualnim recorderom</li>
                    <li>Da sve promjene moraju biti kompletne datoteke (generate_file)</li>
                    <li>Da želiš Chromium recording ("pikaj i gotovo") umjesto verbalnog vođenja</li>
                    <li>Da Dev tab mora raditi odmah kad ga ubaciš</li>
                  </ul>
                  <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 text-xs font-mono text-emerald-300/80">
                    Sljedeći korak: pošalji mi GitHub link ili ZIP cijelog projekta pa ću ti reći točno koje datoteke još trebamo dotjerati da recorder stvarno otvara Playwright i sprema akcije u backend.
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right panel - Steps & Preview */}
        <div className="w-80 border-l border-white/10 bg-zinc-900 flex flex-col">
          <div className="p-5 border-b border-white/10">
            <div className="text-xs uppercase text-zinc-500 mb-4">PREVIEW</div>
            {devPanelPreview?.screenshotUrl ? (
              <img src={devPanelPreview.screenshotUrl} className="rounded-2xl border border-white/10" alt="preview" />
            ) : (
              <div className="aspect-video bg-zinc-950 rounded-3xl flex items-center justify-center border border-dashed border-white/20">
                <div className="text-center text-xs text-zinc-500">Screenshot preview će se pojaviti ovdje</div>
              </div>
            )}
          </div>

          <div className="flex-1 p-5 overflow-auto">
            <div className="uppercase text-xs text-zinc-500 mb-4">STEPS THIS SESSION</div>
            {devSteps && devSteps.length > 0 ? (
              devSteps.map((step, index) => (
                <div key={step.id || index} className="mb-6 last:mb-0">
                  <div className="flex gap-4">
                    <div className="font-mono text-emerald-400 w-6 text-right text-sm">{index + 1}</div>
                    <div className="flex-1">
                      <div className="text-sm">{step.label}</div>
                      {step.detail && <div className="text-[10px] text-zinc-500 mt-1">{step.detail}</div>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-zinc-500">Još nema koraka u ovom dev sessionu.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevPanel;
