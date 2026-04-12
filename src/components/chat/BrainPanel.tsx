import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X, ZoomIn, ZoomOut, Maximize2, Search, Plus, Trash2, Play, Save, Brain, Database, Globe, Mail, FileText, Folder, MessageSquare, Code2, Shield, BookOpen, Workflow, ChevronRight, GripVertical, Circle, ArrowRight, Zap, Eye, EyeOff, Settings2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────
type NodeType = "tool" | "knowledge" | "workflow" | "input" | "output" | "condition";

interface Port {
  id: string;
  label: string;
  type: "in" | "out";
}

interface BrainNode {
  type: NodeType;
  label: string;
  icon: string;
  x: number;
  y: number;
  enabled: boolean;
  category: string;
  ports: Port[];
  color: string;
  description?: string;
  badge?: string;
}

interface Connection {
  id: string;
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
}

// ─── Default node definitions ───────────────────────────────
const DEFAULT_NODES: BrainNode[] = [
  // ── INPUT ──
  { id: "user_input", type: "input", label: "Korisnik", icon: "💬", x: 60, y: 280, enabled: true, category: "flow", color: "#3b82f6",
    ports: [{ id: "out", label: "Poruka", type: "out" }], badge: "INPUT", description: "Korisnički upit" },

  // ── ROUTING ──
  { id: "router", type: "condition", label: "Router", icon: "🔀", x: 280, y: 280, enabled: true, category: "flow", color: "#a855f7",
    ports: [
      { id: "in", label: "Upit", type: "in" },
      { id: "web", label: "Web", type: "out" },
      { id: "internal", label: "Interno", type: "out" },
      { id: "memory", label: "Pamćenje", type: "out" },
    ], badge: "LOGIC", description: "Odlučuje koji put podaci idu" },

  // ── WEB SEARCH TOOLS ──
  { id: "web_search", type: "tool", label: "Web Search", icon: "🌐", x: 500, y: 80, enabled: true, category: "web", color: "#06b6d4",
    ports: [{ id: "in", label: "Query", type: "in" }, { id: "out", label: "Rezultati", type: "out" }], badge: "TOOL", description: "Pretražuje cijeli internet" },
  { id: "x_search", type: "tool", label: "X Search", icon: "𝕏", x: 500, y: 170, enabled: true, category: "web", color: "#1d9bf0",
    ports: [{ id: "in", label: "Query", type: "in" }, { id: "out", label: "Postovi", type: "out" }], badge: "TOOL", description: "Pretražuje X/Twitter" },

  // ── INTERNAL TOOLS ──
  { id: "search_sdge", type: "tool", label: "SDGE", icon: "📊", x: 500, y: 280, enabled: true, category: "internal", color: "#f59e0b",
    ports: [{ id: "in", label: "Query", type: "in" }, { id: "out", label: "Predmeti", type: "out" }], badge: "TOOL" },
  { id: "search_drive", type: "tool", label: "Google Drive", icon: "📁", x: 500, y: 370, enabled: true, category: "internal", color: "#22c55e",
    ports: [{ id: "in", label: "Query", type: "in" }, { id: "out", label: "Datoteke", type: "out" }], badge: "TOOL" },
  { id: "search_gmail", type: "tool", label: "Gmail", icon: "✉️", x: 500, y: 460, enabled: true, category: "internal", color: "#ef4444",
    ports: [{ id: "in", label: "Query", type: "in" }, { id: "out", label: "Mailovi", type: "out" }], badge: "TOOL" },
  { id: "search_trello", type: "tool", label: "Trello", icon: "📌", x: 500, y: 550, enabled: true, category: "internal", color: "#0079bf",
    ports: [{ id: "in", label: "Query", type: "in" }, { id: "out", label: "Kartice", type: "out" }], badge: "TOOL" },
  { id: "search_solo", type: "tool", label: "Solo.hr", icon: "🧾", x: 680, y: 280, enabled: true, category: "internal", color: "#8b5cf6",
    ports: [{ id: "in", label: "Query", type: "in" }, { id: "out", label: "Računi", type: "out" }], badge: "TOOL" },
  { id: "search_oss", type: "tool", label: "OSS Portal", icon: "🗺️", x: 680, y: 370, enabled: true, category: "internal", color: "#14b8a6",
    ports: [{ id: "in", label: "Query", type: "in" }, { id: "out", label: "Podaci", type: "out" }], badge: "TOOL" },
  { id: "scrape_website", type: "tool", label: "Firecrawl", icon: "🔗", x: 680, y: 460, enabled: true, category: "web", color: "#f97316",
    ports: [{ id: "in", label: "URL", type: "in" }, { id: "out", label: "Sadržaj", type: "out" }], badge: "TOOL" },
  { id: "playwright", type: "tool", label: "Browser", icon: "🌐", x: 680, y: 550, enabled: true, category: "web", color: "#6366f1",
    ports: [{ id: "in", label: "Akcija", type: "in" }, { id: "out", label: "Rezultat", type: "out" }], badge: "TOOL" },

  // ── MEMORY / KNOWLEDGE ──
  { id: "search_memory", type: "knowledge", label: "Memorija", icon: "🧠", x: 500, y: 660, enabled: true, category: "memory", color: "#ec4899",
    ports: [{ id: "in", label: "Query", type: "in" }, { id: "out", label: "Sjećanja", type: "out" }], badge: "MEM" },
  { id: "search_knowledge", type: "knowledge", label: "Baza Znanja", icon: "📚", x: 680, y: 660, enabled: true, category: "memory", color: "#d946ef",
    ports: [{ id: "in", label: "Query", type: "in" }, { id: "out", label: "Znanje", type: "out" }], badge: "KB" },
  { id: "brain_drive", type: "knowledge", label: "Brain Drive", icon: "🧠", x: 590, y: 750, enabled: true, category: "memory", color: "#f472b6",
    ports: [{ id: "in", label: "Read/Write", type: "in" }, { id: "out", label: "Files", type: "out" }], badge: "BRAIN" },

  // ── CODE / GENERATION ──
  { id: "generate_file", type: "tool", label: "Generate File", icon: "📄", x: 680, y: 80, enabled: true, category: "output", color: "#84cc16",
    ports: [{ id: "in", label: "Kod", type: "in" }, { id: "out", label: "Download", type: "out" }], badge: "GEN" },
  { id: "run_python", type: "tool", label: "Python", icon: "🐍", x: 680, y: 170, enabled: true, category: "code", color: "#fbbf24",
    ports: [{ id: "in", label: "Script", type: "in" }, { id: "out", label: "Output", type: "out" }], badge: "CODE" },

  // ── AGGREGATOR ──
  { id: "aggregator", type: "condition", label: "Agregator", icon: "🔄", x: 900, y: 380, enabled: true, category: "flow", color: "#a855f7",
    ports: [
      { id: "in1", label: "Izvor 1", type: "in" },
      { id: "in2", label: "Izvor 2", type: "in" },
      { id: "in3", label: "Izvor 3", type: "in" },
      { id: "out", label: "Spojeno", type: "out" },
    ], badge: "MERGE", description: "Spaja rezultate iz više izvora" },

  // ── OUTPUT ──
  { id: "response", type: "output", label: "Odgovor", icon: "💬", x: 1100, y: 380, enabled: true, category: "flow", color: "#1de98b",
    ports: [{ id: "in", label: "Tekst", type: "in" }], badge: "OUTPUT", description: "Konačni odgovor korisniku" },

  // ── SAVE ──
  { id: "save_knowledge", type: "knowledge", label: "Spremi Znanje", icon: "💾", x: 1100, y: 520, enabled: true, category: "memory", color: "#f59e0b",
    ports: [{ id: "in", label: "Podatak", type: "in" }], badge: "SAVE", description: "Sprema u bazu znanja" },
];

