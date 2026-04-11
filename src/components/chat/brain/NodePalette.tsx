import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, Plus } from "lucide-react";
import { NODE_CATALOG, CATEGORY_META, type NodeTemplate, type CategoryType } from "./types";

interface Props {
  onAddNode: (template: NodeTemplate, x: number, y: number) => void;
}

const NodePalette = ({ onAddNode }: Props) => {
  const [search, setSearch] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>("Playwright");

  const filteredCatalog = Object.entries(NODE_CATALOG).reduce<Record<string, NodeTemplate[]>>((acc, [group, templates]) => {
    if (!search) { acc[group] = templates; return acc; }
    const filtered = templates.filter(t =>
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
    );
    if (filtered.length) acc[group] = filtered;
    return acc;
  }, {});

  const handleAdd = (template: NodeTemplate) => {
    // Place at center-ish of canvas
    onAddNode(template, 400 + Math.random() * 200, 200 + Math.random() * 200);
  };

  return (
    <div className="w-64 border-r border-white/[0.06] flex flex-col shrink-0 overflow-hidden"
      style={{ background: "rgba(6,20,17,0.92)", backdropFilter: "blur(20px)" }}>
      {/* Search */}
      <div className="px-3 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.035] border border-white/[0.06]">
          <Search className="w-3.5 h-3.5 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pretraži čvorove..."
            className="bg-transparent text-xs text-white/88 placeholder:text-white/25 outline-none flex-1"
          />
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
        {Object.entries(filteredCatalog).map(([group, templates]) => (
          <div key={group}>
            <button
              onClick={() => setExpandedGroup(expandedGroup === group ? null : group)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-emerald-100/55 hover:text-emerald-50 transition-colors"
            >
              <ChevronRight className={cn("w-3 h-3 transition-transform", expandedGroup === group && "rotate-90")} />
              {group}
              <span className="ml-auto text-[9px] text-white/20">{templates.length}</span>
            </button>
            <AnimatePresence>
              {expandedGroup === group && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {templates.map((tmpl, i) => {
                    const cat = CATEGORY_META[tmpl.category];
                    const Icon = tmpl.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => handleAdd(tmpl)}
                        className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.035] transition-colors group"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: cat.cardBg, border: `1px solid ${cat.borderColor}` }}>
                          <Icon className={cn("w-3.5 h-3.5", cat.text)} />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-[11px] font-medium text-white/88 truncate">{tmpl.label}</p>
                          <p className="text-[9px] text-white/30 truncate">{tmpl.description}</p>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-white/10 group-hover:text-emerald-200/50 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NodePalette;
