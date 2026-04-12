import React from "react";
import { ArrowLeft, Brain, Camera, FolderOpen, Maximize2, Minus, Play, Plus, Save, Sparkles, Trash2, Wand2, Square, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CATEGORY_META, LEARNING_NODE_TYPES } from "./learningNodeTypes";
import { useLearningPanelTech } from "./useLearningPanelTech";

const getCategoryAccent = (raw?: string) => {
  const value = String(raw || "").toLowerCase();

  if (value.includes("play") || value.includes("browser")) {
    return {
      color: "#67e8f9",
      soft: "rgba(103, 232, 249, 0.16)",
      strong: "rgba(103, 232, 249, 0.24)",
      glow: "linear-gradient(135deg, rgba(34,211,238,0.24), rgba(45,212,191,0.12))",
    };
  }

  if (value.includes("dat") || value.includes("file")) {
    return {
      color: "#6ee7b7",
      soft: "rgba(110, 231, 183, 0.16)",
      strong: "rgba(110, 231, 183, 0.24)",
      glow: "linear-gradient(135deg, rgba(16,185,129,0.24), rgba(45,212,191,0.12))",
    };
  }

  if (value.includes("log")) {
    return {
      color: "#2dd4bf",
      soft: "rgba(45, 212, 191, 0.16)",
      strong: "rgba(45, 212, 191, 0.24)",
      glow: "linear-gradient(135deg, rgba(20,184,166,0.24), rgba(45,212,191,0.12))",
    };
  }

  if (value.includes("trans")) {
    return {
      color: "#34d399",
      soft: "rgba(52, 211, 153, 0.16)",
      strong: "rgba(52, 211, 153, 0.24)",
      glow: "linear-gradient(135deg, rgba(52,211,153,0.24), rgba(16,185,129,0.12))",
    };
  }

  if (value.includes("api") || value.includes("web")) {
    return {
      color: "#22d3ee",
      soft: "rgba(34, 211, 238, 0.16)",
      strong: "rgba(34, 211, 238, 0.24)",
      glow: "linear-gradient(135deg, rgba(34,211,238,0.24), rgba(14,165,233,0.12))",
    };
  }

  if (value.includes("ai")) {
    return {
      color: "#5eead4",
      soft: "rgba(94, 234, 212, 0.16)",
      strong: "rgba(94, 234, 212, 0.24)",
      glow: "linear-gradient(135deg, rgba(94,234,212,0.24), rgba(45,212,191,0.12))",
    };
  }

  if (value.includes("integ")) {
    return {
      color: "#4ade80",
      soft: "rgba(74, 222, 128, 0.16)",
      strong: "rgba(74, 222, 128, 0.24)",
      glow: "linear-gradient(135deg, rgba(74,222,128,0.24), rgba(16,185,129,0.12))",
    };
  }

  if (value.includes("i/o") || value.includes("io")) {
    return {
      color: "#99f6e4",
      soft: "rgba(153, 246, 228, 0.16)",
      strong: "rgba(153, 246, 228, 0.24)",
      glow: "linear-gradient(135deg, rgba(153,246,228,0.22), rgba(45,212,191,0.12))",
    };
  }

  return {
    color: "#5eead4",
    soft: "rgba(94, 234, 212, 0.16)",
    strong: "rgba(94, 234, 212, 0.24)",
    glow: "linear-gradient(135deg, rgba(94,234,212,0.24), rgba(45,212,191,0.12))",
  };
};

const panelGlass = "rgba(5, 26, 24, 0.72)";
const panelGlassStrong = "rgba(5, 22, 21, 0.84)";
const borderSoft = "rgba(110, 231, 183, 0.10)";
const borderStrong = "rgba(94, 234, 212, 0.14)";

const AnimatedConnection = ({ d, color, index, isActive }: { d: string; color: string; index: number; isActive?: boolean }) => (
  <g>
    <path d={d} fill="none" stroke={color} strokeWidth={isActive ? 6 : 4} strokeOpacity={isActive ? 0.14 : 0.05} />
    <path d={d} fill="none" stroke={color} strokeWidth={isActive ? 2.2 : 1.5} strokeOpacity={isActive ? 0.78 : 0.42} />
    <circle r={isActive ? 3.5 : 2.5} fill={color} opacity={isActive ? 1 : 0.8}>
      <animateMotion dur={`${isActive ? 1.4 : 3 + (index % 4) * 0.7}s`} repeatCount="indefinite" path={d} />
    </circle>
  </g>
);

