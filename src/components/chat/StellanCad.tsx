import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Ruler, Zap, Save, Download, Send, Command, Square, Triangle, Circle, Move } from "lucide-react";
import { toast } from "sonner";
import * as fabric from "fabric";   // ← za grip edit i crtanje

import BrainPanel from "./BrainPanel";
import { GEO_NODE_CATALOG, type NodeTemplate } from "./brain/types";
import DxfViewer from "dxf-viewer";

interface StellanCadProps { onClose: () => void; }

const StellanCad = ({ onClose }: StellanCadProps) => {
  const [flowName, setFlowName] = useState("Novi geodetski projekt");
  const [commandInput, setCommandInput] = useState("");
  const [drawingMode, setDrawingMode] = useState<"select" | "line" | "polyline" | "circle" | null>("select");

  const viewerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const dxfViewerInstance = useRef<any>(null);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);

  const [addNodeCallback, setAddNodeCallback] = useState<((t: NodeTemplate, x?: number, y?: number, config?: any) => void) | null>(null);

  // Inicijalizacija Fabric.js overlay za grip edit i crtanje
  useEffect(() => {
    if (overlayRef.current && !fabricCanvas.current) {
      fabricCanvas.current = new fabric.Canvas(overlayRef.current, {
        isDrawingMode: false,
        selection: true,
        preserveObjectStacking: true,
      });
    }
  }, []);

  const activateTool = (mode: "select" | "line" | "polyline" | "circle") => {
    setDrawingMode(mode);
    if (fabricCanvas.current) {
      fabricCanvas.current.isDrawingMode = mode === "line" || mode === "polyline";
      toast.info(`Aktiviran alat: ${mode}`);
    }
  };

  const executeCommand = () => {
    if (!addNodeCallback || !commandInput.trim()) return;
    const cmd = commandInput.trim().toUpperCase();
    // ... tvoj parser (isti kao prije)
    setCommandInput("");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "radial-gradient(ellipse 120% 80% at 50% 40%, rgba(20,30,50,1) 0%, rgba(10,12,22,1) 50%, rgba(8,6,16,1) 100%)" }}
    >
      {/* Header */}
      <div className="px-6 py-3 border-b border-white/[0.06] flex items-center justify-between bg-black/70">
        <div className="flex items-center gap-4">
          <motion.button whileHover={{ scale: 1.05 }} onClick={onClose} className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1]">
            <ArrowLeft className="w-4 h-4" /> Nazad
          </motion.button>
          <Ruler className="w-7 h-7 text-emerald-400" />
          <span className="text-3xl font-bold">StellanCad</span>
        </div>
        <div className="text-emerald-400 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          <span className="font-semibold">Grip Edit + Crtanje mišem</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <BrainPanel
          onClose={() => {}}
          activeNodes={[]}
          customCatalog={GEO_NODE_CATALOG}
          onAddNodeExternal={setAddNodeCallback}
        />

        {/* CAD PANEL */}
        <div className="w-[560px] border-l border-white/[0.08] bg-[#0a0814] flex flex-col relative">
          {/* DWG Viewer + Overlay za grip edit */}
          <div className="flex-1 p-3 relative">
            <div ref={viewerRef} className="w-full h-full border border-white/[0.1] rounded-3xl overflow-hidden bg-[#111827]" />

            {/* Fabric.js overlay canvas za grip edit i crtanje */}
            <canvas
              ref={overlayRef}
              className="absolute top-3 left-3 w-full h-full pointer-events-auto z-10"
            />
          </div>

          {/* Toolbar za grip edit i crtanje */}
          <div className="h-12 bg-black border-t border-white/[0.08] flex items-center gap-2 px-4">
            <button onClick={() => activateTool("select")} className={`flex items-center gap-2 px-4 py-1 rounded-xl ${drawingMode === "select" ? "bg-emerald-500 text-white" : "bg-white/[0.06] hover:bg-white/[0.1]"}`}>
              <Move className="w-4 h-4" /> Select / Grip
            </button>
            <button onClick={() => activateTool("line")} className={`flex items-center gap-2 px-4 py-1 rounded-xl ${drawingMode === "line" ? "bg-emerald-500 text-white" : "bg-white/[0.06] hover:bg-white/[0.1]"}`}>
              <Square className="w-4 h-4" /> Linija
            </button>
            <button onClick={() => activateTool("polyline")} className={`flex items-center gap-2 px-4 py-1 rounded-xl ${drawingMode === "polyline" ? "bg-emerald-500 text-white" : "bg-white/[0.06] hover:bg-white/[0.1]"}`}>
              <Triangle className="w-4 h-4" /> Polilinija
            </button>
            <button onClick={() => activateTool("circle")} className={`flex items-center gap-2 px-4 py-1 rounded-xl ${drawingMode === "circle" ? "bg-emerald-500 text-white" : "bg-white/[0.06] hover:bg-white/[0.1]"}`}>
              <Circle className="w-4 h-4" /> Kružnica
            </button>
          </div>

          {/* Command Line */}
          <div className="h-14 bg-black border-t px-4 flex items-center gap-3">
            <Command className="w-5 h-5 text-emerald-400" />
            <input
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && executeCommand()}
              placeholder="Naredba ili LISP..."
              className="flex-1 bg-transparent font-mono text-white outline-none text-base"
            />
            <button onClick={executeCommand} className="text-emerald-400">
              <Send className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StellanCad;
