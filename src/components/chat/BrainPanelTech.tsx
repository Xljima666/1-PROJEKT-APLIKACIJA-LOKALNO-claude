import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { NODE_CATALOG, type BrainNode, type Connection, type NodeTemplate, type NodeRunStatus } from "./brain/types";
import {
  PORT_COLORS,
  NODE_W,
  CANVAS_W,
  CANVAS_H,
  MIN_ZOOM,
  MAX_ZOOM,
  getNodeHeight,
  getPortPos,
  generateId,
  generateConnectionId,
} from "./brain/types";

const FLOW_STORAGE = "stellan_flows";
const AGENT_URL = import.meta.env.VITE_AGENT_SERVER_URL || "";
const AGENT_KEY = import.meta.env.VITE_AGENT_API_KEY || "";
const LEARNING_TO_BRAIN_BRIDGE_KEY = "stellan_learning_to_brain_bridge_v1";

export interface SavedFlow {
  id: string;
  name: string;
  nodes: BrainNode[];
  connections: Connection[];
  savedAt: string;
}

export interface FlowExecutionContext {
  page?: {
    url?: string;
    title?: string;
    selector?: string;
    lastAction?: string;
    fields?: Record<string, string>;
  };
  text?: string;
  image?: string;
  value?: unknown;
  output?: unknown;
  selector?: string;
  url?: string;
  [key: string]: unknown;
}

export interface BrainPanelTechState {
  containerRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  pan: { x: number; y: number };
  vpSize: { w: number; h: number };
  isPanning: boolean;
  nodes: BrainNode[];
  connections: Connection[];
  selectedNode: string | null;
  selectedConnection: string | null;
  selectedNodeData?: BrainNode;
  drawingConn: {
    fromNode: string;
    fromPort: string;
    fromSide: "left" | "right";
    mouseX: number;
    mouseY: number;
  } | null;
  runStatuses: Record<string, NodeRunStatus>;
  isRunning: boolean;
  activeNodes: string[];
  lastRunOutputs: Record<string, FlowExecutionContext>;
  flowName: string;
  showFlowMenu: boolean;
  savedFlows: SavedFlow[];
  connectionPaths: (Connection & { d: string; color: string })[];
  drawingPath: string | null;
}

export interface BrainPanelTechActions {
  setFlowName: (value: string) => void;
  setShowFlowMenu: (value: boolean) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedConnection: (id: string | null) => void;
  updateNodeConfig: (nodeId: string, key: string, value: unknown) => void;
  handleCanvasMouseDown: (e: React.MouseEvent) => void;
  handleNodeMouseDown: (nodeId: string, e: React.MouseEvent) => void;
  handleNodeClick: (nodeId: string, e?: React.MouseEvent) => void;
  handlePortMouseDown: (nodeId: string, portId: string, side: "left" | "right", e: React.MouseEvent) => void;
  handlePortMouseUp: (nodeId: string, portId: string, side: "left" | "right") => void;
  handleAddNode: (tmpl: NodeTemplate, x?: number, y?: number) => void;
  handleDelete: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  handleMinimapNav: (wx: number, wy: number) => void;
  runFlow: () => Promise<void>;
  runSmartAuto: (prompt: string) => Promise<void>;
  stopFlow: () => void;
  resetRun: () => void;
  saveFlow: () => void;
  loadFlow: (flowId: string) => void;
  setNodes: (nodes: BrainNode[]) => void;
  setConnections: (connections: Connection[]) => void;
  replaceFlow: (nodes: BrainNode[], connections: Connection[], flowName?: string) => void;
  importLearningSteps: (steps: any[], flowName?: string) => void;
  importBridgeFromLearning: () => boolean;
}

export interface UseBrainPanelTechResult {
  state: BrainPanelTechState;
  actions: BrainPanelTechActions;
}


function getTemplateByLabel(label: string): NodeTemplate | undefined {
  const all = Object.values(NODE_CATALOG).flat();
  return all.find((t) => t.label.toLowerCase() === label.toLowerCase());
}

function createBrainNodeFromTemplate(template: NodeTemplate, x: number, y: number, config?: Record<string, any>): BrainNode {
  return {
    id: generateId(),
    label: template.label,
    icon: template.icon,
    category: template.category,
    x,
    y,
    ports: template.ports.map((p) => ({ ...p })),
    config: { ...(template.defaultConfig || {}), ...(config || {}) },
  };
}

