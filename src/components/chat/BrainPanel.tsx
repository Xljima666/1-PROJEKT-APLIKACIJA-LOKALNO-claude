import { Brain, ArrowLeft, Sparkles, Minus, Plus, Maximize2, Trash2, Save, FolderOpen, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import NodeCard from "./brain/NodeCard";
import NodePalette from "./brain/NodePalette";
import RunPanel from "./brain/RunPanel";
import {
  CATEGORY_META,
  PORT_COLORS,
  MINIMAP_COLORS,
  NODE_W,
  CANVAS_W,
  CANVAS_H,
  getNodeHeight,
} from "./brain/types";
import { useBrainPanelTech } from "./BrainPanelTech";

// ─── Animated connection ────────────────────────────────
const AnimatedConnection = ({ d, color, index, isActive }: { d: string; color: string; index: number; isActive?: boolean }) => (
  <g>
    <path d={d} fill="none" stroke={color} strokeWidth={isActive ? 6 : 4} strokeOpacity={isActive ? 0.15 : 0.06} />
    <path d={d} fill="none" stroke={color} strokeWidth={isActive ? 2 : 1.5} strokeOpacity={isActive ? 0.7 : 0.5} />
    <circle r={isActive ? 3.5 : 2.5} fill={color} opacity={isActive ? 1 : 0.8}>
      <animateMotion dur={`${isActive ? 1.5 : 3 + (index % 4) * 0.7}s`} repeatCount="indefinite" path={d} />
    </circle>
  </g>
);

// ─── Minimap ────────────────────────────────────────────
const Minimap = ({ nodes, connectionPaths, zoom, panX, panY, vpW, vpH, onNav }: {
  nodes: any[]; connectionPaths: { d: string; color: string }[];
  zoom: number; panX: number; panY: number; vpW: number; vpH: number;
  onNav: (x: number, y: number) => void;
}) => {
  const mmW = 180, mmH = 110;
  const scale = Math.min(mmW / CANVAS_W, mmH / CANVAS_H);
  const vx = (-panX / zoom) * scale, vy = (-panY / zoom) * scale;
  const vw = (vpW / zoom) * scale, vh = (vpH / zoom) * scale;
  return (
    <div className="absolute bottom-4 right-4 z-30 rounded-xl overflow-hidden border border-white/[0.08]"
      style={{ background: "rgba(7,22,19,0.88)", backdropFilter: "blur(12px)" }}>
      <svg width={mmW} height={mmH} className="cursor-pointer"
        onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onNav((e.clientX - r.left) / scale, (e.clientY - r.top) / scale); }}>
        {connectionPaths.map((cp, i) => <path key={i} d={cp.d} fill="none" stroke={cp.color} strokeWidth={0.5} strokeOpacity={0.3} transform={`scale(${scale})`} />)}
        {nodes.map(n => <rect key={n.id} x={n.x * scale} y={n.y * scale} width={NODE_W * scale} height={getNodeHeight(n) * scale} rx={2} fill={MINIMAP_COLORS[n.category] || "#888"} fillOpacity={0.5} />)}
        <rect x={Math.max(0, vx)} y={Math.max(0, vy)} width={Math.min(vw, mmW)} height={Math.min(vh, mmH)} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.3)" strokeWidth={1} rx={2} />
      </svg>
    </div>
  );
};

// ─── Zoom controls ──────────────────────────────────────
const ZoomControls = ({ zoom, onIn, onOut, onFit }: { zoom: number; onIn: () => void; onOut: () => void; onFit: () => void }) => (
  <div className="absolute bottom-20 left-4 z-30 flex flex-col gap-1 rounded-xl overflow-hidden border border-white/[0.08]"
    style={{ background: "rgba(7,22,19,0.88)", backdropFilter: "blur(12px)" }}>
    <button onClick={onIn} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"><Plus className="w-4 h-4" /></button>
    <div className="text-[9px] text-white/30 text-center py-0.5 border-y border-white/[0.06]">{Math.round(zoom * 100)}%</div>
    <button onClick={onOut} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"><Minus className="w-4 h-4" /></button>
    <button onClick={onFit} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors border-t border-white/[0.06]"><Maximize2 className="w-3.5 h-3.5" /></button>
  </div>
);

// ─── Main BrainPanel ────────────────────────────────────
interface Props { onClose: () => void; activeNodes?: string[]; }

