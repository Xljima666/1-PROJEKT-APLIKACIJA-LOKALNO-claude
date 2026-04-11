import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Ruler, Zap, Save, Download, FileText, Settings, Layers as LayersIcon, Send, Command } from "lucide-react";
import { toast } from "sonner";

import BrainPanel from "./BrainPanel";
import { GEO_NODE_CATALOG, type NodeTemplate } from "./brain/types";
import DxfViewer from "dxf-viewer";

// Jednostavni DXF generator
const generateDXF = (nodes: any[], connections: any[]) => {
  let dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1021\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  // Nodovi kao POINT + TEXT
  nodes.forEach((node: any, i: number) => {
    const x = node.x || 0;
    const y = node.y || 0;
    dxf += `0\nPOINT\n10\n${x}\n20\n${y}\n30\n0\n`;
    dxf += `0\nTEXT\n10\n${x + 5}\n20\n${y + 5}\n30\n0\n40\n2\n1\n${node.label}\n`;
  });

  // Veze kao LINE
  connections.forEach((conn: any) => {
    // Za sada jednostavne linije (kasnije možeš poboljšati)
    dxf += `0\nLINE\n10\n100\n20\n100\n30\n0\n11\n200\n21\n150\n31\n0\n`;
  });

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
};

interface StellanCadProps { onClose: () => void; }

const StellanCad = ({ onClose }: StellanCadProps) => {
  const [flowName, setFlowName] = useState("Novi geodetski projekt");
  const [commandInput, setCommandInput] = useState("");

  const viewerRef = useRef<HTMLDivElement>(null);
  const dxfViewerInstance = useRef<any>(null);

  const [addNodeCallback, setAddNodeCallback] = useState<((t: NodeTemplate, x?: number, y?: number, config?: any) => void) | null>(null);

  // Auto-generiranje DWG-a (DXF)
  const generateDWGFromFlow = () => {
    // Ovdje bi trebao imati pristup nodes i connections iz BrainPanela
    // Za sada simuliramo (kasnije ćemo proslijediti stvarne podatke)
    const dummyNodes = [{ label: "Parcel Divider", x: 100, y: 100 }, { label: "Transform", x: 300, y: 200 }];
    const dummyConnections = [{ from: 0, to: 1 }];

    const dxfContent = generateDXF(dummyNodes, dummyConnections);
    const blob = new Blob([dxfContent], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flowName.replace(/\s+/g, "_")}.dxf`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("DWG (DXF) generiran i spreman za download!");
  };

  const executeCommand = () => {
    if (!addNodeCallback || !commandInput.trim()) return;
    const cmd = commandInput.trim().toUpperCase();

    if (cmd.includes("3D") || cmd.includes("TOČKE")) {
      const t = GEO_NODE_CATALOG["LISP / AutoCAD Funkcije"]?.find(n => n.label === "3D Točke");
      if (t) addNodeCallback(t, 650, 300);
    }
    // ... ostali parseri (isti kao prije)

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

        <div className="flex items-center gap-3">
          <button 
            onClick={generateDWGFromFlow}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-medium"
          >
            <Download className="w-4 h-4" /> Generiraj DWG iz flowa
          </button>
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
        <div className="w-[540px] border-l border-white/[0.08] bg-[#0a0814] flex flex-col">
          <div className="flex-1 p-3">
            <div ref={viewerRef} className="w-full h-full border border-white/[0.1] rounded-3xl overflow-hidden bg-[#111827]" />
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
