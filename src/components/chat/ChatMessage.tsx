import { memo, useState, useCallback } from "react";
import { Copy, Check, Code2, Sparkles, ThumbsUp, ThumbsDown, FileText, FileCode2, FileArchive, FileImage, FileSpreadsheet, File, ChevronDown, ChevronRight } from "lucide-react";
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

const SECTION_COLORS = [
  { bg: "rgba(29,158,117,0.18)", border: "rgba(29,158,117,0.45)", left: "#1de98b", title: "#1de98b" },
  { bg: "rgba(55,138,221,0.18)", border: "rgba(55,138,221,0.45)", left: "#5aaef8", title: "#8ecfff" },
  { bg: "rgba(155,100,240,0.18)", border: "rgba(155,100,240,0.45)", left: "#c084fc", title: "#d8b4fe" },
  { bg: "rgba(239,159,39,0.18)", border: "rgba(239,159,39,0.45)", left: "#fbbf24", title: "#fcd34d" },
  { bg: "rgba(239,68,68,0.18)", border: "rgba(239,68,68,0.45)", left: "#f87171", title: "#fca5a5" },
];

// ─── File type detection ────────────────────────────────────
const FILE_TYPE_MAP: Record<string, { icon: typeof File; color: string; badge: string; badgeColor: string }> = {
  // Archives
  zip:  { icon: FileArchive, color: "#fbbf24", badge: "ZIP", badgeColor: "rgba(251,191,36,0.15)" },
  rar:  { icon: FileArchive, color: "#fbbf24", badge: "RAR", badgeColor: "rgba(251,191,36,0.15)" },
  "7z": { icon: FileArchive, color: "#fbbf24", badge: "7Z", badgeColor: "rgba(251,191,36,0.15)" },
  tar:  { icon: FileArchive, color: "#fbbf24", badge: "TAR", badgeColor: "rgba(251,191,36,0.15)" },
  gz:   { icon: FileArchive, color: "#fbbf24", badge: "GZ", badgeColor: "rgba(251,191,36,0.15)" },
  // Documents
  pdf:  { icon: FileText, color: "#ef4444", badge: "PDF", badgeColor: "rgba(239,68,68,0.15)" },
  doc:  { icon: FileText, color: "#3b82f6", badge: "DOC", badgeColor: "rgba(59,130,246,0.15)" },
  docx: { icon: FileText, color: "#3b82f6", badge: "DOCX", badgeColor: "rgba(59,130,246,0.15)" },
  // Spreadsheets
  csv:  { icon: FileSpreadsheet, color: "#22c55e", badge: "CSV", badgeColor: "rgba(34,197,94,0.15)" },
  xls:  { icon: FileSpreadsheet, color: "#22c55e", badge: "XLS", badgeColor: "rgba(34,197,94,0.15)" },
  xlsx: { icon: FileSpreadsheet, color: "#22c55e", badge: "XLSX", badgeColor: "rgba(34,197,94,0.15)" },
  // Code
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
  // Images
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

// ─── File card component ────────────────────────────────────
function FileCard({ filename, size, extra }: { filename: string; size?: string; extra?: string }) {
  const ft = getFileType(filename);
  const Icon = ft.icon;
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column", gap: "8px",
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "14px", padding: "14px 16px", minWidth: "160px", maxWidth: "240px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: `${ft.color}15`, border: `1px solid ${ft.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon style={{ width: "18px", height: "18px", color: ft.color }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.9)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
          }}>{filename}</div>
          {size && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "1px" }}>{size}</div>}
        </div>
      </div>
      <div style={{
        display: "inline-flex", alignSelf: "flex-start",
        fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em",
        padding: "3px 8px", borderRadius: "6px",
        background: ft.badgeColor, color: ft.color,
      }}>
        {ft.badge}
      </div>
      {extra && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{extra}</div>}
    </div>
  );
}