const BrainPanel = ({ onClose, activeNodes = [] }: Props) => {
  const { state, actions } = useBrainPanelTech(activeNodes);
  const selected = state.selectedNodeData;
  const [smartPrompt, setSmartPrompt] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "radial-gradient(ellipse 125% 82% at 50% 38%, rgba(10,42,34,1) 0%, rgba(6,24,20,1) 52%, rgba(4,14,14,1) 100%)" }}
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-[20%] w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(16,185,129,1), transparent 70%)" }} />
        <div className="absolute top-[50%] right-[15%] w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, rgba(34,197,94,0.95), transparent 70%)" }} />
        <div className="absolute bottom-[10%] left-[40%] w-[350px] h-[350px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, rgba(45,212,191,0.95), transparent 70%)" }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/70 hover:text-white transition-all text-xs font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Nazad na Stellan
          </motion.button>
          <div className="h-5 w-px bg-white/[0.08]" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.32), rgba(20,184,166,0.16))" }}>
              <Brain className="w-4 h-4 text-emerald-300" style={{ filter: "drop-shadow(0 0 6px rgba(16,185,129,0.45))" }} />
            </div>
            <input value={state.flowName} onChange={e => actions.setFlowName(e.target.value)}
              className="bg-transparent text-sm font-semibold text-white/90 outline-none border-b border-transparent hover:border-white/10 focus:border-white/20 transition-colors w-40" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">
              {state.nodes.length} čvorova · {state.connections.length} veza
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => actions.importBridgeFromLearning()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-200 transition-all text-xs"
          >
            <Brain className="w-3 h-3" /> Uvezi iz Učenja
          </button>
          <button onClick={actions.saveFlow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white transition-all text-xs">
            <Save className="w-3 h-3" /> Spremi
          </button>
          <div className="relative">
            <button onClick={() => actions.setShowFlowMenu(!state.showFlowMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white transition-all text-xs">
              <FolderOpen className="w-3 h-3" /> Učitaj
            </button>
            {state.showFlowMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => actions.setShowFlowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-white/[0.08] overflow-hidden"
                  style={{ background: "rgba(7,22,19,0.96)", backdropFilter: "blur(20px)" }}>
                  {state.savedFlows.length === 0 ? (
                    <p className="text-xs text-white/30 px-4 py-3">Nema spremljenih flowova</p>
                  ) : state.savedFlows.map(flow => (
                    <button key={flow.id} onClick={() => actions.loadFlow(flow.id)}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04] last:border-0">
                      <p className="text-xs text-white/70">{flow.name}</p>
                      <p className="text-[9px] text-white/25">{new Date(flow.savedAt).toLocaleString("hr")}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {(state.selectedNode || state.selectedConnection) && (
            <button onClick={actions.handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 text-red-400 transition-all text-xs">
              <Trash2 className="w-3 h-3" /> Obriši
            </button>
          )}
          <div className="flex items-center gap-1 text-[10px] text-white/30">
            <Sparkles className="w-3 h-3" /> Stellan Workflow Builder
          </div>
        </div>
      </div>

      <div className="relative z-10 border-b border-white/[0.06] px-5 py-3 flex items-center gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 flex-1 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-emerald-300" />
          <input
            value={smartPrompt}
            onChange={(e) => setSmartPrompt(e.target.value)}
            placeholder="Smart Auto... npr. Odi na OSS i klikni Prijava"
            className="bg-transparent w-full text-sm text-white/85 outline-none placeholder:text-white/25"
          />
        </div>
        <button
          onClick={() => smartPrompt.trim() && actions.runSmartAuto(smartPrompt)}
          className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-100 border border-emerald-400/20 text-sm"
        >
          <Wand2 className="w-4 h-4 inline mr-1" /> Smart Auto
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 relative z-10">
        <NodePalette onAddNode={(template, x, y) => actions.handleAddNode(template, x, y)} />

        {/* Canvas */}
        <div ref={state.containerRef}
          className={cn("flex-1 relative overflow-hidden", state.isPanning ? "cursor-grabbing" : state.drawingConn ? "cursor-crosshair" : "cursor-grab")}
          onMouseDown={actions.handleCanvasMouseDown}
        >
          <div data-canvas="true" className="absolute inset-0" />
          <div style={{ transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`, transformOrigin: "0 0", position: "absolute", width: CANVAS_W, height: CANVAS_H }}>
            {/* Grid */}
            <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W} height={CANVAS_H}>
              <defs>
                <pattern id="brain-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#brain-grid)" />
            </svg>

            {/* Connections */}
            <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W} height={CANVAS_H} style={{ zIndex: 1 }}>
              {state.connectionPaths.map((cp, i) => (
                <g data-connection="true" key={cp.id} onClick={e => { e.stopPropagation(); actions.setSelectedConnection(cp.id); actions.setSelectedNode(null); }} style={{ pointerEvents: "stroke", cursor: "pointer" }}>
                  <path d={cp.d} fill="none" stroke="transparent" strokeWidth={12} />
                  <AnimatedConnection d={cp.d} color={state.selectedConnection === cp.id ? "#fff" : cp.color} index={i} isActive={state.activeNodes.includes(cp.fromNode) || state.activeNodes.includes(cp.toNode)} />
                </g>
              ))}
              {state.drawingPath && (
                <path d={state.drawingPath} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeDasharray="6 4" />
              )}
            </svg>

            {/* Nodes */}
            <div style={{ position: "relative", zIndex: 2, width: CANVAS_W, height: CANVAS_H }}>
              {state.nodes.map(node => (
                <NodeCard
                  key={node.id}
                  node={node}
                  isSelected={state.selectedNode === node.id}
                  isDragging={false}
                  runStatus={state.runStatuses[node.id]}
                  onMouseDown={e => actions.handleNodeMouseDown(node.id, e)}
                  onClick={e => actions.handleNodeClick(node.id, e)}
                  onPortMouseDown={actions.handlePortMouseDown}
                  onPortMouseUp={actions.handlePortMouseUp}
                />
              ))}
              {state.nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                      <Brain className="w-8 h-8 text-white/10" />
                    </div>
                    <p className="text-sm text-emerald-100/35">Dodaj čvorove iz palete lijevo</p>
                    <p className="text-xs text-white/15">Spoji ih povlačenjem portova</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ZoomControls zoom={state.zoom} onIn={actions.zoomIn} onOut={actions.zoomOut} onFit={actions.fitToScreen} />
          <Minimap nodes={state.nodes} connectionPaths={state.connectionPaths} zoom={state.zoom} panX={state.pan.x} panY={state.pan.y} vpW={state.vpSize.w} vpH={state.vpSize.h} onNav={actions.handleMinimapNav} />
        </div>

        {/* Inspector */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-60 border-l border-white/[0.06] p-4 space-y-4 overflow-y-auto shrink-0"
              style={{ background: "rgba(7,22,19,0.9)", backdropFilter: "blur(20px)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: CATEGORY_META[selected.category].glow }}>
                  <selected.icon className={cn("w-4 h-4", CATEGORY_META[selected.category].text)} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">{selected.label}</p>
                  <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-md", CATEGORY_META[selected.category].bg, CATEGORY_META[selected.category].text)}>
                    {CATEGORY_META[selected.category].label}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Portovi</p>
                {selected.ports.map(port => (
                  <div key={port.id} className="flex items-center gap-2 text-xs text-white/60">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PORT_COLORS[port.color], boxShadow: `0 0 4px ${PORT_COLORS[port.color]}40` }} />
                    <span>{port.label}</span>
                    <span className="text-white/20 text-[9px] ml-auto">{port.side}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Veze</p>
                {state.connections.filter(c => c.fromNode === selected.id || c.toNode === selected.id).map((c, i) => {
                  const otherId = c.fromNode === selected.id ? c.toNode : c.fromNode;
                  const other = state.nodes.find(n => n.id === otherId);
                  return (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-white/50">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PORT_COLORS[c.color] }} />
                      <span>{c.fromNode === selected.id ? "→" : "←"} {other?.label}</span>
                    </div>
                  );
                })}
              </div>
              {state.runStatuses[selected.id] && state.runStatuses[selected.id].status !== "idle" && (
                <div className="pt-3 border-t border-white/[0.06] space-y-1">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Status</p>
                  <p className={cn("text-xs font-medium",
                    state.runStatuses[selected.id].status === "success" && "text-emerald-400",
                    state.runStatuses[selected.id].status === "error" && "text-red-400",
                    state.runStatuses[selected.id].status === "running" && "text-amber-400",
                  )}>{state.runStatuses[selected.id].status}</p>
                  {state.runStatuses[selected.id].duration && <p className="text-[10px] text-white/20">{state.runStatuses[selected.id].duration}ms</p>}
                  {state.runStatuses[selected.id].error && <p className="text-[10px] text-red-400/60">{state.runStatuses[selected.id].error}</p>}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Run panel */}
      <RunPanel
        nodes={state.nodes}
        connections={state.connections}
        runStatuses={state.runStatuses}
        isRunning={state.isRunning}
        onRun={actions.runFlow}
        onStop={actions.stopFlow}
        onReset={actions.resetRun}
        onPreview={actions.importBridgeFromLearning}
      />
    </motion.div>
  );
};

export default BrainPanel;