const DEFAULT_CONNECTIONS: Connection[] = [
  { id: "c1", fromNode: "user_input", fromPort: "out", toNode: "router", toPort: "in" },
  { id: "c2", fromNode: "router", fromPort: "web", toNode: "web_search", toPort: "in" },
  { id: "c3", fromNode: "router", fromPort: "web", toNode: "x_search", toPort: "in" },
  { id: "c4", fromNode: "router", fromPort: "internal", toNode: "search_sdge", toPort: "in" },
  { id: "c5", fromNode: "router", fromPort: "internal", toNode: "search_drive", toPort: "in" },
  { id: "c6", fromNode: "router", fromPort: "internal", toNode: "search_gmail", toPort: "in" },
  { id: "c7", fromNode: "router", fromPort: "internal", toNode: "search_trello", toPort: "in" },
  { id: "c8", fromNode: "router", fromPort: "memory", toNode: "search_memory", toPort: "in" },
  { id: "c9", fromNode: "router", fromPort: "memory", toNode: "search_knowledge", toPort: "in" },
  { id: "c10", fromNode: "web_search", fromPort: "out", toNode: "aggregator", toPort: "in1" },
  { id: "c11", fromNode: "search_sdge", fromPort: "out", toNode: "aggregator", toPort: "in2" },
  { id: "c12", fromNode: "search_memory", fromPort: "out", toNode: "aggregator", toPort: "in3" },
  { id: "c13", fromNode: "aggregator", fromPort: "out", toNode: "response", toPort: "in" },
  { id: "c14", fromNode: "aggregator", fromPort: "out", toNode: "save_knowledge", toPort: "in" },
];

