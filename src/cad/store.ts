import { create } from "zustand";
import type { CadDoc, Layer, Shape } from "./types";

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultLayers: Layer[] = [
  { id: "l-0", name: "0", color: "oklch(0.97 0.01 250)", visible: true, locked: false },
  { id: "l-walls", name: "ZIDOVI", color: "oklch(0.7 0.18 265)", visible: true, locked: false },
  { id: "l-openings", name: "OTVORI", color: "oklch(0.72 0.16 210)", visible: true, locked: false },
  { id: "l-dims", name: "KOTE", color: "oklch(0.78 0.16 80)", visible: true, locked: false },
  { id: "l-hatch", name: "ŠRAFURE", color: "oklch(0.7 0.18 155)", visible: true, locked: false },
  { id: "l-aux", name: "POMOĆNI", color: "oklch(0.65 0.02 265)", visible: true, locked: false },
];

const seedShapes = (): Shape[] => [
  { id: uid(), type: "rect", layerId: "l-walls", x: 200, y: 120, w: 800, h: 460 },
  { id: uid(), type: "line", layerId: "l-walls", x1: 600, y1: 120, x2: 600, y2: 380 },
  { id: uid(), type: "line", layerId: "l-walls", x1: 200, y1: 380, x2: 600, y2: 380 },
  { id: uid(), type: "circle", layerId: "l-openings", cx: 800, cy: 430, r: 70 },
];

export type CadState = {
  doc: CadDoc;
  selectedIds: string[];
  past: CadDoc[];
  future: CadDoc[];

  // ops
  setDoc: (d: CadDoc, recordHistory?: boolean) => void;
  addShape: (s: Omit<Shape, "id" | "layerId"> & { layerId?: string }) => string;
  updateShape: (id: string, patch: Partial<Shape>) => void;
  deleteShapes: (ids: string[]) => void;
  clearAll: () => void;

  // layers
  addLayer: (name: string) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  setActiveLayer: (id: string) => void;

  // selection
  setSelection: (ids: string[]) => void;

  // history
  undo: () => void;
  redo: () => void;

  // io
  loadDoc: (d: CadDoc) => void;
};

const HISTORY_LIMIT = 50;
const STORAGE_KEY = "stellancad:doc:v1";

function load(): CadDoc {
  if (typeof window === "undefined") return freshDoc();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshDoc();
    const d = JSON.parse(raw) as CadDoc;
    if (d?.version === 1 && Array.isArray(d.shapes) && Array.isArray(d.layers)) return d;
  } catch {
    /* ignore */
  }
  return freshDoc();
}

function freshDoc(): CadDoc {
  return {
    version: 1,
    layers: defaultLayers,
    activeLayerId: "l-walls",
    shapes: seedShapes(),
  };
}

function persist(doc: CadDoc) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* quota */
  }
}

export const useCad = create<CadState>((set, get) => ({
  doc: load(),
  selectedIds: [],
  past: [],
  future: [],

  setDoc: (d, recordHistory = true) => {
    const prev = get().doc;
    set((s) => ({
      doc: d,
      past: recordHistory ? [...s.past.slice(-HISTORY_LIMIT), prev] : s.past,
      future: recordHistory ? [] : s.future,
    }));
    persist(d);
  },

  addShape: (s) => {
    const id = uid();
    const layerId = s.layerId ?? get().doc.activeLayerId;
    const next: CadDoc = {
      ...get().doc,
      shapes: [...get().doc.shapes, { ...(s as Shape), id, layerId }],
    };
    get().setDoc(next);
    return id;
  },

  updateShape: (id, patch) => {
    const next: CadDoc = {
      ...get().doc,
      shapes: get().doc.shapes.map((sh) => (sh.id === id ? ({ ...sh, ...patch } as Shape) : sh)),
    };
    get().setDoc(next);
  },

  deleteShapes: (ids) => {
    if (!ids.length) return;
    const set2 = new Set(ids);
    const next: CadDoc = {
      ...get().doc,
      shapes: get().doc.shapes.filter((s) => !set2.has(s.id)),
    };
    get().setDoc(next);
    set({ selectedIds: [] });
  },

  clearAll: () => {
    const next: CadDoc = { ...get().doc, shapes: [] };
    get().setDoc(next);
    set({ selectedIds: [] });
  },

  addLayer: (name) => {
    const id = "l-" + uid();
    const palette = [
      "oklch(0.7 0.2 30)",
      "oklch(0.72 0.18 110)",
      "oklch(0.7 0.2 200)",
      "oklch(0.7 0.22 320)",
    ];
    const color = palette[get().doc.layers.length % palette.length];
    const next: CadDoc = {
      ...get().doc,
      layers: [...get().doc.layers, { id, name, color, visible: true, locked: false }],
    };
    get().setDoc(next);
  },

  removeLayer: (id) => {
    const doc = get().doc;
    if (doc.layers.length <= 1) return;
    const fallback = doc.layers.find((l) => l.id !== id)!.id;
    const next: CadDoc = {
      ...doc,
      layers: doc.layers.filter((l) => l.id !== id),
      activeLayerId: doc.activeLayerId === id ? fallback : doc.activeLayerId,
      shapes: doc.shapes.map((s) => (s.layerId === id ? { ...s, layerId: fallback } : s)),
    };
    get().setDoc(next);
  },

  updateLayer: (id, patch) => {
    const next: CadDoc = {
      ...get().doc,
      layers: get().doc.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    };
    get().setDoc(next);
  },

  setActiveLayer: (id) => {
    const next: CadDoc = { ...get().doc, activeLayerId: id };
    get().setDoc(next, false);
  },

  setSelection: (ids) => set({ selectedIds: ids }),

  undo: () => {
    const { past, doc, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({
      doc: prev,
      past: past.slice(0, -1),
      future: [doc, ...future].slice(0, HISTORY_LIMIT),
      selectedIds: [],
    });
    persist(prev);
  },

  redo: () => {
    const { past, doc, future } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      doc: next,
      past: [...past, doc].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      selectedIds: [],
    });
    persist(next);
  },

  loadDoc: (d) => {
    set({ past: [], future: [], selectedIds: [] });
    get().setDoc(d, false);
  },
}));
