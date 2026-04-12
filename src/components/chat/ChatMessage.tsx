import { memo, useState, useCallback } from "react";
import { Copy, Check, Code2, Sparkles, ThumbsUp, ThumbsDown, FileText, FileCode2, FileArchive, FileImage, FileSpreadsheet, File, ChevronDown, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
  
interface CodeBlock { language: string; code: string; label: string; }

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isLatest: boolean;
  isStreaming?: boolean;
  codeBlocks: CodeBlock[];
  hasCode: boolean;
  onShowCodePanel: () => void;
  onScrollToCode: (index: number) => void;
  messageIndex?: number;
  onReaction?: (index: number, reaction: "up" | "down") => void;
  reaction?: "up" | "down" | null;
}

// ─── Heading colors (no backgrounds, just colored titles) ───
const HEADING_COLORS = ["#1de98b", "#5aaef8", "#c084fc", "#fbbf24", "#f87171"];

// ─── File type detection ────────────────────────────────────
const FILE_TYPE_MAP: Record<string, { icon: typeof File; color: string; badge: string; badgeColor: string }> = {
  zip:  { icon: FileArchive, color: "#fbbf24", badge: "ZIP", badgeColor: "rgba(251,191,36,0.15)" },
  rar:  { icon: FileArchive, color: "#fbbf24", badge: "RAR", badgeColor: "rgba(251,191,36,0.15)" },
  "7z": { icon: FileArchive, color: "#fbbf24", badge: "7Z", badgeColor: "rgba(251,191,36,0.15)" },
  gz:   { icon: FileArchive, color: "#fbbf24", badge: "GZ", badgeColor: "rgba(251,191,36,0.15)" },
  tar:  { icon: FileArchive, color: "#fbbf24", badge: "TAR", badgeColor: "rgba(251,191,36,0.15)" },
  pdf:  { icon: FileText, color: "#ef4444", badge: "PDF", badgeColor: "rgba(239,68,68,0.15)" },
  doc:  { icon: FileText, color: "#3b82f6", badge: "DOC", badgeColor: "rgba(59,130,246,0.15)" },
  docx: { icon: FileText, color: "#3b82f6", badge: "DOCX", badgeColor: "rgba(59,130,246,0.15)" },
  csv:  { icon: FileSpreadsheet, color: "#22c55e", badge: "CSV", badgeColor: "rgba(34,197,94,0.15)" },
  xls:  { icon: FileSpreadsheet, color: "#22c55e", badge: "XLS", badgeColor: "rgba(34,197,94,0.15)" },
  xlsx: { icon: FileSpreadsheet, color: "#22c55e", badge: "XLSX", badgeColor: "rgba(34,197,94,0.15)" },
  ts:   { icon: FileCode2, color: "#3178c6", badge: "TS", badgeColor: "rgba(49,120,198,0.15)" },
  tsx:  { icon: FileCode2, color: "#3178c6", badge: "TSX", badgeColor: "rgba(49,120,198,0.15)" },
  js:   { icon: FileCode2, color: "#f7df1e", badge: "JS", badgeColor: "rgba(247,223,30,0.15)" },
  jsx:  { icon: FileCode2, color: "#61dafb", badge: "JSX", badgeColor: "rgba(97,218,251,0.15)" },
  py:   { icon: FileCode2, color: "#3776ab", badge: "PY", badgeColor: "rgba(55,118,171,0.15)" },
  html: { icon: FileCode2, color: "#e34f26", badge: "HTML", badgeColor: "rgba(227,79,38,0.15)" },
  css:  { icon: FileCode2, color: "#264de4", badge: "CSS", badgeColor: "rgba(38,77,228,0.15)" },
  json: { icon: FileCode2, color: "#a8a8a8", badge: "JSON", badgeColor: "rgba(168,168,168,0.15)" },
  sql:  { icon: FileCode2, color: "#f29111", badge: "SQL", badgeColor: "rgba(242,145,17,0.15)" },
  xml:  { icon: FileCode2, color: "#f16529", badge: "XML", badgeColor: "rgba(241,101,41,0.15)" },
  yaml: { icon: FileCode2, color: "#cb171e", badge: "YAML", badgeColor: "rgba(203,23,30,0.15)" },
  yml:  { icon: FileCode2, color: "#cb171e", badge: "YML", badgeColor: "rgba(203,23,30,0.15)" },
  sh:   { icon: FileCode2, color: "#89e051", badge: "SH", badgeColor: "rgba(137,224,81,0.15)" },
  md:   { icon: FileText, color: "#ffffff", badge: "MD", badgeColor: "rgba(255,255,255,0.1)" },
  png:  { icon: FileImage, color: "#a855f7", badge: "PNG", badgeColor: "rgba(168,85,247,0.15)" },
  jpg:  { icon: FileImage, color: "#a855f7", badge: "JPG", badgeColor: "rgba(168,85,247,0.15)" },
  jpeg: { icon: FileImage, color: "#a855f7", badge: "JPEG", badgeColor: "rgba(168,85,247,0.15)" },
  gif:  { icon: FileImage, color: "#a855f7", badge: "GIF", badgeColor: "rgba(168,85,247,0.15)" },
  svg:  { icon: FileImage, color: "#a855f7", badge: "SVG", badgeColor: "rgba(168,85,247,0.15)" },
  webp: { icon: FileImage, color: "#a855f7", badge: "WEBP", badgeColor: "rgba(168,85,247,0.15)" },
};

