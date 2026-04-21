import type { Point } from "./types";

/**
 * Parse coordinate input from command line.
 * Formats:
 *   "100,200"   absolute
 *   "@50,0"     relative to last point
 *   "@100<45"   polar relative (length<angleDeg)
 *   "100<45"    polar absolute from origin
 */
export function parseCoord(input: string, last: Point | null): Point | null {
  const s = input.trim().replace(/\s+/g, "");
  if (!s) return null;
  const relative = s.startsWith("@");
  const body = relative ? s.slice(1) : s;

  if (body.includes("<")) {
    const [rs, as] = body.split("<");
    const r = Number(rs);
    const a = (Number(as) * Math.PI) / 180;
    if (!isFinite(r) || !isFinite(a)) return null;
    const dx = r * Math.cos(a);
    const dy = r * Math.sin(a);
    if (relative && last) return { x: last.x + dx, y: last.y + dy };
    return { x: dx, y: dy };
  }

  if (body.includes(",")) {
    const [xs, ys] = body.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (!isFinite(x) || !isFinite(y)) return null;
    if (relative && last) return { x: last.x + x, y: last.y + y };
    return { x, y };
  }

  return null;
}
