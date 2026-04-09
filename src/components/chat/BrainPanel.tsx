import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Brain, GitGraph, Layers, Database, Zap, Play, Plus, ArrowLeft } from "lucide-react";
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
  const [memoryHealth, setMemoryHealth] = useState(95);
  const [pulse, setPulse] = useState(true);
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
      position: { x: Math.random() * 400 + 200, y: Math.random() * 300 + 150 },
      data: { label: flowName },
      style: { background: "#0a1125", border: "2px solid #67e8f9", borderRadius: "12px" },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const runPipeline = async () => {
    if (nodes.length === 0) return alert("Dodaj barem jedan flow na canvas!");
    setRunning(true);
    setRunResult("");

    const firstFlow = nodes.find((n) => n.data?.label);
    if (!firstFlow) return;

    try {
      const res = await fetch(`${AGENT_URL}/record/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ name: firstFlow.data.label }),
      });
      const data = await res.json();
      setRunResult(data?.success ? `✅ ${firstFlow.data.label} izvršen!` : `❌ Greška`);
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
      setPulse((p) => !p);
      setMemoryHealth((prev) => Math.max(92, Math.min(98, prev + (Math.random() * 3 - 1.5))));
    }, 1200);
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
    <div className="h-full flex flex-col bg-[#05050f] text-white overflow-hidden border-l border-cyan-500/30">
      {/* HEADER - kao kod Učenja */}
      <div className="h-14 border-b border-white/10 bg-black/80 backdrop-blur-2xl px-6 flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-3 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Nazad na Stellana</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-2xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter">Mozak</h1>
            <p className="text-xs font-mono text-cyan-400">NEURAL CORE • LIVE</p>
          </div>
        </div>

        <div className="flex gap-1 bg-white/5 rounded-3xl p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "px-5 py-2 rounded-3xl text-sm font-medium flex items-center gap-2 transition-all",
                  activeTab === tab.id
                    ? "bg-cyan-400 text-black shadow-xl shadow-cyan-500/50"
                    : "hover:bg-white/10"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "pipelines" ? (
          /* Pipelines tab - ostaje isti */
          <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-80 border-r border-white/10 bg-[#0a0a1f] p-6 overflow-auto">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-cyan-300">
                <Plus className="w-4 h-4" /> Dostupni Flowovi
              </h3>
              {flows.map((flow) => (
                <div
                  key={flow.name}
                  onClick={() => addFlowToCanvas(flow.name)}
                  className="bg-black/60 hover:bg-cyan-500/20 border border-cyan-400/30 rounded-2xl p-5 mb-3 cursor-pointer transition-all"
                >
                  <div className="font-medium text-white">{flow.name}</div>
                  <div className="text-xs text-cyan-300/70">.py • spreman za run</div>
                </div>
              ))}
            </div>

            {/* Canvas */}
            <div className="flex-1 relative">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                className="bg-[#0a0a1f]"
              >
                <Controls />
                <Background gap={25} size={2} color="#67e8f9" />
              </ReactFlow>

              <button
                onClick={runPipeline}
                disabled={running || nodes.length === 0}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-500 hover:to-cyan-500 text-black font-bold px-12 py-5 rounded-3xl flex items-center gap-3 shadow-2xl shadow-cyan-500/50 text-lg disabled:opacity-50 transition-all"
              >
                {running ? "Pokrećem..." : <><Play className="w-6 h-6" /> RUN PIPELINE</>}
              </button>
            </div>
          </div>
        ) : (
          /* OVERVIEW - sada pravi neural heavy */
          <div className="h-full flex items-center justify-center p-12">
            <div className="text-center max-w-2xl">
              {/* Glowing Brain Core */}
              <div className="relative mx-auto mb-12 w-[420px] h-[420px] flex items-center justify-center">
                <div className="absolute w-[420px] h-[420px] bg-cyan-400/10 rounded-full animate-[ping_4s_infinite]"></div>
                <div className="absolute w-[380px] h-[380px] bg-purple-500/10 rounded-full animate-pulse"></div>
                
                <Brain 
                  className="w-[340px] h-[340px] text-cyan-300 transition-all duration-1000"
                  style={{
                    filter: pulse 
                      ? "drop-shadow(0 0 120px #67e8f9) drop-shadow(0 0 60px #a78bfa)" 
                      : "drop-shadow(0 0 60px #67e8f9)",
                  }}
                />
              </div>

              <h1 className="text-6xl font-bold tracking-[-4px] text-white mb-2">NEURAL CORE</h1>
              <p className="text-cyan-300 text-xl font-mono mb-8">Live Vector Memory</p>

              {/* Memory Gauge */}
              <div className="mx-auto w-56 h-56 relative">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="85" fill="none" stroke="#112233" strokeWidth="18" />
                  <circle 
                    cx="100" 
                    cy="100" 
                    r="85" 
                    fill="none" 
                    stroke="#67e8f9" 
                    strokeWidth="18"
                    strokeDasharray={534}
                    strokeDashoffset={534 - (534 * memoryHealth / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-7xl font-bold text-white">{memoryHealth}</span>
                  <span className="text-cyan-300 font-mono text-xl">%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
