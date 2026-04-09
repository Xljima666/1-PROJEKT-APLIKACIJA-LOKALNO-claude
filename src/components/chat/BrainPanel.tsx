import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Brain, GitGraph, Layers, Database, Zap, Search, Sparkles, Play, Plus } from "lucide-react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
} from "reactflow";
import "reactflow/dist/style.css";

type Tab = "overview" | "graph" | "pipelines" | "vault" | "tools";

export default function BrainPanel({ onClose, agentServerUrl }: { onClose: () => void; agentServerUrl?: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [memoryHealth, setMemoryHealth] = useState(94);
  const [pulse, setPulse] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ideas, setIdeas] = useState<string>("");
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [flows, setFlows] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>("");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);

  const AGENT_URL = agentServerUrl || import.meta.env.VITE_AGENT_SERVER_URL || "";

  const loadFlows = async () => {
    if (!AGENT_URL) return;
    try {
      const res = await fetch(`${AGENT_URL}/record/list`, {
        method: "GET",
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.actions)) setFlows(data.actions);
    } catch (e) {}
  };

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const addFlowToCanvas = (flowName: string) => {
    const newNode: Node = {
      id: `flow-${Date.now()}`,
      position: { x: Math.random() * 400 + 150, y: Math.random() * 300 + 150 },
      data: { label: flowName },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const runPipeline = async () => {
    if (nodes.length === 0) return alert("Nema flowova na canvasu!");
    setRunning(true);
    setRunResult("");

    const firstFlow = nodes.find(n => n.data?.label);
    if (!firstFlow) return;

    try {
      const res = await fetch(`${AGENT_URL}/record/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ name: firstFlow.data.label }),
      });
      const data = await res.json();
      if (data?.success) {
        setRunResult(`✅ "${firstFlow.data.label}" izvršen!\n\n${data.stdout || ""}`);
      } else {
        setRunResult(`❌ Greška: ${data?.error || "Nepoznato"}`);
      }
    } catch (e) {
      setRunResult(`❌ Greška: ${e}`);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (activeTab === "pipelines") loadFlows();
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => !p);
      setMemoryHealth(prev => Math.max(88, Math.min(98, prev + (Math.random() * 4 - 2))));
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: "overview", label: "Overview", icon: Brain },
    { id: "graph", label: "Knowledge Graph", icon: GitGraph },
    { id: "pipelines", label: "Pipelines", icon: Layers },
    { id: "vault", label: "Memory Vault", icon: Database },
    { id: "tools", label: "Tools", icon: Zap },
  ] as const;

  return (
    <div className="h-full flex flex-col bg-[#050814] text-white overflow-hidden">
      <div className="px-8 py-5 border-b border-white/10 flex items-center justify-between bg-black/70 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-3xl bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center shadow-2xl shadow-cyan-500/50">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tighter">Mozak</h1>
            <p className="font-mono text-cyan-300 text-sm">NEURAL CORE • LIVE</p>
          </div>
        </div>

        <div className="flex gap-1 bg-white/5 rounded-3xl p-1.5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "px-6 py-3 rounded-3xl flex items-center gap-3 text-sm font-medium transition-all",
                  activeTab === tab.id ? "bg-cyan-400 text-black shadow-xl" : "hover:bg-white/10 text-white/70"
                )}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <button onClick={onClose} className="text-4xl text-white/40 hover:text-white">✕</button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {activeTab === "pipelines" ? (
          <div className="flex w-full h-full">
            <div className="w-72 border-r border-white/10 bg-[#0a1125] p-4 overflow-auto">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Dostupni Flowovi
              </h3>
              {flows.map((flow) => (
                <div
                  key={flow.name}
                  onClick={() => addFlowToCanvas(flow.name)}
                  className="bg-black/60 hover:bg-cyan-500/20 border border-white/10 rounded-xl p-4 mb-3 cursor-pointer transition-all"
                >
                  <div className="font-medium">{flow.name}</div>
                  <div className="text-xs text-white/40">.py</div>
                </div>
              ))}
            </div>

            <div className="flex-1 relative">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                className="bg-[#0a1125]"
              >
                <Controls />
                <Background gap={20} size={1} />
              </ReactFlow>

              <button
                onClick={runPipeline}
                disabled={running || nodes.length === 0}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-bold px-10 py-4 rounded-3xl flex items-center gap-3 shadow-2xl hover:scale-105 transition-all disabled:opacity-50"
              >
                {running ? <>Pokrećem...</> : <><Play className="w-5 h-5" /> Run Pipeline</>}
              </button>

              {runResult && (
                <div className="absolute bottom-8 right-8 bg-black/90 backdrop-blur-xl border border-white/20 rounded-3xl p-6 max-w-md text-sm whitespace-pre-wrap max-h-64 overflow-auto">
                  {runResult}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 p-8 overflow-auto">
            {activeTab === "overview" && (
              <div className="flex items-center justify-center h-full text-4xl text-white/30">
                Overview - centralni mozak
              </div>
            )}
            {activeTab === "graph" && <div className="text-4xl text-white/30">Knowledge Graph</div>}
            {activeTab === "vault" && <div className="text-4xl text-white/30">Memory Vault</div>}
            {activeTab === "tools" && <div className="text-4xl text-white/30">Tools</div>}
          </div>
        )}
      </div>
    </div>
  );
}
