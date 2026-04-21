import type { Point, Shape } from "./types";

export type SnapKind = "endpoint" | "midpoint" | "center" | "intersection" | "perp" | "grid";
export type SnapHit = { p: Point; kind: SnapKind; sourceIds: string[] };

export type OSnapSettings = Record<Exclude<SnapKind, "grid">, boolean>;

export const defaultOsnap: OSnapSettings = {
  endpoint: true,
  midpoint: true,
  center: true,
  intersection: true,
  perp: false,
};

const sqr = (n: number) => n * n;

/** Find best object-snap point near `p` within `tolWorld` (world units). */
export function findOSnap(
  shapes: Shape[],
  p: Point,
  tolWorld: number,
  enabled: OSnapSettings,
): SnapHit | null {
  const candidates: SnapHit[] = [];
  const tol2 = tolWorld * tolWorld;

  // collect endpoints / midpoints / centers
  for (const s of shapes) {
    if (s.type === "line") {
      if (enabled.endpoint) {
        candidates.push({ p: { x: s.x1, y: s.y1 }, kind: "endpoint", sourceIds: [s.id] });
        candidates.push({ p: { x: s.x2, y: s.y2 }, kind: "endpoint", sourceIds: [s.id] });
      }
      if (enabled.midpoint) {
        candidates.push({ p: { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 }, kind: "midpoint", sourceIds: [s.id] });
      }
    } else if (s.type === "rect") {
      const corners: Point[] = [
        { x: s.x, y: s.y }, { x: s.x + s.w, y: s.y },
        { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h },
      ];
      if (enabled.endpoint) for (const c of corners) candidates.push({ p: c, kind: "endpoint", sourceIds: [s.id] });
      if (enabled.midpoint) {
        for (let i = 0; i < 4; i++) {
          const a = corners[i], b = corners[(i + 1) % 4];
          candidates.push({ p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, kind: "midpoint", sourceIds: [s.id] });
        }
      }
      if (enabled.center) candidates.push({ p: { x: s.x + s.w / 2, y: s.y + s.h / 2 }, kind: "center", sourceIds: [s.id] });
    } else if (s.type === "circle") {
      if (enabled.center) candidates.push({ p: { x: s.cx, y: s.cy }, kind: "center", sourceIds: [s.id] });
      if (enabled.endpoint) {
        // quadrants
        candidates.push({ p: { x: s.cx + s.r, y: s.cy }, kind: "endpoint", sourceIds: [s.id] });
        candidates.push({ p: { x: s.cx - s.r, y: s.cy }, kind: "endpoint", sourceIds: [s.id] });
        candidates.push({ p: { x: s.cx, y: s.cy + s.r }, kind: "endpoint", sourceIds: [s.id] });
        candidates.push({ p: { x: s.cx, y: s.cy - s.r }, kind: "endpoint", sourceIds: [s.id] });
      }
    } else if (s.type === "arc") {
      if (enabled.center) candidates.push({ p: { x: s.cx, y: s.cy }, kind: "center", sourceIds: [s.id] });
      if (enabled.endpoint) {
        const sa = (s.startAngle * Math.PI) / 180;
        const ea = (s.endAngle * Math.PI) / 180;
        candidates.push({ p: { x: s.cx + s.r * Math.cos(sa), y: s.cy + s.r * Math.sin(sa) }, kind: "endpoint", sourceIds: [s.id] });
        candidates.push({ p: { x: s.cx + s.r * Math.cos(ea), y: s.cy + s.r * Math.sin(ea) }, kind: "endpoint", sourceIds: [s.id] });
      }
    } else if (s.type === "polyline") {
      if (enabled.endpoint) for (const pt of s.points) candidates.push({ p: pt, kind: "endpoint", sourceIds: [s.id] });
      if (enabled.midpoint) {
        for (let i = 0; i < s.points.length - 1; i++) {
          const a = s.points[i], b = s.points[i + 1];
          candidates.push({ p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, kind: "midpoint", sourceIds: [s.id] });
        }
      }
    }
  }

  // intersections of lines / polyline-segments / rect-edges (limited to nearby segments)
  if (enabled.intersection) {
    const segs = collectSegments(shapes, p, tolWorld * 8);
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const ip = segIntersect(segs[i], segs[j]);
        if (ip && sqr(ip.x - p.x) + sqr(ip.y - p.y) <= tol2 * 4) {
          candidates.push({ p: ip, kind: "intersection", sourceIds: [segs[i].id, segs[j].id] });
        }
      }
    }
  }

  // pick closest within tolerance, with priority order
  const priority: Record<SnapKind, number> = {
    endpoint: 0, intersection: 1, center: 2, midpoint: 3, perp: 4, grid: 5,
  };
  let best: SnapHit | null = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const d2 = sqr(c.p.x - p.x) + sqr(c.p.y - p.y);
    if (d2 > tol2) continue;
    const score = d2 + priority[c.kind] * 0.0001;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

type Seg = { id: string; a: Point; b: Point };

function collectSegments(shapes: Shape[], near: Point, range: number): Seg[] {
  const out: Seg[] = [];
  const inRange = (p: Point) => Math.abs(p.x - near.x) <= range && Math.abs(p.y - near.y) <= range;
  const push = (id: string, a: Point, b: Point) => {
    if (inRange(a) || inRange(b)) out.push({ id, a, b });
  };
  for (const s of shapes) {
    if (s.type === "line") push(s.id, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
    else if (s.type === "rect") {
      const c = [
        { x: s.x, y: s.y }, { x: s.x + s.w, y: s.y },
        { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h },
      ];
      for (let i = 0; i < 4; i++) push(s.id, c[i], c[(i + 1) % 4]);
    } else if (s.type === "polyline") {
      for (let i = 0; i < s.points.length - 1; i++) push(s.id, s.points[i], s.points[i + 1]);
      if (s.closed && s.points.length > 1) push(s.id, s.points[s.points.length - 1], s.points[0]);
    }
  }
  return out;
}

function segIntersect(s1: Seg, s2: Seg): Point | null {
  const x1 = s1.a.x, y1 = s1.a.y, x2 = s1.b.x, y2 = s1.b.y;
  const x3 = s2.a.x, y3 = s2.a.y, x4 = s2.b.x, y4 = s2.b.y;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / den;
  if (t < -0.001 || t > 1.001 || u < -0.001 || u > 1.001) return null;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}
