import { memo, useState, useCallback } from "react";
import { Copy, Check, Code2, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
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
  messageIndex?: number;
  onReaction?: (index: number, reaction: "up" | "down") => void;
  reaction?: "up" | "down" | null;
}

const CopyButton = memo(({ text, size = "normal" }: { text: string; size?: "normal" | "small" }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (size === "small") {
    return (
      <button
        onClick={copy}
        className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] text-white/40 hover:text-white/80 transition-all"
        title="Kopiraj poruku"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    );
  }
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

const ChatMessage = memo(({ role, content, isLatest, codeBlocks, hasCode, onShowCodePanel, onScrollToCode, messageIndex, onReaction, reaction }: ChatMessageProps) => {
  const [showActions, setShowActions] = useState(false);

  const handleCodeClick = useCallback((blockIndex: number) => {
    onShowCodePanel();
    setTimeout(() => onScrollToCode(blockIndex), 100);
  }, [onShowCodePanel, onScrollToCode]);

  return (
    <div
      className={cn(
        "flex group",
        role === "user" ? "justify-end" : "justify-start",
        isLatest ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {role === "assistant" && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mr-3 mt-0.5 shrink-0 shadow-lg shadow-primary/20">
          <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}
      <div className={cn(
        "flex flex-col gap-1.5",
        role === "user" ? "items-end max-w-[80%]" : "items-start flex-1 min-w-0"
      )}>
        {/* Message bubble */}
        <div className={cn(
          "text-[15px] leading-[1.75]",
          role === "user"
            ? "bg-gradient-to-br from-white/[0.10] to-white/[0.06] text-white/90 rounded-2xl rounded-br-sm px-4 py-3 leading-relaxed border border-white/[0.08]"
            : "text-white/90 w-full"
        )}>
          {role === "assistant" ? (
            <div style={{fontSize:"15px", lineHeight:"1.85", color:"rgba(255,255,255,0.85)"}}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeStr = String(children).replace(/\n$/, "");
                    const isBlock = match;
                    if (isBlock) {
                      const lang = match?.[1] || "code";
                      // Samo java i code idu u panel, ostalo inline
                      const panelLanguages = ["java", "code"];
                      const blockIndex = codeBlocks.findIndex(
                        (cb) => cb.code.trim() === codeStr.trim()
                      );
                      if (hasCode && blockIndex !== -1 && panelLanguages.includes(lang.toLowerCase())) {
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
                      // Svi ostali kodovi — direktno inline
                      return (
                        <div className="relative group my-3" style={{maxWidth: "680px"}}>
                          <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d] rounded-t-xl">
                            <span className="text-[11px] font-mono text-[#7d8590] uppercase tracking-wider">{lang}</span>
                            <CopyButton text={codeStr} />
                          </div>
                          <SyntaxHighlighter
                            language={match?.[1] || "text"}
                            style={oneDark}
                            customStyle={{ margin: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, background: "#0d1117", fontSize: "13px", lineHeight: "1.7", borderRadius: "0 0 10px 10px", maxWidth: "100%" }}
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
                    return (
                      <h1 style={{
                        background: "linear-gradient(90deg,#00ff9525,transparent)",
                        borderLeft: "4px solid #00ff95",
                        padding: "8px 16px",
                        borderRadius: "0 10px 10px 0",
                        marginBottom: "14px",
                        marginTop: "18px",
                        fontSize: "19px",
                        fontWeight: 500,
                        color: "#00ff95",
                      }}>{children}</h1>
                    );
                  },
                  h2({ children }) {
                    return (
                      <h2 style={{
                        display: "inline-flex",
                        alignItems: "center",
                        background: "#0066ff20",
                        border: "1px solid #0066ff70",
                        borderRadius: "20px",
                        padding: "4px 16px",
                        marginBottom: "10px",
                        marginTop: "14px",
                        fontSize: "16px",
                        fontWeight: 500,
                        color: "#3399ff",
                      }}>{children}</h2>
                    );
                  },
                  h3({ children }) {
                    return (
                      <h3 style={{
                        display: "inline-flex",
                        alignItems: "center",
                        background: "#0066ff14",
                        border: "1px solid #0066ff50",
                        borderRadius: "20px",
                        padding: "3px 14px",
                        marginBottom: "8px",
                        marginTop: "12px",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#3399ff",
                      }}>{children}</h3>
                    );
                  },
                  h4({ children }) {
                    return (
                      <h4 style={{
                        display: "inline-flex",
                        alignItems: "center",
                        background: "#0066ff10",
                        border: "1px solid #0066ff40",
                        borderRadius: "20px",
                        padding: "2px 12px",
                        marginBottom: "6px",
                        marginTop: "10px",
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#3399ffcc",
                      }}>{children}</h4>
                    );
                  },
                  strong({ children }) {
                    return (
                      <strong style={{
                        display: "inline-flex",
                        alignItems: "center",
                        background: "#0066ff20",
                        border: "1px solid #0066ff70",
                        borderRadius: "20px",
                        padding: "3px 14px",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#3399ff",
                      }}>{children}</strong>
                    );
                  },
                  p({ children }) {
                    return <p style={{margin:"10px 0", lineHeight:"1.85", fontSize:"15px", color:"rgba(255,255,255,0.85)"}}>{children}</p>;
                  },
                  ul({ children }) {
                    return <ul style={{margin:"10px 0", paddingLeft:"0", display:"flex", flexDirection:"column", gap:"10px", listStyle:"none"}}>{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol style={{margin:"10px 0", paddingLeft:"0", display:"flex", flexDirection:"column", gap:"10px", listStyle:"none"}}>{children}</ol>;
                  },
                  li({ children }) {
                    return <li style={{fontSize:"15px", lineHeight:"1.8", color:"rgba(255,255,255,0.80)", display:"flex", flexDirection:"column", gap:"4px"}}>{children}</li>;
                  },
                  blockquote({ children }) {
                    return (
                      <div style={{
                        background: "#EF9F2710",
                        border: "1px solid #EF9F2740",
                        borderLeft: "4px solid #EF9F27",
                        borderRadius: "10px",
                        padding: "10px 16px",
                        margin: "12px 0",
                        fontSize: "13px",
                        color: "rgba(255,255,255,0.7)",
                        lineHeight: "1.7",
                      }}>{children}</div>
                    );
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
                          style={{color:"#00ff95", textDecoration:"underline", fontWeight:500, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:"4px"}}
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
                        style={{color:"#3399ff", textDecoration:"underline", textUnderlineOffset:"2px", cursor:"pointer"}}
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
                      <div style={{margin:"16px 0", overflowX:"auto", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.08)"}}>
                        <table style={{width:"100%", borderCollapse:"collapse"}}>{children}</table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return <th style={{border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.06)", padding:"8px 12px", textAlign:"left", fontSize:"13px", fontWeight:600, color:"rgba(255,255,255,0.8)"}}>{children}</th>;
                  },
                  td({ children }) {
                    return <td style={{border:"1px solid rgba(255,255,255,0.08)", padding:"8px 12px", fontSize:"13px", color:"rgba(255,255,255,0.7)"}}>{children}</td>;
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
            <div>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                img({ src, alt }) {
                  return <img src={src} alt={alt || ""} className="max-w-full max-h-80 rounded-xl my-2 border border-white/[0.08]" />;
                },
              }}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Action row - shown on hover */}
        <div className={cn(
          "flex items-center gap-1 transition-all duration-150",
          showActions ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <CopyButton text={content} size="small" />
          {role === "assistant" && onReaction && messageIndex !== undefined && (
            <>
              <button
                onClick={() => onReaction(messageIndex, "up")}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                  reaction === "up"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-white/[0.06] text-white/30 hover:bg-emerald-500/10 hover:text-emerald-400"
                )}
                title="Korisno"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onReaction(messageIndex, "down")}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                  reaction === "down"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-white/[0.06] text-white/30 hover:bg-red-500/10 hover:text-red-400"
                )}
                title="Nije korisno"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.content === next.content
    && prev.isLatest === next.isLatest
    && prev.hasCode === next.hasCode
    && prev.codeBlocks === next.codeBlocks
    && prev.reaction === next.reaction;
});

ChatMessage.displayName = "ChatMessage";

export { ChatMessage, CopyButton };
export type { CodeBlock };
