import type { CadDoc, Layer, Shape } from "./types";

const uid = () => Math.random().toString(36).slice(2, 9);

/* =========================
   EXPORT  (minimal AutoCAD 2000-compatible DXF)
   ========================= */

export function exportDXF(doc: CadDoc): string {
  const lines: string[] = [];
  const push = (code: number, value: string | number) => {
    lines.push(String(code));
    lines.push(String(value));
  };

  // HEADER (minimal)
  push(0, "SECTION");
  push(2, "HEADER");
  push(9, "$ACADVER");
  push(1, "AC1015");
  push(0, "ENDSEC");

  // TABLES — layers
  push(0, "SECTION");
  push(2, "TABLES");
  const linetypes = Array.from(new Set(doc.layers.map((l) => normalizeLinetype(l.lineType)).filter(Boolean)));
  push(0, "TABLE");
  push(2, "LTYPE");
  push(70, linetypes.length || 1);
  for (const lineType of linetypes.length ? linetypes : ["CONTINUOUS"]) {
    push(0, "LTYPE");
    push(2, lineType);
    push(70, 0);
    push(3, lineType === "CONTINUOUS" ? "Solid line" : lineType);
    push(72, 65);
    push(73, 0);
    push(40, 0);
  }
  push(0, "ENDTAB");
  push(0, "TABLE");
  push(2, "LAYER");
  push(70, doc.layers.length);
  for (const l of doc.layers) {
    push(0, "LAYER");
    push(2, sanitizeName(l.name));
    push(70, l.locked ? 4 : 0);
    const aci = l.aciColor || layerColorIndex(l.color, doc.layers.indexOf(l));
    push(62, l.visible === false ? -Math.abs(aci) : Math.abs(aci));
    push(6, normalizeLinetype(l.lineType));
    if (typeof l.lineWeight === "number" && l.lineWeight >= 0) push(370, l.lineWeight);
    if (typeof l.plottable === "boolean") push(290, l.plottable ? 1 : 0);
  }
  push(0, "ENDTAB");
  push(0, "ENDSEC");

  // ENTITIES
  push(0, "SECTION");
  push(2, "ENTITIES");

  for (const s of doc.shapes) {
    const layerName = sanitizeName(doc.layers.find((l) => l.id === s.layerId)?.name ?? "0");
    if (s.type === "line") {
      push(0, "LINE");
      push(8, layerName);
      push(10, s.x1); push(20, -s.y1); push(30, 0);
      push(11, s.x2); push(21, -s.y2); push(31, 0);
    } else if (s.type === "rect") {
      // emit as closed LWPOLYLINE
      push(0, "LWPOLYLINE");
      push(8, layerName);
      push(90, 4);
      push(70, 1);
      const pts: [number, number][] = [
        [s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h],
      ];
      for (const [x, y] of pts) { push(10, x); push(20, -y); }
    } else if (s.type === "circle") {
      push(0, "CIRCLE");
      push(8, layerName);
      push(10, s.cx); push(20, -s.cy); push(30, 0);
      push(40, s.r);
    } else if (s.type === "arc") {
      push(0, "ARC");
      push(8, layerName);
      push(10, s.cx); push(20, -s.cy); push(30, 0);
      push(40, s.r);
      // DXF arcs are CCW; we flipped Y so flip angles
      push(50, -s.endAngle);
      push(51, -s.startAngle);
    } else if (s.type === "polyline") {
      push(0, "LWPOLYLINE");
      push(8, layerName);
      push(90, s.points.length);
      push(70, s.closed ? 1 : 0);
      for (const p of s.points) { push(10, p.x); push(20, -p.y); }
    } else if (s.type === "text") {
      push(0, "TEXT");
      push(8, layerName);
      push(10, s.x); push(20, -s.y); push(30, 0);
      push(40, s.size);
      push(1, s.text);
    }
  }

  push(0, "ENDSEC");
  push(0, "EOF");
  return lines.join("\n");
}

/* =========================
   IMPORT
   ========================= */

type Pair = { code: number; value: string };

