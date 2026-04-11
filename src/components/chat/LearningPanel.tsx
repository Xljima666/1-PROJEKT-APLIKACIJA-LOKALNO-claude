import { ArrowLeft, Brain, Camera, FolderOpen, Maximize2, Minus, Play, Plus, Save, Sparkles, Trash2, Wand2, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CATEGORY_META, LEARNING_NODE_TYPES } from "./learningNodeTypes";
import { useLearningPanelTech } from "./useLearningPanelTech";
 
const AnimatedConnection = ({ d, color, index, isActive }: { d: string; color: string; index: number; isActive?: boolean }) => (
  <g>
    <path d={d} fill="none" stroke={color} strokeWidth={isActive ? 6 : 4} strokeOpacity={isActive ? 0.15 : 0.06} />
    <path d={d} fill="none" stroke={color} strokeWidth={isActive ? 2 : 1.5} strokeOpacity={isActive ? 0.7 : 0.45} />
    <circle r={isActive ? 3.5 : 2.5} fill={color} opacity={isActive ? 1 : 0.75}>
      <animateMotion dur={`${isActive ? 1.4 : 3 + (index % 4) * 0.7}s`} repeatCount="indefinite" path={d} />
    </circle>
  </g>
);

const NodePalette = ({ onAdd }: { onAdd: (kind: keyof typeof LEARNING_NODE_TYPES) => void }) => (
  <div className="w-[240px] border-r border-white/[0.06] p-4 overflow-y-auto shrink-0" style={{ background: "rgba(12,10,22,0.72)", backdropFilter: "blur(18px)" }}>
    <div className="mb-4">
      <p className="text-sm font-semibold text-white/90">Learning Nodes</p>
      <p className="text-xs text-white/35">Klikni za dodavanje u flow</p>
    </div>

    <div className="space-y-2">
      {Object.values(LEARNING_NODE_TYPES).map((template) => {
        const Icon = template.icon;
        return (
          <button
            key={template.kind}
            onClick={() => onAdd(template.kind)}
            className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition text-left p-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: template.glow }}>
                <Icon className="w-4 h-4" style={{ color: template.color }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/90">{template.label}</p>
                <p className="text-[10px] text-white/35 uppercase tracking-wider">{template.category}</p>
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
  return (
    <motion.div
      data-node-card="true"
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={cn(
        "absolute rounded-2xl border overflow-hidden select-none cursor-grab",
        isSelected ? "border-white/30 shadow-[0_0_0_1px_rgba(255,255,255,0.10)]" : "border-white/[0.08]"
      )}
      style={{
        left: node.x,
        top: node.y,
        width: 240,
        height: getNodeHeight(node),
        background: "linear-gradient(180deg, rgba(18,14,30,0.98), rgba(11,9,20,0.96))",
        boxShadow: isActive ? `0 0 28px ${template.color}30` : "0 12px 32px rgba(0,0,0,0.28)",
      }}
      animate={isActive ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.8, repeat: isActive ? Infinity : 0 }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: template.color }} />
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: template.glow }}>
            <Icon className="w-4 h-4" style={{ color: template.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/90 truncate">{node.label}</p>
            <span className={cn("text-[9px] px-2 py-0.5 rounded-full inline-block mt-1", CATEGORY_META[node.category].bg, CATEGORY_META[node.category].text)}>
              {CATEGORY_META[node.category].label}
            </span>
          </div>
        </div>

        <div className="mt-3 text-[10px] text-white/45 space-y-1">
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
          <div className="mt-3 rounded-xl overflow-hidden border border-white/[0.06] bg-black/20">
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
    <div className="absolute bottom-4 right-4 z-30 rounded-xl overflow-hidden border border-white/[0.08]" style={{ background: "rgba(10,8,20,0.85)", backdropFilter: "blur(12px)" }}>
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
        {nodes.map((n: any) => (
          <rect key={n.id} x={n.x * scale} y={n.y * scale} width={240 * scale} height={getNodeHeight(n) * scale} rx={2} fill={LEARNING_NODE_TYPES[n.kind].color} fillOpacity={0.45} />
        ))}
        <rect x={Math.max(0, vx)} y={Math.max(0, vy)} width={Math.min(vw, mmW)} height={Math.min(vh, mmH)} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.3)" strokeWidth={1} rx={2} />
      </svg>
    </div>
  );
};

