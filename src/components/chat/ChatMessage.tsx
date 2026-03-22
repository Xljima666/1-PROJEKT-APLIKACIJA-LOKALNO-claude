import { memo, useState, useCallback } from "react";
import { Copy, Check, Code2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlock {
  language: string;
  code: string;
  label: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isLatest: boolean;
  codeBlocks: CodeBlock[];
  hasCode: boolean;
  onShowCodePanel: () => void;
  onScrollToCode: (index: number) => void;
}

const CopyButton = memo(({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white text-[11px] transition-all"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Kopirano!" : "Kopiraj"}
    </button>
  );
});
CopyButton.displayName = "CopyButton";

const ChatMessage = memo(({ role, content, isLatest, codeBlocks, hasCode, onShowCodePanel, onScrollToCode }: ChatMessageProps) => {
  const handleCodeClick = useCallback((blockIndex: number) => {
    onShowCodePanel();
    setTimeout(() => onScrollToCode(blockIndex), 100);
  }, [onShowCodePanel, onScrollToCode]);

  return (
    <div
      className={cn(
        "flex",
        role === "user" ? "justify-end" : "justify-start",
        isLatest ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""
      )}
    >
      {role === "assistant" && (
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mr-2.5 mt-0.5 shrink-0">
          <Sparkles className="w-3 h-3 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] text-[15px] leading-[1.75]",
          role === "user"
            ? "bg-white/[0.08] text-white/90 rounded-2xl rounded-br-md px-4 py-3 text-[15px] leading-relaxed"
            : "text-white/90"
        )}
      >
        {role === "assistant" ? (
          <div className="prose prose-base prose-invert max-w-none prose-p:my-2.5 prose-p:leading-[1.8] prose-p:text-[15px] prose-p:text-white/85 prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h1:my-5 prose-h1:text-emerald-400 prose-h2:text-xl prose-h2:my-4 prose-h2:text-emerald-500 prose-h3:text-lg prose-h3:my-3 prose-h3:text-emerald-600 prose-h4:text-base prose-h4:my-2.5 prose-ul:my-3 prose-ul:space-y-1.5 prose-ol:my-3 prose-ol:space-y-1.5 prose-li:text-[15px] prose-li:leading-[1.75] prose-li:text-white/80 prose-li:pl-1 prose-code:text-primary/90 prose-code:bg-white/[0.08] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-medium prose-pre:bg-white/[0.04] prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl prose-a:text-primary prose-a:underline prose-a:underline-offset-2 prose-strong:text-white prose-strong:font-semibold prose-blockquote:border-l-primary/40 prose-blockquote:text-white/60 prose-hr:border-white/[0.08] prose-table:border-collapse prose-th:border prose-th:border-white/[0.1] prose-th:bg-white/[0.06] prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-[13px] prose-th:font-semibold prose-th:text-white/80 prose-td:border prose-td:border-white/[0.08] prose-td:px-3 prose-td:py-2 prose-td:text-[13px] prose-td:text-white/70">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeStr = String(children).replace(/\n$/, "");
                  const isBlock = match;
                  if (isBlock) {
                    const lang = match?.[1] || "code";
                    const blockIndex = codeBlocks.findIndex(
                      (cb) => cb.code.trim() === codeStr.trim()
                    );
                    if (hasCode && blockIndex !== -1) {
                      return (
                        <button
                          onClick={() => handleCodeClick(blockIndex)}
                          className="flex items-center gap-1.5 my-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[13px] font-medium transition-colors cursor-pointer border border-emerald-500/20"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          Kod #{blockIndex + 1} · {lang} → Kodovi
                        </button>
                      );
                    }
                    return (
                      <div className="relative group my-4">
                        <div className="flex items-center justify-between px-4 py-2 bg-white/[0.06] border-b border-white/[0.06] rounded-t-xl">
                          <span className="text-[10px] font-mono text-primary/60 uppercase tracking-wider">{lang}</span>
                          <CopyButton text={codeStr} />
                        </div>
                        <SyntaxHighlighter
                          language={match?.[1] || "text"}
                          style={oneDark}
                          customStyle={{ margin: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, background: "rgba(255,255,255,0.03)", fontSize: "13px", lineHeight: "1.7" }}
                          wrapLongLines
                        >
                          {codeStr}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  return <code className={className} {...props}>{children}</code>;
                },
                h1({ children }) {
                  return <h1 className="bg-emerald-500/[0.10] border-l-[3px] border-emerald-400 pl-4 pr-3 py-2.5 rounded-r-lg w-full">{children}</h1>;
                },
                h2({ children }) {
                  return <h2 className="inline-block w-fit bg-emerald-500/[0.07] border-l-[3px] border-emerald-500 pl-4 pr-3 py-2 rounded-r-lg">{children}</h2>;
                },
                h3({ children }) {
                  return <h3 className="inline-block w-fit bg-emerald-500/[0.05] border-l-[2px] border-emerald-600 pl-3 pr-3 py-1.5 rounded-r-lg">{children}</h3>;
                },
                strong({ children }) {
                  return <strong className="uppercase">{children}</strong>;
                },
                a({ href, children }) {
                  const safeHref = typeof href === "string" ? href.trim() : "";
                  const codeMatch = safeHref.match(/^#code-(\d+)$/);
                  if (codeMatch) {
                    const idx = parseInt(codeMatch[1], 10) - 1;
                    return (
                      <button
                        type="button"
                        onClick={() => onScrollToCode(idx)}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline underline-offset-2 font-medium transition-colors cursor-pointer"
                      >
                        <Code2 className="w-3 h-3" />
                        {children}
                      </button>
                    );
                  }
                  if (!safeHref) return <span>{children}</span>;
                  return (
                    <a
                      href={safeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline text-primary hover:text-primary/80 underline underline-offset-2 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        const w = window.top || window;
                        w.open(safeHref, "_blank", "noopener,noreferrer");
                      }}
                    >
                      {children}
                    </a>
                  );
                },
                table({ children }) {
                  return (
                    <div className="my-4 overflow-x-auto rounded-xl border border-white/[0.08]">
                      <table className="w-full">{children}</table>
                    </div>
                  );
                },
                img({ src, alt }) {
                  return (
                    <img src={src} alt={alt || ""} className="max-w-full max-h-80 rounded-xl my-2 border border-white/[0.08]" />
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="group/usermsg relative">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                img({ src, alt }) {
                  return (
                    <img src={src} alt={alt || ""} className="max-w-full max-h-80 rounded-xl my-2 border border-white/[0.08]" />
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
            <button
              onClick={() => {
                navigator.clipboard.writeText(content);
              }}
              className="absolute -bottom-5 right-0 opacity-0 group-hover/usermsg:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.1] text-white/30 hover:text-white/60"
              title="Kopiraj tekst"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  // Custom comparison: only re-render if content changed or isLatest changed
  return prev.content === next.content 
    && prev.isLatest === next.isLatest 
    && prev.hasCode === next.hasCode
    && prev.codeBlocks === next.codeBlocks;
});

ChatMessage.displayName = "ChatMessage";

export { ChatMessage, CopyButton };
export type { CodeBlock };
