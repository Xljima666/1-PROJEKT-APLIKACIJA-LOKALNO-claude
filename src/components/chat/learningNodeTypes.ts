import {
  Brain,
  Camera,
  ClickPointer,
  Globe,
  Keyboard,
  Sparkles,
  Type,
  Play,
  Flag,
} from "lucide-react";

export type LearningNodeKind =
  | "start"
  | "goto"
  | "click"
  | "fill"
  | "input"
  | "screenshot"
  | "ai"
  | "run";

export interface LearningNodeTemplate {
  kind: LearningNodeKind;
  label: string;
  category: "trigger" | "action" | "input" | "output" | "ai";
  color: string;
  glow: string;
  icon: any;
  defaults: Record<string, any>;
}

export const LEARNING_NODE_TYPES: Record<LearningNodeKind, LearningNodeTemplate> = {
  start: {
    kind: "start",
    label: "Start",
    category: "trigger",
    color: "#a78bfa",
    glow: "linear-gradient(135deg, rgba(167,139,250,0.28), rgba(139,92,246,0.12))",
    icon: Flag,
    defaults: {},
  },
  goto: {
    kind: "goto",
    label: "Browser Open",
    category: "action",
    color: "#38bdf8",
    glow: "linear-gradient(135deg, rgba(56,189,248,0.28), rgba(14,165,233,0.12))",
    icon: Globe,
    defaults: { url: "https://oss.uredjenazemlja.hr/", timeout: 45000 },
  },
  click: {
    kind: "click",
    label: "Click",
    category: "action",
    color: "#60a5fa",
    glow: "linear-gradient(135deg, rgba(96,165,250,0.28), rgba(59,130,246,0.12))",
    icon: ClickPointer,
    defaults: { selector: "", timeout: 20000 },
  },
  fill: {
    kind: "fill",
    label: "Fill Input",
    category: "action",
    color: "#34d399",
    glow: "linear-gradient(135deg, rgba(52,211,153,0.28), rgba(16,185,129,0.12))",
    icon: Keyboard,
    defaults: { selector: "", value: "", timeout: 20000 },
  },
  input: {
    kind: "input",
    label: "Input",
    category: "input",
    color: "#f59e0b",
    glow: "linear-gradient(135deg, rgba(245,158,11,0.28), rgba(217,119,6,0.12))",
    icon: Type,
    defaults: { key: "", value: "" },
  },
  screenshot: {
    kind: "screenshot",
    label: "Screenshot",
    category: "output",
    color: "#f472b6",
    glow: "linear-gradient(135deg, rgba(244,114,182,0.28), rgba(236,72,153,0.12))",
    icon: Camera,
    defaults: { full_page: true, timeout: 15000, image: "" },
  },
  ai: {
    kind: "ai",
    label: "AI Improve",
    category: "ai",
    color: "#c084fc",
    glow: "linear-gradient(135deg, rgba(192,132,252,0.28), rgba(168,85,247,0.12))",
    icon: Sparkles,
    defaults: { prompt: "" },
  },
  run: {
    kind: "run",
    label: "Run Flow",
    category: "trigger",
    color: "#22c55e",
    glow: "linear-gradient(135deg, rgba(34,197,94,0.28), rgba(22,163,74,0.12))",
    icon: Play,
    defaults: {},
  },
};

export const CATEGORY_META = {
  trigger: { label: "Trigger", text: "text-purple-300", bg: "bg-purple-500/15", chip: "#a78bfa" },
  action: { label: "Action", text: "text-sky-300", bg: "bg-sky-500/15", chip: "#38bdf8" },
  input: { label: "Input", text: "text-amber-300", bg: "bg-amber-500/15", chip: "#f59e0b" },
  output: { label: "Output", text: "text-pink-300", bg: "bg-pink-500/15", chip: "#f472b6" },
  ai: { label: "AI", text: "text-violet-300", bg: "bg-violet-500/15", chip: "#c084fc" },
};