function convertLearningStepsToBrainFlow(steps: any[]) {
  const nodes: BrainNode[] = [];
  const connections: Connection[] = [];

  const labelForStep = (step: any) => {
    const action = String(step?.action || "").toLowerCase();
    if (action.includes("goto") || action.includes("open") || step?.url) return "Browser Open";
    if (action.includes("fill") || action.includes("type")) return "Fill Input";
    if (action.includes("screenshot")) return "Screenshot";
    if (action.includes("extract")) return "Extract Text";
    return "Click";
  };

  steps.forEach((step, index) => {
    const label = labelForStep(step);
    const template = getTemplateByLabel(label);
    if (!template) return;

    const node = createBrainNodeFromTemplate(
      template,
      280 + index * 320,
      220 + ((index % 2) * 170),
      {
        url: step?.url,
        selector: step?.selector,
        value: step?.value,
        text: step?.text,
        timeout: step?.timeout,
        full_page: step?.full_page,
      },
    );
    nodes.push(node);

    if (nodes.length > 1) {
      const fromNode = nodes[nodes.length - 2];
      const toNode = node;
      const fromPort = fromNode.ports.find((p) => p.side === "right") || fromNode.ports[0];
      const toPort = toNode.ports.find((p) => p.side === "left") || toNode.ports[0];
      if (fromPort && toPort) {
        connections.push({
          id: generateConnectionId(),
          fromNode: fromNode.id,
          fromPort: fromPort.id,
          toNode: toNode.id,
          toPort: toPort.id,
          color: fromPort.color,
        });
      }
    }
  });

  return { nodes, connections };
}

function fallbackStepsFromPrompt(prompt: string) {
  const steps: any[] = [];
  const lower = prompt.toLowerCase();
  const urlMatch = prompt.match(/https?:\/\/[^\s]+/i);

  if (urlMatch) {
    steps.push({ action: "goto", url: urlMatch[0] });
  } else if (lower.includes("oss")) {
    steps.push({ action: "goto", url: "https://oss.uredjenazemlja.hr/" });
  }

  const clickQuoted = prompt.match(/(?:klikni|pritisni)\s+["“]?(.+?)["”]?$/i);
  if (clickQuoted) {
    steps.push({ action: "click", selector: `text=${clickQuoted[1].trim()}` });
  }

  const fillQuoted = prompt.match(/(?:upiši|upisi|unesi)\s+["“](.+?)["”]\s+u\s+["“](.+?)["”]/i);
  if (fillQuoted) {
    steps.push({
      action: "fill",
      selector: `input[placeholder*="${fillQuoted[2].trim()}" i], input[name*="${fillQuoted[2].trim()}" i], textarea[placeholder*="${fillQuoted[2].trim()}" i]`,
      value: fillQuoted[1].trim(),
    });
  }

  if (lower.includes("screenshot") || lower.includes("snimi")) {
    steps.push({ action: "screenshot" });
  }

  if (!steps.length) {
    steps.push({ action: "goto", url: "https://oss.uredjenazemlja.hr/" });
  }

  return steps;
}

async function callAgentJson(endpoint: string, body: Record<string, unknown>) {
  if (!AGENT_URL) throw new Error("VITE_AGENT_SERVER_URL nije postavljen.");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (AGENT_KEY) headers["X-API-Key"] = AGENT_KEY;

  const response = await fetch(`${AGENT_URL}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as any)?.error || `${endpoint} failed (${response.status})`);
  }
  return data as any;
}


function loadFlows(): SavedFlow[] {
  try {
    const raw = localStorage.getItem(FLOW_STORAGE) || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFlows(flows: SavedFlow[]) {
  localStorage.setItem(FLOW_STORAGE, JSON.stringify(flows));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNodeConfigValue(node: BrainNode, ...keys: string[]) {
  for (const key of keys) {
    const value = node.config?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function mergeIncomingPayloads(
  nodeId: string,
  connections: Connection[],
  outputs: Record<string, FlowExecutionContext>,
) {
  const incoming = connections.filter((c) => c.toNode === nodeId);
  const merged: FlowExecutionContext = {};

  for (const conn of incoming) {
    const payload = outputs[conn.fromNode];
    if (!payload) continue;

    Object.assign(merged, payload);

    const sourceValue =
      payload.output ??
      payload.value ??
      payload.text ??
      payload.image ??
      payload.page;

    const sourcePortKey = conn.fromPort.toLowerCase().replace(/\s+/g, "_");
    const targetPortKey = conn.toPort.toLowerCase().replace(/\s+/g, "_");

    merged[sourcePortKey] = sourceValue;
    merged[targetPortKey] = sourceValue;
  }

  return merged;
}

async function callAgentPlaywright(body: Record<string, unknown>) {
  if (!AGENT_URL) {
    throw new Error("VITE_AGENT_SERVER_URL nije postavljen.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };

  if (AGENT_KEY) headers["X-API-Key"] = AGENT_KEY;

  const response = await fetch(`${AGENT_URL}/playwright`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Playwright request failed (${response.status})`);
  }

  return data as any;
}