function getFileType(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return FILE_TYPE_MAP[ext] || { icon: File, color: "#8b8b8b", badge: ext.toUpperCase() || "FILE", badgeColor: "rgba(139,139,139,0.15)" };
}

// ─── File card ──────────────────────────────────────────────
function FileCard({ filename, size, extra }: { filename: string; size?: string; extra?: string }) {
  const ft = getFileType(filename);
  const Icon = ft.icon;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "8px",
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px", padding: "8px 10px", maxWidth: "200px",
    }}>
      <div style={{
        width: "28px", height: "28px", borderRadius: "7px",
        background: `${ft.color}15`, border: `1px solid ${ft.color}30`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon style={{ width: "14px", height: "14px", color: ft.color }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{filename}</div>
        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", marginTop: "1px" }}>
          {[size, extra].filter(Boolean).join(" · ")}
          {" · "}<span style={{ fontWeight: 700, color: ft.color, fontSize: "8px", letterSpacing: "0.04em" }}>{ft.badge}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Code file card (compact card, expand to see code) ──────
function CodeFileCard({ filename, size, language, code }: { filename: string; size?: string; language: string; code: string }) {
  const [expanded, setExpanded] = useState(false);
  const ft = getFileType(filename);
  const Icon = ft.icon;
  const lineCount = code.split("\n").length;

  if (!expanded) {
    return (
      <div onClick={() => setExpanded(true)} style={{
        display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer",
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "10px", padding: "8px 10px", maxWidth: "220px",
        transition: "border-color 0.15s",
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
      >
        <div style={{
          width: "28px", height: "28px", borderRadius: "7px",
          background: `${ft.color}15`, border: `1px solid ${ft.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon style={{ width: "14px", height: "14px", color: ft.color }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{filename}</div>
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>
            {size ? `${size} · ` : ""}{lineCount} linija
            {" · "}<span style={{ fontWeight: 700, color: ft.color, fontSize: "8px", letterSpacing: "0.04em" }}>{ft.badge}</span>
          </div>
        </div>
        <ChevronRight style={{ width: "12px", height: "12px", color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "14px", overflow: "hidden", maxWidth: "100%",
    }}>
      <button onClick={() => setExpanded(false)} style={{
        display: "flex", alignItems: "center", gap: "10px", width: "100%",
        padding: "12px 14px", background: "transparent", border: "none",
        cursor: "pointer", textAlign: "left" as const,
      }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${ft.color}15`, border: `1px solid ${ft.color}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon style={{ width: "16px", height: "16px", color: ft.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{filename}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{size ? `${size} · ` : ""}{lineCount} linija</div>
        </div>
        <ChevronDown style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
      </button>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", maxHeight: "400px", overflow: "auto" }}>
        <SyntaxHighlighter language={language} style={oneDark} customStyle={{ margin: 0, background: "#0d1117", fontSize: "12px", lineHeight: "1.6", borderRadius: 0, padding: "12px 14px" }} wrapLongLines>{code}</SyntaxHighlighter>
      </div>
    </div>
  );
}

// ─── Download card for generated files ───────────────────────
function DownloadCard({ filename, url, size }: { filename: string; url: string; size?: string }) {
  const ft = getFileType(filename);
  const Icon = ft.icon;
  return (
    <a
      href={url}
      download={filename}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex", flexDirection: "column", gap: "8px", textDecoration: "none",
        background: "rgba(29,233,139,0.06)", border: "1px solid rgba(29,233,139,0.2)",
        borderRadius: "14px", padding: "14px 16px", minWidth: "180px", maxWidth: "280px",
        cursor: "pointer", transition: "all 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(29,233,139,0.12)"; e.currentTarget.style.borderColor = "rgba(29,233,139,0.35)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(29,233,139,0.06)"; e.currentTarget.style.borderColor = "rgba(29,233,139,0.2)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: `${ft.color}15`, border: `1px solid ${ft.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon style={{ width: "18px", height: "18px", color: ft.color }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{filename}</div>
          {size && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "1px" }}>{size}</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          fontSize: "11px", fontWeight: 600, letterSpacing: "0.03em",
          padding: "4px 10px", borderRadius: "8px",
          background: "rgba(29,233,139,0.15)", color: "#1de98b",
        }}>
          <Download style={{ width: "12px", height: "12px" }} />
          Preuzmi
        </div>
        <span style={{
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em",
          padding: "3px 8px", borderRadius: "6px",
          background: ft.badgeColor, color: ft.color,
        }}>{ft.badge}</span>
      </div>
    </a>
  );
}

// ─── Parse %%FILE_DOWNLOAD%% markers from assistant content ──
function parseFileDownloads(content: string): { cleanContent: string; downloads: { filename: string; url: string; size?: string }[] } {
  const downloads: { filename: string; url: string; size?: string }[] = [];
  const cleanContent = content.replace(/%%FILE_DOWNLOAD:(.*?)%%/g, (_, json) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.filename && parsed.url) downloads.push(parsed);
    } catch { /* ignore */ }
    return "";
  }).trim();
  return { cleanContent, downloads };
}

// ─── Parse user message for file attachments ────────────────
function parseUserContent(content: string) {
  const attachments: Array<any> = [];
  const textParts: string[] = [];
  // Ordered list for correct rendering sequence
  const orderedItems: Array<{ type: "text" | "attachment"; index: number }> = [];

  // Check for ««FILE:...»» delimiters
  const fileRegex = /\u00ab\u00abFILE:([^»]+)\u00bb\u00bb\n([\s\S]*?)\n\u00ab\u00ab\/FILE\u00bb\u00bb/g;
  let hasFiles = false;
  let lastEnd = 0;
  let match;

  while ((match = fileRegex.exec(content)) !== null) {
    hasFiles = true;
    // Text before this file block
    const before = content.slice(lastEnd, match.index).trim();
    if (before) {
      orderedItems.push({ type: "text", index: textParts.length });
      textParts.push(before);
    }
    lastEnd = match.index + match[0].length;

    const meta = match[1]; // e.g. "tsx:ChatDialog.tsx:60.5 KB" or "pdf:file.pdf:45 KB:3:url" or "bin:file.zip:5 KB"
    const fileContent = match[2];
    const parts = meta.split(":");
    const lang = parts[0] || "";
    const filename = parts[1] || "file";
    const size = parts[2] || "";

    if (lang === "pdf") {
      const pages = parts[3] || "";
      attachments.push({ type: "pdf", filename, size, pages: pages !== "0" ? `${pages} str.` : undefined });
    } else if (lang === "bin") {
      attachments.push({ type: "file", filename, size });
    } else {
      attachments.push({ type: "code-file", filename, size, language: lang, code: fileContent });
    }
    orderedItems.push({ type: "attachment", index: attachments.length - 1 });
  }

  if (hasFiles) {
    // Text after the last file block
    const after = content.slice(lastEnd).trim();
    if (after) {
      orderedItems.push({ type: "text", index: textParts.length });
      textParts.push(after);
    }
  }

  if (!hasFiles) {
    // Legacy format fallback: 📎 and 📄 patterns
    let remaining = content;

    // Images
    const imageRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
    let imgMatch;
    while ((imgMatch = imageRegex.exec(content)) !== null) {
      attachments.push({ type: "image", name: imgMatch[1] || "Slika", src: imgMatch[2] });
    }
    if (attachments.length > 0) {
      remaining = remaining.replace(imageRegex, "").trim();
    }

    // Legacy code file with backticks (best effort)
    const legacyCodeRegex = /📎\s*Učitana datoteka:\s*\*\*([^*]+)\*\*\s*\(([^)]+)\)/;
    const legacyMatch = legacyCodeRegex.exec(remaining);
    if (legacyMatch) {
      const before = remaining.slice(0, legacyMatch.index).trim();
      const after = remaining.slice(legacyMatch.index + legacyMatch[0].length).trim();
      // Check if there's a code block after
      const codeBlockMatch = after.match(/^\s*```(\w+)\n([\s\S]*?)```\s*([\s\S]*)$/);
      if (codeBlockMatch) {
        attachments.push({ type: "code-file", filename: legacyMatch[1], size: legacyMatch[2], language: codeBlockMatch[1], code: codeBlockMatch[2].trimEnd() });
        const trailing = codeBlockMatch[3]?.trim();
        if (before) textParts.push(before);
        if (trailing) textParts.push(trailing);
      } else {
        attachments.push({ type: "file", filename: legacyMatch[1], size: legacyMatch[2] });
        if (before) textParts.push(before);
        if (after) textParts.push(after);
      }
      return { attachments, textParts, orderedItems };
    }

    // Legacy PDF
    const pdfRegex = /📄\s*PDF:\s*\*\*([^*]+)\*\*\s*([^\n]*)/;
    const pdfMatch = pdfRegex.exec(remaining);
    if (pdfMatch) {
      const before = remaining.slice(0, pdfMatch.index).trim();
      const meta = pdfMatch[2].trim();
      const sizeMatch = meta.match(/\(([^)]*KB[^)]*)\)/);
      const pagesMatch = meta.match(/\((\d+\s*str\.?[^)]*)\)/);
      attachments.push({ type: "pdf", filename: pdfMatch[1], size: sizeMatch?.[1], pages: pagesMatch?.[1] });
      if (before) textParts.push(before);
      return { attachments, textParts, orderedItems };
    }

    if (remaining && attachments.length === 0) textParts.push(remaining);
    else if (remaining && attachments.length > 0) textParts.push(remaining);
  }

  return { attachments, textParts, orderedItems };
}

