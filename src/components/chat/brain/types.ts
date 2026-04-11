import { type ReactElement } from "react";
import {
  Brain, Search, Globe, Code2, MessageSquare, Mail, FileText, Database,
  Workflow, Settings, GitMerge, ArrowRight, Save, Compass, BarChart3,
  Bookmark, Rss, Play, Eye, FileSpreadsheet, FileType, Image, Timer,
  Filter, ToggleLeft, Terminal, Webhook, MousePointerClick, Monitor,
  Table, Repeat, AlertCircle, CheckCircle, Clock, Cog, Download,
  Upload, Zap, Link, Hash, ShieldCheck, Layers, Bot, Cpu
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────
export type CategoryType =
  | "input" | "logic" | "tool" | "code" | "gen" | "mem" | "kb"
  | "merge" | "output" | "save" | "brain" | "playwright" | "file"
  | "transform" | "trigger" | "api" | "ai";

export interface Port {
  id: string;
  label: string;
  side: "left" | "right";
  color: string;
}

export interface BrainNode {
  id: string;
  label: string;
  icon: React.ElementType;
  category: CategoryType;
  x: number;
  y: number;
  ports: Port[];
  config?: Record<string, any>;
}

export interface Connection {
  id: string;
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
  color: string;
}

export interface NodeRunStatus {
  nodeId: string;
  status: "idle" | "running" | "success" | "error" | "skipped";
  startedAt?: number;
  duration?: number;
  output?: string;
  error?: string;
}

// ─── Category config ────────────────────────────────────
export const CATEGORY_META: Record<CategoryType, { label: string; bg: string; text: string; glow: string; cardBg: string; borderColor: string }> = {
  input:      { label: "INPUT",      bg: "bg-cyan-500/20",    text: "text-cyan-300",    glow: "rgba(34,211,238,0.18)",  cardBg: "rgba(34,211,238,0.08)",  borderColor: "rgba(34,211,238,0.16)" },
  logic:      { label: "LOGIC",      bg: "bg-sky-500/20",     text: "text-sky-300",     glow: "rgba(56,189,248,0.18)",  cardBg: "rgba(56,189,248,0.08)",  borderColor: "rgba(56,189,248,0.16)" },
  tool:       { label: "TOOL",       bg: "bg-emerald-500/20", text: "text-emerald-300", glow: "rgba(52,211,153,0.18)", cardBg: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.16)" },
  code:       { label: "CODE",       bg: "bg-amber-500/20",   text: "text-amber-300",   glow: "rgba(251,191,36,0.18)",  cardBg: "rgba(251,191,36,0.08)",  borderColor: "rgba(251,191,36,0.16)" },
  gen:        { label: "GEN",        bg: "bg-teal-500/20",    text: "text-teal-300",    glow: "rgba(45,212,191,0.18)",  cardBg: "rgba(45,212,191,0.08)",  borderColor: "rgba(45,212,191,0.16)" },
  mem:        { label: "MEM",        bg: "bg-lime-500/20",    text: "text-lime-300",    glow: "rgba(163,230,53,0.18)",  cardBg: "rgba(163,230,53,0.08)",  borderColor: "rgba(163,230,53,0.16)" },
  kb:         { label: "KB",         bg: "bg-cyan-500/20",    text: "text-cyan-300",    glow: "rgba(34,211,238,0.18)",  cardBg: "rgba(34,211,238,0.08)",  borderColor: "rgba(34,211,238,0.16)" },
  merge:      { label: "MERGE",      bg: "bg-yellow-500/20",  text: "text-yellow-300",  glow: "rgba(250,204,21,0.18)",  cardBg: "rgba(250,204,21,0.08)",  borderColor: "rgba(250,204,21,0.16)" },
  output:     { label: "OUTPUT",     bg: "bg-green-500/20",   text: "text-green-300",   glow: "rgba(74,222,128,0.2)",   cardBg: "rgba(74,222,128,0.09)",   borderColor: "rgba(74,222,128,0.18)" },
  save:       { label: "SAVE",       bg: "bg-teal-500/20",    text: "text-teal-300",    glow: "rgba(45,212,191,0.18)",  cardBg: "rgba(45,212,191,0.08)",  borderColor: "rgba(45,212,191,0.16)" },
  brain:      { label: "BRAIN",      bg: "bg-emerald-500/20", text: "text-emerald-300", glow: "rgba(16,185,129,0.22)",  cardBg: "rgba(16,185,129,0.09)",  borderColor: "rgba(16,185,129,0.18)" },
  playwright: { label: "PLAYWRIGHT", bg: "bg-emerald-500/20", text: "text-emerald-300", glow: "rgba(16,185,129,0.22)",  cardBg: "rgba(16,185,129,0.09)",  borderColor: "rgba(16,185,129,0.18)" },
  file:       { label: "FILE",       bg: "bg-cyan-500/20",    text: "text-cyan-300",    glow: "rgba(6,182,212,0.18)",   cardBg: "rgba(6,182,212,0.08)",   borderColor: "rgba(6,182,212,0.16)" },
  transform:  { label: "TRANSFORM",  bg: "bg-lime-500/20",    text: "text-lime-300",    glow: "rgba(132,204,22,0.18)",  cardBg: "rgba(132,204,22,0.08)",  borderColor: "rgba(132,204,22,0.16)" },
  trigger:    { label: "TRIGGER",    bg: "bg-orange-500/20",  text: "text-orange-300",  glow: "rgba(251,146,60,0.18)",  cardBg: "rgba(251,146,60,0.08)",  borderColor: "rgba(251,146,60,0.16)" },
  api:        { label: "API",        bg: "bg-cyan-500/20",    text: "text-cyan-300",    glow: "rgba(6,182,212,0.18)",   cardBg: "rgba(6,182,212,0.08)",   borderColor: "rgba(6,182,212,0.16)" },
  ai:         { label: "AI",         bg: "bg-emerald-500/20", text: "text-emerald-300", glow: "rgba(16,185,129,0.22)",  cardBg: "rgba(16,185,129,0.09)",  borderColor: "rgba(16,185,129,0.18)" },
};

export const PORT_COLORS: Record<string, string> = {
  blue: "#38bdf8", green: "#34d399", amber: "#fbbf24", purple: "#2dd4bf",
  pink: "#22c55e", orange: "#fb923c", cyan: "#22d3ee", red: "#f87171",
  teal: "#2dd4bf", yellow: "#facc15", sky: "#38bdf8", emerald: "#34d399",
  violet: "#10b981", indigo: "#06b6d4", lime: "#84cc16", rose: "#fb923c",
  fuchsia: "#10b981",
};

export const MINIMAP_COLORS: Record<CategoryType, string> = {
  input: "#38bdf8", logic: "#60a5fa", tool: "#34d399", code: "#fbbf24",
  gen: "#2dd4bf", mem: "#84cc16", kb: "#22d3ee", merge: "#facc15",
  output: "#4ade80", save: "#2dd4bf", brain: "#10b981",
  playwright: "#10b981", file: "#06b6d4", transform: "#84cc16",
  trigger: "#fb923c", api: "#22d3ee", ai: "#10b981",
};

// ─── Node templates catalog ────────────────────────────
export interface NodeTemplate {
  label: string;
  icon: React.ElementType;
  category: CategoryType;
  description: string;
  ports: Port[];
  defaultConfig?: Record<string, any>;
}

export const NODE_CATALOG: Record<string, NodeTemplate[]> = {
  "Playwright": [
    { label: "Browser Open", icon: Monitor, category: "playwright", description: "Otvori preglednik s URL-om",
      ports: [{ id: "url", label: "URL", side: "left", color: "violet" }, { id: "page", label: "Page", side: "right", color: "violet" }] },
    { label: "Click", icon: MousePointerClick, category: "playwright", description: "Klikni na element",
      ports: [{ id: "page", label: "Page", side: "left", color: "violet" }, { id: "selector", label: "Selector", side: "left", color: "purple" }, { id: "page_out", label: "Page", side: "right", color: "violet" }] },
    { label: "Fill Input", icon: Terminal, category: "playwright", description: "Unesi tekst u polje",
      ports: [{ id: "page", label: "Page", side: "left", color: "violet" }, { id: "value", label: "Value", side: "left", color: "blue" }, { id: "page_out", label: "Page", side: "right", color: "violet" }] },
    { label: "Screenshot", icon: Image, category: "playwright", description: "Napravi screenshot stranice",
      ports: [{ id: "page", label: "Page", side: "left", color: "violet" }, { id: "image", label: "Image", side: "right", color: "green" }] },
    { label: "Extract Text", icon: FileType, category: "playwright", description: "Izvuci tekst iz elementa",
      ports: [{ id: "page", label: "Page", side: "left", color: "violet" }, { id: "selector", label: "Selector", side: "left", color: "purple" }, { id: "text", label: "Text", side: "right", color: "green" }] },
    { label: "Wait For", icon: Timer, category: "playwright", description: "Čekaj element ili timeout",
      ports: [{ id: "page", label: "Page", side: "left", color: "violet" }, { id: "page_out", label: "Page", side: "right", color: "violet" }] },
    { label: "Navigate", icon: Globe, category: "playwright", description: "Navigiraj na novu stranicu",
      ports: [{ id: "page", label: "Page", side: "left", color: "violet" }, { id: "url", label: "URL", side: "left", color: "blue" }, { id: "page_out", label: "Page", side: "right", color: "violet" }] },
    { label: "Evaluate JS", icon: Code2, category: "playwright", description: "Izvrši JavaScript na stranici",
      ports: [{ id: "page", label: "Page", side: "left", color: "violet" }, { id: "script", label: "Script", side: "left", color: "orange" }, { id: "result", label: "Result", side: "right", color: "green" }] },
  ],
  "Datoteke": [
    { label: "Excel Read", icon: FileSpreadsheet, category: "file", description: "Čitaj Excel datoteku (.xlsx)",
      ports: [{ id: "path", label: "Path", side: "left", color: "indigo" }, { id: "data", label: "Data", side: "right", color: "green" }] },
    { label: "Excel Write", icon: FileSpreadsheet, category: "file", description: "Zapiši u Excel datoteku",
      ports: [{ id: "data", label: "Data", side: "left", color: "green" }, { id: "template", label: "Template", side: "left", color: "indigo" }, { id: "file", label: "File", side: "right", color: "indigo" }] },
    { label: "Word Gen", icon: FileType, category: "file", description: "Generiraj Word dokument",
      ports: [{ id: "content", label: "Content", side: "left", color: "blue" }, { id: "template", label: "Template", side: "left", color: "indigo" }, { id: "file", label: "File", side: "right", color: "indigo" }] },
    { label: "PDF Gen", icon: FileText, category: "file", description: "Generiraj PDF dokument",
      ports: [{ id: "content", label: "Content", side: "left", color: "blue" }, { id: "file", label: "File", side: "right", color: "red" }] },
    { label: "CSV Parse", icon: Table, category: "file", description: "Parsiraj CSV datoteku",
      ports: [{ id: "path", label: "Path", side: "left", color: "indigo" }, { id: "rows", label: "Rows", side: "right", color: "green" }] },
    { label: "JSON Parse", icon: Hash, category: "file", description: "Parsiraj JSON",
      ports: [{ id: "input", label: "Input", side: "left", color: "blue" }, { id: "data", label: "Data", side: "right", color: "green" }] },
    { label: "File Download", icon: Download, category: "file", description: "Preuzmi datoteku s URL-a",
      ports: [{ id: "url", label: "URL", side: "left", color: "blue" }, { id: "file", label: "File", side: "right", color: "indigo" }] },
    { label: "File Upload", icon: Upload, category: "file", description: "Uploadaj datoteku",
      ports: [{ id: "file", label: "File", side: "left", color: "indigo" }, { id: "url", label: "URL", side: "right", color: "green" }] },
  ],
  "Logika": [
    { label: "Router", icon: Workflow, category: "logic", description: "Usmjeri prema uvjetu",
      ports: [{ id: "input", label: "Input", side: "left", color: "blue" }, { id: "route_a", label: "Route A", side: "right", color: "purple" }, { id: "route_b", label: "Route B", side: "right", color: "cyan" }] },
    { label: "Filter", icon: Filter, category: "logic", description: "Filtriraj podatke",
      ports: [{ id: "input", label: "Input", side: "left", color: "blue" }, { id: "pass", label: "Pass", side: "right", color: "green" }, { id: "fail", label: "Fail", side: "right", color: "red" }] },
    { label: "Switch", icon: ToggleLeft, category: "logic", description: "Višestruki putovi",
      ports: [{ id: "input", label: "Input", side: "left", color: "blue" }, { id: "case1", label: "Case 1", side: "right", color: "purple" }, { id: "case2", label: "Case 2", side: "right", color: "cyan" }, { id: "default", label: "Default", side: "right", color: "yellow" }] },
    { label: "Loop", icon: Repeat, category: "logic", description: "Iterraj kroz listu",
      ports: [{ id: "items", label: "Items", side: "left", color: "blue" }, { id: "item", label: "Item", side: "right", color: "green" }, { id: "done", label: "Done", side: "right", color: "yellow" }] },
    { label: "Delay", icon: Clock, category: "logic", description: "Pauza u izvršavanju",
      ports: [{ id: "input", label: "Input", side: "left", color: "blue" }, { id: "output", label: "Output", side: "right", color: "blue" }] },
    { label: "Agregator", icon: GitMerge, category: "merge", description: "Spoji više ulaza",
      ports: [{ id: "in1", label: "Input 1", side: "left", color: "yellow" }, { id: "in2", label: "Input 2", side: "left", color: "yellow" }, { id: "in3", label: "Input 3", side: "left", color: "yellow" }, { id: "merged", label: "Merged", side: "right", color: "orange" }] },
  ],
  "Transformacije": [
    { label: "Map Data", icon: Layers, category: "transform", description: "Mapiraj polja",
      ports: [{ id: "input", label: "Input", side: "left", color: "lime" }, { id: "output", label: "Output", side: "right", color: "lime" }] },
    { label: "Template", icon: FileType, category: "transform", description: "Generiraj tekst iz predloška",
      ports: [{ id: "data", label: "Data", side: "left", color: "lime" }, { id: "template", label: "Template", side: "left", color: "blue" }, { id: "text", label: "Text", side: "right", color: "green" }] },
    { label: "Regex", icon: Hash, category: "transform", description: "Regex pretraga/zamjena",
      ports: [{ id: "input", label: "Input", side: "left", color: "lime" }, { id: "matches", label: "Matches", side: "right", color: "green" }] },
  ],
  "API & Web": [
    { label: "HTTP Request", icon: Globe, category: "api", description: "Šalji HTTP zahtjev",
      ports: [{ id: "url", label: "URL", side: "left", color: "cyan" }, { id: "body", label: "Body", side: "left", color: "blue" }, { id: "response", label: "Response", side: "right", color: "green" }] },
    { label: "Webhook", icon: Webhook, category: "trigger", description: "Primi webhook poziv",
      ports: [{ id: "payload", label: "Payload", side: "right", color: "rose" }] },
    { label: "Web Search", icon: Search, category: "tool", description: "Pretraži internet",
      ports: [{ id: "query", label: "Query", side: "left", color: "purple" }, { id: "results", label: "Results", side: "right", color: "green" }] },
    { label: "Firecrawl", icon: Rss, category: "tool", description: "Scrape web stranicu",
      ports: [{ id: "url", label: "URL", side: "left", color: "cyan" }, { id: "content", label: "Content", side: "right", color: "green" }] },
    { label: "Web Scraper", icon: Globe, category: "tool", description: "Izvuci podatke sa stranice",
      ports: [{ id: "url", label: "URL", side: "left", color: "cyan" }, { id: "selector", label: "Selector", side: "left", color: "purple" }, { id: "data", label: "Data", side: "right", color: "green" }] },
  ],
  "AI": [
    { label: "LLM Chat", icon: Bot, category: "ai", description: "Pošalji prompt AI modelu",
      ports: [{ id: "prompt", label: "Prompt", side: "left", color: "fuchsia" }, { id: "system", label: "System", side: "left", color: "purple" }, { id: "response", label: "Response", side: "right", color: "green" }] },
    { label: "Vision", icon: Eye, category: "ai", description: "Analiza slike AI-om",
      ports: [{ id: "image", label: "Image", side: "left", color: "fuchsia" }, { id: "prompt", label: "Prompt", side: "left", color: "purple" }, { id: "analysis", label: "Analysis", side: "right", color: "green" }] },
    { label: "Summarize", icon: FileText, category: "ai", description: "Sumarizacija teksta",
      ports: [{ id: "text", label: "Text", side: "left", color: "fuchsia" }, { id: "summary", label: "Summary", side: "right", color: "green" }] },
    { label: "Classify", icon: ShieldCheck, category: "ai", description: "Klasificiraj sadržaj",
      ports: [{ id: "input", label: "Input", side: "left", color: "fuchsia" }, { id: "category", label: "Category", side: "right", color: "green" }, { id: "score", label: "Score", side: "right", color: "yellow" }] },
  ],
  "Integracije": [
    { label: "Google Drive", icon: FileText, category: "tool", description: "Čitaj/piši Google Drive",
      ports: [{ id: "query", label: "Query", side: "left", color: "purple" }, { id: "files", label: "Files", side: "right", color: "emerald" }] },
    { label: "Gmail", icon: Mail, category: "tool", description: "Šalji/čitaj email",
      ports: [{ id: "query", label: "Query", side: "left", color: "purple" }, { id: "mails", label: "Mails", side: "right", color: "red" }] },
    { label: "Trello", icon: Bookmark, category: "tool", description: "Upravljaj karticama",
      ports: [{ id: "query", label: "Query", side: "left", color: "purple" }, { id: "cards", label: "Cards", side: "right", color: "emerald" }] },
    { label: "Database", icon: Database, category: "tool", description: "SQL upit na bazu",
      ports: [{ id: "query", label: "Query", side: "left", color: "purple" }, { id: "rows", label: "Rows", side: "right", color: "green" }] },
    { label: "Slack", icon: MessageSquare, category: "tool", description: "Pošalji Slack poruku",
      ports: [{ id: "message", label: "Message", side: "left", color: "purple" }, { id: "sent", label: "Sent", side: "right", color: "green" }] },
  ],
  "I/O": [
    { label: "Input", icon: MessageSquare, category: "input", description: "Ulazni podatak za flow",
      ports: [{ id: "value", label: "Value", side: "right", color: "blue" }] },
    { label: "Output", icon: ArrowRight, category: "output", description: "Izlazni rezultat flowa",
      ports: [{ id: "value", label: "Value", side: "left", color: "green" }] },
    { label: "Save", icon: Save, category: "save", description: "Spremi rezultat",
      ports: [{ id: "data", label: "Data", side: "left", color: "teal" }] },
    { label: "Python", icon: Code2, category: "code", description: "Izvrši Python skriptu",
      ports: [{ id: "script", label: "Script", side: "left", color: "orange" }, { id: "input", label: "Input", side: "left", color: "blue" }, { id: "output", label: "Output", side: "right", color: "green" }] },
    { label: "Memorija", icon: Brain, category: "mem", description: "Kontekst i memorija",
      ports: [{ id: "query", label: "Query", side: "left", color: "pink" }, { id: "data", label: "Data", side: "right", color: "pink" }] },
    { label: "Baza Znanja", icon: Database, category: "kb", description: "Vektorska baza znanja",
      ports: [{ id: "query", label: "Query", side: "left", color: "purple" }, { id: "results", label: "Results", side: "right", color: "purple" }] },
  ],
};

// ─── Constants ──────────────────────────────────────────
export const NODE_W = 165;
export const PORT_SPACING = 22;
export const PORT_Y_START = 44;
export const CANVAS_W = 2000;
export const CANVAS_H = 1400;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.5;

export function getNodeHeight(node: BrainNode) {
  const maxPorts = Math.max(node.ports.filter(p => p.side === "left").length, node.ports.filter(p => p.side === "right").length);
  return Math.max(58, PORT_Y_START + maxPorts * PORT_SPACING + 10);
}

export function getPortPos(node: BrainNode, portId: string): { x: number; y: number } {
  const port = node.ports.find(p => p.id === portId);
  if (!port) return { x: node.x, y: node.y };
  const sameSide = node.ports.filter(p => p.side === port.side);
  const idx = sameSide.indexOf(port);
  return { x: port.side === "left" ? node.x : node.x + NODE_W, y: node.y + PORT_Y_START + idx * PORT_SPACING };
}

export function generateId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function generateConnectionId() {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
