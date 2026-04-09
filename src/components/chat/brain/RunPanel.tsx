import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Play, Square, AlertCircle, CheckCircle, Clock, Trash2, RotateCcw, Eye,
  ChevronDown, ChevronUp
} from "lucide-react";
import { useState } from "react";
import type { BrainNode, Connection, NodeRunStatus } from "./types";

interface Props {
  nodes: BrainNode[];
  connections: Connection[];
  runStatuses: Record<string, NodeRunStatus>;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
  onPreview: () => void;
}

const RunPanel = ({ nodes, connections, runStatuses, isRunning, onRun, onStop, onReset, onPreview }: Props) => {
  const [expanded, setExpanded] = useState(true);

  const statusCounts = Object.values(runStatuses).reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalTime = Object.values(runStatuses)
    .filter(s => s.duration)
    .reduce((sum, s) => sum + (s.duration || 0), 0);

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-xl border border-white/[0.08] overflow-hidden"
      style={{ background: "rgba(10,8,20,0.9)", backdropFilter: "blur(16px)", minWidth: 420 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-white/80">Flow Runner</span>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <span>{nodes.length} čvorova</span>
            <span>·</span>
            <span>{connections.length} veza</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Status badges */}
          {statusCounts.success && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              <CheckCircle className="w-2.5 h-2.5" /> {statusCounts.success}
            </span>
          )}
          {statusCounts.error && (
            <span className="flex items-center gap-1 text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
              <AlertCircle className="w-2.5 h-2.5" /> {statusCounts.error}
            </span>
          )}
          {totalTime > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-white/30">
              <Clock className="w-2.5 h-2.5" /> {(totalTime / 1000).toFixed(1)}s
            </span>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-white/30 hover:text-white/60 transition-colors ml-1">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        {isRunning ? (
          <button onClick={onStop}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30 transition-colors text-xs font-medium">
            <Square className="w-3 h-3 fill-current" /> Stop
          </button>
        ) : (
          <button onClick={onRun}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30 transition-colors text-xs font-medium">
            <Play className="w-3 h-3 fill-current" /> Run Flow
          </button>
        )}
        <button onClick={onPreview}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/70 transition-colors text-xs">
          <Eye className="w-3 h-3" /> Preview
        </button>
        <button onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/70 transition-colors text-xs">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Execution log */}
      {expanded && Object.keys(runStatuses).length > 0 && (
        <div className="border-t border-white/[0.06] max-h-40 overflow-y-auto scrollbar-hide">
          {Object.values(runStatuses)
            .filter(s => s.status !== "idle")
            .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))
            .map(status => {
              const node = nodes.find(n => n.id === status.nodeId);
              return (
                <div key={status.nodeId} className="flex items-center gap-2.5 px-4 py-1.5 border-b border-white/[0.03] last:border-0">
                  <div className={cn("w-2 h-2 rounded-full shrink-0",
                    status.status === "running" && "bg-amber-400 animate-pulse",
                    status.status === "success" && "bg-emerald-400",
                    status.status === "error" && "bg-red-400",
                    status.status === "skipped" && "bg-white/20",
                  )} />
                  <span className="text-[10px] text-white/60 flex-1 truncate">{node?.label || status.nodeId}</span>
                  {status.duration && (
                    <span className="text-[9px] text-white/25">{status.duration}ms</span>
                  )}
                  {status.output && (
                    <span className="text-[9px] text-emerald-400/60 truncate max-w-[120px]">{status.output}</span>
                  )}
                  {status.error && (
                    <span className="text-[9px] text-red-400/60 truncate max-w-[120px]">{status.error}</span>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </motion.div>
  );
};

export default RunPanel;