export function importDXF(text: string, existingLayers: Layer[]): { shapes: Shape[]; layers: Layer[] } {
  const pairs = parsePairs(text);
  const layers: Layer[] = [...existingLayers];
  const layerByName = new Map(layers.map((l) => [l.name.toUpperCase(), l]));

  const ensureLayer = (name: string): Layer => {
    const key = name.toUpperCase();
    const existing = layerByName.get(key);
    if (existing) return existing;
    const palette = [
      "oklch(0.7 0.2 30)",
      "oklch(0.72 0.18 110)",
      "oklch(0.7 0.2 200)",
      "oklch(0.7 0.22 320)",
      "oklch(0.78 0.16 80)",
    ];
    const layer: Layer = {
      id: "l-" + uid(),
      name,
      color: palette[layers.length % palette.length],
      visible: true,
      locked: false,
    };
    layers.push(layer);
    layerByName.set(key, layer);
    return layer;
  };

  const shapes: Shape[] = [];

  let i = 0;
  // walk to ENTITIES section
  while (i < pairs.length) {
    if (pairs[i].code === 2 && pairs[i].value.toUpperCase() === "ENTITIES") {
      i++;
      break;
    }
    i++;
  }

  while (i < pairs.length) {
    const p = pairs[i];
    if (p.code === 0 && p.value.toUpperCase() === "ENDSEC") break;
    if (p.code !== 0) {
      i++;
      continue;
    }
    const type = p.value.toUpperCase();
    const block: Record<number, string[]> = {};
    i++;
    while (i < pairs.length && pairs[i].code !== 0) {
      const cp = pairs[i];
      (block[cp.code] ||= []).push(cp.value);
      i++;
    }
    const layerName = block[8]?.[0] ?? "0";
    const layer = ensureLayer(layerName);
    const num = (code: number, idx = 0) => Number(block[code]?.[idx] ?? "0");

    try {
      if (type === "LINE") {
        shapes.push({
          id: uid(), layerId: layer.id, type: "line",
          x1: num(10), y1: -num(20), x2: num(11), y2: -num(21),
        });
      } else if (type === "CIRCLE") {
        shapes.push({
          id: uid(), layerId: layer.id, type: "circle",
          cx: num(10), cy: -num(20), r: num(40),
        });
      } else if (type === "ARC") {
        const start = num(50);
        const end = num(51);
        shapes.push({
          id: uid(), layerId: layer.id, type: "arc",
          cx: num(10), cy: -num(20), r: num(40),
          // flipped Y: swap & negate
          startAngle: -end, endAngle: -start,
        });
      } else if (type === "LWPOLYLINE" || type === "POLYLINE") {
        const xs = (block[10] ?? []).map(Number);
        const ys = (block[20] ?? []).map((v) => -Number(v));
        const pts = xs.map((x, idx) => ({ x, y: ys[idx] ?? 0 }));
        const flag = num(70);
        if (pts.length >= 2) {
          shapes.push({
            id: uid(), layerId: layer.id, type: "polyline",
            points: pts, closed: (flag & 1) === 1,
          });
        }
      } else if (type === "TEXT" || type === "MTEXT") {
        shapes.push({
          id: uid(), layerId: layer.id, type: "text",
          x: num(10), y: -num(20),
          text: (block[1]?.[0] ?? "").replace(/\\P/g, " "),
          size: num(40) || 20,
        });
      }
    } catch {
      /* skip malformed entity */
    }
  }

  return { shapes, layers };
}

function parsePairs(text: string): Pair[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i]);
    if (!Number.isFinite(code)) continue;
    out.push({ code, value: lines[i + 1] });
  }
  return out;
}

function sanitizeName(n: string) {
  return n.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 31) || "L";
}

function normalizeLinetype(name?: string) {
  return sanitizeName((name || "CONTINUOUS").toUpperCase());
}

function layerColorIndex(_color: string, fallbackIdx: number): number {
  // AutoCAD ACI palette mapping is complex; cycle through nice indices
  const aci = [7, 5, 1, 2, 3, 4, 6, 8, 9];
  return aci[fallbackIdx % aci.length];
}
