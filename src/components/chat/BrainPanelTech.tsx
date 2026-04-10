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

export interface BrainPanelTechState {
  // canvas refs / viewport
  containerRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  pan: { x: number; y: number };
  vpSize: { w: number; h: number };
  isPanning: boolean;

  // graph state
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

  // run state
  runStatuses: Record<string, NodeRunStatus>;
  isRunning: boolean;
  activeNodes: string[];

  // flow state
  flowName: string;
  showFlowMenu: boolean;
  savedFlows: SavedFlow[];

  // derived
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

  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [vpSize, setVpSize] = useState({ w: 1200, h: 700 });

  const [runStatuses, setRunStatuses] = useState<Record<string, NodeRunStatus>>({});
  const [isRunning, setIsRunning] = useState(false);

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
    setIsRunning(true);

    const statuses: Record<string, NodeRunStatus> = {};
    nodes.forEach((n) => {
      statuses[n.id] = { nodeId: n.id, status: "idle" };
    });
    setRunStatuses({ ...statuses });

    const visited = new Set<string>();
    const queue = nodes
      .filter((n) => !connections.some((c) => c.toNode === n.id))
      .map((n) => n.id);

    if (queue.length === 0 && nodes.length > 0) queue.push(nodes[0].id);

    const process = async (id: string) => {
      if (visited.has(id) || !isRunning) return;
      visited.add(id);

      statuses[id] = {
        nodeId: id,
        status: "running",
        startedAt: Date.now(),
      };
      setRunStatuses({ ...statuses });

      await new Promise((r) => setTimeout(r, 400 + Math.random() * 800));

      const success = Math.random() > 0.1;
      statuses[id] = {
        nodeId: id,
        status: success ? "success" : "error",
        startedAt: statuses[id].startedAt,
        duration: Date.now() - (statuses[id].startedAt || 0),
        output: success ? "OK" : undefined,
        error: success ? undefined : "Simulated error",
      };
      setRunStatuses({ ...statuses });

      if (success) {
        const next = connections
          .filter((c) => c.fromNode === id)
          .map((c) => c.toNode);

        for (const nid of next) {
          await process(nid);
        }
      }
    };

    for (const id of queue) {
      await process(id);
    }

    setIsRunning(false);
  }, [connections, isRunning, nodes]);

  const stopFlow = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resetRun = useCallback(() => {
    setIsRunning(false);
    setRunStatuses({});
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
      activeNodes: activeNodesInput,
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
