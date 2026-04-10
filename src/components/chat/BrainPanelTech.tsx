import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { BrainNode, Connection, NodeTemplate, NodeRunStatus } from "./brain/types";
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
  stopFlow: () => void;
  resetRun: () => void;

  saveFlow: () => void;
  loadFlow: (flowId: string) => void;
}

export interface UseBrainPanelTechResult {
  state: BrainPanelTechState;
  actions: BrainPanelTechActions;
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

async function executeNodePhase1(
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
    const url =
      String(getNodeConfigValue(node, "url") ?? input.url ?? input.value ?? "https://example.com");
    return {
      ...input,
      page: {
        url,
        title: "Opened page",
        lastAction: "browser_open",
        fields: {},
      },
      output: url,
    };
  }

  if (label === "click") {
    const selector = String(
      getNodeConfigValue(node, "selector", "target") ??
        input.selector ??
        input.value ??
        "button"
    );
    return {
      ...input,
      page: {
        ...(input.page as FlowExecutionContext["page"]),
        selector,
        lastAction: `click:${selector}`,
      },
      output: selector,
    };
  }

  if (label === "fill input") {
    const selector = String(getNodeConfigValue(node, "selector", "target") ?? input.selector ?? "input");
    const value = String(getNodeConfigValue(node, "value", "text") ?? input.value ?? input.text ?? "");
    const page = (input.page as FlowExecutionContext["page"]) ?? { fields: {} };

    return {
      ...input,
      page: {
        ...page,
        lastAction: `fill:${selector}`,
        fields: {
          ...(page.fields ?? {}),
          [selector]: value,
        },
      },
      value,
      output: value,
    };
  }

  if (label === "screenshot") {
    const page = (input.page as FlowExecutionContext["page"]) ?? {};
    const image = `Screenshot(${page.url ?? "page"})`;
    return {
      ...input,
      image,
      output: image,
    };
  }

  if (label === "extract text") {
    const selector = String(getNodeConfigValue(node, "selector", "target") ?? input.selector ?? "body");
    const text = `Extracted text from ${selector}`;
    return {
      ...input,
      text,
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

  // Fallback for other nodes in phase 1:
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

  const selectedNodeData = useMemo(
    () => nodes.find((n) => n.id === selectedNode),
    [nodes, selectedNode]
  );

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
      (e.button === 0 &&
        (e.target === containerRef.current || target.dataset?.canvas))
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
            ? {
                ...n,
                x: Math.max(0, wx - dragOffset.current.x),
                y: Math.max(0, wy - dragOffset.current.y),
              }
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
    const maxY = Math.max(
      ...ys.map((y, i) => y + getNodeHeight(nodes[i]))
    ) + 50;

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

  const handleDelete = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    const tag = activeElement?.tagName?.toLowerCase();
    const isTyping =
      tag === "input" ||
      tag === "textarea" ||
      activeElement?.isContentEditable;

    if (isTyping) return;

    if (selectedConnection) {
      setConnections((prev) => prev.filter((c) => c.id !== selectedConnection));
      setSelectedConnection(null);
      return;
    }

    if (selectedNode) {
      setConnections((prev) =>
        prev.filter((c) => c.fromNode !== selectedNode && c.toNode !== selectedNode)
      );
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

  const runFlow = useCallback(async () => {
    stopRequestedRef.current = false;
    setIsRunning(true);
    setActiveNodes([]);

    const statuses: Record<string, NodeRunStatus> = {};
    const outputs: Record<string, FlowExecutionContext> = {};
    nodes.forEach((n) => {
      statuses[n.id] = { nodeId: n.id, status: "idle" };
    });
    setRunStatuses({ ...statuses });
    setLastRunOutputs({});

    const depsMap = new Map<string, string[]>();
    const outgoingMap = new Map<string, string[]>();

    nodes.forEach((n) => {
      depsMap.set(
        n.id,
        connections.filter((c) => c.toNode === n.id).map((c) => c.fromNode)
      );
      outgoingMap.set(
        n.id,
        connections.filter((c) => c.fromNode === n.id).map((c) => c.toNode)
      );
    });

    const ready = nodes
      .filter((n) => (depsMap.get(n.id) || []).length === 0)
      .map((n) => n.id);

    const completed = new Set<string>();
    const failed = new Set<string>();

    while (ready.length > 0 && !stopRequestedRef.current) {
      const nodeId = ready.shift()!;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || completed.has(nodeId) || failed.has(nodeId)) continue;

      const input = mergeIncomingPayloads(nodeId, connections, outputs);

      statuses[nodeId] = {
        nodeId,
        status: "running",
        startedAt: Date.now(),
      };
      setRunStatuses({ ...statuses });
      setActiveNodes([nodeId]);

      try {
        await sleep(250);
        const result = await executeNodePhase1(node, input);
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
  }, [connections, nodes]);

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

    if (existing >= 0) {
      flows[existing] = flow;
    } else {
      flows.push(flow);
    }

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
      stopFlow,
      resetRun,
      saveFlow,
      loadFlow,
    },
  };
}

export const BRAIN_CANVAS = {
  width: CANVAS_W,
  height: CANVAS_H,
};
