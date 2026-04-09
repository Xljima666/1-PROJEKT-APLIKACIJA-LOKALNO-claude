import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Brain, FileText, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";

// Reuse svih komponenti iz Mozak taba
import BrainPanel from "./BrainPanel";
import {
  GEO_NODE_CATALOG,           // ← novi geodetski katalog (vidi dolje)
  type NodeTemplate
} from "./brain/types";

// Ako želiš da BrainPanel prima custom katalog, dodajemo prop
interface StellanCadProps {
  onClose: () => void;
}

const StellanCad = ({ onClose }: StellanCadProps) => {
  const [flowName, setFlowName] = useState("Novi geodetski projekt");

  const handleAddGeoNode = (template: NodeTemplate, x: number, y: number) => {
    // isti handler kao u BrainPanelu, ali sa geo nodovima
    console.log("Dodajem geodetski nod:", template.label);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "radial-gradient(ellipse 120% 80% at 50% 40%, rgba(20,30,50,1) 0%, rgba(10,12,22,1) 50%, rgba(8,6,16,1) 100%)" }}
    >
      {/* Header - isti stil kao Mozak tab, ali sa StellanCad brandingom */}
      <div className="relative z-10 flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/70 hover:text-white transition-all text-xs font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Nazad na Stellan
          </motion.button>

          <div className="h-5 w-px bg-white/[0.08]" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/20">
              <Ruler className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-lg font-semibold text-white/90">StellanCad</span>
            <input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="bg-transparent text-sm font-semibold text-white/90 outline-none border-b border-transparent hover:border-white/10 focus:border-white/20 transition-colors w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded">Geodetski mod</span>
        </div>
      </div>

      {/* Glavni sadržaj – reuse BrainPanel sa geodetskim katalogom */}
      <BrainPanel
        onClose={() => {}} // ne koristimo jer je već u tabu
        activeNodes={[]}
        // Dodajemo custom prop koji ćemo kasnije podržati u BrainPanelu
        customCatalog={GEO_NODE_CATALOG}
        customTitle="StellanCad"
      />

      {/* Optional: Command line na dnu (ZWCAD stil) */}
      <div className="h-9 bg-black/60 border-t border-white/[0.08] flex items-center px-4 text-xs font-mono text-white/70">
        <span className="text-emerald-400 mr-2">›</span>
        <input
          type="text"
          placeholder="Upiši naredbu... (npr. PARCELA, TRANSFORM, VOL...)"
          className="flex-1 bg-transparent outline-none text-white/80 placeholder:text-white/30"
        />
      </div>
    </motion.div>
  );
};

export default StellanCad;