const NodePalette = ({ onAdd }: { onAdd: (kind: keyof typeof LEARNING_NODE_TYPES) => void }) => (
  <div
    className="w-[240px] border-r p-4 overflow-y-auto shrink-0"
    style={{ background: panelGlass, borderColor: borderSoft, backdropFilter: "blur(18px)" }}
  >
    <div className="mb-4">
      <p className="text-sm font-semibold text-white/90">Learning Nodes</p>
      <p className="text-xs text-emerald-100/45">Klikni za dodavanje u flow</p>
    </div>

    <div className="space-y-2">
      {Object.values(LEARNING_NODE_TYPES).map((template) => {
        const Icon = template.icon;
        const accent = getCategoryAccent(template.category);
        return (
          <button
            key={template.kind}
            onClick={() => onAdd(template.kind)}
            className="w-full rounded-2xl border transition text-left p-3 hover:translate-x-[2px]"
            style={{ background: "rgba(255,255,255,0.025)", borderColor: borderSoft }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: accent.glow }}>
                <Icon className="w-4 h-4" style={{ color: accent.color }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/90">{template.label}</p>
                <p className="text-[10px] uppercase tracking-wider text-emerald-100/35">{template.category}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const NodeCard = ({ node, isSelected, isActive, onMouseDown, onClick, getNodeHeight }: any) => {
  const template = LEARNING_NODE_TYPES[node.kind];
  const Icon = template.icon;
  const accent = getCategoryAccent(node.category || template.category);

  return (
    <motion.div
      data-node-card="true"
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={cn(
        "absolute rounded-2xl border overflow-hidden select-none cursor-grab",
        isSelected ? "shadow-[0_0_0_1px_rgba(94,234,212,0.18)]" : ""
      )}
      style={{
        left: node.x,
        top: node.y,
        width: 240,
        height: getNodeHeight(node),
        borderColor: isSelected ? accent.strong : borderSoft,
        background: "linear-gradient(180deg, rgba(7,28,26,0.98), rgba(5,20,19,0.96))",
        boxShadow: isActive ? `0 0 28px ${accent.soft}` : "0 12px 32px rgba(0,0,0,0.24)",
      }}
      animate={isActive ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.8, repeat: isActive ? Infinity : 0 }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: accent.color }} />
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent.glow }}>
            <Icon className="w-4 h-4" style={{ color: accent.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/90 truncate">{node.label}</p>
            <span className={cn("text-[9px] px-2 py-0.5 rounded-full inline-block mt-1", CATEGORY_META[node.category].bg, CATEGORY_META[node.category].text)}>
              {CATEGORY_META[node.category].label}
            </span>
          </div>
        </div>

        <div className="mt-3 text-[10px] text-emerald-50/45 space-y-1">
          {node.kind === "goto" && <p className="truncate">URL: {node.config?.url || "—"}</p>}
          {node.kind === "click" && <p className="truncate">Selector: {node.config?.selector || "—"}</p>}
          {node.kind === "fill" && (
            <>
              <p className="truncate">Selector: {node.config?.selector || "—"}</p>
              <p className="truncate">Value: {node.config?.value || "—"}</p>
            </>
          )}
          {node.kind === "input" && (
            <>
              <p className="truncate">Key: {node.config?.key || "—"}</p>
              <p className="truncate">Value: {node.config?.value || "—"}</p>
            </>
          )}
          {node.kind === "ai" && <p className="truncate">Prompt: {node.config?.prompt || node.config?.result || "AI block"}</p>}
        </div>

        {node.kind === "screenshot" && node.config?.image && (
          <div className="mt-3 rounded-xl overflow-hidden border bg-emerald-950/20" style={{ borderColor: borderSoft }}>
            <img src={node.config.image} alt="preview" className="w-full h-[110px] object-cover" />
          </div>
        )}
      </div>
    </motion.div>
  );
};

const Minimap = ({ nodes, connectionPaths, zoom, panX, panY, vpW, vpH, onNav, getNodeHeight, CANVAS_W, CANVAS_H }: any) => {
  const mmW = 180;
  const mmH = 110;
  const scale = Math.min(mmW / CANVAS_W, mmH / CANVAS_H);
  const vx = (-panX / zoom) * scale;
  const vy = (-panY / zoom) * scale;
  const vw = (vpW / zoom) * scale;
  const vh = (vpH / zoom) * scale;

  return (
    <div
      className="absolute bottom-4 right-4 z-30 rounded-xl overflow-hidden border"
      style={{ background: panelGlassStrong, borderColor: borderSoft, backdropFilter: "blur(12px)" }}
    >
      <svg
        width={mmW}
        height={mmH}
        className="cursor-pointer"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onNav((e.clientX - r.left) / scale, (e.clientY - r.top) / scale);
        }}
      >
        {connectionPaths.map((cp: any, i: number) => (
          <path key={i} d={cp.d} fill="none" stroke={cp.color} strokeWidth={0.5} strokeOpacity={0.3} transform={`scale(${scale})`} />
        ))}
        {nodes.map((n: any) => {
          const accent = getCategoryAccent(n.category);
          return <rect key={n.id} x={n.x * scale} y={n.y * scale} width={240 * scale} height={getNodeHeight(n) * scale} rx={2} fill={accent.color} fillOpacity={0.42} />;
        })}
        <rect x={Math.max(0, vx)} y={Math.max(0, vy)} width={Math.min(vw, mmW)} height={Math.min(vh, mmH)} fill="rgba(255,255,255,0.04)" stroke="rgba(153,246,228,0.28)" strokeWidth={1} rx={2} />
      </svg>
    </div>
  );
};

const ZoomControls = ({ zoom, onIn, onOut, onFit }: any) => (
  <div
    className="absolute bottom-20 left-4 z-30 flex flex-col gap-1 rounded-xl overflow-hidden border"
    style={{ background: panelGlassStrong, borderColor: borderSoft, backdropFilter: "blur(12px)" }}
  >
    <button onClick={onIn} className="w-9 h-9 flex items-center justify-center text-emerald-100/50 hover:text-white hover:bg-white/[0.06]"><Plus className="w-4 h-4" /></button>
    <div className="text-[9px] text-emerald-100/30 text-center py-0.5 border-y" style={{ borderColor: borderSoft }}>{Math.round(zoom * 100)}%</div>
    <button onClick={onOut} className="w-9 h-9 flex items-center justify-center text-emerald-100/50 hover:text-white hover:bg-white/[0.06]"><Minus className="w-4 h-4" /></button>
    <button onClick={onFit} className="w-9 h-9 flex items-center justify-center text-emerald-100/50 hover:text-white hover:bg-white/[0.06] border-t" style={{ borderColor: borderSoft }}><Maximize2 className="w-3.5 h-3.5" /></button>
  </div>
);

const InspectorField = ({ label, value, onChange, multiline = false, numeric = false, placeholder = "" }: any) => (
  <div className="space-y-1.5">
    <p className="text-[10px] font-semibold text-emerald-100/30 uppercase tracking-wider">{label}</p>
    {multiline ? (
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full min-h-[76px] rounded-lg bg-white/[0.04] border px-3 py-2 text-xs text-white/85 outline-none focus:border-white/[0.16]" style={{ borderColor: borderSoft }} />
    ) : (
      <input type={numeric ? "number" : "text"} value={value ?? ""} onChange={(e) => onChange(numeric ? Number(e.target.value || 0) : e.target.value)} placeholder={placeholder} className="w-full h-9 rounded-lg bg-white/[0.04] border px-3 text-xs text-white/85 outline-none focus:border-white/[0.16]" style={{ borderColor: borderSoft }} />
    )}
  </div>
);

const ToneLog = ({ logs }: any) => (
  <div className="space-y-2">
    {logs.map((entry: any, i: number) => (
      <div
        key={`${entry.time}-${i}`}
        className={cn(
          "flex items-start gap-3 rounded-2xl border px-3 py-2.5",
          entry.tone === "success" && "bg-emerald-500/[0.06]",
          entry.tone === "error" && "bg-red-500/[0.06]",
          (!entry.tone || entry.tone === "info") && "bg-white/[0.03]"
        )}
        style={{ borderColor: entry.tone === "error" ? "rgba(248,113,113,0.14)" : entry.tone === "success" ? "rgba(52,211,153,0.14)" : borderSoft }}
      >
        <div className="mt-0.5 text-[11px] text-emerald-100/30">{entry.time}</div>
        <div className={cn(
          "text-[12px] leading-6",
          entry.tone === "success" && "text-emerald-200/90",
          entry.tone === "error" && "text-red-200/90",
          (!entry.tone || entry.tone === "info") && "text-white/72"
        )}>
          {entry.msg}
        </div>
      </div>
    ))}
  </div>
);

interface Props {
  onClose: () => void;
}

export default function LearningPanelV2({ onClose }: Props) {
  const { constants, state, actions } = useLearningPanelTech();
  const selected = state.selectedNodeData;
  const nodeMap = new Map(state.nodes.map((node: any) => [node.id, node]));
  const [showFlowMenu, setShowFlowMenu] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[80] flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse 120% 90% at 50% 35%, rgba(10,62,55,1) 0%, rgba(6,31,31,1) 42%, rgba(3,18,18,1) 72%, rgba(2,12,12,1) 100%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.22]" style={{
          backgroundImage:
            "linear-gradient(rgba(94,234,212,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(94,234,212,0.045) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(circle at center, rgba(0,0,0,0.95), rgba(0,0,0,0.45) 70%, transparent 100%)",
        }} />
        <div className="absolute top-[10%] left-[18%] w-[520px] h-[520px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, rgba(16,185,129,1), transparent 70%)" }} />
        <div className="absolute top-[40%] right-[12%] w-[420px] h-[420px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(34,211,238,1), transparent 70%)" }} />
        <div className="absolute bottom-[8%] left-[38%] w-[360px] h-[360px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(94,234,212,1), transparent 70%)" }} />
      </div>

      <div className="relative z-10 flex items-center justify-between px-5 py-2.5 border-b" style={{ borderColor: borderSoft }}>
        <div className="flex items-center gap-3">
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={onClose} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-white/75 hover:text-white text-xs font-medium" style={{ background: "rgba(255,255,255,0.04)", borderColor: borderSoft }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Nazad na Stellan
          </motion.button>

          <div className="h-5 w-px" style={{ background: borderSoft }} />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.28), rgba(34,211,238,0.14))" }}>
              <Brain className="w-4 h-4 text-emerald-300" style={{ filter: "drop-shadow(0 0 6px rgba(94,234,212,0.35))" }} />
            </div>
            <input value={state.flowName} onChange={(e) => actions.setFlowName(e.target.value)} className="bg-transparent text-sm font-semibold text-white/90 outline-none border-b border-transparent hover:border-white/10 focus:border-white/20 transition-colors w-48" />
            <span className="text-[10px] px-2 py-0.5 rounded-full border text-emerald-100/40" style={{ background: "rgba(255,255,255,0.04)", borderColor: borderSoft }}>
              {state.nodes.length} čvorova · {state.connections.length} veza
            </span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", state.agentOnline ? "text-emerald-200" : "text-red-200")} style={{ background: state.agentOnline ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)", borderColor: state.agentOnline ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)" }}>
              {state.agentOnline ? "Agent online" : "Agent offline"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={actions.exportFlowToBrain} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-emerald-100 text-xs" style={{ background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.18)" }}>
            <Brain className="w-3 h-3" /> Izvezi u Mozak
          </button>
          <button onClick={actions.saveFlow} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-white/70 hover:text-white text-xs" style={{ background: "rgba(255,255,255,0.04)", borderColor: borderSoft }}>
            <Save className="w-3 h-3" /> Spremi
          </button>

          <div className="relative">
            <button onClick={() => setShowFlowMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-white/70 hover:text-white text-xs" style={{ background: "rgba(255,255,255,0.04)", borderColor: borderSoft }}>
              <FolderOpen className="w-3 h-3" /> Učitaj
            </button>
            {showFlowMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFlowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border overflow-hidden" style={{ background: "rgba(5,22,21,0.96)", borderColor: borderSoft, backdropFilter: "blur(20px)" }}>
                  {state.savedFlows.length === 0 ? (
                    <p className="text-xs text-emerald-100/30 px-4 py-3">Nema spremljenih flowova</p>
                  ) : state.savedFlows.slice(0, 8).map((flow: any) => (
                    <button key={flow.id} onClick={() => { actions.loadFlow(flow.id); setShowFlowMenu(false); }} className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] border-b last:border-0" style={{ borderColor: borderSoft }}>
                      <p className="text-xs text-white/70">{flow.name}</p>
                      <p className="text-[9px] text-emerald-100/25">{new Date(flow.savedAt).toLocaleString("hr-HR")}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {(state.selectedNode || state.selectedConnection) && (
            <button onClick={actions.deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-red-300 text-xs" style={{ background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.18)" }}>
              <Trash2 className="w-3 h-3" /> Obriši
            </button>
          )}

          <div className="flex items-center gap-1 text-[10px] text-emerald-100/28">
            <Sparkles className="w-3 h-3" /> Stellan Workflow Builder
          </div>
        </div>
      </div>

      <div className="relative z-10 border-b px-5 py-3 flex items-center gap-3" style={{ borderColor: borderSoft }}>
        <div className="rounded-xl border px-3 py-2 flex-1 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderColor: borderSoft }}>
          <Wand2 className="w-4 h-4 text-emerald-300" />
          <input
            value={state.flowPrompt}
            onChange={(e) => actions.setFlowPrompt(e.target.value)}
            placeholder="Smart Auto... npr. Odi na OSS i klikni Prijava"
            className="bg-transparent w-full text-sm text-white/85 outline-none placeholder:text-white/25"
          />
        </div>
        <button onClick={actions.generateFlowFromPrompt} className="px-3 py-2 rounded-xl border text-emerald-100 text-sm" style={{ background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.18)" }}>🧠 Smart Auto</button>
        {!state.recording ? (
          <button onClick={actions.startRecording} className="px-3 py-2 rounded-xl border text-amber-100 text-sm" style={{ background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.18)" }}>⏺ Record</button>
        ) : (
          <button onClick={actions.stopRecording} className="px-3 py-2 rounded-xl border text-red-100 text-sm" style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.18)" }}>⏹ Stop</button>
        )}
        <button onClick={actions.runFlowAnimated} disabled={state.isRunning} className="px-3 py-2 rounded-xl border text-emerald-100 text-sm disabled:opacity-40" style={{ background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.18)" }}>
          <Play className="w-4 h-4 inline mr-1" /> Run Flow
        </button>
        <button onClick={actions.loadPreview} className="px-3 py-2 rounded-xl border text-cyan-100 text-sm" style={{ background: "rgba(34,211,238,0.12)", borderColor: "rgba(34,211,238,0.18)" }}>
          <Camera className="w-4 h-4 inline mr-1" /> Preview
        </button>
        <button onClick={actions.improveWithAI} className="px-3 py-2 rounded-xl border text-emerald-50 text-sm" style={{ background: "rgba(94,234,212,0.10)", borderColor: "rgba(94,234,212,0.18)" }}>✨ Improve</button>
      </div>

      <div className="flex-1 flex min-h-0 relative z-10">
        <NodePalette onAdd={actions.addNode as any} />

        <div
          ref={state.containerRef}
          className={cn("flex-1 relative overflow-hidden", state.isPanning ? "cursor-grabbing" : "cursor-grab")}
          onMouseDown={actions.handleCanvasMouseDown}
        >
          <div data-canvas="true" className="absolute inset-0" />

          <div
            style={{
              transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`,
              transformOrigin: "0 0",
              position: "absolute",
              width: constants.CANVAS_W,
              height: constants.CANVAS_H,
            }}
          >
            <svg className="absolute inset-0 pointer-events-none" width={constants.CANVAS_W} height={constants.CANVAS_H}>
              <defs>
                <pattern id="learning-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(94,234,212,0.045)" strokeWidth="0.7" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#learning-grid)" />
            </svg>

            <svg className="absolute inset-0 pointer-events-none" width={constants.CANVAS_W} height={constants.CANVAS_H} style={{ zIndex: 1 }}>
              {state.connectionPaths.map((cp: any, i: number) => {
                const fromNode = nodeMap.get(cp.fromNode);
                const accent = getCategoryAccent(fromNode?.category);
                return (
                  <g
                    key={cp.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.setSelectedConnection(cp.id);
                      actions.setSelectedNode(null);
                    }}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  >
                    <path d={cp.d} fill="none" stroke="transparent" strokeWidth={12} />
                    <AnimatedConnection d={cp.d} color={state.selectedConnection === cp.id ? "#ccfbf1" : accent.color} index={i} isActive={state.activeNodes.includes(cp.fromNode) || state.activeNodes.includes(cp.toNode)} />
                  </g>
                );
              })}
            </svg>

            <div style={{ position: "relative", zIndex: 2, width: constants.CANVAS_W, height: constants.CANVAS_H }}>
              {state.nodes.map((node: any) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  isSelected={state.selectedNode === node.id}
                  isActive={state.activeNodes.includes(node.id)}
                  onMouseDown={(e: any) => actions.handleNodeMouseDown(node.id, e)}
                  onClick={(e: any) => {
                    e.stopPropagation();
                    actions.setSelectedNode(node.id);
                    actions.setSelectedConnection(null);
                  }}
                  getNodeHeight={constants.getNodeHeight}
                />
              ))}

              {state.nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-2xl border flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", borderColor: borderSoft }}>
                      <Brain className="w-8 h-8 text-emerald-100/12" />
                    </div>
                    <p className="text-sm text-emerald-50/42">Dodaj čvorove iz palete lijevo</p>
                    <p className="text-xs text-emerald-50/22">Spoji ih povlačenjem portova</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ZoomControls zoom={state.zoom} onIn={actions.zoomIn} onOut={actions.zoomOut} onFit={actions.fitToScreen} />
          <Minimap
            nodes={state.nodes}
            connectionPaths={state.connectionPaths.map((cp: any) => {
              const fromNode = nodeMap.get(cp.fromNode);
              const accent = getCategoryAccent(fromNode?.category);
              return { ...cp, color: accent.color };
            })}
            zoom={state.zoom}
            panX={state.pan.x}
            panY={state.pan.y}
            vpW={state.vpSize.w}
            vpH={state.vpSize.h}
            onNav={actions.handleMinimapNav}
            getNodeHeight={constants.getNodeHeight}
            CANVAS_W={constants.CANVAS_W}
            CANVAS_H={constants.CANVAS_H}
          />
        </div>

        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-72 border-l p-4 space-y-4 overflow-y-auto shrink-0"
              style={{ background: "rgba(5,22,21,0.82)", borderColor: borderSoft, backdropFilter: "blur(20px)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: getCategoryAccent(selected.category || LEARNING_NODE_TYPES[selected.kind].category).glow }}>
                  {(() => { const Icon = LEARNING_NODE_TYPES[selected.kind].icon; return <Icon className="w-4 h-4" style={{ color: getCategoryAccent(selected.category || LEARNING_NODE_TYPES[selected.kind].category).color }} />; })()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">{selected.label}</p>
                  <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-md", CATEGORY_META[selected.category].bg, CATEGORY_META[selected.category].text)}>
                    {CATEGORY_META[selected.category].label}
                  </span>
                </div>
              </div>

              {selected.kind === "goto" && (
                <>
                  <InspectorField label="URL" value={selected.config?.url || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "url", v)} placeholder="https://oss.uredjenazemlja.hr/" />
                  <InspectorField label="Timeout (ms)" numeric value={selected.config?.timeout || 45000} onChange={(v: number) => actions.updateNodeConfig(selected.id, "timeout", v)} />
                </>
              )}

              {selected.kind === "click" && (
                <>
                  <InspectorField label="Selector" value={selected.config?.selector || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "selector", v)} placeholder='text=Prijava' />
                  <InspectorField label="Timeout (ms)" numeric value={selected.config?.timeout || 20000} onChange={(v: number) => actions.updateNodeConfig(selected.id, "timeout", v)} />
                </>
              )}

              {selected.kind === "fill" && (
                <>
                  <InspectorField label="Selector" value={selected.config?.selector || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "selector", v)} placeholder='input[name="username"]' />
                  <InspectorField label="Value" value={selected.config?.value || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "value", v)} placeholder="Vrijednost" multiline />
                  <InspectorField label="Timeout (ms)" numeric value={selected.config?.timeout || 20000} onChange={(v: number) => actions.updateNodeConfig(selected.id, "timeout", v)} />
                </>
              )}

              {selected.kind === "input" && (
                <>
                  <InspectorField label="Key" value={selected.config?.key || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "key", v)} />
                  <InspectorField label="Value" value={selected.config?.value || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "value", v)} multiline />
                </>
              )}

              {selected.kind === "screenshot" && (
                <>
                  <InspectorField label="Title" value={selected.config?.title || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "title", v)} />
                  {selected.config?.image && (
                    <div className="rounded-xl overflow-hidden border bg-emerald-950/20" style={{ borderColor: borderSoft }}>
                      <img src={selected.config.image} alt="preview" className="w-full object-cover" />
                    </div>
                  )}
                </>
              )}

              {selected.kind === "ai" && (
                <>
                  <InspectorField label="Prompt / Result" value={selected.config?.prompt || selected.config?.result || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "prompt", v)} multiline />
                </>
              )}

              <div className="pt-3 border-t" style={{ borderColor: borderSoft }}>
                <p className="text-[10px] font-semibold text-emerald-100/30 uppercase tracking-wider mb-2">Status</p>
                <p className="text-xs text-white/60">{state.activeNodes.includes(selected.id) ? "Running" : "Idle"}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-10 border-t backdrop-blur-xl h-[260px] grid grid-cols-[1.2fr_340px]" style={{ borderColor: borderSoft, background: "rgba(5,22,21,0.74)" }}>
        <div className="p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white/90">Flow Runner</p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-100/30">{state.nodes.length} čvorova · {state.connections.length} veza</span>
            </div>
          </div>
          <div className="rounded-2xl border p-4 mb-4" style={{ background: "rgba(4,17,17,0.72)", borderColor: borderSoft }}>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={actions.runFlowAnimated} disabled={state.isRunning} className="px-4 py-2 rounded-xl border text-emerald-100 text-sm disabled:opacity-40" style={{ background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.18)" }}>
                <Play className="w-4 h-4 inline mr-1" /> Run Flow
              </button>
              <button onClick={actions.loadPreview} className="px-4 py-2 rounded-xl border text-white/75 text-sm" style={{ background: "rgba(255,255,255,0.04)", borderColor: borderSoft }}>
                👁 Preview
              </button>
              <button onClick={actions.fitToScreen} className="px-4 py-2 rounded-xl border text-white/75 text-sm" style={{ background: "rgba(255,255,255,0.04)", borderColor: borderSoft }}>
                ↻ Reset
              </button>
            </div>
            {state.recording && (
              <span className="text-[11px] px-2 py-1 rounded-full border text-amber-200" style={{ background: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.18)" }}>
                Recording aktivan
              </span>
            )}
            {state.isRunning && (
              <span className="ml-2 text-[11px] px-2 py-1 rounded-full border text-emerald-200" style={{ background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.18)" }}>
                Flow se izvršava
              </span>
            )}
          </div>
          <ToneLog logs={state.logs} />
        </div>

        <div className="border-l p-4 overflow-y-auto" style={{ borderColor: borderSoft }}>
          <p className="text-sm font-semibold text-white/90 mb-3">Live Preview</p>
          <div className="rounded-2xl border overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", borderColor: borderSoft }}>
            {state.previewImage ? (
              <img src={state.previewImage} alt="preview" className="w-full h-[170px] object-cover" />
            ) : (
              <div className="h-[170px] flex items-center justify-center text-sm text-emerald-50/30">Još nema live preview slike</div>
            )}
          </div>
          <div className="mt-3 text-xs text-emerald-50/45">
            <p>Naslov: <span className="text-white/80">{state.previewTitle || "—"}</span></p>
            <p className="mt-1">Tip: Screenshot node se dodaje direktno u canvas.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
