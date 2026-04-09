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
  const [memoryHealth, setMemoryHealth] = useState(95.7);
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
      const res = await fetch(`${AGENT_URL}/record/list`, { headers: { "ngrok-skip-browser-warning": "true" } });
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
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const runPipeline = async () => {
    if (nodes.length === 0) return alert("Dodaj flow na canvas!");
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
      setMemoryHealth((prev) => Math.max(92, Math.min(98, prev + (Math.random() * 2 - 1))));
    }, 1300);
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
    <div className="h-full flex flex-col bg-[#03040a] text-white overflow-hidden">
      {/* HEADER - isti kao kod Učenja */}
      <div className="h-14 border-b border-cyan-500/20 bg-black/90 backdrop-blur-3xl px-6 flex items-center justify-between z-50">
        <button onClick={onClose} className="flex items-center gap-3 text-white/80 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Nazad na Stellana</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 via-purple-500 to-violet-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-cyan-500/60">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-[-2px]">Mozak</h1>
            <p className="font-mono text-[10px] text-cyan-400 tracking-[1px]">NEURAL CORE • LIVE</p>
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
                  "px-6 py-2.5 rounded-3xl text-sm font-medium flex items-center gap-2 transition-all",
                  activeTab === tab.id ? "bg-cyan-400 text-black shadow-xl shadow-cyan-500/50" : "hover:bg-white/10"
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
        {activeTab === "overview" && (
          <div className="h-full flex items-center justify-center relative">
            <div className="absolute w-[520px] h-[520px] bg-cyan-400/10 rounded-full animate-pulse"></div>
            <div className="absolute w-[460px] h-[460px] bg-purple-500/10 rounded-full animate-[ping_3s_infinite]"></div>

            <Brain
              className="relative w-[380px] h-[380px] text-cyan-300 transition-all duration-1000"
              style={{
                filter: pulse
                  ? "drop-shadow(0 0 140px #67e8f9) drop-shadow(0 0 70px #a78bfa)"
                  : "drop-shadow(0 0 80px #67e8f9)",
              }}
            />

            <div className="absolute bottom-20 text-center">
              <h1 className="text-7xl font-black tracking-[-4px] bg-gradient-to-b from-white to-cyan-200 bg-clip-text text-transparent">
                NEURAL CORE
              </h1>
              <p className="text-cyan-300 font-mono text-xl mt-2">LIVE VECTOR MEMORY</p>

              <div className="mt-10 mx-auto w-64 h-64 relative">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="82" fill="none" stroke="#112233" strokeWidth="22" />
                  <circle
                    cx="100"
                    cy="100"
                    r="82"
                    fill="none"
                    stroke="#67e8f9"
                    strokeWidth="22"
                    strokeDasharray="515"
                    strokeDashoffset={515 - (515 * memoryHealth) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl font-bold text-white">{memoryHealth.toFixed(1)}</span>
                  <span className="text-cyan-300 font-mono text-2xl">%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "pipelines" && (
          <div className="flex h-full">
            <div className="w-80 border-r border-white/10 bg-[#0a0a1f] p-6 overflow-auto">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-cyan-300">
                <Plus className="w-4 h-4" /> Dostupni Flowovi
              </h3>
              {flows.map((flow) => (
                <div
                  key={flow.name}
                  onClick={() => addFlowToCanvas(flow.name)}
                  className="bg-black/70 hover:bg-cyan-500/20 border border-cyan-400/30 rounded-2xl p-5 mb-3 cursor-pointer"
                >
                  <div className="font-medium">{flow.name}</div>
                  <div className="text-xs text-cyan-300">.py</div>
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
                className="bg-[#0a0a1f]"
              >
                <Controls />
                <Background gap={25} size={2} color="#67e8f9" />
              </ReactFlow>

              <button
                onClick={runPipeline}
                disabled={running || nodes.length === 0}
                className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-bold px-14 py-6 rounded-3xl flex items-center gap-4 text-xl shadow-2xl disabled:opacity-50"
              >
                {running ? "Pokrećem..." : <><Play className="w-7 h-7" /> RUN PIPELINE</>}
              </button>
            </div>
          </div>
        )}

        {activeTab !== "overview" && activeTab !== "pipelines" && (
          <div className="h-full flex items-center justify-center text-5xl text-white/20">
            {activeTab.toUpperCase()} — dolazi uskoro
          </div>
        )}
      </div>
    </div>
  );
}
