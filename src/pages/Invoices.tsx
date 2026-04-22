import { useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/utils";
import { useCad } from "@/cad/store";
import { exportDXF, importDXF } from "@/cad/dxf";
import { parseCoord } from "@/cad/coords";
import { defaultOsnap, findOSnap } from "@/cad/osnap";
import type { Point, Shape } from "@/cad/types";
import {
  ChevronDown,
  Circle as CircleIcon,
  Crosshair,
  Download,
  ExternalLink,
  FileDown,
  FolderOpen,
  Grid3X3,
  Layers,
  MousePointer2,
  Move,
  PenLine,
  Redo2,
  Ruler,
  Search,
  Settings,
  Square,
  Terminal,
  Trash2,
  TriangleRight,
  Undo2,
  Upload,
  ZoomIn,
} from "lucide-react";

type CadTool = "select" | "line" | "rect" | "circle" | "polyline";

const CANVAS_W = 1800;
const CANVAS_H = 980;
const GRID = 20;

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
  ["DWT template", "5"],
];

const templates = [
  "Digitalna_skica_original.dwt",
  "Prazan_crtez.dwt",
  "Skica_izmjere.dwt",
  "Skica_izmjere_sud.dwt",
  "Terenska_situacija.dwt",
];

const layerTools = ["S1", "SP", "NS", "SN", "C1", "C2", "L1", "L2", "L3", "L4", "L5", "L6", "L7"];

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
  return s.type;
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

function renderShape(
  shape: Shape,
  layerColor: string,
  selected: boolean,
  onSelect: (id: string) => void,
) {
  const stroke = selected ? "#60a5fa" : layerColor;
  const common = {
    stroke,
    strokeWidth: selected ? 3 : 1.6,
    fill: "none",
    vectorEffect: "non-scaling-stroke" as const,
    onMouseDown: (event: MouseEvent) => {
      event.stopPropagation();
      onSelect(shape.id);
    },
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
        onMouseDown={(event) => {
          event.stopPropagation();
          onSelect(shape.id);
        }}
      >
        {shape.text}
      </text>
    );
  }
  return null;
}

