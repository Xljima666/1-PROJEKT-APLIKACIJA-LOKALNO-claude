import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

interface FlowCodeViewerProps {
  code: string;
  isRecording: boolean;
}

export const FlowCodeViewer: React.FC<FlowCodeViewerProps> = ({ code, isRecording }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="font-medium">{isRecording ? 'Snimanje u tijeku...' : 'Live Code Preview'}</span>
        </div>
        <div className="text-xs text-zinc-500">Playwright + Stellan</div>
      </div>

      <ScrollArea className="flex-1 p-6 font-mono text-sm bg-[#0a0a0a]">
        <pre className="text-emerald-300 whitespace-pre-wrap break-words leading-relaxed">
          {code}
        </pre>
      </ScrollArea>

      <div className="px-6 py-3 border-t border-zinc-800 text-xs text-zinc-500 bg-zinc-950">
        Kod se automatski popunjava dok klikćeš po Chromiumu. Stellan će ga poboljšati kad pritisneš „Popravi kod“.
      </div>
    </div>
  );
};