// ─── Collapsible code attachment ────────────────────────────
function CodeAttachment({ filename, size, language, code }: { filename: string; size?: string; language: string; code: string }) {
  const [expanded, setExpanded] = useState(false);
  const ft = getFileType(filename);
  const Icon = ft.icon;
  const previewLines = code.split("\n").slice(0, 6).join("\n");
  const lineCount = code.split("\n").length;

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "14px", overflow: "hidden", maxWidth: "100%",
    }}>
      {/* File header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: "10px", width: "100%",
          padding: "12px 14px", background: "transparent", border: "none",
          cursor: "pointer", textAlign: "left" as const,
        }}
      >
        <div style={{
          width: "32px", height: "32px", borderRadius: "8px",
          background: `${ft.color}15`, border: `1px solid ${ft.color}25`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon style={{ width: "16px", height: "16px", color: ft.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{filename}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>
            {size ? `${size} · ` : ""}{lineCount} linija · {ft.badge}
          </div>
        </div>
        {expanded
          ? <ChevronDown style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
          : <ChevronRight style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
        }
      </button>

      {/* Code preview / full code */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {expanded ? (
          <div style={{ maxHeight: "400px", overflow: "auto" }}>
            <SyntaxHighlighter language={language} style={oneDark} customStyle={{
              margin: 0, background: "#0d1117", fontSize: "12px", lineHeight: "1.6",
              borderRadius: 0, padding: "12px 14px",
            }} wrapLongLines>{code}</SyntaxHighlighter>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <SyntaxHighlighter language={language} style={oneDark} customStyle={{
              margin: 0, background: "#0d1117", fontSize: "12px", lineHeight: "1.6",
              borderRadius: 0, padding: "12px 14px", maxHeight: "120px", overflow: "hidden",
            }} wrapLongLines>{previewLines}</SyntaxHighlighter>
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: "50px",
              background: "linear-gradient(transparent, #0d1117)",
              display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "6px",
            }}>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
                Klikni za proširenje · {lineCount - 6 > 0 ? `još ${lineCount - 6} linija` : ""}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Parse user message for file attachments ────────────────
interface ParsedUserContent {
  textBefore: string;
  attachments: Array<
    | { type: "file"; filename: string; size?: string; extra?: string }
    | { type: "code-file"; filename: string; size?: string; language: string; code: string }
    | { type: "image"; name: string; src: string }
    | { type: "pdf"; filename: string; size?: string; pages?: string; url?: string; content: string }
  >;
  textAfter: string;
}

function parseUserContent(content: string): ParsedUserContent {
  const result: ParsedUserContent = { textBefore: "", attachments: [], textAfter: "" };

  // Check for image markdown: ![name](data:image/...)
  const imageRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
  const images: { name: string; src: string }[] = [];
  let cleanContent = content;
  let imgMatch;
  while ((imgMatch = imageRegex.exec(content)) !== null) {
    images.push({ name: imgMatch[1] || "Slika", src: imgMatch[2] });
  }
  if (images.length > 0) {
    cleanContent = content.replace(imageRegex, "").trim();
    images.forEach(img => result.attachments.push({ type: "image", ...img }));
  }

  // Check for code file attachment: 📎 Učitana datoteka: **name** (size)\n\n```lang\n...\n```
  const codeFileRegex = /📎\s*Učitana datoteka:\s*\*\*([^*]+)\*\*\s*\(([^)]+)\)\s*\n\n```(\w+)\n([\s\S]*?)```/;
  const codeMatch = codeFileRegex.exec(cleanContent);
  if (codeMatch) {
    const before = cleanContent.slice(0, codeMatch.index).trim();
    const after = cleanContent.slice(codeMatch.index + codeMatch[0].length).trim();
    result.attachments.push({
      type: "code-file",
      filename: codeMatch[1],
      size: codeMatch[2],
      language: codeMatch[3],
      code: codeMatch[4].trimEnd(),
    });
    result.textBefore = before;
    result.textAfter = after;
    return result;
  }

  // Check for binary file attachment: 📎 Učitana datoteka: **name** (size, type)
  const binaryFileRegex = /📎\s*Učitana datoteka:\s*\*\*([^*]+)\*\*\s*\(([^)]+)\)/;
  const binaryMatch = binaryFileRegex.exec(cleanContent);
  if (binaryMatch) {
    const before = cleanContent.slice(0, binaryMatch.index).trim();
    const after = cleanContent.slice(binaryMatch.index + binaryMatch[0].length).trim();
    result.attachments.push({ type: "file", filename: binaryMatch[1], size: binaryMatch[2] });
    result.textBefore = before;
    result.textAfter = after;
    return result;
  }

  // Check for PDF: 📄 PDF: **name** (pages) (size)\n\n...
  const pdfRegex = /📄\s*PDF:\s*\*\*([^*]+)\*\*([^]*?)(?:\n\n🔗[^\n]*)?\n\n([\s\S]*)/;
  const pdfMatch = pdfRegex.exec(cleanContent);
  if (pdfMatch) {
    const before = cleanContent.slice(0, pdfMatch.index).trim();
    const meta = pdfMatch[2].trim();
    const pdfContent = pdfMatch[3].trim();
    // Extract size from meta like "(3 str.) (45.2 KB)"
    const sizeMatch = meta.match(/\(([^)]*KB[^)]*)\)/);
    const pagesMatch = meta.match(/\((\d+\s*str\.?[^)]*)\)/);
    const urlMatch = cleanContent.match(/🔗\s*PDF URL[^\n]*?(https?:\/\/[^\s)]+)/);
    result.attachments.push({
      type: "pdf",
      filename: pdfMatch[1],
      size: sizeMatch?.[1],
      pages: pagesMatch?.[1],
      url: urlMatch?.[1],
      content: pdfContent,
    });
    result.textBefore = before;
    return result;
  }

  // No special attachment detected — return raw
  result.textBefore = cleanContent;
  return result;
}