// ─── Node dimensions ────────────────────────────────────────
const NODE_W = 150;
const NODE_H_BASE = 52;
const PORT_H = 18;
const PORT_R = 5;

// ─── Helpers ────────────────────────────────────────────────
function getPortPos(node: BrainNode, portId: string): { x: number; y: number } {
  const port = node.ports.find(p => p.id === portId);
  if (!port) return { x: node.x, y: node.y };
  const portIndex = node.ports.filter(p => p.type === port.type).indexOf(port);
  const sameTypePorts = node.ports.filter(p => p.type === port.type);
  const nodeH = NODE_H_BASE + Math.max(0, node.ports.length - 2) * PORT_H;

  if (port.type === "in") {
    const startY = node.y + 26;
    const spacing = sameTypePorts.length > 1 ? (nodeH - 32) / (sameTypePorts.length) : 0;
    return { x: node.x - 1, y: startY + portIndex * spacing };
  } else {
    const startY = node.y + 26;
    const spacing = sameTypePorts.length > 1 ? (nodeH - 32) / (sameTypePorts.length) : 0;
    return { x: node.x + NODE_W + 1, y: startY + portIndex * spacing };
  }
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

// ─── Category colors ────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  flow: "rgba(168,85,247,0.15)",
  web: "rgba(6,182,212,0.08)",
  internal: "rgba(245,158,11,0.08)",
  memory: "rgba(236,72,153,0.08)",
  output: "rgba(132,204,22,0.08)",
  code: "rgba(251,191,36,0.08)",
};

// ─── Component ──────────────────────────────────────────────
interface BrainPanelProps {
  onClose: () => void;
}