async function executeNodeWithAgent(
  node: BrainNode,
  input: FlowExecutionContext,
): Promise<FlowExecutionContext> {
  const label = node.label.toLowerCase();

  if (label === "input") {
    const value =
      getNodeConfigValue(node, "value", "text", "input", "prompt") ??
      input.value ??
      input.text ??
      node.label;

    return {
      ...input,
      value,
      output: value,
      text: typeof value === "string" ? value : JSON.stringify(value),
    };
  }

  if (label === "browser open") {
    const url = String(getNodeConfigValue(node, "url") ?? input.url ?? input.value ?? "https://example.com");
    const timeout = Number(getNodeConfigValue(node, "timeout") ?? 45000);

    const data = await callAgentPlaywright({
      action: "navigate",
      url,
      timeout,
    });

    return {
      ...input,
      url,
      page: {
        url: data?.url || url,
        title: data?.title || "Opened page",
        lastAction: "browser_open",
        fields: {},
      },
      output: data?.url || url,
    };
  }

  if (label === "click") {
    const selector = String(
      getNodeConfigValue(node, "selector", "target") ??
      input.selector ??
      input.value ??
      "text=Klikni"
    );
    const timeout = Number(getNodeConfigValue(node, "timeout") ?? 20000);

    const data = await callAgentPlaywright({
      action: "click",
      selector,
      timeout,
    });

    return {
      ...input,
      selector,
      page: {
        ...(input.page as FlowExecutionContext["page"]),
        url: data?.url || (input.page as any)?.url,
        title: data?.title || (input.page as any)?.title,
        selector,
        lastAction: `click:${selector}`,
        fields: (input.page as any)?.fields || {},
      },
      output: data?.message || selector,
    };
  }

  if (label === "fill input") {
    const selector = String(getNodeConfigValue(node, "selector", "target") ?? input.selector ?? "input");
    const value = String(getNodeConfigValue(node, "value", "text") ?? input.value ?? input.text ?? "");
    const timeout = Number(getNodeConfigValue(node, "timeout") ?? 20000);

    const data = await callAgentPlaywright({
      action: "fill",
      selector,
      value,
      timeout,
    });

    const page = (input.page as FlowExecutionContext["page"]) ?? { fields: {} };

    return {
      ...input,
      selector,
      value,
      page: {
        ...page,
        url: data?.url || page.url,
        title: data?.title || page.title,
        lastAction: `fill:${selector}`,
        fields: {
          ...(page.fields ?? {}),
          [selector]: value,
        },
      },
      output: value,
    };
  }

  if (label === "screenshot") {
    const timeout = Number(getNodeConfigValue(node, "timeout") ?? 15000);
    const full_page = Boolean(getNodeConfigValue(node, "full_page") ?? true);

    const data = await callAgentPlaywright({
      action: "screenshot",
      full_page,
      timeout,
    });

    const image = data?.screenshot_base64
      ? String(data.screenshot_base64).startsWith("data:image")
        ? String(data.screenshot_base64)
        : `data:image/png;base64,${String(data.screenshot_base64)}`
      : "screenshot";

    return {
      ...input,
      image,
      page: {
        ...(input.page as FlowExecutionContext["page"]),
        url: data?.url || (input.page as any)?.url,
        title: data?.title || (input.page as any)?.title,
        lastAction: "screenshot",
        fields: (input.page as any)?.fields || {},
      },
      output: image,
    };
  }

  if (label === "extract text") {
    const timeout = Number(getNodeConfigValue(node, "timeout") ?? 15000);

    const data = await callAgentPlaywright({
      action: "extract",
      timeout,
    });

    const text = data?.content || "";

    return {
      ...input,
      text,
      page: {
        ...(input.page as FlowExecutionContext["page"]),
        url: data?.url || (input.page as any)?.url,
        title: data?.title || (input.page as any)?.title,
        lastAction: "extract_text",
        fields: (input.page as any)?.fields || {},
      },
      output: text,
    };
  }

  if (label === "output") {
    const finalOutput =
      input.output ??
      input.value ??
      input.text ??
      input.image ??
      input.page ??
      null;

    return {
      ...input,
      output: finalOutput,
    };
  }

  return {
    ...input,
    output: input.output ?? input.value ?? input.text ?? node.label,
  };
}

