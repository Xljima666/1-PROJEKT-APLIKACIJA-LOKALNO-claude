import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Brain,
  Activity,
  Layers,
  Database,
  GitBranch,
  Bug,
  Play,
  RefreshCw,
  Power,
  Search,
} from "lucide-react";

type Tab = "control" | "pipelines" | "memory" | "graph" | "debug";

export default function BrainPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("control");

  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [flows, setFlows] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const AGENT_URL = import.meta.env.VITE_AGENT_SERVER_URL || "";

  // 🔌 Agent health check
  const checkAgent = async () => {
    if (!AGENT_URL) return setAgentOnline(false);
    try {
      const res = await fetch(`${AGENT_URL}/health`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      setAgentOnline(res.ok);
    } catch {
      setAgentOnline(false);
    }
  };

  // 🔁 Load flows
  const loadFlows = async () => {
    if (!AGENT_URL) return;
    try {
      const res = await fetch(`${AGENT_URL}/record/list`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const data = await res.json();
      if (data?.success) setFlows(data.actions || []);
    } catch {}
  };

  useEffect(() => {
    checkAgent();
  }, []);

  useEffect(() => {
    if (activeTab === "pipelines") loadFlows();
  }, [activeTab]);

  const tabs = [
    { id: "control", label: "Control", icon: Brain },
    { id: "pipelines", label: "Pipelines", icon: Layers },
    { id: "memory", label: "Memory", icon: Database },
    { id: "graph", label: "Graph", icon: GitBranch },
    { id: "debug", label: "Debug", icon: Bug },
  ] as const;

  return (
    <div className="h-full flex flex-col bg-[#0b0c12] text-white">
      {/* HEADER */}
      <div className="h-14 border-b border-white/[0.06] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Stellan Brain</p>
            <p className="text-[10px] text-white/40">AI Operating Core</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-white/40 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 px-2 py-2 border-b border-white/[0.06]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition",
                activeTab === tab.id
                  ? "bg-white text-black"
                  : "text-white/50 hover:bg-white/[0.06]"
              )}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden">

        {/* 🧠 CONTROL */}
        {activeTab === "control" && (
          <div className="p-6 space-y-6">

            {/* STATUS */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/[0.04] p-4 rounded-xl">
                <p className="text-xs text-white/40">Agent</p>
                <p
                  className={cn(
                    "text-lg font-semibold",
                    agentOnline
                      ? "text-emerald-400"
                      : "text-red-400"
                  )}
                >
                  {agentOnline ? "ONLINE" : "OFFLINE"}
                </p>
              </div>

              <div className="bg-white/[0.04] p-4 rounded-xl">
                <p className="text-xs text-white/40">Flows</p>
                <p className="text-lg font-semibold text-white">
                  {flows.length}
                </p>
              </div>

              <div className="bg-white/[0.04] p-4 rounded-xl">
                <p className="text-xs text-white/40">Memory</p>
                <p className="text-lg font-semibold text-white">
                  {memoryItems.length}
                </p>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-3">
              <button
                onClick={checkAgent}
                className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>

              <button
                className="px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-sm flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Test Agent
              </button>

              <button
                className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-sm flex items-center gap-2"
              >
                <Power className="w-4 h-4" />
                Restart
              </button>
            </div>
          </div>
        )}

        {/* 🔁 PIPELINES */}
        {activeTab === "pipelines" && (
          <div className="p-4 space-y-3 overflow-y-auto h-full">
            {flows.map((f) => (
              <div
                key={f.name}
                className="p-4 rounded-xl bg-white/[0.04] flex justify-between items-center"
              >
                <div>
                  <p className="text-sm">{f.name}</p>
                  <p className="text-[10px] text-white/30">.py</p>
                </div>

                <button className="text-xs bg-cyan-500/20 px-3 py-1 rounded-lg">
                  RUN
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 🧠 MEMORY */}
        {activeTab === "memory" && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search memory..."
                className="bg-transparent border-b border-white/10 text-sm outline-none flex-1"
              />
            </div>

            <div className="text-white/30 text-sm">
              (Memory system dolazi u sljedećem koraku)
            </div>
          </div>
        )}

        {/* 🌐 GRAPH */}
        {activeTab === "graph" && (
          <div className="flex items-center justify-center h-full text-white/30">
            Graph dolazi uskoro (real data, ne fake)
          </div>
        )}

        {/* 🐞 DEBUG */}
        {activeTab === "debug" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-auto p-3 font-mono text-xs space-y-1">
              {logs.length === 0 && (
                <p className="text-white/20">Nema logova</p>
              )}
              {logs.map((l, i) => (
                <div key={i} className="text-white/70">
                  {l}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
