import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/utils";
import { useCad } from "@/cad/store";
import { exportDXF, importDXF } from "@/cad/dxf";
import { dwgTemplatePresets, makeCadDocFromDwgTemplate, type DwgTemplateLayout, type DwgTemplatePreset } from "@/cad/dwgTemplatePresets";
import { parseCoord } from "@/cad/coords";
import { defaultOsnap, findOSnap, type SnapHit } from "@/cad/osnap";
import { extendLine, mirrorShape, offsetShape, trimLine } from "@/cad/modify";
import type { Layer, LineShape, Point, Shape } from "@/cad/types";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  ChevronDown,
  Circle as CircleIcon,
  Copy,
  Crosshair,
  Download,
  ExternalLink,
  FlipHorizontal2,
  FileDown,
  FolderOpen,
  Grid3X3,
  Hexagon,
  Layers,
  Maximize2,
  MousePointer2,
  Move,
  PenLine,
  Redo2,
  RotateCw,
  Ruler,
  Search,
  Settings,
  Scissors,
  Square,
  Terminal,
  Trash2,
  TriangleRight,
  Type as TypeIcon,
  Undo2,
  Upload,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type CadTool =
  | "select"
  | "line"
  | "rect"
  | "circle"
  | "polyline"
  | "arc"
  | "polygon"
  | "text"
  | "dim"
  | "move"
  | "copy"
  | "rotate"
  | "scale"
  | "trim"
  | "extend"
  | "offset"
  | "mirror";

const CANVAS_W = 1800;
const CANVAS_H = 980;
const GRID = 20;
const CAD_CONVERTER_URL = String(import.meta.env.VITE_CAD_CONVERTER_URL || "http://localhost:8791").replace(/\/+$/, "");

type ViewBox = { x: number; y: number; w: number; h: number };
type CadConverterResponse = {
  dxf?: string;
  layers?: Layer[];
  shapes?: Shape[];
  message?: string;
};

const DEFAULT_VIEW_BOX: ViewBox = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
const MODEL_LAYOUT: DwgTemplateLayout = {
  name: "Model",
  media: "",
  plotter: "",
  styleSheet: "",
  standardScale: 1,
  paperUnits: 0,
  plotType: 0,
};

const menuItems = [
  "File",
  "Edit",
  "View",
  "Insert",
  "Format",
  "Tools",
  "Draw",
  "Dimension",
  "Modify",
  "Parametric",
  "Smart",
  "Express",
  "Window",
  "Help",
  "GeoService",
  "APP+",
  "Tocke",
  "Pomocni",
  "Prikazi",
  "Kartografski znakovi",
  "Digitalni elaborat",
  "Dodaci",
];

const quickLinks = [
  { label: "OSS", url: "https://oss.uredjenazemlja.hr" },
  { label: "SDGE", url: "https://sdge.dgu.hr" },
  { label: "DXF2GML", url: "https://dxf2gml.dgu.hr/" },
  { label: "ISPU", url: "https://ispu.mgipu.hr/#/" },
];

const geoHrIcons = [
  "skica.bmp",
  "gmltxt.bmp",
  "kod.BMP",
  "laydef.BMP",
  "laystil.bmp",
  "linon.bmp",
  "lindt.BMP",
  "mj.bmp",
  "mjon.bmp",
  "mjoff.bmp",
  "Tocka1.bmp",
  "tocka4.bmp",
  "VisinskaTocka.bmp",
  "sud.bmp",
  "sudskatocka.BMP",
  "brposj.bmp",
  "kota.bmp",
  "povrsina.BMP",
  "posj.bmp",
  "postxt.bmp",
  "fron.bmp",
  "frnt1.bmp",
  "frnt2.BMP",
  "pns.BMP",
  "spp.BMP",
  "sn.BMP",
  "f1.bmp",
  "f2.BMP",
  "f3.BMP",
  "f4.BMP",
  "f5.BMP",
  "l1.BMP",
  "l2.BMP",
  "l3.BMP",
  "l4.BMP",
  "l5.BMP",
  "l6.BMP",
  "l7.BMP",
];

const geoHrStats = [
  ["DWG blokovi", "385"],
  ["SLD simboli", "374"],
  ["LISP alati", "123"],
  ["BMP ikone", "102"],
  ["DWG predlosci", "2"],
  ["Layeri iz DWG", "121"],
];

const layerTools = ["S1", "SP", "NS", "SN", "C1", "C2", "L1", "L2", "L3", "L4", "L5", "L6", "L7"];

const drawTools = [
  { id: "select" as CadTool, title: "Select (S)", Icon: MousePointer2 },
  { id: "line" as CadTool, title: "Line (L)", Icon: PenLine },
  { id: "polyline" as CadTool, title: "Polyline (PL)", Icon: TriangleRight },
  { id: "rect" as CadTool, title: "Rectangle (R)", Icon: Square },
  { id: "circle" as CadTool, title: "Circle (C)", Icon: CircleIcon },
  { id: "arc" as CadTool, title: "Arc (A)", Icon: Waypoints },
  { id: "polygon" as CadTool, title: "Polygon (G)", Icon: Hexagon },
  { id: "text" as CadTool, title: "Text (T)", Icon: TypeIcon },
  { id: "dim" as CadTool, title: "Linear dimension (D)", Icon: Ruler },
];

const modifyTools = [
  { id: "move" as CadTool, title: "Move (M)", Icon: Move },
  { id: "copy" as CadTool, title: "Copy (Y)", Icon: Copy },
  { id: "rotate" as CadTool, title: "Rotate (O)", Icon: RotateCw },
  { id: "scale" as CadTool, title: "Scale (SC)", Icon: Maximize2 },
  { id: "trim" as CadTool, title: "Trim (X)", Icon: Scissors },
  { id: "extend" as CadTool, title: "Extend (W)", Icon: ZoomIn },
  { id: "offset" as CadTool, title: "Offset (F)", Icon: ArrowLeftRight },
  { id: "mirror" as CadTool, title: "Mirror (I)", Icon: FlipHorizontal2 },
];

function ToolbarButton({
  children,
  active,
  title,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-6 min-w-6 items-center justify-center border border-[#607181] bg-[#344451] px-1 text-[10px] font-semibold text-slate-100 shadow-[inset_0_1px_rgba(255,255,255,0.12)] hover:bg-[#46596a]",
        active && "border-blue-400 bg-[#1f6fb5] text-white",
      )}
    >
      {children}
    </button>
  );
}

function SelectLike({ label, width = "w-36" }: { label: string; width?: string }) {
  return (
    <button className={cn("flex h-7 items-center justify-between border border-[#607181] bg-[#18232d] px-2 text-[11px] text-slate-200", width)}>
      <span>{label}</span>
      <ChevronDown className="h-3 w-3 text-slate-400" />
    </button>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[76px_1fr] border-b border-[#52616e]/60 px-2 py-1 text-[11px] leading-4">
      <span className="truncate text-slate-300">{label}</span>
      <span className="truncate text-slate-100">{value}</span>
    </div>
  );
}

function PropertyInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "color";
}) {
  return (
    <label className="grid grid-cols-[76px_1fr] items-center border-b border-[#52616e]/60 px-2 py-1 text-[11px] leading-4">
      <span className="truncate text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-5 min-w-0 border border-[#607181] bg-[#18232d] px-1 text-[11px] text-slate-100 outline-none"
      />
    </label>
  );
}

function snapGrid(p: Point) {
  return { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID };
}

function formatPoint(p: Point | null) {
  if (!p) return "0.000, 0.000";
  return `${p.x.toFixed(3)}, ${p.y.toFixed(3)}`;
}

function shapeBounds(s: Shape) {
  if (s.type === "line") {
    return `${s.x1.toFixed(1)},${s.y1.toFixed(1)} -> ${s.x2.toFixed(1)},${s.y2.toFixed(1)}`;
  }
  if (s.type === "rect") return `x ${s.x.toFixed(1)}, y ${s.y.toFixed(1)}, ${s.w.toFixed(1)} x ${s.h.toFixed(1)}`;
  if (s.type === "circle") return `c ${s.cx.toFixed(1)},${s.cy.toFixed(1)}, r ${s.r.toFixed(1)}`;
  if (s.type === "polyline") return `${s.points.length} tocaka${s.closed ? ", zatvoreno" : ""}`;
  if (s.type === "text") return s.text;
  if (s.type === "arc") return `arc c ${s.cx.toFixed(1)},${s.cy.toFixed(1)}, r ${s.r.toFixed(1)}`;
  if (s.type === "dim-linear") return `dim ${s.x1.toFixed(1)},${s.y1.toFixed(1)} -> ${s.x2.toFixed(1)},${s.y2.toFixed(1)}`;
  return "object";
}

function shapeBBox(s: Shape) {
  if (s.type === "line" || s.type === "dim-linear") {
    return {
      minX: Math.min(s.x1, s.x2),
      minY: Math.min(s.y1, s.y2),
      maxX: Math.max(s.x1, s.x2),
      maxY: Math.max(s.y1, s.y2),
    };
  }
  if (s.type === "rect") return { minX: s.x, minY: s.y, maxX: s.x + s.w, maxY: s.y + s.h };
  if (s.type === "circle" || s.type === "arc") {
    return { minX: s.cx - s.r, minY: s.cy - s.r, maxX: s.cx + s.r, maxY: s.cy + s.r };
  }
  if (s.type === "polyline") {
    if (!s.points.length) return null;
    return s.points.reduce(
      (box, point) => ({
        minX: Math.min(box.minX, point.x),
        minY: Math.min(box.minY, point.y),
        maxX: Math.max(box.maxX, point.x),
        maxY: Math.max(box.maxY, point.y),
      }),
      { minX: s.points[0].x, minY: s.points[0].y, maxX: s.points[0].x, maxY: s.points[0].y },
    );
  }
  if (s.type === "text") {
    const w = Math.max(40, s.text.length * s.size * 0.55);
    return { minX: s.x, minY: s.y - s.size, maxX: s.x + w, maxY: s.y + s.size * 0.3 };
  }
  return null;
}

