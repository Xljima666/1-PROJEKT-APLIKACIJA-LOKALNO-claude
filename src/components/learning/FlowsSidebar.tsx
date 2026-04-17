import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Play, FileText } from 'lucide-react';

interface FlowsSidebarProps {
  flows: any[];
  selectedFlow: string | null;
  onSelect: (id: string) => void;
  onNewFlow: () => void;
}

export const FlowsSidebar: React.FC<FlowsSidebarProps> = ({
  flows,
  selectedFlow,
  onSelect,
  onNewFlow
}) => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <Button onClick={onNewFlow} className="w-full bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Novi Flow
        </Button>
      </div>

      <div className="p-3 text-xs uppercase tracking-widest text-zinc-500 font-medium">
        Tvoji Flowovi
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 space-y-1">
          {flows.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">
              Još nemaš nijedan flow.<br/>Pritisni „Novi Flow“ ili „Pamćenje“.
            </div>
          ) : (
            flows.map((flow) => (
              <div
                key={flow.id}
                onClick={() => onSelect(flow.id)}
                className={`px-4 py-3 rounded-xl cursor-pointer flex items-center gap-3 transition-colors ${selectedFlow === flow.id ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900'}`}
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <div className="flex-1 truncate text-sm">{flow.name}</div>
                {flow.isTested && <Play className="w-3.5 h-3.5 text-emerald-500" />}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
