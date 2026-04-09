import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Brain, ArrowLeft, Sparkles, Minus, Plus, Maximize2, Trash2, Save, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  type BrainNode, type Connection, type NodeTemplate, type NodeRunStatus,
  CATEGORY_META, PORT_COLORS, MINIMAP_COLORS,
  NODE_W, PORT_SPACING, PORT_Y_START, CANVAS_W, CANVAS_H, MIN_ZOOM, MAX_ZOOM,
  getNodeHeight, getPortPos, generateId, generateConnectionId
} from "./brain/types";
import NodeCard from "./brain/NodeCard";
import NodePalette from "./brain/NodePalette";
import RunPanel from "./brain/RunPanel";
 
// ─── Storage ────────────────────────────────────────────
const FLOW_STORAGE = "stellan_flows";
interface SavedFlow { id: string; name: string; nodes: any[]; connections: any[]; savedAt: string; }
function loadFlows(): SavedFlow[] { try { return JSON.parse(localStorage.getItem(FLOW_STORAGE) || "[]"); } catch { return []; } }
function saveFlows(flows: SavedFlow[]) { localStorage.setItem(FLOW_STORAGE, JSON.stringify(flows)); }

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
  nodes: BrainNode[]; connectionPaths: { d: string; color: string }[];
  zoom: number; panX: number; panY: number; vpW: number; vpH: number;
  onNav: (x: number, y: number) => void;
}) => {
  const mmW = 180, mmH = 110;
  const scale = Math.min(mmW / CANVAS_W, mmH / CANVAS_H);
  const vx = (-panX / zoom) * scale, vy = (-panY / zoom) * scale;
  const vw = (vpW / zoom) * scale, vh = (vpH / zoom) * scale;
  return (
    <div className="absolute bottom-4 right-4 z-30 rounded-xl overflow-hidden border border-white/[0.08]"
      style={{ background: "rgba(10,8,20,0.85)", backdropFilter: "blur(12px)" }}>
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
    style={{ background: "rgba(10,8,20,0.85)", backdropFilter: "blur(12px)" }}>
    <button onClick={onIn} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"><Plus className="w-4 h-4" /></button>
    <div className="text-[9px] text-white/30 text-center py-0.5 border-y border-white/[0.06]">{Math.round(zoom * 100)}%</div>
    <button onClick={onOut} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"><Minus className="w-4 h-4" /></button>
    <button onClick={onFit} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors border-t border-white/[0.06]"><Maximize2 className="w-3.5 h-3.5" /></button>
  </div>
);

// ─── Main BrainPanel ────────────────────────────────────
interface Props { onClose: () => void; activeNodes?: string[]; }

const BrainPanel = ({ onClose, activeNodes = [] }: Props) => {
  const [nodes, setNodes] = useState<BrainNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Pan & Zoom
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [vpSize, setVpSize] = useState({ w: 1200, h: 700 });

  // Connection drawing
  const [drawingConn, setDrawingConn] = useState<{ fromNode: string; fromPort: string; fromSide: "left" | "right"; mouseX: number; mouseY: number } | null>(null);

  // Run state
  const [runStatuses, setRunStatuses] = useState<Record<string, NodeRunStatus>>({});
  const [isRunning, setIsRunning] = useState(false);

  // Saved flows
  const [showFlowMenu, setShowFlowMenu] = useState(false);
  const [flowName, setFlowName] = useState("Untitled Flow");

  // Viewport tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => { for (const e of entries) setVpSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * delta));
        const ratio = next / prev;
        setPan(p => ({ x: mx - ratio * (mx - p.x), y: my - ratio * (my - p.y) }));
        return next;
      });
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  // Pan
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && (e.target === containerRef.current || (e.target as HTMLElement).dataset?.canvas))) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    }
    setSelectedNode(null);
    setSelectedConnection(null);
  };

  useEffect(() => {
    if (!isPanning) return;
    const move = (e: MouseEvent) => setPan({ x: panStart.current.px + e.clientX - panStart.current.x, y: panStart.current.py + e.clientY - panStart.current.y });
    const up = () => setIsPanning(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [isPanning]);

  // Node drag
  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    const wx = (e.clientX - r.left - pan.x) / zoom, wy = (e.clientY - r.top - pan.y) / zoom;
    dragOffset.current = { x: wx - node.x, y: wy - node.y };
    setDraggingNode(nodeId);
  };

  useEffect(() => {
    if (!draggingNode) return;
    const move = (e: MouseEvent) => {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return;
      const wx = (e.clientX - r.left - pan.x) / zoom, wy = (e.clientY - r.top - pan.y) / zoom;
      setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: Math.max(0, wx - dragOffset.current.x), y: Math.max(0, wy - dragOffset.current.y) } : n));
    };
    const up = () => setDraggingNode(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [draggingNode, pan, zoom]);

  // Connection drawing
  const handlePortMouseDown = (nodeId: string, portId: string, side: "left" | "right", e: React.MouseEvent) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    setDrawingConn({ fromNode: nodeId, fromPort: portId, fromSide: side, mouseX: (e.clientX - r.left - pan.x) / zoom, mouseY: (e.clientY - r.top - pan.y) / zoom });
  };

  const handlePortMouseUp = (nodeId: string, portId: string, side: "left" | "right") => {
    if (!drawingConn || drawingConn.fromNode === nodeId) { setDrawingConn(null); return; }
    // Determine from/to (right→left)
    const isFromRight = drawingConn.fromSide === "right";
    const fromNode = isFromRight ? drawingConn.fromNode : nodeId;
    const fromPort = isFromRight ? drawingConn.fromPort : portId;
    const toNode = isFromRight ? nodeId : drawingConn.fromNode;
    const toPort = isFromRight ? portId : drawingConn.fromPort;
    // Find port color
    const srcNode = nodes.find(n => n.id === fromNode);
    const srcPort = srcNode?.ports.find(p => p.id === fromPort);
    const exists = connections.some(c => c.fromNode === fromNode && c.fromPort === fromPort && c.toNode === toNode && c.toPort === toPort);
    if (!exists) {
      setConnections(prev => [...prev, { id: generateConnectionId(), fromNode, fromPort, toNode, toPort, color: srcPort?.color || "blue" }]);
    }
    setDrawingConn(null);
  };

  useEffect(() => {
    if (!drawingConn) return;
    const move = (e: MouseEvent) => {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return;
      setDrawingConn(prev => prev ? { ...prev, mouseX: (e.clientX - r.left - pan.x) / zoom, mouseY: (e.clientY - r.top - pan.y) / zoom } : null);
    };
    const up = () => setDrawingConn(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [drawingConn, pan, zoom]);

  // Bezier paths
  const connectionPaths = useMemo(() => {
    return connections.map(conn => {
      const fn = nodes.find(n => n.id === conn.fromNode);
      const tn = nodes.find(n => n.id === conn.toNode);
      if (!fn || !tn) return null;
      const from = getPortPos(fn, conn.fromPort);
      const to = getPortPos(tn, conn.toPort);
      const dx = Math.abs(to.x - from.x) * 0.5;
      const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
      return { ...conn, d, color: PORT_COLORS[conn.color] || "#666" };
    }).filter(Boolean) as (Connection & { d: string; color: string })[];
  }, [nodes, connections]);

  // Drawing line path
  const drawingPath = useMemo(() => {
    if (!drawingConn) return null;
    const srcNode = nodes.find(n => n.id === drawingConn.fromNode);
    if (!srcNode) return null;
    const from = getPortPos(srcNode, drawingConn.fromPort);
    const to = { x: drawingConn.mouseX, y: drawingConn.mouseY };
    const dx = Math.abs(to.x - from.x) * 0.4;
    return drawingConn.fromSide === "right"
      ? `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
      : `M ${from.x} ${from.y} C ${from.x - dx} ${from.y}, ${to.x + dx} ${to.y}, ${to.x} ${to.y}`;
  }, [drawingConn, nodes]);

  // Zoom controls
  const zoomIn = useCallback(() => setZoom(z => Math.min(MAX_ZOOM, z * 1.2)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(MIN_ZOOM, z / 1.2)), []);
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (nodes.length === 0) { setZoom(0.85); setPan({ x: 50, y: 50 }); return; }
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 50, minY = Math.min(...ys) - 50;
    const maxX = Math.max(...xs) + NODE_W + 50, maxY = Math.max(...ys.map((y, i) => y + getNodeHeight(nodes[i]))) + 50;
    const fw = width / (maxX - minX), fh = height / (maxY - minY);
    const z = Math.min(fw, fh, 1.5) * 0.9;
    setZoom(z);
    setPan({ x: (width - (maxX - minX) * z) / 2 - minX * z, y: (height - (maxY - minY) * z) / 2 - minY * z });
  }, [nodes]);

  const handleMinimapNav = useCallback((wx: number, wy: number) => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setPan({ x: -(wx * zoom - width / 2), y: -(wy * zoom - height / 2) });
  }, [zoom]);

  // Add node from palette
  const handleAddNode = (tmpl: NodeTemplate, x: number, y: number) => {
    const newNode: BrainNode = {
      id: generateId(),
      label: tmpl.label,
      icon: tmpl.icon,
      category: tmpl.category,
      x, y,
      ports: tmpl.ports.map(p => ({ ...p })),
      config: tmpl.defaultConfig ? { ...tmpl.defaultConfig } : {},
    };
    setNodes(prev => [...prev, newNode]);
  };

  // Delete selected
  const handleDelete = () => {
    if (selectedConnection) {
      setConnections(prev => prev.filter(c => c.id !== selectedConnection));
      setSelectedConnection(null);
    } else if (selectedNode) {
      setConnections(prev => prev.filter(c => c.fromNode !== selectedNode && c.toNode !== selectedNode));
      setNodes(prev => prev.filter(n => n.id !== selectedNode));
      setSelectedNode(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") handleDelete();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selectedNode, selectedConnection]);

  // ─ Simulated run
  const runFlow = async () => {
    setIsRunning(true);
    const statuses: Record<string, NodeRunStatus> = {};
    nodes.forEach(n => { statuses[n.id] = { nodeId: n.id, status: "idle" }; });
    setRunStatuses({ ...statuses });

    // Simple topological traversal simulation
    const visited = new Set<string>();
    const queue = nodes.filter(n => !connections.some(c => c.toNode === n.id)).map(n => n.id);
    if (queue.length === 0 && nodes.length > 0) queue.push(nodes[0].id);

    const process = async (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      statuses[id] = { nodeId: id, status: "running", startedAt: Date.now() };
      setRunStatuses({ ...statuses });
      await new Promise(r => setTimeout(r, 400 + Math.random() * 800));
      const success = Math.random() > 0.1;
      statuses[id] = {
        nodeId: id,
        status: success ? "success" : "error",
        startedAt: statuses[id].startedAt,
        duration: Date.now() - (statuses[id].startedAt || 0),
        output: success ? "OK" : undefined,
        error: success ? undefined : "Simulated error",
      };
      setRunStatuses({ ...statuses });
      if (success) {
        const next = connections.filter(c => c.fromNode === id).map(c => c.toNode);
        for (const nid of next) await process(nid);
      }
    };

    for (const id of queue) await process(id);
    setIsRunning(false);
  };

  // Save/Load
  const handleSave = () => {
    const flows = loadFlows();
    const serialized = nodes.map(n => ({ ...n, icon: n.label }));
    const existing = flows.findIndex(f => f.name === flowName);
    const flow: SavedFlow = { id: existing >= 0 ? flows[existing].id : generateId(), name: flowName, nodes: serialized, connections, savedAt: new Date().toISOString() };
    if (existing >= 0) flows[existing] = flow; else flows.push(flow);
    saveFlows(flows);
  };

  const selected = nodes.find(n => n.id === selectedNode);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "radial-gradient(ellipse 120% 80% at 50% 40%, rgba(30,20,50,1) 0%, rgba(12,10,22,1) 50%, rgba(8,6,16,1) 100%)" }}
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-[20%] w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(167,139,250,1), transparent 70%)" }} />
        <div className="absolute top-[50%] right-[15%] w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, rgba(56,189,248,1), transparent 70%)" }} />
        <div className="absolute bottom-[10%] left-[40%] w-[350px] h-[350px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, rgba(244,114,182,1), transparent 70%)" }} />
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
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(139,92,246,0.15))" }}>
              <Brain className="w-4 h-4 text-purple-400" style={{ filter: "drop-shadow(0 0 6px rgba(167,139,250,0.5))" }} />
            </div>
            <input value={flowName} onChange={e => setFlowName(e.target.value)}
              className="bg-transparent text-sm font-semibold text-white/90 outline-none border-b border-transparent hover:border-white/10 focus:border-white/20 transition-colors w-40" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">
              {nodes.length} čvorova · {connections.length} veza
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white transition-all text-xs">
            <Save className="w-3 h-3" /> Spremi
          </button>
          <div className="relative">
            <button onClick={() => setShowFlowMenu(!showFlowMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white transition-all text-xs">
              <FolderOpen className="w-3 h-3" /> Učitaj
            </button>
            {showFlowMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFlowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-white/[0.08] overflow-hidden"
                  style={{ background: "rgba(12,10,22,0.95)", backdropFilter: "blur(20px)" }}>
                  {loadFlows().length === 0 ? (
                    <p className="text-xs text-white/30 px-4 py-3">Nema spremljenih flowova</p>
                  ) : loadFlows().map(flow => (
                    <button key={flow.id} onClick={() => {
                      setFlowName(flow.name);
                      // We'd need icon deserialization - for now just set the data
                      setConnections(flow.connections);
                      setShowFlowMenu(false);
                    }}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04] last:border-0">
                      <p className="text-xs text-white/70">{flow.name}</p>
                      <p className="text-[9px] text-white/25">{new Date(flow.savedAt).toLocaleString("hr")}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {(selectedNode || selectedConnection) && (
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 text-red-400 transition-all text-xs">
              <Trash2 className="w-3 h-3" /> Obriši
            </button>
          )}
          <div className="flex items-center gap-1 text-[10px] text-white/30">
            <Sparkles className="w-3 h-3" /> Stellan Workflow Builder
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 relative z-10">
        {/* Node palette */}
        <NodePalette onAddNode={handleAddNode} />

        {/* Canvas */}
        <div ref={containerRef}
          className={cn("flex-1 relative overflow-hidden", isPanning ? "cursor-grabbing" : drawingConn ? "cursor-crosshair" : "cursor-grab")}
          onMouseDown={handleCanvasMouseDown}
        >
          <div data-canvas="true" className="absolute inset-0" />
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute", width: CANVAS_W, height: CANVAS_H }}>
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
              {connectionPaths.map((cp, i) => (
                <g key={cp.id} onClick={e => { e.stopPropagation(); setSelectedConnection(cp.id); setSelectedNode(null); }} style={{ pointerEvents: "stroke", cursor: "pointer" }}>
                  <path d={cp.d} fill="none" stroke="transparent" strokeWidth={12} />
                  <AnimatedConnection d={cp.d} color={selectedConnection === cp.id ? "#fff" : cp.color} index={i} isActive={activeNodes.includes(cp.fromNode) || activeNodes.includes(cp.toNode)} />
                </g>
              ))}
              {/* Drawing line */}
              {drawingPath && (
                <path d={drawingPath} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeDasharray="6 4" />
              )}
            </svg>

            {/* Nodes */}
            <div style={{ position: "relative", zIndex: 2, width: CANVAS_W, height: CANVAS_H }}>
              {nodes.map(node => (
                <NodeCard
                  key={node.id}
                  node={node}
                  isSelected={selectedNode === node.id}
                  isDragging={draggingNode === node.id}
                  runStatus={runStatuses[node.id]}
                  onMouseDown={e => handleNodeMouseDown(node.id, e)}
                  onClick={e => { e.stopPropagation(); setSelectedNode(node.id); setSelectedConnection(null); }}
                  onPortMouseDown={handlePortMouseDown}
                  onPortMouseUp={handlePortMouseUp}
                />
              ))}
              {/* Empty state */}
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                      <Brain className="w-8 h-8 text-white/10" />
                    </div>
                    <p className="text-sm text-white/30">Dodaj čvorove iz palete lijevo</p>
                    <p className="text-xs text-white/15">Spoji ih povlačenjem portova</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ZoomControls zoom={zoom} onIn={zoomIn} onOut={zoomOut} onFit={fitToScreen} />
          <Minimap nodes={nodes} connectionPaths={connectionPaths} zoom={zoom} panX={pan.x} panY={pan.y} vpW={vpSize.w} vpH={vpSize.h} onNav={handleMinimapNav} />
        </div>

        {/* Inspector */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-60 border-l border-white/[0.06] p-4 space-y-4 overflow-y-auto shrink-0"
              style={{ background: "rgba(15,12,25,0.85)", backdropFilter: "blur(20px)" }}>
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
                {connections.filter(c => c.fromNode === selected.id || c.toNode === selected.id).map((c, i) => {
                  const otherId = c.fromNode === selected.id ? c.toNode : c.fromNode;
                  const other = nodes.find(n => n.id === otherId);
                  return (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-white/50">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PORT_COLORS[c.color] }} />
                      <span>{c.fromNode === selected.id ? "→" : "←"} {other?.label}</span>
                    </div>
                  );
                })}
              </div>
              {runStatuses[selected.id] && runStatuses[selected.id].status !== "idle" && (
                <div className="pt-3 border-t border-white/[0.06] space-y-1">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Status</p>
                  <p className={cn("text-xs font-medium",
                    runStatuses[selected.id].status === "success" && "text-emerald-400",
                    runStatuses[selected.id].status === "error" && "text-red-400",
                    runStatuses[selected.id].status === "running" && "text-amber-400",
                  )}>{runStatuses[selected.id].status}</p>
                  {runStatuses[selected.id].duration && <p className="text-[10px] text-white/20">{runStatuses[selected.id].duration}ms</p>}
                  {runStatuses[selected.id].error && <p className="text-[10px] text-red-400/60">{runStatuses[selected.id].error}</p>}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Run panel */}
      <RunPanel
        nodes={nodes}
        connections={connections}
        runStatuses={runStatuses}
        isRunning={isRunning}
        onRun={runFlow}
        onStop={() => setIsRunning(false)}
        onReset={() => setRunStatuses({})}
        onPreview={() => {}}
      />
    </motion.div>
  );
};

export default BrainPanel;
