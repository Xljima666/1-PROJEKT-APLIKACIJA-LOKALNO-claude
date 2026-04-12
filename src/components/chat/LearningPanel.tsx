import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Brain, Camera, FolderOpen, Maximize2, Minus, Plus,
  Save, Sparkles, Trash2, Wand2, Play, Square, Globe, MousePointerClick,
  Keyboard, Type, Flag, RefreshCw, Monitor, Circle, StopCircle
} from "lucide-react";
import { CATEGORY_META, LEARNING_NODE_TYPES, type LearningNodeKind } from "./learningNodeTypes";
import { useLearningPanelTech } from "./useLearningPanelTech";

// ─── Stilske konstante ───────────────────────────────────
const bg = "radial-gradient(ellipse 120% 90% at 50% 35%, rgba(10,62,55,1) 0%, rgba(6,31,31,1) 42%, rgba(3,18,18,1) 72%, rgba(2,12,12,1) 100%)";
const panelBg = "rgba(5, 26, 24, 0.82)";
const border = "rgba(94, 234, 212, 0.10)";
const borderActive = "rgba(94, 234, 212, 0.22)";

// ─── Animirana konekcija ─────────────────────────────────
const AnimatedConn = ({ d, color, index, active }: any) => (
  <g>
    <path d={d} fill="none" stroke={color} strokeWidth={active ? 6 : 4} strokeOpacity={active ? 0.14 : 0.05} />
    <path d={d} fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.5} strokeOpacity={active ? 0.78 : 0.42} />
    <circle r={active ? 3.5 : 2.5} fill={color} opacity={active ? 1 : 0.8}>
      <animateMotion dur={`${active ? 1.4 : 3 + (index % 4) * 0.7}s`} repeatCount="indefinite" path={d} />
    </circle>
  </g>
);

// ─── Zoom kontrole ───────────────────────────────────────
const ZoomBar = ({ zoom, onIn, onOut, onFit }: any) => (
  <div className="absolute bottom-20 left-4 z-30 flex flex-col rounded-xl overflow-hidden border"
    style={{ background: "rgba(5,22,21,0.90)", borderColor: border, backdropFilter: "blur(12px)" }}>
    <button onClick={onIn} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06]"><Plus className="w-4 h-4" /></button>
    <div className="text-[9px] text-white/30 text-center py-0.5 border-y" style={{ borderColor: border }}>{Math.round(zoom * 100)}%</div>
    <button onClick={onOut} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06]"><Minus className="w-4 h-4" /></button>
    <button onClick={onFit} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] border-t" style={{ borderColor: border }}><Maximize2 className="w-3.5 h-3.5" /></button>
  </div>
);

// ─── Minimap ─────────────────────────────────────────────
const Minimap = ({ nodes, paths, zoom, panX, panY, vpW, vpH, onNav, getH, CW, CH }: any) => {
  const W = 160, H = 100;
  const s = Math.min(W / CW, H / CH);
  return (
    <div className="absolute bottom-4 right-4 z-30 rounded-xl overflow-hidden border"
      style={{ background: "rgba(5,22,21,0.90)", borderColor: border }}>
      <svg width={W} height={H} className="cursor-pointer"
        onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onNav((e.clientX - r.left) / s, (e.clientY - r.top) / s); }}>
        {paths.map((p: any, i: number) => <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth={0.5} strokeOpacity={0.3} transform={`scale(${s})`} />)}
        {nodes.map((n: any) => {
          const t = LEARNING_NODE_TYPES[n.kind as LearningNodeKind];
          return <rect key={n.id} x={n.x * s} y={n.y * s} width={240 * s} height={getH(n) * s} rx={2} fill={t?.color || "#888"} fillOpacity={0.4} />;
        })}
        <rect x={Math.max(0, (-panX / zoom) * s)} y={Math.max(0, (-panY / zoom) * s)}
          width={Math.min((vpW / zoom) * s, W)} height={Math.min((vpH / zoom) * s, H)}
          fill="rgba(255,255,255,0.04)" stroke="rgba(153,246,228,0.3)" strokeWidth={1} rx={2} />
      </svg>
    </div>
  );
};