function shapesBBox(shapes: Shape[]) {
  const boxes = shapes.map(shapeBBox).filter(Boolean) as Array<NonNullable<ReturnType<typeof shapeBBox>>>;
  if (!boxes.length) return null;
  return boxes.reduce(
    (box, item) => ({
      minX: Math.min(box.minX, item.minX),
      minY: Math.min(box.minY, item.minY),
      maxX: Math.max(box.maxX, item.maxX),
      maxY: Math.max(box.maxY, item.maxY),
    }),
    boxes[0],
  );
}

function hitTest(shape: Shape, p: Point, tol = 10) {
  if (shape.type === "line") return distToSegment(p, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }) <= tol;
  if (shape.type === "rect") {
    const corners = [
      { x: shape.x, y: shape.y },
      { x: shape.x + shape.w, y: shape.y },
      { x: shape.x + shape.w, y: shape.y + shape.h },
      { x: shape.x, y: shape.y + shape.h },
    ];
    return corners.some((a, i) => distToSegment(p, a, corners[(i + 1) % 4]) <= tol);
  }
  if (shape.type === "circle") return Math.abs(Math.hypot(p.x - shape.cx, p.y - shape.cy) - shape.r) <= tol;
  if (shape.type === "polyline") {
    for (let i = 0; i < shape.points.length - 1; i++) {
      if (distToSegment(p, shape.points[i], shape.points[i + 1]) <= tol) return true;
    }
    if (shape.closed && shape.points.length > 2) {
      return distToSegment(p, shape.points[shape.points.length - 1], shape.points[0]) <= tol;
    }
  }
  if (shape.type === "text") return Math.hypot(p.x - shape.x, p.y - shape.y) <= tol * 2;
  if (shape.type === "dim-linear") {
    const dx = shape.x2 - shape.x1;
    const dy = shape.y2 - shape.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    return distToSegment(
      p,
      { x: shape.x1 + nx * shape.offset, y: shape.y1 + ny * shape.offset },
      { x: shape.x2 + nx * shape.offset, y: shape.y2 + ny * shape.offset },
    ) <= tol;
  }
  return false;
}

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(p.x - x, p.y - y);
}

const cadUid = () => Math.random().toString(36).slice(2, 9);

function cloneForAdd(shape: Shape) {
  const { id: _id, ...rest } = shape as any;
  return rest;
}

function translateShape(s: Shape, dx: number, dy: number): Shape {
  if (s.type === "line") return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
  if (s.type === "rect") return { ...s, x: s.x + dx, y: s.y + dy };
  if (s.type === "circle" || s.type === "arc") return { ...s, cx: s.cx + dx, cy: s.cy + dy };
  if (s.type === "polyline") return { ...s, points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  if (s.type === "text") return { ...s, x: s.x + dx, y: s.y + dy };
  if (s.type === "dim-linear") return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
  return s;
}

function rotatePoint(p: Point, c: Point, angle: number): Point {
  const cs = Math.cos(angle);
  const sn = Math.sin(angle);
  const x = p.x - c.x;
  const y = p.y - c.y;
  return { x: c.x + x * cs - y * sn, y: c.y + x * sn + y * cs };
}

function rotateShape(s: Shape, c: Point, angle: number): Shape {
  if (s.type === "line") {
    const p1 = rotatePoint({ x: s.x1, y: s.y1 }, c, angle);
    const p2 = rotatePoint({ x: s.x2, y: s.y2 }, c, angle);
    return { ...s, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }
  if (s.type === "circle" || s.type === "arc") {
    const p = rotatePoint({ x: s.cx, y: s.cy }, c, angle);
    return { ...s, cx: p.x, cy: p.y };
  }
  if (s.type === "polyline") return { ...s, points: s.points.map((p) => rotatePoint(p, c, angle)) };
  if (s.type === "text") {
    const p = rotatePoint({ x: s.x, y: s.y }, c, angle);
    return { ...s, x: p.x, y: p.y };
  }
  if (s.type === "dim-linear") {
    const p1 = rotatePoint({ x: s.x1, y: s.y1 }, c, angle);
    const p2 = rotatePoint({ x: s.x2, y: s.y2 }, c, angle);
    return { ...s, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }
  return s;
}

function scaleCadShape(s: Shape, c: Point, factor: number): Shape {
  const sp = (p: Point) => ({ x: c.x + (p.x - c.x) * factor, y: c.y + (p.y - c.y) * factor });
  if (s.type === "line") {
    const p1 = sp({ x: s.x1, y: s.y1 });
    const p2 = sp({ x: s.x2, y: s.y2 });
    return { ...s, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }
  if (s.type === "rect") {
    const p = sp({ x: s.x, y: s.y });
    return { ...s, x: p.x, y: p.y, w: s.w * factor, h: s.h * factor };
  }
  if (s.type === "circle" || s.type === "arc") {
    const p = sp({ x: s.cx, y: s.cy });
    return { ...s, cx: p.x, cy: p.y, r: s.r * factor };
  }
  if (s.type === "polyline") return { ...s, points: s.points.map(sp) };
  if (s.type === "text") {
    const p = sp({ x: s.x, y: s.y });
    return { ...s, x: p.x, y: p.y, size: s.size * factor };
  }
  if (s.type === "dim-linear") {
    const p1 = sp({ x: s.x1, y: s.y1 });
    const p2 = sp({ x: s.x2, y: s.y2 });
    return { ...s, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, offset: s.offset * factor };
  }
  return s;
}

function renderShape(
  shape: Shape,
  layerColor: string,
  selected: boolean,
  _onSelect: (id: string) => void,
) {
  const stroke = selected ? "#60a5fa" : layerColor;
  const common = {
    stroke,
    strokeWidth: selected ? 3 : 1.6,
    fill: "none",
    vectorEffect: "non-scaling-stroke" as const,
    pointerEvents: "none" as const,
  };

  if (shape.type === "line") return <line key={shape.id} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...common} />;
  if (shape.type === "rect") return <rect key={shape.id} x={shape.x} y={shape.y} width={shape.w} height={shape.h} {...common} />;
  if (shape.type === "circle") return <circle key={shape.id} cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />;
  if (shape.type === "polyline") {
    const points = shape.points.map((p) => `${p.x},${p.y}`).join(" ");
    return <polyline key={shape.id} points={points} {...common} strokeLinejoin="round" />;
  }
  if (shape.type === "arc") {
    const start = (shape.startAngle * Math.PI) / 180;
    const end = (shape.endAngle * Math.PI) / 180;
    const p1 = { x: shape.cx + Math.cos(start) * shape.r, y: shape.cy + Math.sin(start) * shape.r };
    const p2 = { x: shape.cx + Math.cos(end) * shape.r, y: shape.cy + Math.sin(end) * shape.r };
    const large = Math.abs(shape.endAngle - shape.startAngle) > 180 ? 1 : 0;
    return <path key={shape.id} d={`M ${p1.x} ${p1.y} A ${shape.r} ${shape.r} 0 ${large} 1 ${p2.x} ${p2.y}`} {...common} />;
  }
  if (shape.type === "text") {
    return (
      <text
        key={shape.id}
        x={shape.x}
        y={shape.y}
        fill={selected ? "#60a5fa" : layerColor}
        fontSize={shape.size}
        pointerEvents="none"
      >
        {shape.text}
      </text>
    );
  }
  if (shape.type === "dim-linear") {
    const dx = shape.x2 - shape.x1;
    const dy = shape.y2 - shape.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const a = { x: shape.x1 + nx * shape.offset, y: shape.y1 + ny * shape.offset };
    const b = { x: shape.x2 + nx * shape.offset, y: shape.y2 + ny * shape.offset };
    const text = `${(len / 100).toFixed(2)} m`;
    return (
      <g key={shape.id} pointerEvents="none">
        <line x1={shape.x1} y1={shape.y1} x2={a.x} y2={a.y} {...common} strokeWidth={selected ? 2.4 : 1.1} />
        <line x1={shape.x2} y1={shape.y2} x2={b.x} y2={b.y} {...common} strokeWidth={selected ? 2.4 : 1.1} />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...common} />
        <text x={(a.x + b.x) / 2 + 6} y={(a.y + b.y) / 2 - 6} fill={stroke} fontSize={20} stroke="none">
          {text}
        </text>
      </g>
    );
  }
  return null;
}

function renderSnapMarker(hit: SnapHit) {
  const s = 9;
  const p = hit.p;
  const common = {
    stroke: "#facc15",
    strokeWidth: 1.4,
    fill: "none",
    vectorEffect: "non-scaling-stroke" as const,
    pointerEvents: "none" as const,
  };
  if (hit.kind === "endpoint") return <rect x={p.x - s} y={p.y - s} width={s * 2} height={s * 2} {...common} />;
  if (hit.kind === "midpoint") return <polygon points={`${p.x},${p.y - s} ${p.x + s},${p.y + s} ${p.x - s},${p.y + s}`} {...common} />;
  if (hit.kind === "center") return <circle cx={p.x} cy={p.y} r={s} {...common} />;
  if (hit.kind === "intersection") {
    return (
      <g {...common}>
        <line x1={p.x - s} y1={p.y - s} x2={p.x + s} y2={p.y + s} />
        <line x1={p.x - s} y1={p.y + s} x2={p.x + s} y2={p.y - s} />
      </g>
    );
  }
  return <circle cx={p.x} cy={p.y} r={s * 0.7} {...common} />;
}

function layoutPaperSize(layout: DwgTemplateLayout) {
  const media = layout.media.toUpperCase();
  if (media.includes("A3")) return { w: 420, h: 297 };
  if (media.includes("A4")) return { w: 297, h: 210 };
  if (media.includes("LETTER")) return { w: 279, h: 216 };
  return { w: 297, h: 210 };
}

function layoutPaperWorld(layout: DwgTemplateLayout) {
  const paper = layoutPaperSize(layout);
  return { w: paper.w * 3.5, h: paper.h * 3.5 };
}

function normalizeFileMatch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
}

function findDwgTemplateForFile(fileName: string) {
  const normalized = normalizeFileMatch(fileName);
  const exact = dwgTemplatePresets.find((template) => {
    const source = normalizeFileMatch(template.sourceFile.replace(/\.dwg$/i, ""));
    const title = normalizeFileMatch(template.title);
    return normalized.includes(source) || normalized.includes(title);
  });
  if (exact) return exact;
  if (normalized.includes("05 2") || normalized.includes("skica") || normalized.includes("izmjere")) {
    return dwgTemplatePresets.find((template) => template.id.includes("skica")) || dwgTemplatePresets[0];
  }
  if (normalized.includes("08 4") || normalized.includes("kkp") || normalized.includes("zk") || normalized.includes("zemljis")) {
    return dwgTemplatePresets.find((template) => template.id.includes("kkp")) || dwgTemplatePresets[1] || dwgTemplatePresets[0];
  }
  return dwgTemplatePresets[0];
}

function readCadTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Ne mogu procitati ${file.name}.`));
    reader.readAsText(file);
  });
}

async function convertDwgFile(file: File): Promise<CadConverterResponse> {
  if (!CAD_CONVERTER_URL) {
    throw new Error("DWG converter nije spojen. Postavi VITE_CAD_CONVERTER_URL na servis koji pretvara DWG u DXF/JSON.");
  }
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${CAD_CONVERTER_URL}/convert`, { method: "POST", body });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const detail = contentType.includes("application/json")
      ? ((await response.json()) as { message?: string; error?: string })
      : { message: await response.text() };
    throw new Error(detail.message || detail.error || `DWG converter je vratio HTTP ${response.status}.`);
  }
  if (contentType.includes("application/json")) {
    return (await response.json()) as CadConverterResponse;
  }
  return { dxf: await response.text() };
}