export function useBrainPanelTech(activeNodesInput: string[] = []): UseBrainPanelTechResult {
  const [nodes, setNodes] = useState<BrainNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [drawingConn, setDrawingConn] = useState<{
    fromNode: string;
    fromPort: string;
    fromSide: "left" | "right";
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const stopRequestedRef = useRef(false);

  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [vpSize, setVpSize] = useState({ w: 1200, h: 700 });

  const [runStatuses, setRunStatuses] = useState<Record<string, NodeRunStatus>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [activeNodes, setActiveNodes] = useState<string[]>(activeNodesInput);
  const [lastRunOutputs, setLastRunOutputs] = useState<Record<string, FlowExecutionContext>>({});

  const [showFlowMenu, setShowFlowMenu] = useState(false);
  const [flowName, setFlowName] = useState("Untitled Flow");
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>([]);

  const selectedNodeData = useMemo(() => nodes.find((n) => n.id === selectedNode), [nodes, selectedNode]);

  useEffect(() => {
    setSavedFlows(loadFlows());
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setVpSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;

      setZoom((prev) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * delta));
        const ratio = next / prev;
        setPan((p) => ({
          x: mx - ratio * (mx - p.x),
          y: my - ratio * (my - p.y),
        }));
        return next;
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      e.button === 1 ||
      (e.button === 0 && (e.target === containerRef.current || target.dataset?.canvas))
    ) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    }

    setSelectedNode(null);
    setSelectedConnection(null);
  }, [pan.x, pan.y]);

  useEffect(() => {
    if (!isPanning) return;

    const move = (e: MouseEvent) => {
      setPan({
        x: panStart.current.px + e.clientX - panStart.current.x,
        y: panStart.current.py + e.clientY - panStart.current.y,
      });
    };

    const up = () => setIsPanning(false);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [isPanning]);

  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const wx = (e.clientX - rect.left - pan.x) / zoom;
    const wy = (e.clientY - rect.top - pan.y) / zoom;
    dragOffset.current = { x: wx - node.x, y: wy - node.y };
    setDraggingNode(nodeId);
  }, [nodes, pan.x, pan.y, zoom]);

  useEffect(() => {
    if (!draggingNode) return;

    const move = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const wx = (e.clientX - rect.left - pan.x) / zoom;
      const wy = (e.clientY - rect.top - pan.y) / zoom;

      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNode
            ? { ...n, x: Math.max(0, wx - dragOffset.current.x), y: Math.max(0, wy - dragOffset.current.y) }
            : n
        )
      );
    };

    const up = () => setDraggingNode(null);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [draggingNode, pan.x, pan.y, zoom]);

  const handlePortMouseDown = useCallback((
    nodeId: string,
    portId: string,
    side: "left" | "right",
    e: React.MouseEvent
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDrawingConn({
      fromNode: nodeId,
      fromPort: portId,
      fromSide: side,
      mouseX: (e.clientX - rect.left - pan.x) / zoom,
      mouseY: (e.clientY - rect.top - pan.y) / zoom,
    });
  }, [pan.x, pan.y, zoom]);

  const handlePortMouseUp = useCallback((
    nodeId: string,
    portId: string,
    side: "left" | "right"
  ) => {
    if (!drawingConn || drawingConn.fromNode === nodeId) {
      setDrawingConn(null);
      return;
    }

    const isFromRight = drawingConn.fromSide === "right";
    const fromNode = isFromRight ? drawingConn.fromNode : nodeId;
    const fromPort = isFromRight ? drawingConn.fromPort : portId;
    const toNode = isFromRight ? nodeId : drawingConn.fromNode;
    const toPort = isFromRight ? portId : drawingConn.fromPort;

    const sourceNode = nodes.find((n) => n.id === fromNode);
    const sourcePort = sourceNode?.ports.find((p) => p.id === fromPort);

    const exists = connections.some(
      (c) =>
        c.fromNode === fromNode &&
        c.fromPort === fromPort &&
        c.toNode === toNode &&
        c.toPort === toPort
    );

    if (!exists) {
      setConnections((prev) => [
        ...prev,
        {
          id: generateConnectionId(),
          fromNode,
          fromPort,
          toNode,
          toPort,
          color: sourcePort?.color || "blue",
        },
      ]);
    }

    setDrawingConn(null);
  }, [connections, drawingConn, nodes]);

  useEffect(() => {
    if (!drawingConn) return;

    const move = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setDrawingConn((prev) =>
        prev
          ? {
              ...prev,
              mouseX: (e.clientX - rect.left - pan.x) / zoom,
              mouseY: (e.clientY - rect.top - pan.y) / zoom,
            }
          : null
      );
    };

    const up = () => setDrawingConn(null);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drawingConn, pan.x, pan.y, zoom]);

  const connectionPaths = useMemo(() => {
    return connections
      .map((conn) => {
        const fn = nodes.find((n) => n.id === conn.fromNode);
        const tn = nodes.find((n) => n.id === conn.toNode);
        if (!fn || !tn) return null;

        const from = getPortPos(fn, conn.fromPort);
        const to = getPortPos(tn, conn.toPort);
        const dx = Math.abs(to.x - from.x) * 0.5;
        const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;

        return {
          ...conn,
          d,
          color: PORT_COLORS[conn.color] || "#666",
        };
      })
      .filter(Boolean) as (Connection & { d: string; color: string })[];
  }, [connections, nodes]);

  const drawingPath = useMemo(() => {
    if (!drawingConn) return null;

    const srcNode = nodes.find((n) => n.id === drawingConn.fromNode);
    if (!srcNode) return null;

    const from = getPortPos(srcNode, drawingConn.fromPort);
    const to = { x: drawingConn.mouseX, y: drawingConn.mouseY };
    const dx = Math.abs(to.x - from.x) * 0.4;

    return drawingConn.fromSide === "right"
      ? `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
      : `M ${from.x} ${from.y} C ${from.x - dx} ${from.y}, ${to.x + dx} ${to.y}, ${to.x} ${to.y}`;
  }, [drawingConn, nodes]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z * 1.2));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z / 1.2));
  }, []);

  const fitToScreen = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (nodes.length === 0) {
      setZoom(0.85);
      setPan({ x: 50, y: 50 });
      return;
    }

    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 50;
    const minY = Math.min(...ys) - 50;
    const maxX = Math.max(...xs) + NODE_W + 50;
    const maxY = Math.max(...ys.map((y, i) => y + getNodeHeight(nodes[i]))) + 50;

    const fw = rect.width / (maxX - minX);
    const fh = rect.height / (maxY - minY);
    const z = Math.min(fw, fh, 1.5) * 0.9;

    setZoom(z);
    setPan({
      x: (rect.width - (maxX - minX) * z) / 2 - minX * z,
      y: (rect.height - (maxY - minY) * z) / 2 - minY * z,
    });
  }, [nodes]);

  const handleMinimapNav = useCallback((wx: number, wy: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setPan({
      x: -(wx * zoom - rect.width / 2),
      y: -(wy * zoom - rect.height / 2),
    });
  }, [zoom]);

  const handleAddNode = useCallback((tmpl: NodeTemplate, x?: number, y?: number) => {
    const newNode: BrainNode = {
      id: generateId(),
      label: tmpl.label,
      icon: tmpl.icon,
      category: tmpl.category,
      x: x ?? 400 + Math.random() * 200,
      y: y ?? 200 + Math.random() * 200,
      ports: tmpl.ports.map((p) => ({ ...p })),
      config: tmpl.defaultConfig ? { ...tmpl.defaultConfig } : {},
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNode(newNode.id);
    setSelectedConnection(null);
  }, []);

  const updateNodeConfig = useCallback((nodeId: string, key: string, value: unknown) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? { ...node, config: { ...(node.config || {}), [key]: value } }
          : node
      )
    );
  }, []);

  const handleDelete = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    const tag = activeElement?.tagName?.toLowerCase();
    const isTyping = tag === "input" || tag === "textarea" || activeElement?.isContentEditable;

    if (isTyping) return;

    if (selectedConnection) {
      setConnections((prev) => prev.filter((c) => c.id !== selectedConnection));
      setSelectedConnection(null);
      return;
    }

    if (selectedNode) {
      setConnections((prev) => prev.filter((c) => c.fromNode !== selectedNode && c.toNode !== selectedNode));
      setNodes((prev) => prev.filter((n) => n.id !== selectedNode));
      setSelectedNode(null);
    }
  }, [selectedConnection, selectedNode]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") handleDelete();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleDelete]);
  const executeGraph = useCallback(async (
    graphNodes: BrainNode[],
    graphConnections: Connection[],
    nextFlowName?: string,
  ) => {
    stopRequestedRef.current = false;
    setIsRunning(true);
    setActiveNodes([]);
    if (nextFlowName) setFlowName(nextFlowName);

    const statuses: Record<string, NodeRunStatus> = {};
    const outputs: Record<string, FlowExecutionContext> = {};

    graphNodes.forEach((n) => {
      statuses[n.id] = { nodeId: n.id, status: "idle" };
    });

    setRunStatuses({ ...statuses });
    setLastRunOutputs({});

    const depsMap = new Map<string, string[]>();
    const outgoingMap = new Map<string, string[]>();

    graphNodes.forEach((n) => {
      depsMap.set(n.id, graphConnections.filter((c) => c.toNode === n.id).map((c) => c.fromNode));
      outgoingMap.set(n.id, graphConnections.filter((c) => c.fromNode === n.id).map((c) => c.toNode));
    });

    const ready = graphNodes.filter((n) => (depsMap.get(n.id) || []).length === 0).map((n) => n.id);
    const completed = new Set<string>();
    const failed = new Set<string>();

    while (ready.length > 0 && !stopRequestedRef.current) {
      const nodeId = ready.shift()!;
      const node = graphNodes.find((n) => n.id === nodeId);
      if (!node || completed.has(nodeId) || failed.has(nodeId)) continue;

      const input = mergeIncomingPayloads(nodeId, graphConnections, outputs);

      statuses[nodeId] = {
        nodeId,
        status: "running",
        startedAt: Date.now(),
      };

      setRunStatuses({ ...statuses });
      setActiveNodes([nodeId]);

      try {
        await sleep(120);
        const result = await executeNodeWithAgent(node, input);
        outputs[nodeId] = result;

        statuses[nodeId] = {
          nodeId,
          status: "success",
          startedAt: statuses[nodeId].startedAt,
          duration: Date.now() - (statuses[nodeId].startedAt || 0),
          output:
            typeof result.output === "string"
              ? result.output
              : result.output !== undefined
              ? JSON.stringify(result.output)
              : "OK",
        };

        completed.add(nodeId);
      } catch (error) {
        statuses[nodeId] = {
          nodeId,
          status: "error",
          startedAt: statuses[nodeId].startedAt,
          duration: Date.now() - (statuses[nodeId].startedAt || 0),
          error: error instanceof Error ? error.message : "Execution failed",
        };

        failed.add(nodeId);
      }

      setRunStatuses({ ...statuses });
      setLastRunOutputs({ ...outputs });
      setActiveNodes([]);

      const nextIds = outgoingMap.get(nodeId) || [];
      for (const nextId of nextIds) {
        if (completed.has(nextId) || failed.has(nextId) || ready.includes(nextId)) continue;

        const deps = depsMap.get(nextId) || [];
        const allDepsResolved = deps.every((depId) => completed.has(depId));
        const anyDepFailed = deps.some((depId) => failed.has(depId));

        if (anyDepFailed) {
          statuses[nextId] = {
            nodeId: nextId,
            status: "skipped",
            error: "Skipped because dependency failed",
          };
          failed.add(nextId);
          setRunStatuses({ ...statuses });
          continue;
        }

        if (allDepsResolved) ready.push(nextId);
      }
    }

    setActiveNodes([]);
    setIsRunning(false);
    return outputs;
  }, []);

  const runFlow = useCallback(async () => {
    await executeGraph(nodes, connections, flowName);
  }, [connections, executeGraph, flowName, nodes]);

  const replaceFlow = useCallback((nextNodes: BrainNode[], nextConnections: Connection[], nextFlowName?: string) => {
    setNodes(nextNodes);
    setConnections(nextConnections);
    if (nextFlowName) setFlowName(nextFlowName);
    setRunStatuses({});
    setLastRunOutputs({});
    setSelectedNode(nextNodes[0]?.id || null);
    setSelectedConnection(null);
    setTimeout(() => {
      fitToScreen();
    }, 50);
  }, [fitToScreen]);

  const importLearningSteps = useCallback((steps: any[], nextFlowName?: string) => {
    const converted = convertLearningStepsToBrainFlow(steps);
    replaceFlow(converted.nodes, converted.connections, nextFlowName || "Learning Flow");
  }, [replaceFlow]);

  const importBridgeFromLearning = useCallback(() => {
    try {
      const raw = localStorage.getItem(LEARNING_TO_BRAIN_BRIDGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.steps) || parsed.steps.length === 0) return false;
      importLearningSteps(parsed.steps, parsed.flowName || "Learning Flow");
      return true;
    } catch {
      return false;
    }
  }, [importLearningSteps]);

  const runSmartAuto = useCallback(async (prompt: string) => {
    let steps: any[] = [];
    try {
      const generated = await callAgentJson("ai/generate_flow", { prompt });
      if (generated?.success && Array.isArray(generated.steps) && generated.steps.length > 0) {
        steps = generated.steps;
      }
    } catch {
      // fallback below
    }

    if (!steps.length) {
      steps = fallbackStepsFromPrompt(prompt);
    }

    if (!steps.some((s) => String(s?.action || "").toLowerCase().includes("screenshot"))) {
      steps.push({ action: "screenshot", full_page: true });
    }

    const converted = convertLearningStepsToBrainFlow(steps);
    replaceFlow(converted.nodes, converted.connections, "Smart Auto");
    await executeGraph(converted.nodes, converted.connections, "Smart Auto");
  }, [executeGraph, replaceFlow]);

  const stopFlow = useCallback(() => {
    stopRequestedRef.current = true;
    setIsRunning(false);
    setActiveNodes([]);
  }, []);

  const resetRun = useCallback(() => {
    stopRequestedRef.current = false;
    setIsRunning(false);
    setRunStatuses({});
    setActiveNodes([]);
    setLastRunOutputs({});
  }, []);

  const saveFlow = useCallback(() => {
    const flows = loadFlows();
    const existing = flows.findIndex((f) => f.name === flowName);

    const flow: SavedFlow = {
      id: existing >= 0 ? flows[existing].id : generateId(),
      name: flowName,
      nodes,
      connections,
      savedAt: new Date().toISOString(),
    };

    if (existing >= 0) flows[existing] = flow;
    else flows.push(flow);

    saveFlows(flows);
    setSavedFlows(flows);
    setShowFlowMenu(false);
  }, [connections, flowName, nodes]);

  const loadFlow = useCallback((flowId: string) => {
    const flow = savedFlows.find((f) => f.id === flowId);
    if (!flow) return;

    setFlowName(flow.name);
    setNodes(flow.nodes || []);
    setConnections(flow.connections || []);
    setRunStatuses({});
    setLastRunOutputs({});
    setSelectedNode(null);
    setSelectedConnection(null);
    setShowFlowMenu(false);

    setTimeout(() => {
      fitToScreen();
    }, 50);
  }, [fitToScreen, savedFlows]);

  const handleNodeClick = useCallback((nodeId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedNode(nodeId);
    setSelectedConnection(null);
  }, []);

  return {
    state: {
      containerRef,
      zoom,
      pan,
      vpSize,
      isPanning,
      nodes,
      connections,
      selectedNode,
      selectedConnection,
      selectedNodeData,
      drawingConn,
      runStatuses,
      isRunning,
      activeNodes,
      lastRunOutputs,
      flowName,
      showFlowMenu,
      savedFlows,
      connectionPaths,
      drawingPath,
    },
    actions: {
      setFlowName,
      setShowFlowMenu,
      setSelectedNode,
      setSelectedConnection,
      updateNodeConfig,
      handleCanvasMouseDown,
      handleNodeMouseDown,
      handleNodeClick,
      handlePortMouseDown,
      handlePortMouseUp,
      handleAddNode,
      handleDelete,
      zoomIn,
      zoomOut,
      fitToScreen,
      handleMinimapNav,
      runFlow,
      runSmartAuto,
      stopFlow,
      resetRun,
      saveFlow,
      loadFlow,
      setNodes,
      setConnections,
      replaceFlow,
      importLearningSteps,
      importBridgeFromLearning,
    },
  };
}

export const BRAIN_CANVAS = {
  width: CANVAS_W,
  height: CANVAS_H,
};
