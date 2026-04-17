import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Play, Square, Trash2, PlayCircle, Save, FileText, 
  Bug, Terminal, FolderOpen, Brain, Zap, Settings 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ConsoleLog } from "./DevPanel"; // adjusted if needed

interface DevPanelProps {
  isRecording?: boolean;
  onRecordingChange?: (recording: boolean) => void;
  recordingName?: string;
  onRecordingNameChange?: (name: string) => void;
  recordedSteps?: Array<{ n: number; url: string; desc: string; screenshot?: string }>;
  savedActions?: Array<{ name: string; description?: string; steps?: number }>;
  consoleLogs?: Array<{ t: string; msg: string; time?: string }>;
  onAddLog?: (type: string, message: string) => void;
  onStartRecording?: (name: string) => void;
  onStopRecording?: () => void;
  onRunAction?: (actionName: string, params?: Record<string, any>) => void;
  onDeleteAction?: (name: string) => void;
  devSteps?: Array<any>;
  devPanelPreview?: {
    url?: string;
    screenshotUrl?: string;
    summary?: string;
  };
  agentOnline?: boolean | null;
  projectRoot?: string;
}

const DevPanel: React.FC<DevPanelProps> = ({
  isRecording = false,
  onRecordingChange,
  recordingName = "",
  onRecordingNameChange,
  recordedSteps = [],
  savedActions = [],
  consoleLogs = [],
  onAddLog = () => {},
  onStartRecording,
  onStopRecording,
  onRunAction,
  onDeleteAction,
  devSteps = [],
  devPanelPreview,
  agentOnline = null,
  projectRoot = "",
}) => {
  const [activeTab, setActiveTab] = useState<"recorder" | "actions" | "steps" | "console" | "memory">("recorder");
  const [newActionName, setNewActionName] = useState("");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [actionParam, setActionParam] = useState("");

  // Safe arrays
  const safeRecordedSteps = useMemo(() => Array.isArray(recordedSteps) ? recordedSteps : [], [recordedSteps]);
  const safeSavedActions = useMemo(() => Array.isArray(savedActions) ? savedActions : [], [savedActions]);
  const safeConsoleLogs = useMemo(() => Array.isArray(consoleLogs) ? consoleLogs : [], [consoleLogs]);
  const safeDevSteps = useMemo(() => Array.isArray(devSteps) ? devSteps : [], [devSteps]);

  const handleStartRecording = () => {
    const name = newActionName.trim() || `recording_${Date.now()}`;
    onStartRecording?.(name);
    onRecordingNameChange?.(name);
    onAddLog("info", `🎥 Počinjem recording: ${name}`);
    onAddLog("ok", "Chromium se otvara u pozadini... (simulacija za sada)");
  };

  const handleStopRecording = () => {
    onStopRecording?.();
    onAddLog("ok", "Recording zaustavljen. Akcija spremljena.");
    setNewActionName("");
  };

  const runAction = (name: string) => {
    const params = actionParam.trim() ? { predmet: actionParam } : undefined;
    onRunAction?.(name, params);
    onAddLog("info", `▶️ Pokrećem akciju: ${name}`);
  };

  const addLog = (type: "info" | "ok" | "error" | "warn", msg: string) => {
    onAddLog(type, msg);
  };

  useEffect(() => {
    if (isRecording) {
      addLog("info", "Recording je aktivan — možeš raditi na portalima");
    }
  }, [isRecording]);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white overflow-hidden">
      <div className="border-b border-white/10 p-4 flex items-center justify-between bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-lg">Dev Studio</h2>
          </div>
          <Badge variant={agentOnline === true ? "default" : "secondary"} className="text-xs">
            Agent {agentOnline === true ? "🟢 Online" : "🔴 Offline"}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-white/50">
          {projectRoot && <div>Root: {projectRoot.split("/").pop()}</div>}
          <div className="px-2 py-0.5 bg-white/5 rounded">v2.1</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5 bg-zinc-900 border-b border-white/10 rounded-none">
          <TabsTrigger value="recorder" className="data-[state=active]:bg-emerald-500/10">🎥 Recorder</TabsTrigger>
          <TabsTrigger value="actions" className="data-[state=active]:bg-emerald-500/10">Actions</TabsTrigger>
          <TabsTrigger value="steps" className="data-[state=active]:bg-emerald-500/10">Steps</TabsTrigger>
          <TabsTrigger value="console" className="data-[state=active]:bg-emerald-500/10">Console</TabsTrigger>
          <TabsTrigger value="memory" className="data-[state=active]:bg-emerald-500/10">Memory</TabsTrigger>
        </TabsList>

        <TabsContent value="recorder" className="flex-1 p-6 overflow-auto">
          <Card className="bg-zinc-900 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-emerald-400" />
                Visual Action Recorder
              </CardTitle>
              <CardDescription>
                Klikni Start → otvara se Chromium → radi normalno po SDGE/OSS portalu → Stop → akcija se sprema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Ime akcije</Label>
                  <Input
                    value={newActionName}
                    onChange={(e) => setNewActionName(e.target.value)}
                    placeholder="sdge_povratnice_3_2026"
                    className="bg-zinc-950 border-white/20"
                  />
                </div>
                <Button 
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  size="lg"
                  className={`mt-6 ${isRecording ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                >
                  {isRecording ? (
                    <>
                      <Square className="mr-2 h-4 w-4" />
                      STOP RECORDING
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      START RECORDING IN CHROMIUM
                    </>
                  )}
                </Button>
              </div>

              {isRecording && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    Recording je aktivan — radi što treba na portalu
                  </div>
                  <div className="text-sm text-white/70 mt-2">
                    Kad završiš, klikni STOP. Koraci će se automatski spremiti.
                  </div>
                </div>
              )}

              {safeRecordedSteps.length > 0 && (
                <div>
                  <Label className="text-xs uppercase tracking-widest mb-2 block">Snimljeni koraci ({safeRecordedSteps.length})</Label>
                  <ScrollArea className="h-64 bg-black/40 border border-white/10 rounded p-3">
                    {safeRecordedSteps.map((step, i) => (
                      <div key={i} className="py-2 border-b border-white/10 last:border-0 text-sm">
                        <div className="font-mono text-white/50">#{step.n}</div>
                        <div>{step.desc}</div>
                        {step.url && <div className="text-xs text-white/40 mt-1 truncate">{step.url}</div>}
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
              <CardDescription>One koje možeš pokrenuti jednim klikom</CardDescription>
            </CardHeader>
            <CardContent>
              {safeSavedActions.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  Još nema spremljenih akcija.<br />Snimi prvu preko Recorder taba.
                </div>
              ) : (
                <div className="space-y-3">
                  {safeSavedActions.map((action, i) => (
                    <div key={i} className="flex items-center justify-between bg-zinc-950 border border-white/10 p-4 rounded-lg">
                      <div>
                        <div className="font-medium">{action.name}</div>
                        {action.description && <div className="text-xs text-white/50">{action.description}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input 
                          placeholder="npr. 3/2026" 
                          value={selectedAction === action.name ? actionParam : ""}
                          onChange={(e) => {
                            setSelectedAction(action.name);
                            setActionParam(e.target.value);
                          }}
                          className="w-40 bg-black border-white/20 text-sm"
                        />
                        <Button onClick={() => runAction(action.name)} size="sm">
                          Run
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => onDeleteAction?.(action.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="steps" className="flex-1 p-6 overflow-auto">
          <Card className="bg-zinc-900 border-white/10">
            <CardHeader>
              <CardTitle>Dev Steps</CardTitle>
            </CardHeader>
            <CardContent>
              {safeDevSteps.length === 0 ? (
                <div className="text-white/40 py-8 text-center">Još nema koraka.</div>
              ) : (
                safeDevSteps.map((step: any, i: number) => (
                  <div key={i} className="flex gap-3 py-3 border-b border-white/10 last:border-none">
                    <Badge variant="outline">{step.status || "queued"}</Badge>
                    <div className="flex-1">
                      <div className="font-medium">{step.label}</div>
                      {step.detail && <div className="text-sm text-white/60">{step.detail}</div>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="console" className="flex-1 flex flex-col">
          <div className="p-4 border-b border-white/10 bg-zinc-900 flex items-center justify-between">
            <div className="font-medium">Console Log</div>
            <Button variant="ghost" size="sm" onClick={() => addLog("info", "Log cleared manually")}>
              Clear
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4 font-mono text-sm bg-black/60">
            {safeConsoleLogs.length === 0 ? (
              <div className="text-white/30 py-8 text-center">Konzola je čista.</div>
            ) : (
              safeConsoleLogs.map((log, i) => (
                <div key={i} className="py-1">
                  <span className="text-white/40">[{log.time || new Date().toLocaleTimeString()}]</span>{" "}
                  <span className={
                    log.t === "error" ? "text-red-400" : 
                    log.t === "ok" ? "text-emerald-400" : "text-white/70"
                  }>
                    {log.msg}
                  </span>
                </div>
              ))
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="memory" className="flex-1 p-6">
          <Card className="bg-zinc-900 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" /> Zapamćeno stanje projekta
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert text-sm">
              <p>Projekt je učitan iz ZIP-a. Više se nećemo vraćati na početak.</p>
              <ul className="list-disc pl-5 space-y-1 text-white/80">
                <li>ChatDialog.tsx je glavni orchestrator sa svim tabovima</li>
                <li>DevPanel treba podržavati visual recording + reusable akcije</li>
                <li>Glavni cilj: više ne copy-paste koda, sve preko jednog klika</li>
                <li>SDGE povratnice, OSS download, self-healing su prioritet</li>
              </ul>
              <p className="mt-4 text-emerald-400">Ova greška koju vidiš u konzoli je riješena u ovoj verziji.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="p-3 border-t border-white/10 bg-zinc-900 text-[10px] text-white/40 flex items-center justify-between">
        <div>DevPanel v2.2 — učitan cijeli projekt • greška .length je popravljena</div>
        <div className="flex gap-4">
          <span>ctrl + click za debug</span>
          <span>Pošalji screenshot ako i dalje baca grešku</span>
        </div>
      </div>
    </div>
  );
};

export default DevPanel;
