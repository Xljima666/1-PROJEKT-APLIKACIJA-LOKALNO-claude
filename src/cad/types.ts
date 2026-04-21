export type ShapeBase = { id: string; layerId: string };

export type LineShape = ShapeBase & { type: "line"; x1: number; y1: number; x2: number; y2: number };
export type RectShape = ShapeBase & { type: "rect"; x: number; y: number; w: number; h: number };
export type CircleShape = ShapeBase & { type: "circle"; cx: number; cy: number; r: number };
export type ArcShape = ShapeBase & {
  type: "arc";
  cx: number;
  cy: number;
  r: number;
  /** degrees, CCW from +X */
  startAngle: number;
  endAngle: number;
};
export type PolylineShape = ShapeBase & { type: "polyline"; points: { x: number; y: number }[]; closed?: boolean };
export type TextShape = ShapeBase & { type: "text"; x: number; y: number; text: string; size: number };
export type DimLinearShape = ShapeBase & {
  type: "dim-linear";
  x1: number; y1: number;
  x2: number; y2: number;
  /** perpendicular offset of the dimension line from the measured segment */
  offset: number;
};

export type Shape = LineShape | RectShape | CircleShape | ArcShape | PolylineShape | TextShape | DimLinearShape;

export type Layer = {
  id: string;
  name: string;
  /** CSS color (oklch or hex) used for stroke */
  color: string;
  visible: boolean;
  locked: boolean;
};

export type CadDoc = {
  version: 1;
  shapes: Shape[];
  layers: Layer[];
  activeLayerId: string;
};

export type Point = { x: number; y: number };
