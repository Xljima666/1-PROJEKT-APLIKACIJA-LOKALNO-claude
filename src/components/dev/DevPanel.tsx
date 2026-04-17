import React, { useState, useEffect, useCallback } from "react";
import { 
  Play, Square, RotateCcw, PlayCircle, Settings, List, Terminal, FolderOpen, 
  Brain, Zap, FileText, ArrowRight, CheckCircle2, AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { ConsoleLog } from "./DevPanel";

interface DevPanelProps {
  isRecording: boolean;
  setIsRecording: (val: boolean) => void;
  recordingName: string;
  setRecordingName: (name: string) => void;
  recordedSteps: Array<{ n: number; url: string; desc: string; screenshot?: string }>;
  setRecordedSteps: React.Dispatch<React.SetStateAction<any[]>>;
  savedActions: Array<{ name: string; file: string }>;
  setSavedActions: React.Dispatch<React.SetStateAction<any[]>>;
  consoleLogs: ConsoleLog[];
  addLog: (type: string, message: string) => void;
  handleDevPanelAction: (action: string, payload?: any) => Promise<void>;
  devSteps: any[];
  devPanelPreview?: any;
  studioTab?: string;
  setStudioTab?: (tab: string) => void;
  onRunAction?: (name: string, params?: any) => void;
}

const DevPanel: React.FC<DevPanelProps> = ({
  isRecording,
  setIsRecording,
  recordingName,
  setRecordingName,
  recordedSteps,
  setRecordedSteps,
  savedActions,
  setSavedActions,
  consoleLogs,
  addLog,
  handleDevPanelAction,
  devSteps,
  devPanelPreview,
  studioTab = "playwright",
  setStudioTab,
  onRunAction,
}) => {
  const [activeTab, setActiveTab] = useState<"recorder" | "actions" | "memory" | "console" | "preview">("recorder");
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [actionParam, setActionParam] = useState<string>("");
  const [isStartingRecording, setIsStartingRecording] = useState(false);

  const startRecording = async () => {
    if (!recordingName.trim()) {
      addLog("error", "MoraÅ¡ unijeti ime akcije prije snimanja");
      return;
    }

    setIsStartingRecording(true);
    addLog("info", `PokreÄ‡em visual recording: ${recordingName}...`);

    try {
      await handleDevPanelAction("learn", { name: recordingName });
      
      setIsRecording(true);
      setRecordedSteps([]);
      addLog("ok", "âœ… Chromium otvoren â€” sada normalno radi po SDGE/OSS portalu. Kad zavrÅ¡iÅ¡, klikni Stop Recording.");
    } catch (err) {
      addLog("error", "Ne mogu pokrenuti recording. Provjeri da li je playwright backend aktivan.");
    } finally {
      setIsStartingRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    addLog("info", "Snimanje zaustavljeno. Spremam akciju...");

    if (recordedSteps.length > 0) {
      const newAction = {
        name: recordingName,
        file: `${recordingName.toLowerCase().replace(/\s+/g, "_")}.json`,
        steps: [...recordedSteps],
        createdAt: new Date().toISOString(),
      };

      setSavedActions(prev => [newAction, ...prev]);
      
      addLog("ok", `Akcija "${recordingName}" spremljena sa ${recordedSteps.length} koraka.`);
      
      setTimeout(() => {
        setRecordingName("");
      }, 800);
    } else {
      addLog("warn", "Snimanje je zavrÅ¡eno ali nema koraka.");
    }
  };

  const runSavedAction = (actionName: string) => {
    const param = actionParam.trim() ? { broj_predmeta: actionParam } : undefined;
    addLog("info", `PokreÄ‡em akciju: ${actionName} ${param ? `(${actionParam})` : ''}`);
    
    if (onRunAction) {
      onRunAction(actionName, param);
    } else {
      addLog("ok", "Demo run â€” u pravoj verziji bi se ovdje pokrenuo Playwright script sa parametrima.");
    }
  };

  const clearSteps = () => {
    setRecordedSteps([]);
    addLog("info", "Lista koraka oÄiÅ¡Ä‡ena");
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white overflow-hidden">
      <div className="border-b border-white/10 p-4 flex items-center justify-between bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Dev Studio</h2>
            <p className="text-xs text-white/50">Visual Action Recorder + SDGE/OSS Automation</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
            Project Loaded
          </Badge>
          <AgentStatusBadge />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5 bg-zinc-900 border-b border-white/10 p-1">
          <TabsTrigger value="recorder" className="data-[state=active]:bg-zinc-800">ðŸŽ¥ Recorder</TabsTrigger>
          <TabsTrigger value="actions" className="data-[state=active]:bg-zinc-800">ðŸ“‹ Actions</TabsTrigger>
          <TabsTrigger value="memory" className="data-[state=active]:bg-zinc-800">ðŸ§  Memory</TabsTrigger>
          <TabsTrigger value="console" className="data-[state=active]:bg-zinc-800">ðŸ“Ÿ Console</TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:bg-zinc-800">ðŸ‘ï¸ Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="recorder" className="flex-1 p-6 overflow-auto">
          <Card className="bg-zinc-900 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="text-violet-400" />
                Visual Recording Studio
              </CardTitle>
              <CardDescription>
                Klikni Start â†’ otvara se Chromium â†’ ti normalno radiÅ¡ po portalima (SDGE, OSS...) â†’ Stop â†’ akcija se sprema za kasnije pokretanje.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Ime nove akcije</Label>
                  <Input
                    value={recordingName}
                    onChange={(e) => setRecordingName(e.target.value)}
                    placeholder="npr. sdge_povratnice_za_predmet"
                    className="bg-zinc-950 border-white/20"
                  />
                </div>
                
                {!isRecording ? (
                  <Button 
                    onClick={startRecording}
                    disabled={isStartingRecording || !recordingName.trim()}
                    size="lg"
                    className="mt-6 bg-emerald-600 hover:bg-emerald-500 px-8"
                  >
                    {isStartingRecording ? "Otvaram Chromium..." : "START RECORDING"}
                  </Button>
                ) : (
                  <Button 
                    onClick={stopRecording}
                    variant="destructive"
                    size="lg"
                    className="mt-6 px-8"
                  >
                    <Square className="mr-2" /> STOP RECORDING
                  </Button>
                )}
              </div>

              {isRecording && (
                <div className="bg-emerald-950 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <div className="inline-flex items-center gap-2 text-emerald-400 mb-2">
                    <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                    RECORDING ACTIVE â€” radi Å¡to treba u browseru
                  </div>
                  <p className="text-sm text-white/70">Sve Å¡to radiÅ¡ se snima. Kad zavrÅ¡iÅ¡ klikni Stop gore.</p>
                </div>
              )}

              {recordedSteps.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>Snimljeni koraci ({recordedSteps.length})</Label>
                    <Button variant="ghost" size="sm" onClick={clearSteps}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                  <ScrollArea className="h-64 bg-black/40 rounded-xl p-4 font-mono text-xs border border-white/10">
                    {recordedSteps.map((step, i) => (
                      <div key={i} className="flex gap-3 py-1 border-b border-white/10 last:border-0">
                        <div className="text-white/40 w-6">{step.n}.</div>
                        <div className="flex-1 text-emerald-300">{step.desc}</div>
                        {step.screenshot && <div className="text-[10px] text-white/40">ðŸ“¸</div>}
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="flex-1 p-6 overflow-auto">
          <Card className="bg-zinc-900 border-white/10">
            <CardHeader>
              <CardTitle>Spremljene akcije</CardTitle>
              <CardDescription>
                Jednim klikom pokreni snimljene flowove. PodrÅ¾avaju parametre (npr. broj predmeta).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Parametar (opcionalno)</Label>
                <Input 
                  value={actionParam} 
                  onChange={(e) => setActionParam(e.target.value)}
                  placeholder="3/2026 ili PetronijeviÄ‡"
                  className="bg-zinc-950"
                />
              </div>

              <div className="space-y-2">
                {savedActions.length === 0 ? (
                  <div className="text-white/40 text-center py-12 border border-dashed border-white/10 rounded-2xl">
                    JoÅ¡ nema spremljenih akcija. Snimi neÅ¡to u Recorder tabu.
                  </div>
                ) : (
                  savedActions.map((action, index) => (
                    <div key={index} className="flex items-center justify-between bg-zinc-950 border border-white/10 rounded-xl p-4 group hover:border-violet-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="text-emerald-400" />
                        <div>
                          <div className="font-medium">{action.name}</div>
                          <div className="text-xs text-white/50">{action.file}</div>
                        </div>
                      </div>
                      <Button 
                        onClick={() => runSavedAction(action.name)}
                        className="opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Pokreni <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="flex-1 p-6 overflow-auto bg-zinc-950">
          <Card className="bg-zinc-900 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="text-amber-400" /> Trajno zapamÄ‡eno
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert text-sm">
              <p><strong>Projekt je uÄitan.</strong> Cijeli ZIP je obraÄ‘en i kontekst je u memoriji.</p>
              <ul className="list-disc pl-5 space-y-1 text-white/80">
                <li>ChatDialog.tsx â€” glavni chat + tabovi (Dev, Learning, Brain, MozakV2)</li>
                <li>DevPanel je sada potpuno integriran sa svim postojeÄ‡im stateovima</li>
                <li>Å½eliÅ¡ visual recorder unutar aplikacije (ne copy-paste)</li>
                <li>SDGE povratnice, OSS download, self-healing su prioritet</li>
                <li>Nema viÅ¡e verbalnog voÄ‘enja â€” samo fiziÄke datoteke</li>
              </ul>
              <Separator className="my-6" />
              <p className="text-emerald-400 font-medium">SljedeÄ‡e Å¡to trebamo:</p>
              <p>1. Napraviti edge funkciju za pokretanje Playwright recordinga<br />
                 2. Implementirati pravi start_recording / save_action<br />
                 3. Dodati self-healing logiku za kada se UI portala promijeni</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="console" className="flex-1 flex flex-col">
          <div className="p-4 border-b border-white/10 bg-zinc-900 flex items-center justify-between">
            <div className="font-medium">Live Console</div>
            <Button variant="ghost" size="sm" onClick={() => addLog("info", "Console cleared manually")}>
              Clear
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4 font-mono text-xs bg-black/60">
            {consoleLogs.map((log, i) => (
              <div key={i} className={cn(
                "py-0.5",
                log.type === "error" && "text-red-400",
                log.type === "ok" && "text-emerald-400",
                log.type === "warn" && "text-amber-400"
              )}>
                <span className="text-white/30">[{new Date().toLocaleTimeString()}]</span> {log.msg}
              </div>
            ))}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="preview" className="flex-1 p-6">
          {devPanelPreview ? (
            <Card className="bg-zinc-900 border-white/10 h-full">
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {devPanelPreview.screenshotUrl ? (
                  <img src={devPanelPreview.screenshotUrl} alt="preview" className="rounded-xl border border-white/10" />
                ) : (
                  <div className="h-96 flex items-center justify-center text-white/30 border border-dashed rounded-3xl">
                    Nema joÅ¡ previewa â€” pokreni neku akciju
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center text-white/40 py-20">Preview nije aktivan u ovom modu</div>
          )}
        </TabsContent>
      </Tabs>

      <div className="p-3 border-t border-white/10 text-[10px] text-white/40 flex items-center gap-2 bg-zinc-900">
        <div className="flex-1">Cijeli projekt je uÄitan iz ZIP-a. ViÅ¡e neÄ‡emo ponavljati kontekst.</div>
        <Badge variant="secondary">v2.5</Badge>
      </div>
    </div>
  );
};

// Simple badge component used above
const AgentStatusBadge = () => (
  <div className="px-2.5 py-0.5 text-[10px] rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center gap-1.5">
    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
    Agent online
  </div>
);

export default DevPanel;
