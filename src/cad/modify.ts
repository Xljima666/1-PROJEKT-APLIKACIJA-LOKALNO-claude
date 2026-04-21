import type { CircleShape, LineShape, Point, Shape } from "./types";

const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- OFFSET ---------- */

export function offsetShape(s: Shape, distance: number, side: Point): Shape | null {
  if (s.type === "line") {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy);
    if (!len) return null;
    // unit normal candidates
    const nx = -dy / len, ny = dx / len;
    // pick side that brings line toward `side` point
    const mid = { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
    const sign = (side.x - mid.x) * nx + (side.y - mid.y) * ny >= 0 ? 1 : -1;
    const ox = nx * distance * sign, oy = ny * distance * sign;
    return { ...s, id: uid(), x1: s.x1 + ox, y1: s.y1 + oy, x2: s.x2 + ox, y2: s.y2 + oy };
  }
  if (s.type === "circle") {
    const d = Math.hypot(side.x - s.cx, side.y - s.cy);
    const sign = d > s.r ? 1 : -1;
    const r = s.r + sign * distance;
    if (r <= 0) return null;
    return { ...s, id: uid(), r };
  }
  if (s.type === "rect") {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const sign = side.x < s.x || side.x > s.x + s.w || side.y < s.y || side.y > s.y + s.h ? 1 : -1;
    const d = sign * distance;
    if (s.w + 2 * d <= 0 || s.h + 2 * d <= 0) return null;
    return { ...s, id: uid(), x: cx - (s.w / 2 + d), y: cy - (s.h / 2 + d), w: s.w + 2 * d, h: s.h + 2 * d };
  }
  if (s.type === "polyline") {
    // simple: offset every segment, but here we just translate by perpendicular of average
    return null;
  }
  return null;
}

/* ---------- MIRROR ---------- */