const Invoices = () => {
  const dxfRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<SVGSVGElement | null>(null);

  const doc = useCad((s) => s.doc);
  const selectedIds = useCad((s) => s.selectedIds);
  const addShape = useCad((s) => s.addShape);
  const updateShape = useCad((s) => s.updateShape);
  const deleteShapes = useCad((s) => s.deleteShapes);
  const clearAll = useCad((s) => s.clearAll);
  const setSelection = useCad((s) => s.setSelection);
  const setActiveLayer = useCad((s) => s.setActiveLayer);
  const updateLayer = useCad((s) => s.updateLayer);
  const setDoc = useCad((s) => s.setDoc);
  const loadDoc = useCad((s) => s.loadDoc);
  const undo = useCad((s) => s.undo);
  const redo = useCad((s) => s.redo);

  const [tool, setTool] = useState<CadTool>("select");
  const [pending, setPending] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [command, setCommand] = useState("");
  const [log, setLog] = useState("LINE: klikni prvu i drugu tocku. RECT/CIRCLE rade s dvije tocke. DXF import/export je aktivan.");
  const [importStatus, setImportStatus] = useState(
    CAD_CONVERTER_URL
      ? "Ucitaj DWG preko convertera ili DXF direktno u crtez."
      : "DXF se ucitava direktno. Za pravi DWG import treba spojiti VITE_CAD_CONVERTER_URL.",
  );
  const [gridOn, setGridOn] = useState(true);
  const [osnapOn, setOsnapOn] = useState(true);
  const [orthoOn, setOrthoOn] = useState(false);
  const [polygonSides, setPolygonSides] = useState(6);
  const [offsetDistance, setOffsetDistance] = useState(20);
  const [mirrorAxis, setMirrorAxis] = useState<Point | null>(null);
  const [snapHit, setSnapHit] = useState<SnapHit | null>(null);
  const [viewBox, setViewBox] = useState<ViewBox>(DEFAULT_VIEW_BOX);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panDrag, setPanDrag] = useState<{ clientX: number; clientY: number; viewBox: ViewBox } | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState(dwgTemplatePresets[0]?.id ?? "");
  const [activeLayoutName, setActiveLayoutName] = useState("Model");

  const layerMap = useMemo(() => new Map(doc.layers.map((l) => [l.id, l])), [doc.layers]);
  const visibleShapes = useMemo(
    () => doc.shapes.filter((shape) => layerMap.get(shape.layerId)?.visible !== false),
    [doc.shapes, layerMap],
  );
  const selectedShape = doc.shapes.find((shape) => selectedIds.includes(shape.id)) || null;
  const activeLayer = doc.layers.find((layer) => layer.id === doc.activeLayerId) || doc.layers[0];
  const propertyLayer = selectedShape ? layerMap.get(selectedShape.layerId) || activeLayer : activeLayer;
  const activeTemplate = useMemo(
    () => dwgTemplatePresets.find((template) => template.id === activeTemplateId) || dwgTemplatePresets[0] || null,
    [activeTemplateId],
  );
  const skicaTemplate = useMemo(() => dwgTemplatePresets.find((template) => template.id.includes("skica")) || null, []);
  const kkpTemplate = useMemo(() => dwgTemplatePresets.find((template) => template.id.includes("kkp")) || null, []);
  const layoutTabs = useMemo(() => {
    const byName = new Map<string, DwgTemplateLayout>();
    byName.set(MODEL_LAYOUT.name, MODEL_LAYOUT);
    activeTemplate?.layouts.forEach((layout) => byName.set(layout.name, layout));
    return Array.from(byName.values());
  }, [activeTemplate]);
  const activeLayout = layoutTabs.find((layout) => layout.name === activeLayoutName) || layoutTabs[0] || MODEL_LAYOUT;
  const activePaper = activeLayout.name === "Model" ? null : layoutPaperWorld(activeLayout);
  const zoomPercent = Math.round((CANVAS_W / viewBox.w) * 100);
  const snapTolerance = Math.max(4, (18 * viewBox.w) / CANVAS_W);

  const toWorld = (clientX: number, clientY: number): Point => {
    const svg = canvasRef.current;
    if (!svg) return { x: 0, y: 0 };
    const matrix = svg.getScreenCTM();
    if (matrix) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const world = point.matrixTransform(matrix.inverse());
      return { x: world.x, y: world.y };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w,
      y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h,
    };
  };

  const applySnap = (raw: Point, base = pending[0] || null) => {
    let p = gridOn ? snapGrid(raw) : raw;
    if (osnapOn) {
      const hit = findOSnap(visibleShapes, raw, snapTolerance, defaultOsnap);
      setSnapHit(hit);
      if (hit) p = hit.p;
    } else {
      setSnapHit(null);
    }
    if (orthoOn && base) {
      const dx = Math.abs(p.x - base.x);
      const dy = Math.abs(p.y - base.y);
      p = dx >= dy ? { x: p.x, y: base.y } : { x: base.x, y: p.y };
    }
    return p;
  };

  const addLog = (message: string) => setLog(message);

  const setConstrainedViewBox = (next: ViewBox) => {
    const w = Math.min(CANVAS_W * 8, Math.max(80, next.w));
    const h = Math.min(CANVAS_H * 8, Math.max(50, next.h));
    setViewBox({
      x: Math.min(CANVAS_W * 4, Math.max(-CANVAS_W * 4, next.x)),
      y: Math.min(CANVAS_H * 4, Math.max(-CANVAS_H * 4, next.y)),
      w,
      h,
    });
  };

  const zoomAt = (factor: number, center?: Point) => {
    const p = center || { x: viewBox.x + viewBox.w / 2, y: viewBox.y + viewBox.h / 2 };
    const w = viewBox.w * factor;
    const h = viewBox.h * factor;
    const rx = (p.x - viewBox.x) / viewBox.w;
    const ry = (p.y - viewBox.y) / viewBox.h;
    setConstrainedViewBox({ x: p.x - w * rx, y: p.y - h * ry, w, h });
  };

  const zoomInView = () => {
    zoomAt(0.75);
    addLog("ZOOM IN");
  };

  const zoomOutView = () => {
    zoomAt(1.33);
    addLog("ZOOM OUT");
  };

  const zoomFit = () => {
    setViewBox(DEFAULT_VIEW_BOX);
    addLog("ZOOM FIT - cijeli model.");
  };

  const zoomToShapes = (shapes: Shape[]) => {
    const box = shapesBBox(shapes);
    if (!box) return zoomFit();
    const padding = Math.max(80, Math.max(box.maxX - box.minX, box.maxY - box.minY) * 0.08);
    setViewBox({
      x: box.minX - padding,
      y: box.minY - padding,
      w: Math.max(120, box.maxX - box.minX + padding * 2),
      h: Math.max(90, box.maxY - box.minY + padding * 2),
    });
    addLog("ZOOM EXTENTS - uvezeni crtez je u fokusu.");
  };

  const panView = (dx: number, dy: number) => {
    setConstrainedViewBox({ ...viewBox, x: viewBox.x + dx, y: viewBox.y + dy });
    addLog(`PAN ${dx.toFixed(0)}, ${dy.toFixed(0)}`);
  };

  useEffect(() => {
    const svg = canvasRef.current;
    if (!svg) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      zoomAt(event.deltaY < 0 ? 0.86 : 1.16, toWorld(event.clientX, event.clientY));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [viewBox]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.code === "Space") {
        event.preventDefault();
        setSpaceDown(true);
      }
      if (event.key === "Escape") {
        setPending([]);
        setMirrorAxis(null);
        addLog("Naredba prekinuta.");
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedIds.length) deleteShapes(selectedIds);
      }
      if (event.key === "Enter" && tool === "line") {
        setPending([]);
        addLog("LINE zavrsen.");
      }
      if (event.key === "Enter" && tool === "polyline") {
        if (pending.length < 2) {
          addLog("Polyline treba barem dvije tocke.");
        } else {
          const id = addShape({ type: "polyline", points: pending, closed: false } as any);
          setSelection([id]);
          setPending([]);
          addLog(`Polyline dodan (${pending.length} tocaka).`);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedIds, tool, pending]);

  const selectLayout = (layoutName: string) => {
    const layout = layoutTabs.find((item) => item.name === layoutName) || MODEL_LAYOUT;
    setActiveLayoutName(layout.name);
    if (layout.name === "Model") {
      setViewBox(DEFAULT_VIEW_BOX);
    } else {
      const paper = layoutPaperWorld(layout);
      setViewBox({ x: -80, y: -80, w: paper.w + 160, h: paper.h + 160 });
    }
    addLog(
      layout.name === "Model"
        ? "Layout Model aktivan."
        : `Layout ${layout.name}: ${layout.media || "bez papira"} / ${layout.styleSheet || "bez CTB"}`,
    );
  };

  const updateSelectedShape = (patch: Partial<Shape>) => {
    if (!selectedShape) return;
    updateShape(selectedShape.id, patch);
  };

  const setSelectedNumber = (key: string, value: string) => {
    if (!selectedShape) return;
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    updateSelectedShape({ [key]: next } as Partial<Shape>);
  };

  const setSelectedPointNumber = (index: number, key: "x" | "y", value: string) => {
    if (!selectedShape || selectedShape.type !== "polyline") return;
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    updateSelectedShape({
      points: selectedShape.points.map((point, pointIndex) => (pointIndex === index ? { ...point, [key]: next } : point)),
    } as Partial<Shape>);
  };

  const selectTool = (next: CadTool) => {
    setTool(next);
    setPending([]);
    setMirrorAxis(null);
    addLog(`${next.toUpperCase()} aktivan.`);
  };

  const finishPolyline = () => {
    if (pending.length < 2) {
      addLog("Polyline treba barem dvije tocke.");
      return;
    }
    const id = addShape({ type: "polyline", points: pending, closed: false } as any);
    setSelection([id]);
    setPending([]);
    addLog(`Polyline dodan (${pending.length} tocaka).`);
  };

  const pickShapeAt = (p: Point) =>
    [...visibleShapes].reverse().find((shape) => layerMap.get(shape.layerId)?.locked !== true && hitTest(shape, p, Math.max(10, snapTolerance)));

  const applyModifyTool = (modifyTool: CadTool, base: Point, target: Point) => {
    const ids = selectedIds;
    if (!ids.length) return addLog(`${modifyTool.toUpperCase()}: prvo odaberi objekt.`);
    const dx = target.x - base.x;
    const dy = target.y - base.y;
    if (modifyTool === "move") {
      setDoc({ ...doc, shapes: doc.shapes.map((shape) => (ids.includes(shape.id) ? translateShape(shape, dx, dy) : shape)) });
      return addLog(`MOVE ${ids.length} objekt(a).`);
    }
    if (modifyTool === "copy") {
      const clones = doc.shapes
        .filter((shape) => ids.includes(shape.id))
        .map((shape) => ({ ...translateShape(shape, dx, dy), id: cadUid() }));
      setDoc({ ...doc, shapes: [...doc.shapes, ...clones] });
      setSelection(clones.map((shape) => shape.id));
      return addLog(`COPY ${clones.length} objekt(a).`);
    }
    if (modifyTool === "rotate") {
      const angle = Math.atan2(dy, dx);
      setDoc({ ...doc, shapes: doc.shapes.map((shape) => (ids.includes(shape.id) ? rotateShape(shape, base, angle) : shape)) });
      return addLog(`ROTATE ${(angle * 180 / Math.PI).toFixed(1)} stupnjeva.`);
    }
    if (modifyTool === "scale") {
      const factor = Math.max(0.05, Math.hypot(dx, dy) / 100);
      setDoc({ ...doc, shapes: doc.shapes.map((shape) => (ids.includes(shape.id) ? scaleCadShape(shape, base, factor) : shape)) });
      return addLog(`SCALE faktor ${factor.toFixed(2)}.`);
    }
  };

  const onCanvasMouseDown = (event: MouseEvent<SVGSVGElement>) => {
    canvasRef.current?.focus();

    if (event.button === 1 || (event.button === 0 && spaceDown)) {
      event.preventDefault();
      setPanDrag({ clientX: event.clientX, clientY: event.clientY, viewBox });
      addLog("PAN aktivan.");
      return;
    }

    if (event.button !== 0) return;
    const p = applySnap(toWorld(event.clientX, event.clientY));

    if (tool === "select") {
      const hit = pickShapeAt(p);
      setSelection(hit ? [hit.id] : []);
      return;
    }

    if (tool === "trim" || tool === "extend") {
      const hit = pickShapeAt(p);
      if (!hit || hit.type !== "line") return addLog(`${tool.toUpperCase()}: klikni LINE objekt.`);
      const next = tool === "trim" ? trimLine(hit as LineShape, doc.shapes, p) : extendLine(hit as LineShape, doc.shapes, p);
      if (!next) return addLog(`${tool.toUpperCase()}: nema granice za tu radnju.`);
      updateShape(hit.id, next as Partial<Shape>);
      return addLog(`${tool.toUpperCase()} napravljen.`);
    }

    if (tool === "offset") {
      if (!selectedIds.length) {
        const hit = pickShapeAt(p);
        if (hit) setSelection([hit.id]);
        return addLog(hit ? "OFFSET: objekt odabran, klikni stranu za kopiju." : "OFFSET: odaberi objekt.");
      }
      const src = doc.shapes.find((shape) => shape.id === selectedIds[0]);
      if (!src) return;
      const clone = offsetShape(src, offsetDistance, p);
      if (!clone) return addLog("OFFSET: ovaj objekt se jos ne moze offsetati.");
      const id = addShape(cloneForAdd(clone) as any);
      setSelection([id]);
      return addLog(`OFFSET ${offsetDistance}.`);
    }

    if (tool === "mirror") {
      if (!selectedIds.length) return addLog("MIRROR: prvo odaberi objekte.");
      if (!mirrorAxis) {
        setMirrorAxis(p);
        return addLog(`MIRROR prva tocka osi ${formatPoint(p)}.`);
      }
      const clones = doc.shapes
        .filter((shape) => selectedIds.includes(shape.id))
        .map((shape) => mirrorShape(shape, mirrorAxis, p));
      setDoc({ ...doc, shapes: [...doc.shapes, ...clones] });
      setSelection(clones.map((shape) => shape.id));
      setMirrorAxis(null);
      return addLog(`MIRROR ${clones.length} objekt(a).`);
    }

    if (tool === "move" || tool === "copy" || tool === "rotate" || tool === "scale") {
      if (!selectedIds.length) return addLog(`${tool.toUpperCase()}: prvo odaberi objekt.`);
      if (!pending.length) {
        setPending([p]);
        return addLog(`${tool.toUpperCase()} base point ${formatPoint(p)}.`);
      }
      applyModifyTool(tool, pending[0], p);
      setPending([]);
      return;
    }

    if (tool === "line") {
      if (!pending.length) {
        setPending([p]);
        addLog(`LINE first point ${formatPoint(p)}`);
      } else {
        const start = pending[0];
        const end = applySnap(toWorld(event.clientX, event.clientY), start);
        const id = addShape({ type: "line", x1: start.x, y1: start.y, x2: end.x, y2: end.y } as any);
        setSelection([id]);
        setPending([end]);
        addLog(`LINE added ${formatPoint(start)} -> ${formatPoint(end)}. Nastavi crtati ili Escape/Enter za kraj.`);
      }
      return;
    }

    if (tool === "rect") {
      if (!pending.length) {
        setPending([p]);
        addLog(`RECT first corner ${formatPoint(p)}`);
      } else {
        const a = pending[0];
        const b = applySnap(toWorld(event.clientX, event.clientY), a);
        const id = addShape({ type: "rect", x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) } as any);
        setSelection([id]);
        setPending([]);
        addLog(`RECT added ${Math.abs(b.x - a.x).toFixed(1)} x ${Math.abs(b.y - a.y).toFixed(1)}`);
      }
      return;
    }

    if (tool === "circle") {
      if (!pending.length) {
        setPending([p]);
        addLog(`CIRCLE center ${formatPoint(p)}`);
      } else {
        const center = pending[0];
        const edge = applySnap(toWorld(event.clientX, event.clientY), center);
        const r = Math.hypot(edge.x - center.x, edge.y - center.y);
        if (r > 0) {
          const id = addShape({ type: "circle", cx: center.x, cy: center.y, r } as any);
          setSelection([id]);
          addLog(`CIRCLE added r ${r.toFixed(1)}`);
        }
        setPending([]);
      }
      return;
    }

    if (tool === "arc") {
      if (!pending.length) {
        setPending([p]);
        addLog(`ARC center ${formatPoint(p)}`);
      } else if (pending.length === 1) {
        setPending((prev) => [...prev, p]);
        addLog(`ARC start ${formatPoint(p)}`);
      } else {
        const center = pending[0];
        const start = pending[1];
        const r = Math.hypot(start.x - center.x, start.y - center.y);
        const startAngle = (Math.atan2(start.y - center.y, start.x - center.x) * 180) / Math.PI;
        const endAngle = (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
        const id = addShape({ type: "arc", cx: center.x, cy: center.y, r, startAngle, endAngle } as any);
        setSelection([id]);
        setPending([]);
        addLog("ARC dodan.");
      }
      return;
    }

    if (tool === "polygon") {
      if (!pending.length) {
        setPending([p]);
        addLog(`POLYGON center ${formatPoint(p)}`);
      } else {
        const center = pending[0];
        const r = Math.hypot(p.x - center.x, p.y - center.y);
        const a0 = Math.atan2(p.y - center.y, p.x - center.x);
        const points = Array.from({ length: polygonSides }, (_, index) => {
          const angle = a0 + (index * 2 * Math.PI) / polygonSides;
          return { x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) };
        });
        const id = addShape({ type: "polyline", points, closed: true } as any);
        setSelection([id]);
        setPending([]);
        addLog(`POLYGON ${polygonSides} stranica dodan.`);
      }
      return;
    }

    if (tool === "text") {
      const text = window.prompt("Tekst:", "Tekst");
      if (text) {
        const id = addShape({ type: "text", x: p.x, y: p.y, text, size: 28 } as any);
        setSelection([id]);
        addLog(`TEXT dodan: ${text}`);
      }
      return;
    }

    if (tool === "dim") {
      if (!pending.length) {
        setPending([p]);
        addLog(`DIM prva tocka ${formatPoint(p)}`);
      } else if (pending.length === 1) {
        setPending((prev) => [...prev, p]);
        addLog(`DIM druga tocka ${formatPoint(p)}`);
      } else {
        const a = pending[0];
        const b = pending[1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const offset = (p.x - a.x) * nx + (p.y - a.y) * ny;
        const id = addShape({ type: "dim-linear", x1: a.x, y1: a.y, x2: b.x, y2: b.y, offset } as any);
        setSelection([id]);
        setPending([]);
        addLog("DIM dodan.");
      }
      return;
    }

    if (tool === "polyline") {
      setPending((prev) => [...prev, p]);
      addLog(`PL point ${pending.length + 1}: ${formatPoint(p)}. Enter ili dvoklik zavrsava.`);
    }
  };

  const onCanvasMove = (event: MouseEvent<SVGSVGElement>) => {
    if (panDrag) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = -((event.clientX - panDrag.clientX) / Math.max(1, rect.width)) * panDrag.viewBox.w;
      const dy = -((event.clientY - panDrag.clientY) / Math.max(1, rect.height)) * panDrag.viewBox.h;
      setConstrainedViewBox({ ...panDrag.viewBox, x: panDrag.viewBox.x + dx, y: panDrag.viewBox.y + dy });
      return;
    }
    const base = pending[0] || null;
    setCursor(applySnap(toWorld(event.clientX, event.clientY), base));
  };

  const executeCommand = () => {
    const raw = command.trim();
    if (!raw) return;
    const [cmdRaw, ...args] = raw.split(/\s+/);
    const cmd = cmdRaw.toUpperCase();

    const setAndLog = (next: CadTool) => {
      selectTool(next);
      setCommand("");
    };

    if (cmd === "L" || cmd === "LINE") return setAndLog("line");
    if (cmd === "R" || cmd === "RECT") return setAndLog("rect");
    if (cmd === "C" || cmd === "CIRCLE") return setAndLog("circle");
    if (cmd === "PL" || cmd === "POLY") return setAndLog("polyline");
    if (cmd === "A" || cmd === "ARC") return setAndLog("arc");
    if (cmd === "G" || cmd === "POLYGON") return setAndLog("polygon");
    if (cmd === "D" || cmd === "DIM") return setAndLog("dim");
    if ((cmd === "T" || cmd === "TEXT") && args.length < 2) return setAndLog("text");
    if (cmd === "M" || cmd === "MOVE") return setAndLog("move");
    if (cmd === "Y" || cmd === "COPY") return setAndLog("copy");
    if (cmd === "O" || cmd === "ROTATE") return setAndLog("rotate");
    if (cmd === "SC" || cmd === "SCALE") return setAndLog("scale");
    if (cmd === "X" || cmd === "TRIM") return setAndLog("trim");
    if (cmd === "W" || cmd === "EXTEND") return setAndLog("extend");
    if (cmd === "I" || cmd === "MIRROR") return setAndLog("mirror");
    if (cmd === "F" || cmd === "OFFSET") {
      if (args[0] && Number.isFinite(Number(args[0]))) setOffsetDistance(Math.max(0.1, Number(args[0])));
      return setAndLog("offset");
    }
    if (cmd === "S" || cmd === "SELECT") return setAndLog("select");
    if (cmd === "Z" || cmd === "ZOOM") {
      const mode = args[0]?.toUpperCase();
      if (!mode || mode === "+" || mode === "IN") zoomInView();
      else if (mode === "-" || mode === "OUT") zoomOutView();
      else if (mode === "E" || mode === "EXTENTS" || mode === "FIT") zoomFit();
      else if (Number.isFinite(Number(mode))) zoomAt(Math.max(0.1, Math.min(8, 100 / Number(mode))));
      setCommand("");
      return;
    }
    if (cmd === "PAN") {
      panView(Number(args[0] || 0), Number(args[1] || 0));
      setCommand("");
      return;
    }
    if (cmd === "LAYOUT" || cmd === "LO") {
      const name = args.join(" ").trim();
      const match = layoutTabs.find((layout) => layout.name.toLowerCase() === name.toLowerCase());
      if (match) selectLayout(match.name);
      else addLog(`Layout nije pronaden: ${name || "(prazno)"}`);
      setCommand("");
      return;
    }
    if (cmd === "U" || cmd === "UNDO") {
      undo();
      setCommand("");
      return addLog("UNDO");
    }
    if (cmd === "REDO") {
      redo();
      setCommand("");
      return addLog("REDO");
    }
    if (cmd === "E" || cmd === "ERASE" || cmd === "DELETE") {
      deleteShapes(selectedIds);
      setCommand("");
      return addLog("Obrisana selekcija.");
    }
    if (cmd === "CLEAR") {
      clearAll();
      setCommand("");
      return addLog("Crtez ociscen.");
    }
    if (cmd === "DXF" || cmd === "DWG" || cmd === "EXPORT") {
      exportCurrentDxf();
      setCommand("");
      return;
    }
    if (cmd === "IMPORT") {
      dxfRef.current?.click();
      setCommand("");
      return;
    }

    if ((cmd === "TEXT" || cmd === "T") && args.length >= 2) {
      const p = parseCoord(args[0], null);
      if (p) {
        const text = args.slice(1).join(" ");
        const id = addShape({ type: "text", x: p.x, y: p.y, text, size: 28 } as any);
        setSelection([id]);
        setCommand("");
        return addLog(`TEXT added: ${text}`);
      }
    }

    if ((cmd === "LINE" || cmd === "L") && args.length >= 2) {
      const a = parseCoord(args[0], null);
      const b = parseCoord(args[1], a);
      if (a && b) {
        const id = addShape({ type: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y } as any);
        setSelection([id]);
        setCommand("");
        return addLog(`LINE added ${formatPoint(a)} -> ${formatPoint(b)}`);
      }
    }

    setCommand("");
    addLog(`Nepoznata naredba: ${raw}`);
  };

  const exportCurrentDxf = () => {
    const blob = new Blob([exportDXF(doc)], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geoterra-${Date.now()}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
    addLog("DXF export napravljen.");
  };

  const importDxf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    const fileName = file.name;
    const isDwg = fileName.toLowerCase().endsWith(".dwg");

    const finishImport = (layers: Layer[], shapes: Shape[], sourceLabel: string) => {
      if (!shapes.length) {
        throw new Error(`${sourceLabel}: nisu pronadeni podrzani CAD objekti.`);
      }
      loadDoc({ ...doc, layers, shapes, activeLayerId: layers[0]?.id || doc.activeLayerId });
      setPending([]);
      setSelection([]);
      setSnapHit(null);
      setActiveLayoutName("Model");
      zoomToShapes(shapes);
      const message = `${sourceLabel}: ${shapes.length} objekata, ${layers.length} layera.`;
      addLog(message);
      setImportStatus(message);
      toast.success("CAD crtez ucitan", { description: `${shapes.length} objekata, ${layers.length} layera. Pogled je automatski fitan.` });
    };

    try {
      if (isDwg) {
        setImportStatus(`DWG ${fileName}: saljem converteru...`);
        addLog(`DWG import: saljem ${fileName} converteru.`);
        const converted = await convertDwgFile(file);
        if (converted.dxf) {
          const { layers, shapes } = importDXF(converted.dxf, doc.layers);
          finishImport(layers, shapes, `DWG import ${fileName}`);
          return;
        }
        if (Array.isArray(converted.layers) && Array.isArray(converted.shapes)) {
          finishImport(converted.layers, converted.shapes, `DWG import ${fileName}`);
          return;
        }
        throw new Error(converted.message || "DWG converter nije vratio DXF ni CAD JSON.");
      }

      const raw = await readCadTextFile(file);
      if (!raw.trim()) {
        addLog(`DXF import: ${fileName} je prazan ili nije tekstualni DXF.`);
        setImportStatus(`DXF import: ${fileName} je prazan ili nije tekstualni DXF.`);
        toast.error("DXF nije ucitan", { description: "Datoteka je prazna ili nije tekstualni DXF." });
        return;
      }
      const { layers, shapes } = importDXF(raw, doc.layers);
      if (!shapes.length) {
        addLog(`DXF import: ${fileName} nije dao objekte. Moguce je da je binarni DWG ili DXF s nepodrzanim entitetima.`);
        setImportStatus(`DXF ${fileName}: nisu pronadeni podrzani objekti. Exportaj kao AutoCAD 2000/LT2000 DXF.`);
        toast.warning("DXF nije dao objekte", { description: "Probaj exportati kao AutoCAD 2000/LT2000 DXF ili mi posalji primjer." });
        return;
      }
      finishImport(layers, shapes, `DXF import ${fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepoznata greska";
      addLog(`CAD import nije uspio: ${message}`);
      setImportStatus(`CAD import nije uspio: ${message}`);
      toast.error("CAD import nije uspio", { description: message });
    }
  };

  const applyDwgTemplate = (template: DwgTemplatePreset, keepShapes = false) => {
    const nextDoc = makeCadDocFromDwgTemplate(template, keepShapes ? doc.shapes : [], doc.layers);
    loadDoc(nextDoc);
    setPending([]);
    setSelection([]);
    setActiveTemplateId(template.id);
    setActiveLayoutName(template.layouts.find((layout) => layout.name !== "Model")?.name || "Model");
    setViewBox(DEFAULT_VIEW_BOX);
    const layoutNames = template.layouts.map((layout) => layout.name).filter((name) => name !== "Model").join(", ");
    addLog(
      `${template.title}: ucitano ${template.layers.length} layera, ${template.layouts.length} layouta, ${template.blocks.length} blokova. Layouti: ${layoutNames}`,
    );
    setImportStatus(`${template.title}: spremni layeri, layouti, linetype, debljine i plot stilovi. ${keepShapes ? "Postojeca geometrija je preslozena na iste nazive layera." : "Cekam DXF geometriju ili novo crtanje."}`);
  };

  const previewShape = () => {
    if (!cursor || !pending.length) return null;
    const a = pending[0];
    const stroke = "#facc15";
    if (tool === "line") return <line x1={a.x} y1={a.y} x2={cursor.x} y2={cursor.y} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" vectorEffect="non-scaling-stroke" />;
    if (tool === "rect") return <rect x={Math.min(a.x, cursor.x)} y={Math.min(a.y, cursor.y)} width={Math.abs(cursor.x - a.x)} height={Math.abs(cursor.y - a.y)} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" fill="none" vectorEffect="non-scaling-stroke" />;
    if (tool === "circle") return <circle cx={a.x} cy={a.y} r={Math.hypot(cursor.x - a.x, cursor.y - a.y)} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" fill="none" vectorEffect="non-scaling-stroke" />;
    if (tool === "arc" && pending.length === 1) return <circle cx={a.x} cy={a.y} r={Math.hypot(cursor.x - a.x, cursor.y - a.y)} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" fill="none" vectorEffect="non-scaling-stroke" />;
    if (tool === "arc" && pending.length >= 2) {
      const center = pending[0];
      const start = pending[1];
      const r = Math.hypot(start.x - center.x, start.y - center.y);
      const sa = Math.atan2(start.y - center.y, start.x - center.x);
      const ea = Math.atan2(cursor.y - center.y, cursor.x - center.x);
      const p1 = { x: center.x + Math.cos(sa) * r, y: center.y + Math.sin(sa) * r };
      const p2 = { x: center.x + Math.cos(ea) * r, y: center.y + Math.sin(ea) * r };
      return <path d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 ${Math.abs(ea - sa) > Math.PI ? 1 : 0} 1 ${p2.x} ${p2.y}`} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" fill="none" vectorEffect="non-scaling-stroke" />;
    }
    if (tool === "polygon") {
      const r = Math.hypot(cursor.x - a.x, cursor.y - a.y);
      const a0 = Math.atan2(cursor.y - a.y, cursor.x - a.x);
      const points = Array.from({ length: polygonSides }, (_, index) => {
        const angle = a0 + (index * 2 * Math.PI) / polygonSides;
        return `${a.x + r * Math.cos(angle)},${a.y + r * Math.sin(angle)}`;
      }).join(" ");
      return <polygon points={points} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" fill="none" vectorEffect="non-scaling-stroke" />;
    }
    if (tool === "dim" && pending.length >= 2) {
      const b = pending[1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const off = (cursor.x - a.x) * nx + (cursor.y - a.y) * ny;
      const p1 = { x: a.x + nx * off, y: a.y + ny * off };
      const p2 = { x: b.x + nx * off, y: b.y + ny * off };
      return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" vectorEffect="non-scaling-stroke" />;
    }
    if ((tool === "move" || tool === "copy" || tool === "rotate" || tool === "scale" || tool === "mirror") && pending.length) {
      return <line x1={a.x} y1={a.y} x2={cursor.x} y2={cursor.y} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" vectorEffect="non-scaling-stroke" />;
    }
    if (tool === "polyline") {
      const pts = [...pending, cursor].map((p) => `${p.x},${p.y}`).join(" ");
      return <polyline points={pts} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" fill="none" vectorEffect="non-scaling-stroke" />;
    }
    return null;
  };

  return (
    <DashboardLayout noScroll>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#17232d] text-slate-100">
        <input ref={dxfRef} type="file" accept=".dxf,.dwg" hidden onChange={importDxf} />

        <div className="shrink-0 border-b border-[#354653] bg-[#26333f]">
          <div className="flex h-7 items-center gap-4 overflow-x-auto px-2 text-[13px] text-slate-100">
            {menuItems.map((item) => (
              <button key={item} className="whitespace-nowrap hover:text-blue-300">
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto border-t border-[#40515f] px-2 py-1">
            <ToolbarButton title="Novi crtez" onClick={() => { clearAll(); addLog("Novi prazni crtez."); }}>
              <FolderOpen className="h-3.5 w-3.5 text-sky-300" />
            </ToolbarButton>
            <ToolbarButton title="Import DXF / DWG predlozak" onClick={() => dxfRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 text-cyan-300" />
            </ToolbarButton>
            <ToolbarButton title="Export DXF za AutoCAD/DWG workflow" onClick={exportCurrentDxf}>
              <FileDown className="h-3.5 w-3.5 text-emerald-300" />
            </ToolbarButton>
            <ToolbarButton title="Undo" onClick={undo}>
              <Undo2 className="h-3.5 w-3.5 text-slate-200" />
            </ToolbarButton>
            <ToolbarButton title="Redo" onClick={redo}>
              <Redo2 className="h-3.5 w-3.5 text-slate-200" />
            </ToolbarButton>
            <ToolbarButton title="Delete" onClick={() => deleteShapes(selectedIds)}>
              <Trash2 className="h-3.5 w-3.5 text-red-300" />
            </ToolbarButton>
            <div className="mx-1 h-5 w-px bg-[#607181]" />
            {layerTools.map((label, index) => (
              <ToolbarButton key={label} active={index === 0}>
                {label}
              </ToolbarButton>
            ))}
            <div className="mx-1 h-5 w-px bg-[#607181]" />
            <SelectLike label="Standard" width="w-32" />
            <SelectLike label="ISO-25" width="w-28" />
            <SelectLike label={activeLayer?.name || "ByLayer"} width="w-40" />
            <SelectLike label="ByColor" width="w-32" />
          </div>

          <div className="flex min-h-8 items-center gap-1 overflow-x-auto border-t border-[#40515f] px-2 py-1">
            {drawTools.map(({ id, title, Icon }) => (
              <ToolbarButton key={id} title={title} active={tool === id} onClick={() => selectTool(id)}>
                <Icon className="h-3.5 w-3.5" />
              </ToolbarButton>
            ))}
            <ToolbarButton title="Finish polyline" onClick={finishPolyline}>
              OK
            </ToolbarButton>
            <div className="mx-1 h-5 w-px bg-[#607181]" />
            {modifyTools.map(({ id, title, Icon }) => (
              <ToolbarButton key={id} title={title} active={tool === id} onClick={() => selectTool(id)}>
                <Icon className="h-3.5 w-3.5" />
              </ToolbarButton>
            ))}
            <input
              title="Polygon sides"
              type="number"
              min={3}
              max={32}
              value={polygonSides}
              onChange={(event) => setPolygonSides(Math.max(3, Number(event.target.value) || 3))}
              className="h-6 w-10 border border-[#607181] bg-[#18232d] text-center text-[10px] text-slate-100 outline-none"
            />
            <input
              title="Offset distance"
              type="number"
              min={0.1}
              step={1}
              value={offsetDistance}
              onChange={(event) => setOffsetDistance(Math.max(0.1, Number(event.target.value) || 1))}
              className="h-6 w-12 border border-[#607181] bg-[#18232d] text-center text-[10px] text-slate-100 outline-none"
            />
            <div className="mx-1 h-5 w-px bg-[#607181]" />
            {geoHrIcons.map((icon) => (
              <button
                key={icon}
                title={icon.replace(/\.(bmp)$/i, "")}
                className="flex h-6 w-6 items-center justify-center border border-[#607181] bg-[#2e3d49] hover:bg-[#415361]"
                onClick={() => addLog(`GeoHR alat odabran: ${icon.replace(/\.(bmp)$/i, "")}`)}
              >
                <img src={`/geohr/icons/${icon}`} alt="" className="h-4 w-4 image-rendering-pixelated" />
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[230px_minmax(0,1fr)] overflow-hidden">
          <aside className="flex min-h-0 flex-col border-r border-[#354653] bg-[#3a4855]">
            <div className="flex h-9 items-center justify-between border-b border-[#52616e] px-2 text-[12px] font-semibold">
              <span>Properties</span>
              <Settings className="h-3.5 w-3.5 text-slate-300" />
            </div>
            <div className="border-b border-[#52616e] p-2">
              <button className="flex h-7 w-full items-center justify-between bg-[#26333f] px-2 text-left text-[12px] text-slate-200">
                {selectedShape ? selectedShape.type.toUpperCase() : "No selection"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="bg-[#273541] px-2 py-1 text-[12px] font-semibold">General</div>
              <PropertyInput label="Color" value={propertyLayer?.color || "#ffffff"} onChange={(value) => propertyLayer && updateLayer(propertyLayer.id, { color: value })} />
              {selectedShape ? (
                <label className="grid grid-cols-[76px_1fr] items-center border-b border-[#52616e]/60 px-2 py-1 text-[11px] leading-4">
                  <span className="truncate text-slate-300">Layer</span>
                  <select
                    value={selectedShape.layerId}
                    onChange={(event) => updateSelectedShape({ layerId: event.target.value } as Partial<Shape>)}
                    className="h-5 min-w-0 border border-[#607181] bg-[#18232d] px-1 text-[11px] text-slate-100 outline-none"
                  >
                    {doc.layers.map((layer) => (
                      <option key={layer.id} value={layer.id}>{layer.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <PropertyRow label="Layer" value={activeLayer?.name || "0"} />
              )}
              <PropertyRow label="ACI" value={String(propertyLayer?.aciColor ?? "ByLayer")} />
              <PropertyInput label="Linetype" value={propertyLayer?.lineType || "Continuous"} onChange={(value) => propertyLayer && updateLayer(propertyLayer.id, { lineType: value })} />
              <PropertyInput label="Lineweight" type="number" value={propertyLayer?.lineWeight ?? -1} onChange={(value) => propertyLayer && updateLayer(propertyLayer.id, { lineWeight: Number(value) })} />
              <PropertyRow label="Type" value={selectedShape?.type || tool} />
              <PropertyRow label="Geometry" value={selectedShape ? shapeBounds(selectedShape) : "klikni ili upisi naredbu"} />
              {selectedShape?.type === "line" && (
                <>
                  <PropertyInput label="X1" type="number" value={selectedShape.x1} onChange={(value) => setSelectedNumber("x1", value)} />
                  <PropertyInput label="Y1" type="number" value={selectedShape.y1} onChange={(value) => setSelectedNumber("y1", value)} />
                  <PropertyInput label="X2" type="number" value={selectedShape.x2} onChange={(value) => setSelectedNumber("x2", value)} />
                  <PropertyInput label="Y2" type="number" value={selectedShape.y2} onChange={(value) => setSelectedNumber("y2", value)} />
                </>
              )}
              {selectedShape?.type === "rect" && (
                <>
                  <PropertyInput label="X" type="number" value={selectedShape.x} onChange={(value) => setSelectedNumber("x", value)} />
                  <PropertyInput label="Y" type="number" value={selectedShape.y} onChange={(value) => setSelectedNumber("y", value)} />
                  <PropertyInput label="W" type="number" value={selectedShape.w} onChange={(value) => setSelectedNumber("w", value)} />
                  <PropertyInput label="H" type="number" value={selectedShape.h} onChange={(value) => setSelectedNumber("h", value)} />
                </>
              )}
              {(selectedShape?.type === "circle" || selectedShape?.type === "arc") && (
                <>
                  <PropertyInput label="CX" type="number" value={selectedShape.cx} onChange={(value) => setSelectedNumber("cx", value)} />
                  <PropertyInput label="CY" type="number" value={selectedShape.cy} onChange={(value) => setSelectedNumber("cy", value)} />
                  <PropertyInput label="R" type="number" value={selectedShape.r} onChange={(value) => setSelectedNumber("r", value)} />
                </>
              )}
              {selectedShape?.type === "arc" && (
                <>
                  <PropertyInput label="Start" type="number" value={selectedShape.startAngle} onChange={(value) => setSelectedNumber("startAngle", value)} />
                  <PropertyInput label="End" type="number" value={selectedShape.endAngle} onChange={(value) => setSelectedNumber("endAngle", value)} />
                </>
              )}
              {selectedShape?.type === "text" && (
                <>
                  <PropertyInput label="X" type="number" value={selectedShape.x} onChange={(value) => setSelectedNumber("x", value)} />
                  <PropertyInput label="Y" type="number" value={selectedShape.y} onChange={(value) => setSelectedNumber("y", value)} />
                  <PropertyInput label="Size" type="number" value={selectedShape.size} onChange={(value) => setSelectedNumber("size", value)} />
                  <PropertyInput label="Text" value={selectedShape.text} onChange={(value) => updateSelectedShape({ text: value } as Partial<Shape>)} />
                </>
              )}
              {selectedShape?.type === "polyline" && selectedShape.points.slice(0, 4).map((point, index) => (
                <div key={index} className="grid grid-cols-[76px_1fr_1fr] gap-1 border-b border-[#52616e]/60 px-2 py-1 text-[11px] leading-4">
                  <span className="truncate text-slate-300">P{index + 1}</span>
                  <input type="number" value={point.x} onChange={(event) => setSelectedPointNumber(index, "x", event.target.value)} className="h-5 min-w-0 border border-[#607181] bg-[#18232d] px-1 text-slate-100 outline-none" />
                  <input type="number" value={point.y} onChange={(event) => setSelectedPointNumber(index, "y", event.target.value)} className="h-5 min-w-0 border border-[#607181] bg-[#18232d] px-1 text-slate-100 outline-none" />
                </div>
              ))}
              {selectedShape?.type === "dim-linear" && (
                <>
                  <PropertyInput label="X1" type="number" value={selectedShape.x1} onChange={(value) => setSelectedNumber("x1", value)} />
                  <PropertyInput label="Y1" type="number" value={selectedShape.y1} onChange={(value) => setSelectedNumber("y1", value)} />
                  <PropertyInput label="X2" type="number" value={selectedShape.x2} onChange={(value) => setSelectedNumber("x2", value)} />
                  <PropertyInput label="Y2" type="number" value={selectedShape.y2} onChange={(value) => setSelectedNumber("y2", value)} />
                  <PropertyInput label="Offset" type="number" value={selectedShape.offset} onChange={(value) => setSelectedNumber("offset", value)} />
                </>
              )}
              <PropertyRow label="Objects" value={String(doc.shapes.length)} />
              <div className="mt-2 bg-[#273541] px-2 py-1 text-[12px] font-semibold">View</div>
              <PropertyRow label="Cursor" value={formatPoint(cursor)} />
              <PropertyRow label="Snap" value={osnapOn ? (snapHit ? snapHit.kind : "Endpoint/Mid/Center/Intersect") : "Off"} />
              <PropertyRow label="Grid" value={gridOn ? `${GRID} mm` : "Off"} />
              <PropertyRow label="Ortho" value={orthoOn ? "On" : "Off"} />
              <div className="mt-2 bg-[#273541] px-2 py-1 text-[12px] font-semibold">Layers</div>
              {doc.layers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  className={cn(
                    "flex w-full items-center gap-1.5 border-b border-[#52616e]/60 px-2 py-1 text-left text-[11px] hover:bg-[#52616e]/50",
                    doc.activeLayerId === layer.id && "bg-[#1f6fb5]/40",
                  )}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      updateLayer(layer.id, { visible: !layer.visible });
                    }}
                    className={cn("w-4 text-center text-[10px]", layer.visible ? "text-emerald-300" : "text-slate-500")}
                  >
                    V
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      updateLayer(layer.id, { locked: !layer.locked });
                    }}
                    className={cn("w-4 text-center text-[10px]", layer.locked ? "text-amber-300" : "text-slate-500")}
                  >
                    L
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: layer.color }} />
                  <span className="truncate">{layer.name}</span>
                </button>
              ))}
              <div className="mt-2 bg-[#273541] px-2 py-1 text-[12px] font-semibold">GeoHR</div>
              {geoHrStats.map(([label, value]) => (
                <PropertyRow key={label} label={label} value={value} />
              ))}
            </div>
          </aside>

          <main className="relative min-h-0 overflow-hidden bg-[#18232d]">
            <div className="absolute left-2 top-1 z-10 flex items-center gap-2 text-[11px] text-slate-300">
              <span>[-]</span>
              <span>[Top]</span>
              <span>[2D Wireframe]</span>
              <span>[WCS]</span>
              <span>[{activeLayout.name}]</span>
              <span>[{zoomPercent}%]</span>
              {activePaper && <span>[{activeLayout.media || "paper"} / {activeLayout.styleSheet || "no CTB"}]</span>}
            </div>

            <div className="absolute right-5 top-5 z-10 w-[286px] rounded-sm border border-[#4c5d69] bg-[#202d38]/95 p-3 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center bg-lime-600 text-white">
                  <Grid3X3 className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">GeoHR CAD aktivan</p>
                  <p className="text-xs text-slate-300">Crtanje, selekcija, DXF import/export i command line.</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                <button onClick={() => setGridOn((v) => !v)} className={cn("border border-[#4c5d69] bg-[#151f28] p-1", gridOn && "text-emerald-300")}>GRID</button>
                <button onClick={() => setOsnapOn((v) => !v)} className={cn("border border-[#4c5d69] bg-[#151f28] p-1", osnapOn && "text-emerald-300")}>OSNAP</button>
                <button onClick={() => setOrthoOn((v) => !v)} className={cn("border border-[#4c5d69] bg-[#151f28] p-1", orthoOn && "text-emerald-300")}>ORTHO</button>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_1fr_1fr_58px] gap-1 text-center text-[10px]">
                <button onClick={zoomOutView} className="flex h-7 items-center justify-center border border-[#4c5d69] bg-[#151f28] hover:bg-[#273541]">
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button onClick={zoomFit} className="h-7 border border-[#4c5d69] bg-[#151f28] font-semibold hover:bg-[#273541]">FIT</button>
                <button onClick={zoomInView} className="flex h-7 items-center justify-center border border-[#4c5d69] bg-[#151f28] hover:bg-[#273541]">
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <span className="flex h-7 items-center justify-center border border-[#4c5d69] bg-[#0f1821] text-cyan-200">{zoomPercent}%</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
                <button onClick={() => panView(-viewBox.w * 0.12, 0)} className="border border-[#4c5d69] bg-[#151f28] p-1 hover:bg-[#273541]">LEFT</button>
                <button onClick={() => panView(0, -viewBox.h * 0.12)} className="border border-[#4c5d69] bg-[#151f28] p-1 hover:bg-[#273541]">UP</button>
                <button onClick={() => panView(0, viewBox.h * 0.12)} className="border border-[#4c5d69] bg-[#151f28] p-1 hover:bg-[#273541]">DOWN</button>
                <button onClick={() => panView(viewBox.w * 0.12, 0)} className="border border-[#4c5d69] bg-[#151f28] p-1 hover:bg-[#273541]">RIGHT</button>
              </div>
            </div>

            <div className="absolute right-8 top-40 z-10 flex h-28 w-28 items-center justify-center rounded-full border-[16px] border-slate-600/30 text-slate-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-300/80 text-[11px] font-bold text-slate-700">TOP</div>
              <span className="absolute top-1 text-sm font-semibold">N</span>
              <span className="absolute bottom-1 text-sm font-semibold">S</span>
              <span className="absolute right-1 text-sm font-semibold">E</span>
              <span className="absolute left-1 text-sm font-semibold">W</span>
            </div>

            <svg
              ref={canvasRef}
              className={cn("absolute inset-0 h-full w-full", spaceDown || panDrag ? "cursor-grab" : tool === "select" ? "cursor-default" : "cursor-crosshair")}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              preserveAspectRatio="none"
              style={{ touchAction: "none" }}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMove}
              onMouseUp={() => setPanDrag(null)}
              onMouseLeave={() => setPanDrag(null)}
              onContextMenu={(event) => {
                event.preventDefault();
                if (tool === "polyline" && pending.length >= 2) {
                  finishPolyline();
                  return;
                }
                setPending([]);
                setMirrorAxis(null);
              }}
              onDoubleClick={() => {
                if (tool === "polyline") finishPolyline();
                if (tool === "line") {
                  setPending([]);
                  addLog("LINE zavrsen.");
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Delete") deleteShapes(selectedIds);
                if (event.key === "Escape") setPending([]);
                if (event.key === "Enter" && tool === "line") {
                  setPending([]);
                  addLog("LINE zavrsen.");
                }
                if (event.key === "Enter" && tool === "polyline") finishPolyline();
              }}
              tabIndex={0}
            >
              <defs>
                <pattern id="cad-grid-small" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="rgba(148,163,184,0.055)" strokeWidth="1" />
                </pattern>
                <pattern id="cad-grid" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
                  <rect width={GRID * 5} height={GRID * 5} fill="url(#cad-grid-small)" />
                  <path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="1" />
                </pattern>
              </defs>
              {gridOn && <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#cad-grid)" />}
              <g>
                {activePaper && (
                  <g pointerEvents="none">
                    <rect x={0} y={0} width={activePaper.w} height={activePaper.h} fill="rgba(15,23,42,0.35)" stroke="#cbd5e1" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
                    <rect x={35} y={35} width={Math.max(10, activePaper.w - 70)} height={Math.max(10, activePaper.h - 70)} fill="none" stroke="#60a5fa" strokeWidth={1} strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />
                    <text x={42} y={28} fill="#cbd5e1" fontSize={18} stroke="none">
                      {activeLayout.name} · {activeLayout.media || "paper"} · {activeLayout.styleSheet || "bez CTB"}
                    </text>
                  </g>
                )}
                {visibleShapes.map((shape) =>
                  renderShape(
                    shape,
                    layerMap.get(shape.layerId)?.color || "#e2e8f0",
                    selectedIds.includes(shape.id),
                    (id) => setSelection([id]),
                  ),
                )}
                {previewShape()}
                {pending.map((p, index) => (
                  <circle key={`${p.x}-${p.y}-${index}`} cx={p.x} cy={p.y} r={4} fill="#facc15" />
                ))}
                {mirrorAxis && cursor && (
                  <g pointerEvents="none">
                    <circle cx={mirrorAxis.x} cy={mirrorAxis.y} r={4} fill="#facc15" />
                    <line x1={mirrorAxis.x} y1={mirrorAxis.y} x2={cursor.x} y2={cursor.y} stroke="#facc15" strokeWidth={1.4} strokeDasharray="8 8" vectorEffect="non-scaling-stroke" />
                  </g>
                )}
                {snapHit && renderSnapMarker(snapHit)}
              </g>
              {cursor && (
                <g pointerEvents="none" stroke="rgba(226,232,240,0.75)" strokeWidth="1.2" vectorEffect="non-scaling-stroke">
                  <line x1={cursor.x - 22} y1={cursor.y} x2={cursor.x + 22} y2={cursor.y} />
                  <line x1={cursor.x} y1={cursor.y - 22} x2={cursor.x} y2={cursor.y + 22} />
                  <rect x={cursor.x - 5} y={cursor.y - 5} width={10} height={10} fill="none" />
                </g>
              )}
              <g transform="translate(38 820)" stroke="rgba(226,232,240,0.78)" strokeWidth="1.4" fill="none">
                <path d="M0 130 L0 20 M0 130 L110 130" />
                <path d="M0 20 L-7 40 M0 20 L7 40" />
                <path d="M110 130 L90 123 M110 130 L90 137" />
                <rect x="-8" y="122" width="16" height="16" />
                <text x="122" y="139" fill="rgba(226,232,240,0.78)" stroke="none" fontSize="22">X</text>
                <text x="-8" y="0" fill="rgba(226,232,240,0.78)" stroke="none" fontSize="22">Y</text>
              </g>
            </svg>

            <div className="absolute bottom-9 left-1/2 z-10 flex h-9 w-[62%] -translate-x-1/2 items-center border border-[#5f6f7c] bg-[#1d2a35]/95 px-3 text-xs text-slate-100">
              <Terminal className="mr-2 h-3.5 w-3.5" />
              <span className="mr-2 text-slate-400">Command:</span>
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && executeCommand()}
                placeholder="L R C PL A G D T, M Y O SC X W F 20 I, Z/ZOOM FIT, PAN 100 0, LAYOUT Skica_500A4, DXF, IMPORT"
                className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button onClick={executeCommand} className="ml-2 rounded border border-[#607181] px-2 py-1 text-[10px] hover:bg-[#40515f]">
                Enter
              </button>
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 flex h-8 items-center justify-between border-t border-[#354653] bg-[#2e3d49] px-2 text-[11px]">
              <div className="flex h-full min-w-0 items-center gap-1">
                <div className="flex h-full max-w-[58vw] shrink-0 items-center gap-1 overflow-x-auto">
                  {layoutTabs.map((layout) => (
                    <button
                      key={layout.name}
                      onClick={() => selectLayout(layout.name)}
                      className={cn(
                        "h-full shrink-0 border-x border-[#263642] px-4 font-semibold text-slate-300 hover:bg-[#40515f]",
                        activeLayout.name === layout.name && "bg-[#4d5c68] text-white",
                      )}
                      title={`${layout.name}${layout.media ? ` / ${layout.media}` : ""}${layout.styleSheet ? ` / ${layout.styleSheet}` : ""}`}
                    >
                      {layout.name}
                    </button>
                  ))}
                </div>
                <span className="truncate px-2 text-slate-300">{log}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {[
                  [MousePointer2, tool === "select", () => selectTool("select")],
                  [Crosshair, osnapOn, () => setOsnapOn((v) => !v)],
                  [Move, tool === "move", () => selectTool("move")],
                  [Ruler, orthoOn, () => setOrthoOn((v) => !v)],
                  [Layers, true, () => addLog(`Aktivni layer: ${activeLayer?.name}`)],
                  [Square, tool === "rect", () => selectTool("rect")],
                  [TriangleRight, tool === "polyline", () => selectTool("polyline")],
                  [ZoomOut, false, zoomOutView],
                  [Maximize2, false, zoomFit],
                  [ZoomIn, false, zoomInView],
                ].map(([Icon, active, onClick], index) => {
                  const I = Icon as typeof MousePointer2;
                  return (
                    <ToolbarButton key={index} active={Boolean(active)} onClick={onClick as () => void}>
                      <I className="h-3.5 w-3.5" />
                    </ToolbarButton>
                  );
                })}
                <span className="ml-2 text-slate-300">millimeters</span>
              </div>
            </div>

            <div className="absolute left-4 top-12 z-10 flex gap-2">
              {quickLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 items-center gap-1 border border-[#607181] bg-[#26333f] px-2 text-[11px] hover:bg-[#40515f]"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
              <a href="/geohr/GeoHR_upute.pdf" target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 border border-[#607181] bg-[#26333f] px-2 text-[11px] hover:bg-[#40515f]">
                GeoHR upute
                <ExternalLink className="h-3 w-3" />
              </a>
              <button onClick={exportCurrentDxf} className="inline-flex h-7 items-center gap-1 border border-[#607181] bg-[#26333f] px-2 text-[11px] hover:bg-[#40515f]">
                DXF/DWG
                <Download className="h-3 w-3" />
              </button>
              <button onClick={() => dxfRef.current?.click()} className="inline-flex h-7 items-center gap-1 border border-blue-500/60 bg-blue-600/70 px-2 text-[11px] font-semibold text-white hover:bg-blue-500">
                Ucitaj CAD
                <Upload className="h-3 w-3" />
              </button>
              {skicaTemplate && (
                <button onClick={() => applyDwgTemplate(skicaTemplate, true)} className="inline-flex h-7 items-center gap-1 border border-emerald-500/50 bg-emerald-700/65 px-2 text-[11px] font-semibold text-white hover:bg-emerald-600">
                  Skica 500
                </button>
              )}
              {kkpTemplate && (
                <button onClick={() => applyDwgTemplate(kkpTemplate, true)} className="inline-flex h-7 items-center gap-1 border border-amber-500/50 bg-amber-700/65 px-2 text-[11px] font-semibold text-white hover:bg-amber-600">
                  KKP ZK 500
                </button>
              )}
            </div>

            <div className="absolute left-4 top-24 z-10 max-h-[62vh] w-[460px] overflow-y-auto rounded border border-[#425360] bg-[#121d26]/85 p-3 text-xs text-slate-300">
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-100">
                <Search className="h-3.5 w-3.5 text-cyan-300" />
                CAD import i DWG predlosci
              </div>
              <div className="mb-2 border border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 text-[11px] leading-4 text-cyan-100">
                {importStatus}
              </div>
              {!CAD_CONVERTER_URL && (
                <div className="mb-2 border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-4 text-amber-100">
                  Pravi DWG import trazi poseban converter servis. Bez toga browser moze sigurno otvoriti DXF, a DWG predlosci samo postavljaju layere/layout-e.
                </div>
              )}
              <div className="grid grid-cols-1 gap-2">
                {dwgTemplatePresets.map((template) => {
                  const plotStyle = template.layouts.find((layout) => layout.styleSheet)?.styleSheet || "bez CTB";
                  const paper = Array.from(new Set(template.layouts.map((layout) => layout.media).filter(Boolean))).join(", ");
                  return (
                    <div key={template.id} className="border border-[#334451] bg-[#1b2833] p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-100">{template.title}</p>
                          <p className="truncate text-[10px] text-slate-500">{template.sourceFile}</p>
                        </div>
                        <span className="shrink-0 rounded bg-[#24394a] px-1.5 py-0.5 text-[10px] text-cyan-200">DWG</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-slate-400">
                        <span>{template.layers.length} layera</span>
                        <span>{template.layouts.length} layouta</span>
                        <span>{template.blocks.length} blokova</span>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-slate-500">{paper || "model"} / {plotStyle}</p>
                      <div className="mt-2 flex gap-1">
                        <button
                          onClick={() => applyDwgTemplate(template)}
                          className="h-7 flex-1 border border-blue-500/50 bg-blue-600/80 px-2 text-[11px] font-semibold text-white hover:bg-blue-500"
                        >
                          Novi crtez
                        </button>
                        <button
                          onClick={() => applyDwgTemplate(template, true)}
                          className="h-7 flex-1 border border-[#607181] bg-[#26333f] px-2 text-[11px] hover:bg-[#40515f]"
                        >
                          Primijeni layer-e
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