export default function BrainPanel({ onClose }: BrainPanelProps) {
  const [nodes, setNodes] = useState<BrainNode[]>(DEFAULT_NODES);
  const [connections, setConnections] = useState<Connection[]>(DEFAULT_CONNECTIONS);
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Filtered nodes ──
  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.map(n => ({
        ...n,
        _dimmed: !n.label.toLowerCase().includes(q) && !n.category.includes(q),
      })) as any;
    }
    if (activeCategory) {
      result = result.map(n => ({
        ...n,
        _dimmed: (n as any)._dimmed || n.category !== activeCategory,
      })) as any;
    }
    return result;
  }, [nodes, searchQuery, activeCategory]);

  // ── Drag node ──
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDragging(nodeId);
    setSelectedNode(nodeId);
    setDragOffset({
      x: (e.clientX - pan.x) / zoom - node.x,
      y: (e.clientY - pan.y) / zoom - node.y,
    });
  }, [nodes, zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const newX = (e.clientX - pan.x) / zoom - dragOffset.x;
      const newY = (e.clientY - pan.y) / zoom - dragOffset.y;
      setNodes(prev => prev.map(n => n.id === dragging ? { ...n, x: Math.round(newX / 10) * 10, y: Math.round(newY / 10) * 10 } : n));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [dragging, dragOffset, zoom, pan, isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains("brain-canvas-bg")) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNode(null);
    }
  }, [pan]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, enabled: !n.enabled } : n));
  }, []);

  const fitView = useCallback(() => {
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + NODE_W));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + 80));
    const w = maxX - minX + 100;
    const h = maxY - minY + 100;
    const container = canvasRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const newZoom = Math.min(cw / w, ch / h, 1.2) * 0.85;
    setZoom(newZoom);
    setPan({
      x: (cw - w * newZoom) / 2 - minX * newZoom + 50 * newZoom,
      y: (ch - h * newZoom) / 2 - minY * newZoom + 50 * newZoom,
    });
  }, [nodes]);

  useEffect(() => { fitView(); }, []);

  const categories = [
    { id: "web", label: "Web", icon: "🌐", color: "#06b6d4" },
    { id: "internal", label: "Interni", icon: "📊", color: "#f59e0b" },
    { id: "memory", label: "Pamćenje", icon: "🧠", color: "#ec4899" },
    { id: "flow", label: "Flow", icon: "🔀", color: "#a855f7" },
    { id: "code", label: "Kod", icon: "💻", color: "#fbbf24" },
    { id: "output", label: "Output", icon: "📄", color: "#84cc16" },
  ];

  const selectedNodeData = selectedNode ? nodes.find(n => n.id === selectedNode) : null;

  return (
    <div className="flex flex-col h-full bg-[hsl(220,18%,7%)] text-white overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-[hsl(220,15%,9%)]">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-white/80">Stellan Mozak</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">VISUAL</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Traži..."
              className="h-6 w-32 pl-6 pr-2 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10px] text-white/60 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
            />
          </div>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="p-1 rounded hover:bg-white/[0.08] text-white/40 hover:text-white/70" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} className="p-1 rounded hover:bg-white/[0.08] text-white/40 hover:text-white/70" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={fitView} className="p-1 rounded hover:bg-white/[0.08] text-white/40 hover:text-white/70" title="Fit view">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <span className="text-[9px] text-white/20 mx-1">{Math.round(zoom * 100)}%</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/[0.08] text-white/40 hover:text-white/70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Category filter bar ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.04] bg-[hsl(220,15%,8%)]">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn("h-5 px-2 rounded text-[9px] font-medium transition-all",
            !activeCategory ? "bg-white/10 text-white/70" : "text-white/30 hover:text-white/50"
          )}
        >Sve</button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className={cn("h-5 px-2 rounded text-[9px] font-medium transition-all flex items-center gap-1",
              activeCategory === cat.id
                ? "text-white/80"
                : "text-white/30 hover:text-white/50"
            )}
            style={activeCategory === cat.id ? { background: `${cat.color}33` } : {}}
          >
            <span className="text-[8px]">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[9px] text-white/15">{nodes.filter(n => n.enabled).length}/{nodes.length} aktivno</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Canvas ── */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Grid background */}
          <div className="brain-canvas-bg absolute inset-0" style={{
            backgroundImage: `
              radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)
            `,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }} />

          {/* Transform layer */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ overflow: "visible" }}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Connections */}
              {connections.map(conn => {
                const fromNode = nodes.find(n => n.id === conn.fromNode);
                const toNode = nodes.find(n => n.id === conn.toNode);
                if (!fromNode || !toNode) return null;
                const from = getPortPos(fromNode, conn.fromPort);
                const to = getPortPos(toNode, conn.toPort);
                const isActive = fromNode.enabled && toNode.enabled;
                const dimmed = (filteredNodes.find(n => n.id === fromNode.id) as any)?._dimmed ||
                               (filteredNodes.find(n => n.id === toNode.id) as any)?._dimmed;
                return (
                  <g key={conn.id}>
                    <path
                      d={bezierPath(from.x, from.y, to.x, to.y)}
                      stroke={isActive ? (dimmed ? "rgba(255,255,255,0.03)" : fromNode.color) : "rgba(255,255,255,0.04)"}
                      strokeWidth={isActive && !dimmed ? 2 : 1}
                      fill="none"
                      opacity={isActive && !dimmed ? 0.5 : 0.15}
                      strokeDasharray={isActive ? "none" : "4 4"}
                    />
                    {/* Animated dot for active connections */}
                    {isActive && !dimmed && (
                      <circle r="2.5" fill={fromNode.color} opacity="0.8">
                        <animateMotion dur="3s" repeatCount="indefinite" path={bezierPath(from.x, from.y, to.x, to.y)} />
                      </circle>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Nodes */}
          <div className="absolute inset-0" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
            {filteredNodes.map((node) => {
              const isDimmed = (node as any)._dimmed;
              const nodeH = NODE_H_BASE + Math.max(0, node.ports.length - 2) * PORT_H;
              const isSelected = selectedNode === node.id;

              return (
                <div
                  key={node.id}
                  className={cn(
                    "absolute select-none transition-shadow duration-150",
                    dragging === node.id && "z-50",
                    isDimmed && "opacity-20",
                  )}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: NODE_W,
                  }}
                  onMouseDown={e => handleNodeMouseDown(e, node.id)}
                >
                  {/* Node body */}
                  <div
                    className={cn(
                      "rounded-lg border transition-all cursor-move overflow-hidden",
                      node.enabled ? "border-white/[0.1]" : "border-white/[0.04]",
                      isSelected && "ring-1 ring-purple-500/50",
                    )}
                    style={{
                      background: node.enabled
                        ? `linear-gradient(135deg, ${node.color}18 0%, hsl(220,15%,11%) 100%)`
                        : "hsl(220,15%,9%)",
                      boxShadow: isSelected
                        ? `0 0 20px ${node.color}20`
                        : node.enabled
                        ? `0 2px 8px rgba(0,0,0,0.3)`
                        : "none",
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/[0.04]">
                      <span className="text-xs">{node.icon}</span>
                      <span className={cn(
                        "text-[10px] font-semibold flex-1 truncate",
                        node.enabled ? "text-white/80" : "text-white/30"
                      )}>{node.label}</span>
                      {node.badge && (
                        <span
                          className="text-[7px] font-bold px-1 py-0.5 rounded"
                          style={{
                            background: `${node.color}25`,
                            color: node.enabled ? node.color : "rgba(255,255,255,0.2)",
                          }}
                        >{node.badge}</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
                        className="p-0.5 rounded hover:bg-white/[0.1] transition-colors"
                        title={node.enabled ? "Isključi" : "Uključi"}
                      >
                        {node.enabled
                          ? <Eye className="w-2.5 h-2.5 text-white/40" />
                          : <EyeOff className="w-2.5 h-2.5 text-white/20" />
                        }
                      </button>
                    </div>

                    {/* Ports */}
                    <div className="px-1 py-1">
                      {node.ports.map((port) => (
                        <div
                          key={port.id}
                          className={cn(
                            "flex items-center gap-1 py-0.5 px-1",
                            port.type === "out" && "justify-end"
                          )}
                        >
                          {port.type === "in" && (
                            <Circle className="w-2 h-2 flex-shrink-0" style={{ color: node.enabled ? node.color : "rgba(255,255,255,0.1)" }} />
                          )}
                          <span className="text-[8px] text-white/30 truncate">{port.label}</span>
                          {port.type === "out" && (
                            <Circle className="w-2 h-2 flex-shrink-0 fill-current" style={{ color: node.enabled ? node.color : "rgba(255,255,255,0.1)" }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Inspector panel ── */}
        {selectedNodeData && (
          <div className="w-56 border-l border-white/[0.06] bg-[hsl(220,15%,9%)] flex flex-col overflow-y-auto">
            <div className="p-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{selectedNodeData.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/80 truncate">{selectedNodeData.label}</p>
                  <p className="text-[9px] text-white/30">{selectedNodeData.category}</p>
                </div>
              </div>
              {selectedNodeData.description && (
                <p className="text-[10px] text-white/40 leading-relaxed">{selectedNodeData.description}</p>
              )}
            </div>

            <div className="p-3 space-y-3">
              {/* Status */}
              <div>
                <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5">Status</p>
                <button
                  onClick={() => toggleNode(selectedNodeData.id)}
                  className={cn(
                    "w-full h-7 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-medium transition-all",
                    selectedNodeData.enabled
                      ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
                      : "bg-red-500/10 text-red-400/60 ring-1 ring-red-500/10"
                  )}
                >
                  {selectedNodeData.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {selectedNodeData.enabled ? "Aktivan" : "Isključen"}
                </button>
              </div>

              {/* Ports */}
              <div>
                <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5">Portovi</p>
                <div className="space-y-1">
                  {selectedNodeData.ports.map(port => (
                    <div key={port.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.03]">
                      <Circle className="w-2 h-2" style={{ color: selectedNodeData.color }} />
                      <span className="text-[9px] text-white/40">{port.label}</span>
                      <span className="text-[8px] text-white/15 ml-auto">{port.type.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connections */}
              <div>
                <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5">Veze</p>
                <div className="space-y-1">
                  {connections
                    .filter(c => c.fromNode === selectedNodeData.id || c.toNode === selectedNodeData.id)
                    .map(c => {
                      const otherNode = nodes.find(n => n.id === (c.fromNode === selectedNodeData.id ? c.toNode : c.fromNode));
                      const direction = c.fromNode === selectedNodeData.id ? "→" : "←";
                      return (
                        <div key={c.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.03]">
                          <span className="text-[9px] text-white/20">{direction}</span>
                          <span className="text-[9px] text-white/40">{otherNode?.icon} {otherNode?.label}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Position */}
              <div>
                <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5">Pozicija</p>
                <p className="text-[9px] text-white/20">X: {selectedNodeData.x}  Y: {selectedNodeData.y}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
