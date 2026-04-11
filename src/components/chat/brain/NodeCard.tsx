import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import {
  type BrainNode, type NodeRunStatus, CATEGORY_META, PORT_COLORS,
  NODE_W, PORT_SPACING, PORT_Y_START, getNodeHeight
} from "./types";

interface Props {
  node: BrainNode;
  isSelected: boolean;
  isDragging: boolean;
  runStatus?: NodeRunStatus;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onPortMouseDown?: (nodeId: string, portId: string, side: "left" | "right", e: React.MouseEvent) => void;
  onPortMouseUp?: (nodeId: string, portId: string, side: "left" | "right", e: React.MouseEvent) => void;
}

const STATUS_RING: Record<string, string> = {
  running: "ring-2 ring-amber-400/60 animate-pulse",
  success: "ring-2 ring-emerald-400/50",
  error: "ring-2 ring-red-400/50",
};

const NodeCard = ({ node, isSelected, isDragging, runStatus, onMouseDown, onClick, onPortMouseDown, onPortMouseUp }: Props) => {
  const cat = CATEGORY_META[node.category];
  const Icon = node.icon;
  const h = getNodeHeight(node);
  const leftPorts = node.ports.filter(p => p.side === "left");
  const rightPorts = node.ports.filter(p => p.side === "right");
  const statusClass = runStatus ? STATUS_RING[runStatus.status] || "" : "";

  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25, delay: Math.random() * 0.15 }}
      whileHover={{ scale: 1.04, transition: { duration: 0.12 } }}
      className={cn(
        "absolute select-none rounded-xl backdrop-blur-md transition-all duration-200",
        statusClass,
        isSelected && !statusClass && "ring-1 ring-emerald-300/30",
        isDragging && "cursor-grabbing scale-[1.05] z-50"
      )}
      style={{
        left: node.x, top: node.y, width: NODE_W, height: h,
        zIndex: isDragging ? 50 : isSelected ? 40 : 2,
        background: `linear-gradient(145deg, ${cat.cardBg}, rgba(7,22,18,0.94))`,
        border: `1px solid ${cat.borderColor}`,
        boxShadow: isSelected
          ? `0 0 25px ${cat.glow}, 0 0 50px ${cat.glow}, 0 4px 20px rgba(0,0,0,0.4)`
          : `0 0 15px ${cat.glow}, 0 4px 16px rgba(0,0,0,0.3)`,
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 cursor-grab">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn("w-3.5 h-3.5 shrink-0", cat.text)} style={{ filter: `drop-shadow(0 0 6px ${cat.glow})` }} />
          <span className="text-[11px] font-semibold text-white/90 truncate">{node.label}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-md", cat.bg, cat.text)}>{cat.label}</span>
          <Settings className="w-3 h-3 text-emerald-200/20 hover:text-emerald-100/50 transition-colors" />
        </div>
      </div>

      {/* Run status indicator */}
      {runStatus && runStatus.status !== "idle" && (
        <div className="absolute -top-1.5 -right-1.5 z-10">
          {runStatus.status === "running" && <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />}
          {runStatus.status === "success" && <div className="w-3 h-3 rounded-full bg-emerald-400" />}
          {runStatus.status === "error" && <div className="w-3 h-3 rounded-full bg-red-400" />}
        </div>
      )}

      {leftPorts.map((port, i) => (
        <div key={port.id} className="absolute flex items-center gap-1.5" style={{ left: -6, top: PORT_Y_START + i * PORT_SPACING - 6 }}>
          <div
            className="w-[12px] h-[12px] rounded-full border-2 border-[rgba(5,18,15,0.95)] transition-all hover:scale-150 cursor-crosshair"
            style={{ backgroundColor: PORT_COLORS[port.color] || "#888", boxShadow: `0 0 8px ${PORT_COLORS[port.color] || "#888"}80` }}
            onMouseDown={e => { e.stopPropagation(); onPortMouseDown?.(node.id, port.id, "left", e); }}
            onMouseUp={e => { e.stopPropagation(); onPortMouseUp?.(node.id, port.id, "left", e); }}
          />
          <span className="text-[9px] text-white/40 font-medium">{port.label}</span>
        </div>
      ))}
      {rightPorts.map((port, i) => (
        <div key={port.id} className="absolute flex items-center gap-1.5 flex-row-reverse" style={{ right: -6, top: PORT_Y_START + i * PORT_SPACING - 6 }}>
          <div
            className="w-[12px] h-[12px] rounded-full border-2 border-[rgba(5,18,15,0.95)] transition-all hover:scale-150 cursor-crosshair"
            style={{ backgroundColor: PORT_COLORS[port.color] || "#888", boxShadow: `0 0 8px ${PORT_COLORS[port.color] || "#888"}80` }}
            onMouseDown={e => { e.stopPropagation(); onPortMouseDown?.(node.id, port.id, "right", e); }}
            onMouseUp={e => { e.stopPropagation(); onPortMouseUp?.(node.id, port.id, "right", e); }}
          />
          <span className="text-[9px] text-white/40 font-medium">{port.label}</span>
        </div>
      ))}
    </motion.div>
  );
};

export default NodeCard;