// ─── Split markdown into sections (for assistant messages) ──
function splitSections(content: string): { heading: string | null; body: string }[] {
  const lines = content.split("\n");
  const sections: { heading: string | null; body: string }[] = [];
  let heading: string | null = null;
  let buf: string[] = [];

  for (const line of lines) {
    if (line.match(/^#{1,3} /)) {
      if (buf.length > 0 || heading !== null) {
        sections.push({ heading, body: buf.join("\n").trim() });
      }
      heading = line.replace(/^#{1,3} /, "").trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0 || heading !== null) {
    sections.push({ heading, body: buf.join("\n").trim() });
  }
  return sections;
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

// ─── Markdown components for assistant messages ─────────────
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
      return <code className={className} {...props}>{children}</code>;
    },
    h1: ({ children }: any) => <div style={{fontSize:"15px",fontWeight:700,color:"rgba(255,255,255,0.95)",marginBottom:"8px",marginTop:"4px"}}>{children}</div>,
    h2: ({ children }: any) => <div style={{fontSize:"13px",fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase" as const,letterSpacing:"0.07em",marginBottom:"8px",marginTop:"4px"}}>{children}</div>,
    h3: ({ children }: any) => <div style={{fontSize:"12px",fontWeight:600,color:"rgba(255,255,255,0.45)",textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:"6px",marginTop:"4px"}}>{children}</div>,
    h4: ({ children }: any) => <div style={{fontSize:"13px",fontWeight:500,color:"rgba(255,255,255,0.6)",marginBottom:"4px",marginTop:"6px"}}>{children}</div>,
    strong({ children }: any) {
      const text = typeof children === "string" ? children : Array.isArray(children) ? children.filter((c: any) => typeof c === "string").join("") : "";
      const upper = text.toUpperCase().trim();
      if (["NAPOMENA","SAVJET","GOTOVO","UPOZORENJE","VAŽNO","INFO"].includes(upper)) {
        const colors: Record<string,string> = {"NAPOMENA":"#EF9F27","SAVJET":"#EF9F27","UPOZORENJE":"#ef4444","GOTOVO":"#00ff95","VAŽNO":"#ef4444","INFO":"#3399ff"};
        return <strong style={{display:"block",fontSize:"12px",fontWeight:700,color:colors[upper]||"#EF9F27",letterSpacing:"0.5px",textTransform:"uppercase",marginTop:"8px"}}>{children}</strong>;
      }
      return <strong style={{fontWeight:600,color:"rgba(255,255,255,0.95)"}}>{children}</strong>;
    },
    p: ({ children }: any) => <p style={{margin:"6px 0",lineHeight:"1.8",fontSize:"15px",color:"rgba(255,255,255,0.82)"}}>{children}</p>,
    ul: ({ children }: any) => <ul style={{margin:"6px 0 0 0",paddingLeft:0,display:"flex",flexDirection:"column" as const,gap:"7px",listStyle:"none"}}>{children}</ul>,
    ol: ({ children }: any) => <ol style={{margin:"6px 0 0 0",paddingLeft:0,display:"flex",flexDirection:"column" as const,gap:"7px",listStyle:"none"}}>{children}</ol>,
    li: ({ children }: any) => (
      <li style={{fontSize:"15px",lineHeight:"1.8",color:"rgba(255,255,255,0.80)",display:"flex",gap:"10px",alignItems:"flex-start"}}>
        <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#1de98b",flexShrink:0,marginTop:"9px",boxShadow:"0 0 6px #1de98b60"}}></span>
        <span style={{flex:1}}>{children}</span>
      </li>
    ),
    blockquote: ({ children }: any) => <div style={{background:"#EF9F2710",border:"1px solid #EF9F2740",borderLeft:"4px solid #EF9F27",borderRadius:"10px",padding:"10px 16px",margin:"10px 0",fontSize:"13px",color:"rgba(255,255,255,0.7)",lineHeight:"1.7"}}>{children}</div>,
    a({ href, children }: any) {
      const safeHref = typeof href === "string" ? href.trim() : "";
      const cm = safeHref.match(/^#code-(\d+)$/);
      if (cm) return <button type="button" onClick={() => onScrollToCode(parseInt(cm[1],10)-1)} style={{color:"#00ff95",textDecoration:"underline",fontWeight:500,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px"}}><Code2 className="w-3 h-3"/>{children}</button>;
      if (!safeHref) return <span>{children}</span>;
      return <a href={safeHref} target="_blank" rel="noopener noreferrer" style={{color:"#3399ff",textDecoration:"underline",textUnderlineOffset:"2px",cursor:"pointer"}} onClick={(e)=>{e.preventDefault();(window.top||window).open(safeHref,"_blank","noopener,noreferrer");}}>{children}</a>;
    },
    table: ({ children }: any) => <div style={{margin:"12px 0",overflowX:"auto",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.08)"}}><table style={{width:"100%",borderCollapse:"collapse"}}>{children}</table></div>,
    th: ({ children }: any) => <th style={{border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.06)",padding:"8px 12px",textAlign:"left",fontSize:"13px",fontWeight:600,color:"rgba(255,255,255,0.8)"}}>{children}</th>,
    td: ({ children }: any) => <td style={{border:"1px solid rgba(255,255,255,0.08)",padding:"8px 12px",fontSize:"13px",color:"rgba(255,255,255,0.7)"}}>{children}</td>,
    img: ({ src, alt }: any) => <img src={src} alt={alt||""} className="max-w-full max-h-80 rounded-xl my-2 border border-white/[0.08]"/>,
  };
}

// ─── User message content renderer ──────────────────────────
function UserContent({ content }: { content: string }) {
  const parsed = parseUserContent(content);

  // If no special attachments detected, render as before
  if (parsed.attachments.length === 0) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        img:({src,alt}:any)=><img src={src} alt={alt||""} className="max-w-full max-h-80 rounded-xl my-2 border border-white/[0.08]"/>,
      }}>{content}</ReactMarkdown>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Images as thumbnails */}
      {parsed.attachments.filter(a => a.type === "image").length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" as const }}>
          {parsed.attachments.filter(a => a.type === "image").map((a, i) => {
            if (a.type !== "image") return null;
            return (
              <img key={i} src={a.src} alt={a.name}
                style={{
                  maxHeight: "200px", maxWidth: "300px", borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.1)", objectFit: "cover" as const,
                }}
              />
            );
          })}
        </div>
      )}

      {/* File cards */}
      {parsed.attachments.filter(a => a.type === "file").map((a, i) => {
        if (a.type !== "file") return null;
        return <FileCard key={`file-${i}`} filename={a.filename} size={a.size} />;
      })}

      {/* Code file attachments */}
      {parsed.attachments.filter(a => a.type === "code-file").map((a, i) => {
        if (a.type !== "code-file") return null;
        return <CodeAttachment key={`code-${i}`} filename={a.filename} size={a.size} language={a.language} code={a.code} />;
      })}

      {/* PDF attachments */}
      {parsed.attachments.filter(a => a.type === "pdf").map((a, i) => {
        if (a.type !== "pdf") return null;
        return (
          <div key={`pdf-${i}`} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <FileCard filename={a.filename} size={a.size} extra={a.pages} />
            {a.url && (
              <a href={a.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: "11px", color: "#3399ff", textDecoration: "underline" }}>
                Otvori PDF
              </a>
            )}
          </div>
        );
      })}

      {/* Remaining text (the actual user message) */}
      {parsed.textBefore && (
        <div style={{ fontSize: "15px", lineHeight: "1.75", color: "rgba(255,255,255,0.9)" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            img:({src,alt}:any)=><img src={src} alt={alt||""} className="max-w-full max-h-80 rounded-xl my-2 border border-white/[0.08]"/>,
          }}>{parsed.textBefore}</ReactMarkdown>
        </div>
      )}
      {parsed.textAfter && (
        <div style={{ fontSize: "15px", lineHeight: "1.75", color: "rgba(255,255,255,0.9)" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            img:({src,alt}:any)=><img src={src} alt={alt||""} className="max-w-full max-h-80 rounded-xl my-2 border border-white/[0.08]"/>,
          }}>{parsed.textAfter}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// ─── Main ChatMessage component ─────────────────────────────
const ChatMessage = memo(({ role, content, isLatest, isStreaming, codeBlocks, hasCode, onShowCodePanel, onScrollToCode, messageIndex, onReaction, reaction }: ChatMessageProps) => {
  const [showActions, setShowActions] = useState(false);
  const streaming = isStreaming ?? false;

  const handleCodeClick = useCallback((blockIndex: number) => {
    onShowCodePanel();
    setTimeout(() => onScrollToCode(blockIndex), 100);
  }, [onShowCodePanel, onScrollToCode]);

  const components = makeComponents(codeBlocks, hasCode, onScrollToCode, handleCodeClick);

  // Split u sekcije samo za assistant poruke
  const sections = role === "assistant" ? splitSections(content) : null;
  const hasSections = sections !== null && sections.some(s => s.heading !== null);
  let sectionColorIdx = 0;

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
        )}>
          {role === "user" ? (
            <UserContent content={content} />
          ) : (
            <div style={{fontSize:"15px",lineHeight:"1.85",color:"rgba(255,255,255,0.85)"}}>
              {hasSections ? (
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {sections!.map((sec, i) => {
                    if (sec.heading === null) {
                      return sec.body ? (
                        <div key={i} style={{background:"rgba(0,196,255,0.15)", border:"1px solid rgba(0,196,255,0.40)", borderLeft:"3px solid rgba(0,196,255,0.8)", borderRadius:"14px", padding:"14px 16px"}}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{sec.body}</ReactMarkdown>
                        </div>
                      ) : null;
                    }
                    const color = SECTION_COLORS[sectionColorIdx % SECTION_COLORS.length];
                    sectionColorIdx++;
                    return (
                      <div key={i} style={{background:color.bg,border:`1px solid ${color.border}`,borderLeft:`3px solid ${color.left}`,borderRadius:"14px",padding:"14px 16px"}}>
                        <div style={{fontSize:"11px",fontWeight:700,color:color.title,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:sec.body?"10px":"0",opacity:0.9}}>
                          {sec.heading}
                        </div>
                        {sec.body && <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{sec.body}</ReactMarkdown>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
              )}
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