// ─── Copy button ────────────────────────────────────────────
const CopyButton = memo(({ text, size = "normal" }: { text: string; size?: "normal" | "small" }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  if (size === "small") return (
    <button onClick={copy} className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] text-white/40 hover:text-white/80 transition-all" title="Kopiraj">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white text-[11px] transition-all">
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Kopirano!" : "Kopiraj"}
    </button>
  );
});
CopyButton.displayName = "CopyButton";

// ─── Claude-like font ───────────────────────────────────────
const BASE_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// ─── Markdown components ────────────────────────────────────
function makeComponents(codeBlocks: CodeBlock[], hasCode: boolean, onScrollToCode: (i: number) => void, handleCodeClick: (i: number) => void) {
  return {
    code({ className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "");
      const codeStr = String(children).replace(/\n$/, "");
      if (match) {
        const lang = match[1] || "code";
        const blockIndex = codeBlocks.findIndex(cb => cb.code.trim() === codeStr.trim());
        if (hasCode && blockIndex !== -1 && ["java","code"].includes(lang.toLowerCase())) {
          return (
            <button onClick={() => handleCodeClick(blockIndex)} className="flex items-center gap-1.5 my-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[13px] font-medium transition-colors cursor-pointer border border-emerald-500/20">
              <Code2 className="w-3.5 h-3.5" />Kod #{blockIndex + 1} · {lang} → Kodovi
            </button>
          );
        }
        return (
          <div className="relative group my-3" style={{maxWidth:"680px"}}>
            <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d] rounded-t-xl">
              <span className="text-[11px] font-mono text-[#7d8590] uppercase tracking-wider">{lang}</span>
              <CopyButton text={codeStr} />
            </div>
            <SyntaxHighlighter language={match[1]||"text"} style={oneDark} customStyle={{margin:0,borderTopLeftRadius:0,borderTopRightRadius:0,background:"#0d1117",fontSize:"13px",lineHeight:"1.7",borderRadius:"0 0 10px 10px",maxWidth:"100%"}} wrapLongLines>{codeStr}</SyntaxHighlighter>
          </div>
        );
      }
      return <code style={{ fontFamily: "monospace", fontSize: "13px", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px" }} {...props}>{children}</code>;
    },
    h1: ({ children }: any) => <div style={{fontFamily:BASE_FONT,fontSize:"18px",fontWeight:600,color:"rgba(255,255,255,0.95)",marginBottom:"8px",marginTop:"16px"}}>{children}</div>,
    h2: ({ children }: any) => <div style={{fontFamily:BASE_FONT,fontSize:"15px",fontWeight:600,color:"rgba(255,255,255,0.9)",marginBottom:"6px",marginTop:"20px"}}>{children}</div>,
    h3: ({ children }: any) => <div style={{fontFamily:BASE_FONT,fontSize:"14px",fontWeight:600,color:"rgba(255,255,255,0.8)",marginBottom:"4px",marginTop:"16px"}}>{children}</div>,
    h4: ({ children }: any) => <div style={{fontFamily:BASE_FONT,fontSize:"14px",fontWeight:500,color:"rgba(255,255,255,0.7)",marginBottom:"4px",marginTop:"12px"}}>{children}</div>,
    strong({ children }: any) {
      const text = typeof children === "string" ? children : Array.isArray(children) ? children.filter((c: any) => typeof c === "string").join("") : "";
      const upper = text.toUpperCase().trim();
      if (["NAPOMENA","SAVJET","GOTOVO","UPOZORENJE","VAŽNO","INFO"].includes(upper)) {
        const colors: Record<string,string> = {"NAPOMENA":"#EF9F27","SAVJET":"#EF9F27","UPOZORENJE":"#ef4444","GOTOVO":"#00ff95","VAŽNO":"#ef4444","INFO":"#3399ff"};
        return <strong style={{display:"block",fontFamily:BASE_FONT,fontSize:"12px",fontWeight:700,color:colors[upper]||"#EF9F27",letterSpacing:"0.5px",textTransform:"uppercase",marginTop:"8px"}}>{children}</strong>;
      }
      return <strong style={{fontWeight:600,color:"rgba(255,255,255,0.95)"}}>{children}</strong>;
    },
    p: ({ children }: any) => <p style={{fontFamily:BASE_FONT,margin:"6px 0",lineHeight:"1.75",fontSize:"15px",color:"rgba(255,255,255,0.82)"}}>{children}</p>,
    ul: ({ children }: any) => <ul style={{margin:"6px 0",paddingLeft:"20px",display:"flex",flexDirection:"column" as const,gap:"4px",listStyleType:"disc"}}>{children}</ul>,
    ol: ({ children }: any) => <ol style={{margin:"6px 0",paddingLeft:"20px",display:"flex",flexDirection:"column" as const,gap:"4px",listStyleType:"decimal"}}>{children}</ol>,
    li: ({ children }: any) => <li style={{fontFamily:BASE_FONT,fontSize:"15px",lineHeight:"1.75",color:"rgba(255,255,255,0.80)"}}>{children}</li>,
    blockquote: ({ children }: any) => <div style={{borderLeft:"3px solid rgba(255,255,255,0.15)",paddingLeft:"14px",margin:"10px 0",color:"rgba(255,255,255,0.6)",fontStyle:"italic"}}>{children}</div>,
    a({ href, children }: any) {
      const safeHref = typeof href === "string" ? href.trim() : "";
      const cm = safeHref.match(/^#code-(\d+)$/);
      if (cm) return <button type="button" onClick={() => onScrollToCode(parseInt(cm[1],10)-1)} style={{color:"#00ff95",textDecoration:"underline",fontWeight:500,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px"}}><Code2 className="w-3 h-3"/>{children}</button>;
      if (!safeHref) return <span>{children}</span>;
      return <a href={safeHref} target="_blank" rel="noopener noreferrer" style={{color:"#5aaef8",textDecoration:"underline",textUnderlineOffset:"2px",cursor:"pointer"}} onClick={(e)=>{e.preventDefault();(window.top||window).open(safeHref,"_blank","noopener,noreferrer");}}>{children}</a>;
    },
    table: ({ children }: any) => <div style={{margin:"12px 0",overflowX:"auto",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.08)"}}><table style={{width:"100%",borderCollapse:"collapse"}}>{children}</table></div>,
    th: ({ children }: any) => <th style={{fontFamily:BASE_FONT,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.06)",padding:"8px 12px",textAlign:"left",fontSize:"13px",fontWeight:600,color:"rgba(255,255,255,0.8)"}}>{children}</th>,
    td: ({ children }: any) => <td style={{fontFamily:BASE_FONT,border:"1px solid rgba(255,255,255,0.08)",padding:"8px 12px",fontSize:"13px",color:"rgba(255,255,255,0.7)"}}>{children}</td>,
    img: ({ src, alt }: any) => <img src={src} alt={alt||""} className="max-w-full max-h-80 rounded-xl my-2 border border-white/[0.08]"/>,
  };
}

// ─── User message renderer ──────────────────────────────────
function UserContent({ content }: { content: string }) {
  // Strip legacy <!--FILES:...--> metadata if present
  const cleanContent = content.replace(/<!--FILES:.*?-->\n?/g, "");
  const { attachments, textParts, orderedItems } = parseUserContent(cleanContent);
  const imgComponents = {
    img:({src,alt}:any)=><img src={src} alt={alt||""} className="max-w-full max-h-80 rounded-xl my-2 border border-white/[0.08]"/>,
  };

  if (attachments.length === 0) {
    return <ReactMarkdown remarkPlugins={[remarkGfm]} components={imgComponents}>{cleanContent}</ReactMarkdown>;
  }

  // If we have ordered items (new ««FILE»» format), render with files grouped horizontally
  if (orderedItems.length > 0) {
    // Group consecutive attachments together for horizontal layout
    const groups: Array<{ type: "text"; index: number } | { type: "files"; indices: number[] }> = [];
    for (const item of orderedItems) {
      if (item.type === "text") {
        groups.push({ type: "text", index: item.index });
      } else {
        const last = groups[groups.length - 1];
        if (last && last.type === "files") {
          last.indices.push(item.index);
        } else {
          groups.push({ type: "files", indices: [item.index] });
        }
      }
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {groups.map((group, gi) => {
          if (group.type === "text") {
            const text = textParts[group.index];
            return text ? <div key={`g-${gi}`}><ReactMarkdown remarkPlugins={[remarkGfm]} components={imgComponents}>{text}</ReactMarkdown></div> : null;
          }
          return (
            <div key={`g-${gi}`} style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {group.indices.map((ai, fi) => {
                const a = attachments[ai];
                if (!a) return null;
                if (a.type === "image") return <img key={`f-${fi}`} src={a.src} alt={a.name} style={{ maxHeight: "120px", maxWidth: "200px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", objectFit: "cover" as const }} />;
                if (a.type === "file" || a.type === "pdf") return <FileCard key={`f-${fi}`} filename={a.filename} size={a.size} extra={a.pages} />;
                if (a.type === "code-file") return <CodeFileCard key={`f-${fi}`} filename={a.filename} size={a.size} language={a.language} code={a.code} />;
                return null;
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // Legacy fallback: grouped rendering
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {attachments.filter((a: any) => a.type === "image").map((a: any, i: number) => (
          <img key={`img-${i}`} src={a.src} alt={a.name} style={{ maxHeight: "120px", maxWidth: "200px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", objectFit: "cover" as const }} />
        ))}
        {attachments.filter((a: any) => a.type === "file" || a.type === "pdf").map((a: any, i: number) => (
          <FileCard key={`fc-${i}`} filename={a.filename} size={a.size} extra={a.pages} />
        ))}
        {attachments.filter((a: any) => a.type === "code-file").map((a: any, i: number) => (
          <CodeFileCard key={`cc-${i}`} filename={a.filename} size={a.size} language={a.language} code={a.code} />
        ))}
      </div>
      {textParts.map((text, i) => (
        <div key={`tp-${i}`}><ReactMarkdown remarkPlugins={[remarkGfm]} components={imgComponents}>{text}</ReactMarkdown></div>
      ))}
    </div>
  );
}

// ─── Assistant content — colored headings, no backgrounds ───
function AssistantContent({ content, components }: { content: string; components: any }) {
  const { cleanContent, downloads } = parseFileDownloads(content);
  const lines = cleanContent.split("\n");
  const sections: { heading: string | null; level: number; body: string }[] = [];
  let heading: string | null = null;
  let level = 0;
  let buf: string[] = [];

  for (const line of lines) {
    const hMatch = line.match(/^(#{1,3}) (.+)/);
    if (hMatch) {
      if (buf.length > 0 || heading !== null) sections.push({ heading, level, body: buf.join("\n").trim() });
      heading = hMatch[2].trim();
      level = hMatch[1].length;
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0 || heading !== null) sections.push({ heading, level, body: buf.join("\n").trim() });

  const hasHeadings = sections.some(s => s.heading !== null);
  let colorIdx = 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {hasHeadings ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {sections.map((sec, i) => {
            if (sec.heading === null) {
              return sec.body ? <div key={i}><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{sec.body}</ReactMarkdown></div> : null;
            }
            const color = HEADING_COLORS[colorIdx % HEADING_COLORS.length];
            colorIdx++;
            const fontSize = sec.level === 1 ? "17px" : sec.level === 2 ? "15px" : "14px";
            return (
              <div key={i} style={{ marginTop: i === 0 ? "0" : "14px" }}>
                <div style={{ fontFamily: BASE_FONT, fontSize, fontWeight: 600, color, marginBottom: "6px" }}>{sec.heading}</div>
                {sec.body && <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{sec.body}</ReactMarkdown>}
              </div>
            );
          })}
        </div>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{cleanContent}</ReactMarkdown>
      )}
      {downloads.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "12px" }}>
          {downloads.map((dl, i) => (
            <DownloadCard key={i} filename={dl.filename} url={dl.url} size={dl.size} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ChatMessage ───────────────────────────────────────
const ChatMessage = memo(({ role, content, isLatest, isStreaming, codeBlocks, hasCode, onShowCodePanel, onScrollToCode, messageIndex, onReaction, reaction }: ChatMessageProps) => {
  const [showActions, setShowActions] = useState(false);
  const streaming = isStreaming ?? false;

  const handleCodeClick = useCallback((blockIndex: number) => {
    onShowCodePanel();
    setTimeout(() => onScrollToCode(blockIndex), 100);
  }, [onShowCodePanel, onScrollToCode]);

  const components = makeComponents(codeBlocks, hasCode, onScrollToCode, handleCodeClick);

  return (
    <div className={cn("flex group", role==="user"?"justify-end":"justify-start", isLatest?"animate-in fade-in slide-in-from-bottom-2 duration-300":"")}
      onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
      <style>{`
        @keyframes s-pulse{0%,100%{box-shadow:0 0 0 0 rgba(29,233,139,0.5)}50%{box-shadow:0 0 0 8px rgba(29,233,139,0)}}
        @keyframes s-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      {role === "assistant" && (
        <div className="flex flex-col items-center mr-3 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20"
            style={streaming?{animation:"s-pulse 1.4s ease-in-out infinite"}:{}}>
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground" style={streaming?{animation:"s-spin 2s linear infinite"}:{}}/>
          </div>
          <span style={{fontSize:"9px",fontWeight:600,color:"rgba(255,255,255,0.3)",letterSpacing:"0.05em",marginTop:"3px"}}>STELLAN</span>
        </div>
      )}

      <div className={cn("flex flex-col gap-1.5", role==="user"?"items-end max-w-[80%]":"items-start flex-1 min-w-0")}>
        <div className={cn("text-[15px] leading-[1.75]",
          role==="user"
            ?"bg-gradient-to-br from-white/[0.10] to-white/[0.06] text-white/90 rounded-2xl rounded-br-sm px-4 py-3 leading-relaxed border border-white/[0.08]"
            :"text-white/90 w-full"
        )} style={{ fontFamily: BASE_FONT }}>
          {role === "user" ? (
            <UserContent content={content} />
          ) : (
            <div style={{fontFamily:BASE_FONT,fontSize:"15px",lineHeight:"1.75",color:"rgba(255,255,255,0.85)"}}>
              <AssistantContent content={content} components={components} />
            </div>
          )}
        </div>

        <div className={cn("flex items-center gap-1 transition-all duration-150", showActions?"opacity-100":"opacity-0 pointer-events-none")}>
          <CopyButton text={content} size="small"/>
          {role==="assistant" && onReaction && messageIndex!==undefined && (
            <>
              <button onClick={()=>onReaction(messageIndex,"up")} className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-all",reaction==="up"?"bg-emerald-500/20 text-emerald-400":"bg-white/[0.06] text-white/30 hover:bg-emerald-500/10 hover:text-emerald-400")} title="Korisno"><ThumbsUp className="w-3.5 h-3.5"/></button>
              <button onClick={()=>onReaction(messageIndex,"down")} className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-all",reaction==="down"?"bg-red-500/20 text-red-400":"bg-white/[0.06] text-white/30 hover:bg-red-500/10 hover:text-red-400")} title="Nije korisno"><ThumbsDown className="w-3.5 h-3.5"/></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.content===next.content && prev.isLatest===next.isLatest && prev.isStreaming===next.isStreaming && prev.hasCode===next.hasCode && prev.codeBlocks===next.codeBlocks && prev.reaction===next.reaction;
});

ChatMessage.displayName = "ChatMessage";
export { ChatMessage, CopyButton };
export type { CodeBlock };
