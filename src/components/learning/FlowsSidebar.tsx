import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, Play, FileText } from "lucide-react";

type Flow = {
  id: string;
  name: string;
  date: string;
  status: "draft" | "ready" | "converted";
};

interface FlowsSidebarProps {
  flows: Flow[];
  selectedFlow: string | null;
  onSelect: (id: string) => void;
}

export function FlowsSidebar({ flows, selectedFlow, onSelect }: FlowsSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <Button className="w-full bg-emerald-600 hover:bg-emerald-500" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Novi Flow
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {flows.length === 0 ? (
            <div className="text-center text-zinc-500 py-8 text-sm">
              Još nemaš snimljenih flowova.<br/>
              Klikni "Pamćenje" desno da počneš.
            </div>
          ) : (
            flows.map((flow) => (
              <div
                key={flow.id}
                onClick={() => onSelect(flow.id)}
                className={cn(
                  "px-3 py-2.5 rounded-lg cursor-pointer flex items-center gap-3 text-sm transition-colors",
                  selectedFlow === flow.id 
                    ? "bg-zinc-800 text-white" 
                    : "hover:bg-zinc-900 text-zinc-400"
                )}
              >
                <FileText className="w-4 h-4" />
                <div className="flex-1 truncate">
                  <div>{flow.name}</div>
                  <div className="text-[10px] text-zinc-500">{flow.date}</div>
                </div>
                {flow.status === "converted" && (
                  <div className="text-[10px] px-2 py-0.5 bg-emerald-900 text-emerald-400 rounded">FME</div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