const ZoomControls = ({ zoom, onIn, onOut, onFit }: any) => (
  <div className="absolute bottom-20 left-4 z-30 flex flex-col gap-1 rounded-xl overflow-hidden border border-white/[0.08]" style={{ background: "rgba(10,8,20,0.85)", backdropFilter: "blur(12px)" }}>
    <button onClick={onIn} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06]"><Plus className="w-4 h-4" /></button>
    <div className="text-[9px] text-white/30 text-center py-0.5 border-y border-white/[0.06]">{Math.round(zoom * 100)}%</div>
    <button onClick={onOut} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06]"><Minus className="w-4 h-4" /></button>
    <button onClick={onFit} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] border-t border-white/[0.06]"><Maximize2 className="w-3.5 h-3.5" /></button>
  </div>
);

const InspectorField = ({ label, value, onChange, multiline = false, numeric = false, placeholder = "" }: any) => (
  <div className="space-y-1.5">
    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">{label}</p>
    {multiline ? (
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full min-h-[76px] rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-white/85 outline-none focus:border-white/[0.16]" />
    ) : (
      <input type={numeric ? "number" : "text"} value={value ?? ""} onChange={(e) => onChange(numeric ? Number(e.target.value || 0) : e.target.value)} placeholder={placeholder} className="w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-xs text-white/85 outline-none focus:border-white/[0.16]" />
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
          entry.tone === "success" && "border-emerald-400/12 bg-emerald-500/[0.06]",
          entry.tone === "error" && "border-red-400/12 bg-red-500/[0.06]",
          (!entry.tone || entry.tone === "info") && "border-white/8 bg-white/[0.03]"
        )}
      >
        <div className="mt-0.5 text-[11px] text-white/30">{entry.time}</div>
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[80] flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse 120% 80% at 50% 40%, rgba(30,20,50,1) 0%, rgba(12,10,22,1) 50%, rgba(8,6,16,1) 100%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-[20%] w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(167,139,250,1), transparent 70%)" }} />
        <div className="absolute top-[50%] right-[15%] w-[420px] h-[420px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, rgba(56,189,248,1), transparent 70%)" }} />
        <div className="absolute bottom-[10%] left-[40%] w-[350px] h-[350px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, rgba(244,114,182,1), transparent 70%)" }} />
      </div>

      <div className="relative z-10 flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={onClose} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 hover:text-white text-xs font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Nazad na Stellan
          </motion.button>

          <div className="h-5 w-px bg-white/[0.08]" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(139,92,246,0.15))" }}>
              <Brain className="w-4 h-4 text-purple-400" style={{ filter: "drop-shadow(0 0 6px rgba(167,139,250,0.5))" }} />
            </div>
            <input value={state.flowName} onChange={(e) => actions.setFlowName(e.target.value)} className="bg-transparent text-sm font-semibold text-white/90 outline-none border-b border-transparent hover:border-white/10 focus:border-white/20 transition-colors w-48" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">
              {state.nodes.length} nodeova · {state.connections.length} veza
            </span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", state.agentOnline ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-red-500/20 bg-red-500/10 text-red-200")}>
              {state.agentOnline ? "Agent online" : "Agent offline"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={actions.saveFlow} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white text-xs">
            <Save className="w-3 h-3" /> Spremi
          </button>

          <div className="relative">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white text-xs">
              <FolderOpen className="w-3 h-3" /> Učitaj
            </button>
            {state.savedFlows.length > 0 && (
              <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-white/[0.08] overflow-hidden" style={{ background: "rgba(12,10,22,0.96)", backdropFilter: "blur(20px)" }}>
                {state.savedFlows.slice(0, 8).map((flow: any) => (
                  <button key={flow.id} onClick={() => actions.loadFlow(flow.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] border-b border-white/[0.04] last:border-0">
                    <p className="text-xs text-white/70">{flow.name}</p>
                    <p className="text-[9px] text-white/25">{new Date(flow.savedAt).toLocaleString("hr-HR")}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {(state.selectedNode || state.selectedConnection) && (
            <button onClick={actions.deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 text-red-400 text-xs">
              <Trash2 className="w-3 h-3" /> Obriši
            </button>
          )}

          <div className="flex items-center gap-1 text-[10px] text-white/30">
            <Sparkles className="w-3 h-3" /> Learning Workflow Builder
          </div>
        </div>
      </div>

      <div className="relative z-10 border-b border-white/[0.06] px-5 py-3 flex items-center gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 flex-1 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-violet-300" />
          <input
            value={state.flowPrompt}
            onChange={(e) => actions.setFlowPrompt(e.target.value)}
            placeholder="Napiši što želiš da Stellan napravi... npr. Odi na OSS i klikni Prijava"
            className="bg-transparent w-full text-sm text-white/85 outline-none placeholder:text-white/25"
          />
        </div>
        <button onClick={actions.generateFlowFromPrompt} className="px-3 py-2 rounded-xl bg-violet-500/15 text-violet-200 border border-violet-400/20 text-sm">🧠 Generate</button>
        {!state.recording ? (
          <button onClick={actions.startRecording} className="px-3 py-2 rounded-xl bg-amber-500/15 text-amber-100 border border-amber-400/20 text-sm">⏺ Record</button>
        ) : (
          <button onClick={actions.stopRecording} className="px-3 py-2 rounded-xl bg-red-500/15 text-red-100 border border-red-400/20 text-sm">⏹ Stop</button>
        )}
        <button onClick={actions.runFlowAnimated} disabled={state.isRunning} className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-100 border border-emerald-400/20 text-sm disabled:opacity-40">
          <Play className="w-4 h-4 inline mr-1" /> Run
        </button>
        <button onClick={actions.loadPreview} className="px-3 py-2 rounded-xl bg-pink-500/15 text-pink-100 border border-pink-400/20 text-sm">
          <Camera className="w-4 h-4 inline mr-1" /> Preview Node
        </button>
        <button onClick={actions.improveWithAI} className="px-3 py-2 rounded-xl bg-sky-500/15 text-sky-100 border border-sky-400/20 text-sm">✨ AI Improve</button>
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
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#learning-grid)" />
            </svg>

            <svg className="absolute inset-0 pointer-events-none" width={constants.CANVAS_W} height={constants.CANVAS_H} style={{ zIndex: 1 }}>
              {state.connectionPaths.map((cp: any, i: number) => (
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
                  <AnimatedConnection d={cp.d} color={state.selectedConnection === cp.id ? "#fff" : cp.color} index={i} isActive={state.activeNodes.includes(cp.fromNode) || state.activeNodes.includes(cp.toNode)} />
                </g>
              ))}
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
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                      <Brain className="w-8 h-8 text-white/10" />
                    </div>
                    <p className="text-sm text-white/30">Dodaj nodeove iz palete lijevo</p>
                    <p className="text-xs text-white/15">Record, Generate ili ručno složi workflow</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ZoomControls zoom={state.zoom} onIn={actions.zoomIn} onOut={actions.zoomOut} onFit={actions.fitToScreen} />
          <Minimap
            nodes={state.nodes}
            connectionPaths={state.connectionPaths}
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
              className="w-72 border-l border-white/[0.06] p-4 space-y-4 overflow-y-auto shrink-0"
              style={{ background: "rgba(15,12,25,0.85)", backdropFilter: "blur(20px)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: LEARNING_NODE_TYPES[selected.kind].glow }}>
                  {(() => { const Icon = LEARNING_NODE_TYPES[selected.kind].icon; return <Icon className="w-4 h-4" style={{ color: LEARNING_NODE_TYPES[selected.kind].color }} />; })()}
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
                    <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-black/20">
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

              <div className="pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">Status</p>
                <p className="text-xs text-white/60">{state.activeNodes.includes(selected.id) ? "Running" : "Idle"}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-10 border-t border-white/[0.06] bg-[rgba(10,8,20,0.78)] backdrop-blur-xl h-[260px] grid grid-cols-[1.2fr_340px]">
        <div className="p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white/90">Activity Log</p>
            <div className="flex items-center gap-2">
              {state.recording && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/12 text-amber-200 border border-amber-400/20">
                  Recording aktivan
                </span>
              )}
              {state.isRunning && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/12 text-emerald-200 border border-emerald-400/20">
                  Flow se izvršava
                </span>
              )}
            </div>
          </div>
          <ToneLog logs={state.logs} />
        </div>

        <div className="border-l border-white/[0.06] p-4 overflow-y-auto">
          <p className="text-sm font-semibold text-white/90 mb-3">Live Preview</p>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
            {state.previewImage ? (
              <img src={state.previewImage} alt="preview" className="w-full h-[170px] object-cover" />
            ) : (
              <div className="h-[170px] flex items-center justify-center text-sm text-white/30">Još nema live preview slike</div>
            )}
          </div>
          <div className="mt-3 text-xs text-white/45">
            <p>Naslov: <span className="text-white/80">{state.previewTitle || "—"}</span></p>
            <p className="mt-1">Tip: Screenshot node se dodaje direktno u canvas.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
