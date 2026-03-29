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
        <div className="flex flex-col items-center mr-3 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span style={{fontSize:"9px", fontWeight:600, color:"rgba(255,255,255,0.3)", letterSpacing:"0.05em", marginTop:"3px"}}>STELLAN</span>
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
            <div style={{fontSize:"15px", lineHeight:"1.85", color:"rgba(255,255,255,0.85)", position:"relative"}}>
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
                        fontSize: "16px",
                        fontWeight: 600,
                        background: "linear-gradient(90deg, #1de98b, #00c4ff)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        borderLeft: "3px solid #1de98b",
                        paddingLeft: "10px",
                        marginBottom: "12px",
                        marginTop: "22px",
                        display: "block",
                      }}>{children}</h1>
                    );
                  },
                  h2({ children }) {
                    const text = typeof children === "string" ? children : 
                      Array.isArray(children) ? children.filter(c => typeof c === "string").join("") : "";
                    const sourceColors: Record<string, {bg: string, border: string, color: string, icon: string}> = {
                      "GeoTerra": {bg:"rgba(29,158,117,0.12)", border:"rgba(29,158,117,0.3)", color:"#5DCAA5", icon:"📋"},
                      "Google Drive": {bg:"rgba(186,117,23,0.12)", border:"rgba(186,117,23,0.3)", color:"#EF9F27", icon:"📁"},
                      "Drive": {bg:"rgba(186,117,23,0.12)", border:"rgba(186,117,23,0.3)", color:"#EF9F27", icon:"📁"},
                      "Gmail": {bg:"rgba(226,75,74,0.12)", border:"rgba(226,75,74,0.3)", color:"#F09595", icon:"✉️"},
                      "SDGE": {bg:"rgba(55,138,221,0.12)", border:"rgba(55,138,221,0.3)", color:"#85B7EB", icon:"📊"},
                      "Trello": {bg:"rgba(55,138,221,0.12)", border:"rgba(55,138,221,0.3)", color:"#85B7EB", icon:"📌"},
                      "Solo": {bg:"rgba(29,158,117,0.12)", border:"rgba(29,158,117,0.3)", color:"#5DCAA5", icon:"🧾"},
                      "OSS": {bg:"rgba(127,119,221,0.12)", border:"rgba(127,119,221,0.3)", color:"#AFA9EC", icon:"🗺️"},
                    };
                    const match = Object.keys(sourceColors).find(k => text.includes(k));
                    const style = match ? sourceColors[match] : null;
                    if (style) {
                      return (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          background: style.bg,
                          border: `0.5px solid ${style.border}`,
                          borderRadius: "10px",
                          padding: "7px 12px",
                          marginBottom: "8px",
                          marginTop: "16px",
                        }}>
                          <span style={{fontSize:"14px"}}>{style.icon}</span>
                          <span style={{fontSize:"13px", fontWeight:500, color:style.color}}>{children}</span>
                        </div>
                      );
                    }
                    return (
                      <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "rgba(255,255,255,0.06)",
                        border: "0.5px solid rgba(255,255,255,0.15)",
                        borderRadius: "8px",
                        padding: "5px 12px",
                        marginBottom: "8px",
                        marginTop: "18px",
                      }}>
                        <span style={{fontSize:"13px", fontWeight:600, color:"rgba(255,255,255,0.9)", letterSpacing:"0.02em"}}>{children}</span>
                      </div>
                    );
                  },
                  h3({ children }) {
                    return (
                      <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        background: "rgba(51,153,255,0.10)",
                        border: "0.5px solid rgba(51,153,255,0.25)",
                        borderRadius: "6px",
                        padding: "3px 10px",
                        marginBottom: "6px",
                        marginTop: "14px",
                      }}>
                        <span style={{fontSize:"12px", fontWeight:600, color:"#7ab8ff", textTransform:"uppercase", letterSpacing:"0.06em"}}>{children}</span>
                      </div>
                    );
                  },
                  h4({ children }) {
                    return (
                      <h4 style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.6)",
                        marginBottom: "4px",
                        marginTop: "10px",
                      }}>{children}</h4>
                    );
                  },
                  strong({ children }) {
                    const text = typeof children === "string" ? children : 
                      Array.isArray(children) ? children.filter(c => typeof c === "string").join("") : "";
                    const upper = text.toUpperCase().trim();
                    // Blockquote labele
                    const isLabel = ["NAPOMENA", "SAVJET", "GOTOVO", "UPOZORENJE", "VAŽNO", "INFO"].includes(upper);
                    if (isLabel) {
                      const labelColors: Record<string, string> = {
                        "NAPOMENA": "#EF9F27", "SAVJET": "#EF9F27", "UPOZORENJE": "#ef4444",
                        "GOTOVO": "#00ff95", "VAŽNO": "#ef4444", "INFO": "#3399ff",
                      };
                      const color = labelColors[upper] || "#EF9F27";
                      return (
                        <strong style={{
                          display: "block",
                          fontSize: "13px",
                          fontWeight: 700,
                          color,
                          letterSpacing: "0.5px",
                          textTransform: "uppercase",
                          marginTop: "8px",
                        }}>{children}</strong>
                      );
                    }
                    return (
                      <strong style={{
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.95)",
                      }}>{children}</strong>
                    );
                  },
                  p({ children }) {
                    const text = typeof children === "string" ? children :
                      Array.isArray(children) ? children.map(c => typeof c === "string" ? c : "").join("") : "";
                    const isSuggestion = text.trim().endsWith("?") && text.length > 20;
                    if (isSuggestion) {
                      return (
                        <div style={{background:"rgba(239,159,39,0.08)", border:"1px solid rgba(239,159,39,0.25)", borderLeft:"3px solid #EF9F27", borderRadius:"12px", padding:"10px 14px", margin:"8px 0", lineHeight:"1.85", fontSize:"15px", color:"rgba(255,200,100,0.9)"}}>
                          {children}
                        </div>
                      );
                    }
                    return (
                      <div style={{background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"12px", padding:"10px 14px", margin:"8px 0", lineHeight:"1.85", fontSize:"15px", color:"rgba(255,255,255,0.85)"}}>
                        {children}
                      </div>
                    );
                  },
                  ul({ children }) {
                    return (
                      <div style={{background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"14px", padding:"12px 16px", margin:"10px 0"}}>
                        <ul style={{margin:0, paddingLeft:0, display:"flex", flexDirection:"column", gap:"8px", listStyle:"none"}}>{children}</ul>
                      </div>
                    );
                  },
                  ol({ children }) {
                    return (
                      <div style={{background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"14px", padding:"12px 16px", margin:"10px 0"}}>
                        <ol style={{margin:0, paddingLeft:0, display:"flex", flexDirection:"column", gap:"8px", listStyle:"none"}}>{children}</ol>
                      </div>
                    );
                  },
                  li({ children }) {
                    return (
                      <li style={{fontSize:"15px", lineHeight:"1.8", color:"rgba(255,255,255,0.80)", display:"flex", gap:"10px", alignItems:"flex-start"}}>
                        <span style={{width:"6px", height:"6px", borderRadius:"50%", background:"#1de98b", flexShrink:0, marginTop:"9px", boxShadow:"0 0 6px #1de98b60"}}></span>
                        <span style={{flex:1}}>{children}</span>
                      </li>
                    );
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