// ─── Paleta čvorova ──────────────────────────────────────
const Palette = ({ onAdd }: { onAdd: (kind: LearningNodeKind) => void }) => (
  <div className="w-48 shrink-0 border-r overflow-y-auto" style={{ background: panelBg, borderColor: border }}>
    <div className="px-3 pt-4 pb-2">
      <p className="text-xs font-semibold text-white/80">Čvorovi</p>
      <p className="text-[10px] text-white/30 mt-0.5">Klikni za dodavanje</p>
    </div>
    <div className="p-2 space-y-1">
      {Object.values(LEARNING_NODE_TYPES).map(t => {
        const Icon = t.icon;
        return (
          <button key={t.kind} onClick={() => onAdd(t.kind as LearningNodeKind)}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left hover:translate-x-0.5 transition-transform"
            style={{ background: "rgba(255,255,255,0.025)", borderColor: border }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.glow }}>
              <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white/85">{t.label}</p>
              <p className="text-[9px] text-white/30 uppercase">{t.category}</p>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

// ─── Kartica čvora ───────────────────────────────────────
const NodeCard = ({ node, selected, active, onMouseDown, onClick, getH }: any) => {
  const t = LEARNING_NODE_TYPES[node.kind as LearningNodeKind];
  if (!t) return null;
  const Icon = t.icon;
  return (
    <motion.div
      data-node-card="true"
      onMouseDown={onMouseDown}
      onClick={onClick}
      className="absolute rounded-2xl border overflow-hidden cursor-grab select-none"
      style={{
        left: node.x, top: node.y, width: 240, height: getH(node),
        borderColor: selected ? borderActive : border,
        background: "linear-gradient(180deg, rgba(7,28,26,0.98), rgba(5,20,19,0.96))",
        boxShadow: active ? `0 0 28px ${t.color}33` : selected ? `0 0 0 1px ${t.color}22` : "0 8px 24px rgba(0,0,0,0.3)",
      }}
      animate={active ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.8, repeat: active ? Infinity : 0 }}
    >
      {/* Top color bar */}
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: t.color }} />
      <div className="p-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: t.glow }}>
            <Icon className="w-4 h-4" style={{ color: t.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/90">{node.label}</p>
            <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full inline-block mt-0.5",
              CATEGORY_META[node.category as keyof typeof CATEGORY_META]?.bg,
              CATEGORY_META[node.category as keyof typeof CATEGORY_META]?.text)}>
              {CATEGORY_META[node.category as keyof typeof CATEGORY_META]?.label}
            </span>
          </div>
        </div>
        {/* Config preview */}
        <div className="mt-2 space-y-0.5 text-[10px] text-white/40">
          {node.kind === "goto" && <p className="truncate">🌐 {node.config?.url || "—"}</p>}
          {node.kind === "click" && <p className="truncate">🖱 {node.config?.selector || "—"}</p>}
          {node.kind === "fill" && <>
            <p className="truncate">📍 {node.config?.selector || "—"}</p>
            <p className="truncate">✏️ {node.config?.value || "—"}</p>
          </>}
          {node.kind === "input" && <p className="truncate">⌨️ {node.config?.value || node.config?.key || "—"}</p>}
          {node.kind === "screenshot" && <p className="text-pink-300/60">📸 Screenshot</p>}
          {node.kind === "ai" && <p className="truncate">✨ {node.config?.prompt || "AI block"}</p>}
        </div>
        {/* Screenshot preview */}
        {node.kind === "screenshot" && node.config?.image && (
          <div className="mt-2 rounded-lg overflow-hidden border" style={{ borderColor: border }}>
            <img src={node.config.image} alt="" className="w-full h-[80px] object-cover" />
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Inspector polje ─────────────────────────────────────
const Field = ({ label, value, onChange, placeholder = "", multiline = false, type = "text" }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider block">{label}</label>
    {multiline ? (
      <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder:text-white/20 outline-none focus:border-emerald-500/40 resize-none border"
        style={{ background: "rgba(255,255,255,0.04)", borderColor: border }} />
    ) : (
      <input type={type} value={value ?? ""} onChange={e => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 rounded-lg px-2.5 text-xs text-white/80 placeholder:text-white/20 outline-none focus:border-emerald-500/40 border"
        style={{ background: "rgba(255,255,255,0.04)", borderColor: border }} />
    )}
  </div>
);

// ─── Log redak ───────────────────────────────────────────
const LogRow = ({ entry }: any) => (
  <div className={cn("flex gap-2 rounded-lg px-2.5 py-1.5 text-[11px] border",
    entry.tone === "success" && "bg-emerald-500/[0.05] border-emerald-500/[0.12]",
    entry.tone === "error" && "bg-red-500/[0.05] border-red-500/[0.12]",
    entry.tone === "info" && "border-transparent bg-white/[0.025]",
    !entry.tone && "border-transparent bg-white/[0.025]",
  )}>
    <span className="text-white/25 shrink-0">{entry.time}</span>
    <span className={cn(
      entry.tone === "success" ? "text-emerald-300/80" :
      entry.tone === "error" ? "text-red-300/80" : "text-white/55"
    )}>{entry.msg}</span>
  </div>
);

// ─── Glavna komponenta ───────────────────────────────────
interface Props { onClose: () => void; }

export default function LearningPanel({ onClose }: Props) {
  const { constants, state, actions } = useLearningPanelTech();
  const selected = state.selectedNodeData;
  const [showFlowMenu, setShowFlowMenu] = useState(false);
  const [previewRefreshing, setPreviewRefreshing] = useState(false);
  const nodeMap = new Map(state.nodes.map((n: any) => [n.id, n]));

  // ── Keyboard delete ──────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Delete" || e.key === "Backspace") actions.deleteSelected();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);

  // ── Preview refresh ──────────────────────────────────
  const refreshPreview = useCallback(async () => {
    setPreviewRefreshing(true);
    await actions.loadPreview();
    setPreviewRefreshing(false);
  }, [actions]);

  // ── Auto-refresh preview every 4s while recording ───
  useEffect(() => {
    if (!state.recording) return;
    const id = setInterval(refreshPreview, 4000);
    return () => clearInterval(id);
  }, [state.recording, refreshPreview]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex flex-col"
      style={{ background: bg }}>

      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[18%] w-[500px] h-[500px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, rgba(16,185,129,1), transparent 70%)" }} />
        <div className="absolute top-[40%] right-[12%] w-[400px] h-[400px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(34,211,238,1), transparent 70%)" }} />
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 flex items-center justify-between px-5 py-2.5 border-b shrink-0" style={{ borderColor: border }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-white/70 hover:text-white text-xs"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: border }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Nazad na Stellan
          </button>
          <div className="h-4 w-px" style={{ background: border }} />
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.28), rgba(34,211,238,0.14))" }}>
            <Brain className="w-3.5 h-3.5 text-emerald-300" />
          </div>
          <input value={state.flowName} onChange={e => actions.setFlowName(e.target.value)}
            className="bg-transparent text-sm font-semibold text-white/90 outline-none border-b border-transparent hover:border-white/10 focus:border-white/20 w-44" />
          <span className="text-[10px] px-2 py-0.5 rounded-full border text-white/35" style={{ background: "rgba(255,255,255,0.03)", borderColor: border }}>
            {state.nodes.length} čvorova · {state.connections.length} veza
          </span>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border",
            state.agentOnline ? "text-emerald-300" : state.agentOnline === false ? "text-red-300" : "text-white/30")}
            style={{ background: state.agentOnline ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.08)", borderColor: state.agentOnline ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.15)" }}>
            {state.agentOnline === null ? "Provjera..." : state.agentOnline ? "Agent online ✓" : "Agent offline ✗"}
          </span>
          {state.recording && (
            <span className="flex items-center gap-1 text-[10px] text-red-300 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> SNIMA
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={actions.exportFlowToBrain}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-emerald-100 text-xs"
            style={{ background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.18)" }}>
            <Brain className="w-3 h-3" /> Izvezi u Mozak
          </button>
          <button onClick={actions.saveFlow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-white/65 hover:text-white text-xs"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: border }}>
            <Save className="w-3 h-3" /> Spremi
          </button>
          <div className="relative">
            <button onClick={() => setShowFlowMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-white/65 hover:text-white text-xs"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: border }}>
              <FolderOpen className="w-3 h-3" /> Učitaj
            </button>
            {showFlowMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFlowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border overflow-hidden"
                  style={{ background: "rgba(5,22,21,0.97)", borderColor: border, backdropFilter: "blur(20px)" }}>
                  {state.savedFlows.length === 0
                    ? <p className="text-xs text-white/30 px-4 py-3">Nema spremljenih flowova</p>
                    : state.savedFlows.slice(0, 10).map((f: any) => (
                      <button key={f.id} onClick={() => { actions.loadFlow(f.id); setShowFlowMenu(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] border-b last:border-0 transition-colors"
                        style={{ borderColor: border }}>
                        <p className="text-xs text-white/70">{f.name}</p>
                        <p className="text-[9px] text-white/25">{new Date(f.savedAt).toLocaleString("hr-HR")}</p>
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
          {(state.selectedNode || state.selectedConnection) && (
            <button onClick={actions.deleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-red-300 text-xs"
              style={{ background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.18)" }}>
              <Trash2 className="w-3 h-3" /> Obriši
            </button>
          )}
          <span className="text-[10px] text-white/20 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Stellan</span>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="relative z-10 border-b px-5 py-2.5 flex items-center gap-2 shrink-0 flex-wrap" style={{ borderColor: border }}>
        {/* Smart Auto */}
        <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5 flex-1 min-w-[200px]"
          style={{ background: "rgba(255,255,255,0.03)", borderColor: border }}>
          <Wand2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
          <input value={state.flowPrompt} onChange={e => actions.setFlowPrompt(e.target.value)}
            onKeyDown={e => e.key === "Enter" && actions.generateFlowFromPrompt()}
            placeholder="Smart Auto — napiši što Stellan treba napraviti..."
            className="bg-transparent text-xs text-white/80 outline-none placeholder:text-white/25 w-full" />
        </div>
        <button onClick={actions.generateFlowFromPrompt}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-emerald-100 text-xs shrink-0"
          style={{ background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.18)" }}>
          <Wand2 className="w-3.5 h-3.5" /> Smart Auto
        </button>

        <div className="h-4 w-px shrink-0" style={{ background: border }} />

        {/* Record / Stop */}
        {!state.recording ? (
          <button onClick={actions.startRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-amber-100 text-xs shrink-0"
            style={{ background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.20)" }}>
            <Circle className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Record
          </button>
        ) : (
          <button onClick={actions.stopRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-red-100 text-xs shrink-0 animate-pulse"
            style={{ background: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.25)" }}>
            <StopCircle className="w-3.5 h-3.5" /> Stop Recording
          </button>
        )}

        {/* Run */}
        <button onClick={actions.runFlowAnimated} disabled={state.isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-emerald-100 text-xs shrink-0 disabled:opacity-40"
          style={{ background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.18)" }}>
          <Play className="w-3.5 h-3.5" /> Run Flow
        </button>

        {/* Preview */}
        <button onClick={refreshPreview} disabled={previewRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-cyan-100 text-xs shrink-0 disabled:opacity-40"
          style={{ background: "rgba(34,211,238,0.10)", borderColor: "rgba(34,211,238,0.18)" }}>
          <Camera className="w-3.5 h-3.5" className={previewRefreshing ? "animate-spin" : ""} /> Preview
        </button>

        {/* Improve */}
        <button onClick={actions.improveWithAI}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-violet-100 text-xs shrink-0"
          style={{ background: "rgba(139,92,246,0.10)", borderColor: "rgba(139,92,246,0.18)" }}>
          <Sparkles className="w-3.5 h-3.5" /> Improve
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex min-h-0 relative z-10">

        {/* Paleta */}
        <Palette onAdd={kind => actions.addNode(kind)} />

        {/* Canvas */}
        <div ref={state.containerRef}
          className={cn("flex-1 relative overflow-hidden", state.isPanning ? "cursor-grabbing" : "cursor-grab")}
          onMouseDown={actions.handleCanvasMouseDown}>
          <div data-canvas="true" className="absolute inset-0" />
          <div style={{
            transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`,
            transformOrigin: "0 0", position: "absolute",
            width: constants.CANVAS_W, height: constants.CANVAS_H,
          }}>
            {/* Grid */}
            <svg className="absolute inset-0 pointer-events-none" width={constants.CANVAS_W} height={constants.CANVAS_H}>
              <defs>
                <pattern id="lg-grid" width="44" height="44" patternUnits="userSpaceOnUse">
                  <path d="M 44 0 L 0 0 0 44" fill="none" stroke="rgba(94,234,212,0.04)" strokeWidth="0.7" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#lg-grid)" />
            </svg>

            {/* Konekcije */}
            <svg className="absolute inset-0 pointer-events-none" width={constants.CANVAS_W} height={constants.CANVAS_H} style={{ zIndex: 1 }}>
              {state.connectionPaths.map((cp: any, i: number) => {
                const fromNode = nodeMap.get(cp.fromNode);
                const t = LEARNING_NODE_TYPES[(fromNode as any)?.kind as LearningNodeKind];
                const color = t?.color || "#5eead4";
                return (
                  <g key={cp.id} onClick={e => { e.stopPropagation(); actions.setSelectedConnection(cp.id); actions.setSelectedNode(null); }}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}>
                    <path d={cp.d} fill="none" stroke="transparent" strokeWidth={14} />
                    <AnimatedConn d={cp.d} color={state.selectedConnection === cp.id ? "#ccfbf1" : color} index={i}
                      active={state.activeNodes.includes(cp.fromNode) || state.activeNodes.includes(cp.toNode)} />
                  </g>
                );
              })}
            </svg>

            {/* Čvorovi */}
            <div style={{ position: "relative", zIndex: 2, width: constants.CANVAS_W, height: constants.CANVAS_H }}>
              {state.nodes.map((node: any) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  selected={state.selectedNode === node.id}
                  active={state.activeNodes.includes(node.id)}
                  onMouseDown={(e: any) => actions.handleNodeMouseDown(node.id, e)}
                  onClick={(e: any) => { e.stopPropagation(); actions.setSelectedNode(node.id); actions.setSelectedConnection(null); }}
                  getH={constants.getNodeHeight}
                />
              ))}
              {state.nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-2xl border flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", borderColor: border }}>
                      <Brain className="w-8 h-8 text-emerald-100/10" />
                    </div>
                    <p className="text-sm text-emerald-50/35">Klikni Record → klikaj po Chromiumu</p>
                    <p className="text-xs text-white/20">ili dodaj čvorove iz palete lijevo</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ZoomBar zoom={state.zoom} onIn={actions.zoomIn} onOut={actions.zoomOut} onFit={actions.fitToScreen} />
          <Minimap nodes={state.nodes} paths={state.connectionPaths.map((cp: any) => {
            const fn = nodeMap.get(cp.fromNode);
            const t = LEARNING_NODE_TYPES[(fn as any)?.kind as LearningNodeKind];
            return { ...cp, color: t?.color || "#5eead4" };
          })} zoom={state.zoom} panX={state.pan.x} panY={state.pan.y}
            vpW={state.vpSize.w} vpH={state.vpSize.h}
            onNav={actions.handleMinimapNav}
            getH={constants.getNodeHeight}
            CW={constants.CANVAS_W} CH={constants.CANVAS_H} />
        </div>

        {/* Inspector */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-72 border-l flex flex-col overflow-hidden shrink-0"
              style={{ background: "rgba(5,22,21,0.95)", borderColor: border }}>

              {/* Inspector header */}
              <div className="p-4 border-b flex items-center gap-2.5" style={{ borderColor: border }}>
                {(() => {
                  const t = LEARNING_NODE_TYPES[selected.kind as LearningNodeKind];
                  const Icon = t?.icon;
                  return (
                    <>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: t?.glow || "" }}>
                        {Icon && <Icon className="w-4 h-4" style={{ color: t?.color }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/90">{selected.label}</p>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full",
                          CATEGORY_META[selected.category as keyof typeof CATEGORY_META]?.bg,
                          CATEGORY_META[selected.category as keyof typeof CATEGORY_META]?.text)}>
                          {CATEGORY_META[selected.category as keyof typeof CATEGORY_META]?.label}
                        </span>
                      </div>
                      <button onClick={actions.deleteSelected}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-white/20 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  );
                })()}
              </div>

              {/* Config polja */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selected.kind === "goto" && <>
                  <Field label="URL" value={selected.config?.url || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "url", v)} placeholder="https://oss.uredjenazemlja.hr/" />
                  <Field label="Timeout (ms)" type="number" value={selected.config?.timeout || 45000} onChange={(v: number) => actions.updateNodeConfig(selected.id, "timeout", v)} />
                </>}
                {selected.kind === "click" && <>
                  <Field label="Selector" value={selected.config?.selector || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "selector", v)} placeholder='text=Prijava' />
                  <Field label="Timeout (ms)" type="number" value={selected.config?.timeout || 20000} onChange={(v: number) => actions.updateNodeConfig(selected.id, "timeout", v)} />
                </>}
                {selected.kind === "fill" && <>
                  <Field label="Selector" value={selected.config?.selector || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "selector", v)} placeholder='input[name="username"]' />
                  <Field label="Vrijednost" value={selected.config?.value || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "value", v)} placeholder="tekst koji se upisuje" multiline />
                  <Field label="Timeout (ms)" type="number" value={selected.config?.timeout || 20000} onChange={(v: number) => actions.updateNodeConfig(selected.id, "timeout", v)} />
                </>}
                {selected.kind === "input" && <>
                  <Field label="Key" value={selected.config?.key || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "key", v)} placeholder="Enter, Tab..." />
                  <Field label="Vrijednost" value={selected.config?.value || ""} onChange={(v: string) => actions.updateNodeConfig(selected.id, "value", v)} multiline />
                </>}
                {selected.kind === "screenshot" && <>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="fp" checked={selected.config?.full_page !== false}
                      onChange={e => actions.updateNodeConfig(selected.id, "full_page", e.target.checked)} />
                    <label htmlFor="fp" className="text-xs text-white/60">Cijela stranica</label>
                  </div>
                  {selected.config?.image && (
                    <div className="rounded-xl overflow-hidden border" style={{ borderColor: border }}>
                      <img src={selected.config.image} alt="" className="w-full object-cover" />
                    </div>
                  )}
                </>}
                {selected.kind === "ai" && <>
                  <Field label="Prompt / Rezultat" value={selected.config?.prompt || selected.config?.result || ""}
                    onChange={(v: string) => actions.updateNodeConfig(selected.id, "prompt", v)} multiline />
                </>}

                {/* Status */}
                <div className="pt-3 border-t space-y-1" style={{ borderColor: border }}>
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">Status</p>
                  <p className={cn("text-xs", state.activeNodes.includes(selected.id) ? "text-amber-300" : "text-white/35")}>
                    {state.activeNodes.includes(selected.id) ? "⚡ Running..." : "Idle"}
                  </p>
                </div>

                {/* Veze */}
                {state.connections.filter((c: any) => c.fromNode === selected.id || c.toNode === selected.id).length > 0 && (
                  <div className="pt-2 border-t space-y-1" style={{ borderColor: border }}>
                    <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">Veze</p>
                    {state.connections.filter((c: any) => c.fromNode === selected.id || c.toNode === selected.id).map((c: any, i: number) => {
                      const otherId = c.fromNode === selected.id ? c.toNode : c.fromNode;
                      const other = nodeMap.get(otherId) as any;
                      return (
                        <p key={i} className="text-[10px] text-white/40">
                          {c.fromNode === selected.id ? "→" : "←"} {other?.label || "?"}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Flow Runner + Live Preview ── */}
      <div className="relative z-10 border-t shrink-0 grid grid-cols-[1fr_300px]"
        style={{ borderColor: border, background: "rgba(5,22,21,0.80)", backdropFilter: "blur(20px)", height: 220 }}>

        {/* Runner + Log */}
        <div className="p-4 flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white/80">Flow Runner</p>
            <span className="text-[10px] text-white/25">{state.nodes.length} čvorova · {state.connections.length} veza</span>
            {state.isRunning && <span className="text-[10px] text-emerald-300 animate-pulse">Izvršava se...</span>}
            {state.recording && <span className="text-[10px] text-red-300 animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Snimanje aktivo</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={actions.runFlowAnimated} disabled={state.isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-emerald-100 text-xs disabled:opacity-40"
              style={{ background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.18)" }}>
              <Play className="w-3.5 h-3.5" /> Run Flow
            </button>
            <button onClick={refreshPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-white/60 text-xs"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: border }}>
              <Camera className="w-3.5 h-3.5" /> Preview
            </button>
            <button onClick={actions.fitToScreen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-white/60 text-xs"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: border }}>
              <Maximize2 className="w-3.5 h-3.5" /> Fit
            </button>
          </div>
          {/* Log */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {state.logs.length === 0
              ? <p className="text-xs text-white/20 italic">Log je prazan...</p>
              : [...state.logs].reverse().slice(0, 8).map((entry: any, i: number) => <LogRow key={i} entry={entry} />)
            }
          </div>
        </div>

        {/* Live Preview */}
        <div className="border-l p-4 flex flex-col gap-2" style={{ borderColor: border }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5" /> Live Preview
            </p>
            <button onClick={refreshPreview} disabled={previewRefreshing}
              className="p-1 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors disabled:opacity-30">
              <RefreshCw className={cn("w-3.5 h-3.5", previewRefreshing && "animate-spin")} />
            </button>
          </div>
          <div className="flex-1 rounded-xl overflow-hidden border relative" style={{ background: "rgba(255,255,255,0.025)", borderColor: border }}>
            {state.previewImage ? (
              <img src={state.previewImage} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <Monitor className="w-6 h-6 text-white/15" />
                <p className="text-xs text-white/20">Klikni Preview za screenshot</p>
                <p className="text-[10px] text-white/12">ili se osvježi automatski dok snimaš</p>
              </div>
            )}
          </div>
          {state.previewTitle && (
            <p className="text-[10px] text-white/35 truncate">{state.previewTitle}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
