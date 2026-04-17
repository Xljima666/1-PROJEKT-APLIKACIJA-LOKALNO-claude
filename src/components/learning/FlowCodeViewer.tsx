import { ScrollArea } from "@/components/ui/scroll-area";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface FlowCodeViewerProps {
  code: string;
  onCodeChange: (code: string) => void;
}

export function FlowCodeViewer({ code, onCodeChange }: FlowCodeViewerProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 text-xs uppercase tracking-widest text-zinc-500 flex items-center justify-between">
        <div>Real-time Playwright Code</div>
        <div className="text-emerald-400 text-[10px]">LIVE</div>
      </div>
      
      <ScrollArea className="flex-1 p-4 font-mono text-sm">
        <SyntaxHighlighter
          language="typescript"
          style={vscDarkPlus}
          customStyle={{
            background: "transparent",
            margin: 0,
            padding: 0,
          }}
          wrapLines={true}
        >
          {code}
        </SyntaxHighlighter>
      </ScrollArea>
    </div>
  );
}