const Invoices = () => {
  const dxfRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<SVGSVGElement | null>(null);

  const doc = useCad((s) => s.doc);
  const selectedIds = useCad((s) => s.selectedIds);
  const addShape = useCad((s) => s.addShape);
  const deleteShapes = useCad((s) => s.deleteShapes);
  const clearAll = useCad((s) => s.clearAll);
  const setSelection = useCad((s) => s.setSelection);
  const setActiveLayer = useCad((s) => s.setActiveLayer);
  const loadDoc = useCad((s) => s.loadDoc);
  const undo = useCad((s) => s.undo);
  const redo = useCad((s) => s.redo);

  const [tool, setTool] = useState<CadTool>("select");
  const [pending, setPending] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [command, setCommand] = useState("");
  const [log, setLog] = useState("LINE: klikni prvu i drugu tocku. RECT/CIRCLE rade s dvije tocke. DXF import/export je aktivan.");
  const [gridOn, setGridOn] = useState(true);
  const [osnapOn, setOsnapOn] = useState(true);
  const [orthoOn, setOrthoOn] = useState(false);

  const layerMap = useMemo(() => new Map(doc.layers.map((l) => [l.id, l])), [doc.layers]);
  const visibleShapes = useMemo(
    () => doc.shapes.filter((shape) => layerMap.get(shape.layerId)?.visible !== false),
    [doc.shapes, layerMap],
  );
  const selectedShape = doc.shapes.find((shape) => selectedIds.includes(shape.id)) || null;
  const activeLayer = doc.layers.find((layer) => layer.id === doc.activeLayerId) || doc.layers[0];

  const toWorld = (clientX: number, clientY: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const applySnap = (raw: Point, base = pending[0] || null) => {
    let p = gridOn ? snapGrid(raw) : raw;
    if (osnapOn) {
      const hit = findOSnap(visibleShapes, raw, 18, defaultOsnap);
      if (hit) p = hit.p;
    }
    if (orthoOn && base) {
      const dx = Math.abs(p.x - base.x);
      const dy = Math.abs(p.y - base.y);
      p = dx >= dy ? { x: p.x, y: base.y } : { x: base.x, y: p.y };
    }
    return p;
  };

  const addLog = (message: string) => setLog(message);

  const selectTool = (next: CadTool) => {
    setTool(next);
    setPending([]);
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

  const onCanvasMouseDown = (event: MouseEvent<SVGSVGElement>) => {
    const p = applySnap(toWorld(event.clientX, event.clientY));

    if (tool === "select") {
      const hit = [...visibleShapes].reverse().find((shape) => hitTest(shape, p));
      setSelection(hit ? [hit.id] : []);
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
        setPending([]);
        addLog(`LINE added ${formatPoint(start)} -> ${formatPoint(end)}`);
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

    if (tool === "polyline") {
      setPending((prev) => [...prev, p]);
      addLog(`PL point ${pending.length + 1}: ${formatPoint(p)}. Enter ili dvoklik zavrsava.`);
    }
  };

  const onCanvasMove = (event: MouseEvent<SVGSVGElement>) => {
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
    if (cmd === "S" || cmd === "SELECT") return setAndLog("select");
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
    if (cmd === "DXF" || cmd === "EXPORT") {
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

  const importDxf = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { layers, shapes } = importDXF(String(reader.result || ""), doc.layers);
        loadDoc({ ...doc, layers, shapes });
        addLog(`DXF import: ${file.name}, ${shapes.length} objekata.`);
      } catch {
        addLog("DXF import nije uspio.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const previewShape = () => {
    if (!cursor || !pending.length) return null;
    const a = pending[0];
    const stroke = "#facc15";
    if (tool === "line") return <line x1={a.x} y1={a.y} x2={cursor.x} y2={cursor.y} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" vectorEffect="non-scaling-stroke" />;
    if (tool === "rect") return <rect x={Math.min(a.x, cursor.x)} y={Math.min(a.y, cursor.y)} width={Math.abs(cursor.x - a.x)} height={Math.abs(cursor.y - a.y)} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" fill="none" vectorEffect="non-scaling-stroke" />;
    if (tool === "circle") return <circle cx={a.x} cy={a.y} r={Math.hypot(cursor.x - a.x, cursor.y - a.y)} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" fill="none" vectorEffect="non-scaling-stroke" />;
    if (tool === "polyline") {
      const pts = [...pending, cursor].map((p) => `${p.x},${p.y}`).join(" ");
      return <polyline points={pts} stroke={stroke} strokeWidth={1.4} strokeDasharray="8 8" fill="none" vectorEffect="non-scaling-stroke" />;
    }
    return null;
  };

  return (
    <DashboardLayout noScroll>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#17232d] text-slate-100">
        <input ref={dxfRef} type="file" accept=".dxf" hidden onChange={importDxf} />

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
            <ToolbarButton title="Import DXF" onClick={() => dxfRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 text-cyan-300" />
            </ToolbarButton>
            <ToolbarButton title="Export DXF" onClick={exportCurrentDxf}>
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
            <ToolbarButton title="Select" active={tool === "select"} onClick={() => selectTool("select")}>
              <MousePointer2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Line" active={tool === "line"} onClick={() => selectTool("line")}>
              <PenLine className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Rectangle" active={tool === "rect"} onClick={() => selectTool("rect")}>
              <Square className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Circle" active={tool === "circle"} onClick={() => selectTool("circle")}>
              <CircleIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Polyline" active={tool === "polyline"} onClick={() => selectTool("polyline")}>
              <TriangleRight className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Finish polyline" onClick={finishPolyline}>
              OK
            </ToolbarButton>
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
              <PropertyRow label="Color" value={selectedShape ? layerMap.get(selectedShape.layerId)?.color || "ByLayer" : "ByLayer"} />
              <PropertyRow label="Layer" value={selectedShape ? layerMap.get(selectedShape.layerId)?.name || "0" : activeLayer?.name || "0"} />
              <PropertyRow label="Type" value={selectedShape?.type || tool} />
              <PropertyRow label="Geometry" value={selectedShape ? shapeBounds(selectedShape) : "klikni ili upisi naredbu"} />
              <PropertyRow label="Objects" value={String(doc.shapes.length)} />
              <div className="mt-2 bg-[#273541] px-2 py-1 text-[12px] font-semibold">View</div>
              <PropertyRow label="Cursor" value={formatPoint(cursor)} />
              <PropertyRow label="Snap" value={osnapOn ? "Endpoint/Mid/Center" : "Off"} />
              <PropertyRow label="Grid" value={gridOn ? `${GRID} mm` : "Off"} />
              <PropertyRow label="Ortho" value={orthoOn ? "On" : "Off"} />
              <div className="mt-2 bg-[#273541] px-2 py-1 text-[12px] font-semibold">Layers</div>
              {doc.layers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-[#52616e]/60 px-2 py-1 text-left text-[11px] hover:bg-[#52616e]/50",
                    doc.activeLayerId === layer.id && "bg-[#1f6fb5]/40",
                  )}
                >
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
              className="absolute inset-0 h-full w-full cursor-crosshair"
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMove}
              onDoubleClick={() => tool === "polyline" && finishPolyline()}
              onKeyDown={(event) => {
                if (event.key === "Delete") deleteShapes(selectedIds);
                if (event.key === "Escape") setPending([]);
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
              {gridOn && <rect width="100%" height="100%" fill="url(#cad-grid)" />}
              <g>
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
                placeholder="L, RECT, CIRCLE, PL, TEXT 100,100 opis, DXF, IMPORT, UNDO, ERASE, CLEAR"
                className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button onClick={executeCommand} className="ml-2 rounded border border-[#607181] px-2 py-1 text-[10px] hover:bg-[#40515f]">
                Enter
              </button>
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 flex h-8 items-center justify-between border-t border-[#354653] bg-[#2e3d49] px-2 text-[11px]">
              <div className="flex h-full min-w-0 items-center gap-1">
                <button className="h-full bg-[#4d5c68] px-5 font-semibold text-white">Model</button>
                <span className="truncate px-2 text-slate-300">{log}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {[
                  [MousePointer2, tool === "select", () => selectTool("select")],
                  [Crosshair, osnapOn, () => setOsnapOn((v) => !v)],
                  [Move, false, () => addLog("MOVE dolazi u sljedecoj rundi.")],
                  [Ruler, orthoOn, () => setOrthoOn((v) => !v)],
                  [Layers, true, () => addLog(`Aktivni layer: ${activeLayer?.name}`)],
                  [Square, tool === "rect", () => selectTool("rect")],
                  [TriangleRight, tool === "polyline", () => selectTool("polyline")],
                  [ZoomIn, false, () => addLog("Zoom je trenutno viewBox fit.")],
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
                DXF
                <Download className="h-3 w-3" />
              </button>
            </div>

            <div className="absolute left-4 top-24 z-10 max-w-[420px] rounded border border-[#425360] bg-[#121d26]/80 p-3 text-xs text-slate-300">
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-100">
                <Search className="h-3.5 w-3.5 text-cyan-300" />
                GeoHR template
              </div>
              <div className="grid grid-cols-1 gap-1">
                {templates.map((name) => (
                  <button
                    key={name}
                    onClick={() => addLog(`Template odabran: ${name}. DWT je u GeoHR paketu; web crtez ostaje DXF kompatibilan.`)}
                    className="flex items-center justify-between border border-[#334451] bg-[#1b2833] px-2 py-1 text-left hover:bg-[#263846]"
                  >
                    <span>{name}</span>
                    <span className="text-slate-500">DWT</span>
                  </button>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