export function mirrorShape(s: Shape, a: Point, b: Point): Shape {
  const ref = (p: Point): Point => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const den = dx * dx + dy * dy || 1;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / den;
    const fx = a.x + t * dx, fy = a.y + t * dy;
    return { x: 2 * fx - p.x, y: 2 * fy - p.y };
  };
  const id = uid();
  if (s.type === "line") {
    const p1 = ref({ x: s.x1, y: s.y1 }), p2 = ref({ x: s.x2, y: s.y2 });
    return { ...s, id, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }
  if (s.type === "rect") {
    const corners = [
      { x: s.x, y: s.y }, { x: s.x + s.w, y: s.y },
      { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h },
    ].map(ref);
    return { id, layerId: s.layerId, type: "polyline", points: corners, closed: true };
  }
  if (s.type === "circle") {
    const c = ref({ x: s.cx, y: s.cy });
    return { ...s, id, cx: c.x, cy: c.y };
  }
  if (s.type === "arc") {
    const c = ref({ x: s.cx, y: s.cy });
    return { ...s, id, cx: c.x, cy: c.y, startAngle: -s.endAngle, endAngle: -s.startAngle };
  }
  if (s.type === "polyline") return { ...s, id, points: s.points.map(ref) };
  if (s.type === "text") { const np = ref({ x: s.x, y: s.y }); return { ...s, id, x: np.x, y: np.y }; }
  if (s.type === "dim-linear") {
    const p1 = ref({ x: s.x1, y: s.y1 }), p2 = ref({ x: s.x2, y: s.y2 });
    return { ...s, id, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }
  return s;
}

/* ---------- TRIM / EXTEND ----------
   Works only for LINE entities (against any line/rect/polyline edge).
   Trim: cut the part of `target` line on the side of `pickPoint`.
   Extend: lengthen `target` toward `pickPoint` until it hits a boundary.
*/

export function trimLine(target: LineShape, boundaries: Shape[], pickPoint: Point): LineShape | null {
  const segs = collectSegs(boundaries).filter((b) => b.id !== target.id);
  const intersections: { t: number; p: Point }[] = [];
  for (const b of segs) {
    const inter = segLineIntersect(target, b);
    if (inter) intersections.push(inter);
  }
  if (!intersections.length) return null;
  const len = Math.hypot(target.x2 - target.x1, target.y2 - target.y1);
  // pickPoint param along the line
  const tPick =
    ((pickPoint.x - target.x1) * (target.x2 - target.x1) +
      (pickPoint.y - target.y1) * (target.y2 - target.y1)) /
    (len * len || 1);
  // find boundaries surrounding pickPoint
  let lo = 0, hi = 1;
  for (const it of intersections) {
    if (it.t < tPick && it.t > lo) lo = it.t;
    if (it.t > tPick && it.t < hi) hi = it.t;
  }
  // remove segment [lo, hi] containing pick → keep the side that is further
  // simplest: keep [lo..tPick] segment is removed, return the other piece
  // Strategy: if both bounds exist, return the larger remaining piece
  const piece = (a: number, b: number) =>
    ({ x1: target.x1 + a * (target.x2 - target.x1), y1: target.y1 + a * (target.y2 - target.y1),
       x2: target.x1 + b * (target.x2 - target.x1), y2: target.y1 + b * (target.y2 - target.y1) });
  const left = lo > 0 ? piece(0, lo) : null;
  const right = hi < 1 ? piece(hi, 1) : null;
  // pick the piece farther from pickPoint
  const dist = (pc: { x1: number; y1: number; x2: number; y2: number }) => {
    const mx = (pc.x1 + pc.x2) / 2, my = (pc.y1 + pc.y2) / 2;
    return Math.hypot(mx - pickPoint.x, my - pickPoint.y);
  };
  const candidates = [left, right].filter(Boolean) as { x1: number; y1: number; x2: number; y2: number }[];
  if (!candidates.length) return null;
  candidates.sort((a, b) => dist(b) - dist(a));
  return { ...target, ...candidates[0] };
}

export function extendLine(target: LineShape, boundaries: Shape[], pickPoint: Point): LineShape | null {
  const dx = target.x2 - target.x1, dy = target.y2 - target.y1;
  const len = Math.hypot(dx, dy);
  if (!len) return null;
  const tPick =
    ((pickPoint.x - target.x1) * dx + (pickPoint.y - target.y1) * dy) / (len * len);
  const towardEnd = tPick > 0.5; // extend the closer endpoint
  const segs = collectSegs(boundaries).filter((b) => b.id !== target.id);
  // Treat target as infinite line, find intersection params with each boundary segment
  let bestT: number | null = null;
  for (const b of segs) {
    const inter = lineLineIntersect(target, b);
    if (!inter) continue;
    if (towardEnd && inter.t > 1 && (bestT === null || inter.t < bestT)) bestT = inter.t;
    if (!towardEnd && inter.t < 0 && (bestT === null || inter.t > bestT)) bestT = inter.t;
  }
  if (bestT === null) return null;
  if (towardEnd) {
    return { ...target, x2: target.x1 + bestT * dx, y2: target.y1 + bestT * dy };
  } else {
    return { ...target, x1: target.x1 + bestT * dx, y1: target.y1 + bestT * dy };
  }
}

/* ---------- helpers ---------- */

type Seg = { id: string; x1: number; y1: number; x2: number; y2: number };

function collectSegs(shapes: Shape[]): Seg[] {
  const out: Seg[] = [];
  for (const s of shapes) {
    if (s.type === "line") out.push({ id: s.id, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 });
    else if (s.type === "rect") {
      const c = [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }];
      for (let i = 0; i < 4; i++) out.push({ id: s.id, x1: c[i].x, y1: c[i].y, x2: c[(i + 1) % 4].x, y2: c[(i + 1) % 4].y });
    } else if (s.type === "polyline") {
      for (let i = 0; i < s.points.length - 1; i++) out.push({ id: s.id, x1: s.points[i].x, y1: s.points[i].y, x2: s.points[i + 1].x, y2: s.points[i + 1].y });
      if (s.closed && s.points.length > 1) {
        const a = s.points[s.points.length - 1], b = s.points[0];
        out.push({ id: s.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
  }
  return out;
}

function segLineIntersect(target: { x1: number; y1: number; x2: number; y2: number }, b: Seg): { t: number; p: Point } | null {
  const r = lineLineIntersect(target, b);
  if (!r) return null;
  if (r.u < -0.001 || r.u > 1.001) return null;
  if (r.t < -0.001 || r.t > 1.001) return null;
  return { t: r.t, p: r.p };
}

function lineLineIntersect(target: { x1: number; y1: number; x2: number; y2: number }, b: Seg): { t: number; u: number; p: Point } | null {
  const x1 = target.x1, y1 = target.y1, x2 = target.x2, y2 = target.y2;
  const x3 = b.x1, y3 = b.y1, x4 = b.x2, y4 = b.y2;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
  return { t, u, p: { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) } };
}

// Re-export so other modules can import single source
export type { LineShape, CircleShape };
