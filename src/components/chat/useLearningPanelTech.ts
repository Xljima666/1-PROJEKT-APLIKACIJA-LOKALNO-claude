import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LEARNING_NODE_TYPES, LearningNodeKind } from "./learningNodeTypes";

export interface LearningNodeData {
  id: string;
  kind: LearningNodeKind;
  label: string;
  category: "trigger" | "action" | "input" | "output" | "ai";
  x: number;
  y: number;
  config: Record<string, any>;
}

export interface LearningConnection {
  id: string;
  fromNode: string;
  toNode: string;
  color: string;
}

export interface LearningLog {
  time: string;
  msg: string;
  tone?: "info" | "success" | "error";
}

interface SavedFlowItem {
  id: string;
  name: string;
  savedAt: number;
  source: "local" | "agent";
  nodes?: LearningNodeData[];
  connections?: LearningConnection[];
  steps?: any[];
  agentName?: string;
}

const CANVAS_W = 5200;
const CANVAS_H = 3200;
const NODE_W = 240;
const LOCAL_FLOWS_KEY = "stellan_learning_flows_v2";
const LEARNING_TO_BRAIN_BRIDGE_KEY = "stellan_learning_to_brain_bridge_v1";

function getNodeHeight(node: LearningNodeData) {
  if (node.kind === "screenshot" && node.config?.image) return 240;
  return 118;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function toneFromMessage(msg: string): "info" | "success" | "error" {
  const m = msg.toLowerCase();
  if (m.includes("greška") || m.includes("error") || m.includes("failed")) return "error";
  if (m.includes("✓") || m.includes("saved") || m.includes("started") || m.includes("loaded") || m.includes("success")) return "success";
  return "info";
}

function normalizeSavedAt(value: any) {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function dedupeFlows(items: SavedFlowItem[]) {
  const map = new Map<string, SavedFlowItem>();
  for (const item of items) {
    const key = `${item.source}:${item.id || item.name}`;
    const prev = map.get(key);
    if (!prev || (item.savedAt || 0) > (prev.savedAt || 0)) {
      map.set(key, item);
    }
  }
  return [...map.values()].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

function getInitialStartNode(): LearningNodeData {
  return {
    id: "start_1",
    kind: "start",
    label: "Start",
    category: "trigger",
    x: 220,
    y: 220,
    config: {},
  };
}

export function useLearningPanelTech() {
  const AGENT_URL = (import.meta as any).env?.VITE_AGENT_SERVER_URL || "http://localhost:8432";
  const AGENT_KEY = (import.meta as any).env?.VITE_AGENT_API_KEY || "stellan-agent-2026-v2-x7k9m2p";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [flowName, setFlowName] = useState("Learning Flow");
  const [startUrl, setStartUrl] = useState("https://oss.uredjenazemlja.hr/");
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [nodes, setNodes] = useState<LearningNodeData[]>([getInitialStartNode()]);
  const [connections, setConnections] = useState<LearningConnection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [vpSize, setVpSize] = useState({ w: 1200, h: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [logs, setLogs] = useState<LearningLog[]>([]);
  const [activeNodes, setActiveNodes] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [flowPrompt, setFlowPrompt] = useState("");
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [savedFlows, setSavedFlows] = useState<SavedFlowItem[]>([]);
  const [currentStepLabel, setCurrentStepLabel] = useState("");
  const [lastImprovedCode, setLastImprovedCode] = useState<string>("");

  const dragRef = useRef<{ type: "pan" | "node"; startX: number; startY: number; nodeId?: string; originX?: number; originY?: number; panX?: number; panY?: number } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);

  const log = useCallback((msg: string, tone?: "info" | "success" | "error") => {
    const time = new Date().toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(prev => [...prev.slice(-250), { time, msg, tone: tone || toneFromMessage(msg) }]);
  }, []);

  const rawAgentFetch = useCallback(async (endpoint: string, body?: object, method: "POST" | "GET" = "POST") => {
    if (!AGENT_URL) return null;

    const res = await fetch(`${AGENT_URL}/${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(AGENT_KEY ? { "X-API-Key": AGENT_KEY } : {}),
        "ngrok-skip-browser-warning": "true",
      },
      body: method === "GET" ? undefined : JSON.stringify(body || {}),
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { success: res.ok, raw: text };
    }

    return { ok: res.ok, data };
  }, [AGENT_KEY, AGENT_URL]);

  const callAgent = useCallback(async (endpoint: string, body: object = {}, method: "POST" | "GET" = "POST") => {
    if (!AGENT_URL) {
      log("AGENT_SERVER_URL nije postavljen!", "error");
      return null;
    }

    try {
      const result = await rawAgentFetch(endpoint, body, method);
      if (!result) {
        log("Agent nije dostupan.", "error");
        return null;
      }
      return result.data;
    } catch (e: any) {
      log(`Agent greška: ${e.message}`, "error");
      return null;
    }
  }, [AGENT_URL, log, rawAgentFetch]);

  const saveFlowSnapshot = useCallback((name: string, nextNodes: LearningNodeData[], nextConnections: LearningConnection[]) => {
    const prev = JSON.parse(localStorage.getItem(LOCAL_FLOWS_KEY) || "[]");
    const existing = prev.find((x: any) => x?.name === name);
    const payload = {
      id: existing?.id || uid("flow"),
      name,
      savedAt: Date.now(),
      nodes: nextNodes,
      connections: nextConnections,
    };
    const next = [payload, ...prev.filter((x: any) => x.name !== name)].slice(0, 50);
    localStorage.setItem(LOCAL_FLOWS_KEY, JSON.stringify(next));
    return next;
  }, []);

  const tryLoadRemoteFlows = useCallback(async (): Promise<SavedFlowItem[]> => {
    if (!AGENT_URL) return [];

    const endpoints = [
      "record/list",
      "flows/list",
      "learning/list",
      "recordings/list",
    ];

    for (const endpoint of endpoints) {
      try {
        const result = await rawAgentFetch(endpoint, undefined, "GET");
        const data = result?.data;
        const rawItems = data?.actions || data?.flows || data?.items || data?.recordings || data?.files || [];
        if (!Array.isArray(rawItems) || rawItems.length === 0) continue;

        const mapped = rawItems.map((item: any, index: number) => ({
          id: String(item.id || item.name || item.file || item.path || `${endpoint}_${index}`),
          name: String(item.name || item.flowName || item.file || item.path || `Flow ${index + 1}`),
          savedAt: normalizeSavedAt(item.savedAt || item.updatedAt || item.createdAt || item.mtime),
          source: "agent" as const,
          steps: Array.isArray(item.steps) ? item.steps : undefined,
          agentName: String(item.name || item.flowName || item.file || item.path || ""),
        }));

        return mapped;
      } catch {
        // ignore probe failures
      }
    }

    return [];
  }, [AGENT_URL, rawAgentFetch]);

  const refreshSavedFlows = useCallback(async () => {
    const localItems = JSON.parse(localStorage.getItem(LOCAL_FLOWS_KEY) || "[]").map((x: any) => ({
      id: String(x.id || `local:${x.name}`),
      name: String(x.name || "Learning Flow"),
      savedAt: normalizeSavedAt(x.savedAt),
      source: "local" as const,
      nodes: Array.isArray(x.nodes) ? x.nodes : undefined,
      connections: Array.isArray(x.connections) ? x.connections : undefined,
    }));

    const remoteItems = await tryLoadRemoteFlows();
    setSavedFlows(dedupeFlows([...localItems, ...remoteItems]));
  }, [tryLoadRemoteFlows]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setVpSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!AGENT_URL) return;
    (async () => {
      try {
        const res = await fetch(`${AGENT_URL}/health`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        setAgentOnline(res.ok);
        if (res.ok) log("Agent online ✓", "success");
      } catch {
        setAgentOnline(false);
        log("Agent offline", "error");
      }
    })();
  }, [AGENT_URL, log]);

  useEffect(() => {
    void refreshSavedFlows();
  }, [refreshSavedFlows]);

  const toCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setSelectedNode(nodeId);
    setSelectedConnection(null);
    setDraggingNodeId(nodeId);
    dragRef.current = {
      type: "node",
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      originX: node.x,
      originY: node.y,
    };
  }, [nodes]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node-card='true']")) return;
    setSelectedNode(null);
    setSelectedConnection(null);
    setIsPanning(true);
    dragRef.current = {
      type: "pan",
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  }, [pan]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      if (d.type === "pan") {
        setPan({
          x: (d.panX || 0) + (e.clientX - d.startX),
          y: (d.panY || 0) + (e.clientY - d.startY),
        });
      } else if (d.type === "node" && d.nodeId) {
        const dx = (e.clientX - d.startX) / zoom;
        const dy = (e.clientY - d.startY) / zoom;
        setNodes(prev => prev.map(n => n.id === d.nodeId ? {
          ...n,
          x: Math.max(40, (d.originX || 0) + dx),
          y: Math.max(40, (d.originY || 0) + dy),
        } : n));
      }
    };
    const onUp = () => {
      dragRef.current = null;
      setIsPanning(false);
      setDraggingNodeId(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [zoom]);

  const zoomIn = useCallback(() => setZoom(z => Math.min(1.8, +(z + 0.1).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.35, +(z - 0.1).toFixed(2))), []);
  const fitToScreen = useCallback(() => {
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxX = Math.max(...nodes.map(n => n.x + NODE_W));
    const maxY = Math.max(...nodes.map(n => n.y + getNodeHeight(n)));
    const boxW = maxX - minX + 180;
    const boxH = maxY - minY + 180;
    const nextZoom = Math.max(0.35, Math.min(1.3, Math.min(vpSize.w / boxW, vpSize.h / boxH)));
    setZoom(nextZoom);
    setPan({
      x: (vpSize.w - boxW * nextZoom) / 2 - minX * nextZoom + 90 * nextZoom,
      y: (vpSize.h - boxH * nextZoom) / 2 - minY * nextZoom + 90 * nextZoom,
    });
  }, [nodes, vpSize]);

  const handleMinimapNav = useCallback((x: number, y: number) => {
    setPan({
      x: -(x * zoom) + vpSize.w / 2,
      y: -(y * zoom) + vpSize.h / 2,
    });
  }, [zoom, vpSize]);

  const addNode = useCallback((kind: LearningNodeKind, x?: number, y?: number) => {
    const template = LEARNING_NODE_TYPES[kind];
    const id = uid(kind);
    const node: LearningNodeData = {
      id,
      kind,
      label: template.label,
      category: template.category,
      x: x ?? 240 + nodes.length * 60,
      y: y ?? 200 + (nodes.length % 4) * 150,
      config: { ...template.defaults },
    };
    setNodes(prev => [...prev, node]);
    setSelectedNode(id);
    return node;
  }, [nodes.length]);

  const updateNodeConfig = useCallback((nodeId: string, key: string, value: any) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n));
  }, []);

  const connectSequentially = useCallback((orderedNodes: LearningNodeData[]) => {
    const next: LearningConnection[] = [];
    for (let i = 1; i < orderedNodes.length; i++) {
      next.push({
        id: `conn_${orderedNodes[i - 1].id}_${orderedNodes[i].id}`,
        fromNode: orderedNodes[i - 1].id,
        toNode: orderedNodes[i].id,
        color: LEARNING_NODE_TYPES[orderedNodes[i].kind].color,
      });
    }
    setConnections(next);
  }, []);

  const convertStepsToNodes = useCallback((steps: any[], loadedName?: string) => {
    const mapped: LearningNodeData[] = [getInitialStartNode()];

    steps.forEach((s, i) => {
      let kind: LearningNodeKind = "click";
      const action = String(s.action || "").toLowerCase();
      if (action.includes("goto") || action.includes("open") || action.includes("navigate") || s.url) kind = "goto";
      else if (action.includes("fill") || action.includes("type")) kind = "fill";
      else if (action.includes("screenshot")) kind = "screenshot";
      else if (action.includes("input") || action.includes("press")) kind = "input";

      const template = LEARNING_NODE_TYPES[kind];
      mapped.push({
        id: uid("node"),
        kind,
        label: template.label,
        category: template.category,
        x: 520 + i * 300,
        y: 220 + ((i % 2) * 170),
        config: { ...template.defaults, ...s },
      });
    });

    setFlowName(loadedName || flowName);
    setNodes(mapped);
    connectSequentially(mapped);
    setSelectedNode(mapped[1]?.id || "start_1");
    log(`✓ Flow pretvoren u ${mapped.length - 1} nodeova`, "success");
    setTimeout(() => fitToScreen(), 60);
    return mapped;
  }, [connectSequentially, fitToScreen, flowName, log]);

  const syncPreviewFromAgent = useCallback(async (appendScreenshotNode = false) => {
    const res = await callAgent("preview/current", {}, "GET");
    if (!(res?.success && res.screenshot_base64)) return null;

    const image = `data:image/png;base64,${res.screenshot_base64}`;
    setPreviewImage(image);
    setPreviewTitle(res.title || res.url || "Preview");

    if (appendScreenshotNode) {
      const template = LEARNING_NODE_TYPES.screenshot;
      const node: LearningNodeData = {
        id: uid("preview"),
        kind: "screenshot",
        label: "Preview",
        category: "output",
        x: 520 + nodes.length * 120,
        y: 520,
        config: { ...template.defaults, image, title: res.title || "Preview", url: res.url || "" },
      };
      setNodes(prev => [...prev, node]);
    }

    return image;
  }, [callAgent, nodes.length]);

  const loadPreview = useCallback(async () => {
    const image = await syncPreviewFromAgent(false);
    if (image) {
      log("✓ Preview osvježen", "success");
    } else {
      log("Preview greška: nema slike", "error");
    }
  }, [log, syncPreviewFromAgent]);

  const appendRecordedEventNode = useCallback((evt: any) => {
    const action = String(evt.action || "").toLowerCase();
    let kind: LearningNodeKind = "click";
    if (action === "navigate" || action === "goto" || evt.url) kind = "goto";
    else if (action === "fill" || action === "type") kind = "fill";
    else if (action === "screenshot") kind = "screenshot";
    else if (action === "press" || action === "input") kind = "input";

    const template = LEARNING_NODE_TYPES[kind];
    const newNode: LearningNodeData = {
      id: uid("rec"),
      kind,
      label: template.label,
      category: template.category,
      x: 0,
      y: 0,
      config: { ...template.defaults, ...evt },
    };

    setNodes(prev => {
      const x = 520 + prev.length * 300;
      const y = 220 + ((prev.length % 2) * 170);
      const positioned = { ...newNode, x, y };

      if (prev.length > 0) {
        const fromNode = prev[prev.length - 1];
        setConnections(prevConns => [
          ...prevConns,
          {
            id: `conn_${fromNode.id}_${positioned.id}`,
            fromNode: fromNode.id,
            toNode: positioned.id,
            color: template.color,
          },
        ]);
      }

      return [...prev, positioned];
    });

    log(`🔴 ${kind.toUpperCase()}: ${evt.selector || evt.url || evt.key || ""}`, "info");
  }, [log]);

  const startRecording = useCallback(async (url?: string) => {
    if (isRecordingRef.current) return;
    const targetUrl = url || startUrl || "about:blank";

    setNodes([getInitialStartNode()]);
    setConnections([]);
    setSelectedNode("start_1");
    setSelectedConnection(null);
    setCurrentStepLabel("Pokretanje snimanja...");

    log("Otvaranje browsera...", "info");
    callAgent("playwright", { action: "navigate", url: targetUrl, timeout: 45000 })
      .then(r => log(r?.success ? `✓ Browser otvoren: ${targetUrl}` : `Upozorenje: ${r?.error || ""}`, r?.success ? "success" : "info"))
      .catch(() => {});

    await new Promise(r => setTimeout(r, 2000));
    const res = await callAgent("record/start", { name: flowName || "learning_flow" });
    if (res?.success) {
      setRecording(true);
      isRecordingRef.current = true;
      log("✓ Snimanje pokrenuto. Klikaj u Chromiumu.", "success");

      pollIntervalRef.current = setInterval(async () => {
        if (!isRecordingRef.current) return;
        try {
          const poll = await callAgent("record/poll", {}, "GET");
          if (poll?.new_events?.length > 0) {
            for (const evt of poll.new_events) appendRecordedEventNode(evt);
            await syncPreviewFromAgent(false);
          }
        } catch {
          // ignore poll errors
        }
      }, 1200);
    } else {
      log(`Greška: ${res?.error || "ne mogu pokrenuti učenje"}`, "error");
      setCurrentStepLabel("");
    }
  }, [appendRecordedEventNode, callAgent, flowName, log, startUrl, syncPreviewFromAgent]);

  const stopRecording = useCallback(async () => {
    isRecordingRef.current = false;
    setRecording(false);
    setCurrentStepLabel("");

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    try {
      const poll = await callAgent("record/poll", {}, "GET");
      if (poll?.new_events?.length > 0) {
        for (const evt of poll.new_events) appendRecordedEventNode(evt);
      }
    } catch {
      // ignore final poll errors
    }

    const res = await callAgent("record/stop", {});
    if (res?.success) {
      await callAgent("record/save", { name: flowName || "learning_flow" });
      const snapshotNodes = nodes.length ? nodes : [getInitialStartNode()];
      const nextLocal = saveFlowSnapshot(flowName || "Learning Flow", snapshotNodes, connections);
      setSavedFlows(dedupeFlows(nextLocal.map((x: any) => ({
        id: String(x.id),
        name: String(x.name),
        savedAt: normalizeSavedAt(x.savedAt),
        source: "local" as const,
        nodes: x.nodes,
        connections: x.connections,
      }))));
      await syncPreviewFromAgent(false);
      log(`✓ Snimanje završeno i spremljeno. Koraka: ${res.steps ?? 0}`, "success");
    } else {
      log(`Greška: ${res?.error || "ne mogu zaustaviti učenje"}`, "error");
    }
  }, [appendRecordedEventNode, callAgent, connections, flowName, log, nodes, saveFlowSnapshot, syncPreviewFromAgent]);

  const improveWithAI = useCallback(async () => {
    const flow = nodes.map(n => ({ label: n.label, kind: n.kind, config: n.config }));
    const res = await callAgent("code/clean_playwright", { content: JSON.stringify(flow, null, 2) });
    if (res?.cleaned_content) {
      setLastImprovedCode(res.cleaned_content);
      const aiNode = addNode("ai", 460, 760);
      updateNodeConfig(aiNode.id, "result", res.cleaned_content);
      log("✓ AI poboljšanje generirano i spremno za spremanje. Koristi novi gumb 'Save AI Improve'.", "success");
    } else {
      log(`Greška: ${res?.error || "AI improve nije uspio"}`, "error");
    }
  }, [addNode, callAgent, log, nodes, updateNodeConfig]);

  const saveImprovedCode = useCallback(async () => {
    if (!lastImprovedCode) {
      log("Nema AI poboljšanja. Prvo klikni 'Improve'.", "error");
      return;
    }

    const safeName = `${flowName.replace(/[^a-zA-Z0-9_-]/g, "_")}_ai_improved`;
    const payload = {
      name: safeName,
      code: lastImprovedCode,
      type: "playwright",
      description: `AI-improved version of ${flowName} (generated ${new Date().toLocaleString("hr-HR")})`,
    };

    log(`Spremam AI improve kao akciju: ${safeName}...`, "info");

    const res = await callAgent("actions/save", payload);
    if (res?.success || res?.ok) {
      log(`✓ AI Improve uspješno spremljen kao "${safeName}"`, "success");
      log("Sada ga možeš pokrenuti sa 'run_action(\"" + safeName + "\")' ili novim Run buttonom u Learning tabu.", "success");
    } else {
      // Fallback - local storage
      localStorage.setItem(`ai_improved_${safeName}`, lastImprovedCode);
      log(`✓ AI Improve spremljen lokalno pod imenom "${safeName}"`, "success");
      log("Možeš ga pokrenuti ručno preko Stellana ili proširiti Run Flow da podržava AI kod.", "success");
    }

    await refreshSavedFlows();
  }, [lastImprovedCode, flowName, callAgent, log, refreshSavedFlows]);

  const generateFlowFromPrompt = useCallback(async () => {
    if (!flowPrompt.trim()) return;
    const res = await callAgent("ai/generate_flow", { prompt: flowPrompt });
    if (res?.success && Array.isArray(res.steps)) {
      convertStepsToNodes(res.steps, flowName);
      log("✓ AI flow generiran", "success");
      return;
    }

    const fallbackSteps = [
      { action: "goto", url: "https://oss.uredjenazemlja.hr/" },
      { action: "click", selector: "text=Prijava" },
    ];
    convertStepsToNodes(fallbackSteps, flowName);
    log("AI endpoint nije vratio stepove — ubačen fallback demo flow.", "info");
  }, [callAgent, convertStepsToNodes, flowName, flowPrompt, log]);

  const buildExecutionOrder = useCallback(() => {
    const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
    const startNode = nodes.find(node => node.kind === "start") || nodes[0];
    if (!startNode) return [] as LearningNodeData[];

    if (connections.length === 0) {
      return nodes.filter(node => node.kind !== "start");
    }

    const nextMap = new Map<string, string[]>();
    for (const conn of connections) {
      const list = nextMap.get(conn.fromNode) || [];
      list.push(conn.toNode);
      nextMap.set(conn.fromNode, list);
    }

    for (const [key, list] of nextMap.entries()) {
      list.sort((a, b) => (nodeIndex.get(a) || 0) - (nodeIndex.get(b) || 0));
      nextMap.set(key, list);
    }

    const visited = new Set<string>();
    const orderedIds: string[] = [];
    let currentId: string | undefined = startNode.id;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      orderedIds.push(currentId);
      const next = nextMap.get(currentId)?.[0];
      currentId = next;
    }

    const remaining = nodes
      .filter(node => !visited.has(node.id))
      .sort((a, b) => (nodeIndex.get(a.id) || 0) - (nodeIndex.get(b.id) || 0))
      .map(node => node.id);

    return [...orderedIds, ...remaining]
      .map(id => nodes.find(node => node.id === id))
      .filter((node): node is LearningNodeData => Boolean(node))
      .filter(node => node.kind !== "start");
  }, [connections, nodes]);

  const executeNode = useCallback(async (node: LearningNodeData) => {
    switch (node.kind) {
      case "goto": {
        return await callAgent("playwright", {
          action: "navigate",
          url: node.config?.url,
          timeout: node.config?.timeout || 45000,
        });
      }
      case "click": {
        return await callAgent("playwright", {
          action: "click",
          selector: node.config?.selector,
          timeout: node.config?.timeout || 20000,
        });
      }
      case "fill": {
        return await callAgent("playwright", {
          action: node.config?.value ? "fill" : "type",
          selector: node.config?.selector,
          value: node.config?.value || "",
          text: node.config?.value || "",
          timeout: node.config?.timeout || 20000,
        });
      }
      case "input": {
        if (node.config?.key) {
          return await callAgent("playwright", {
            action: "press",
            key: node.config?.key,
            timeout: node.config?.timeout || 10000,
          });
        }
        if (node.config?.value) {
          return await callAgent("playwright", {
            action: "type",
            text: node.config?.value,
            value: node.config?.value,
            timeout: node.config?.timeout || 10000,
          });
        }
        return { success: true };
      }
      case "screenshot": {
        const direct = await callAgent("playwright", {
          action: "screenshot",
          full_page: node.config?.full_page !== false,
          timeout: node.config?.timeout || 15000,
        });
        if (direct?.success) return direct;
        const preview = await callAgent("preview/current", {}, "GET");
        return preview || { success: false, error: "screenshot nije uspio" };
      }
      case "ai": {
        // Za AI node sa improved code-om — samo logiramo (za sada)
        log(`AI Step: ${node.config?.result?.substring(0, 60)}...`, "success");
        return { success: true };
      }
      default:
        return { success: true };
    }
  }, [callAgent, log]);

  const runFlowAnimated = useCallback(async () => {
    const ordered = buildExecutionOrder();
    if (ordered.length === 0) {
      log("Nema koraka za pokretanje.", "error");
      return;
    }

    setIsRunning(true);
    setCurrentStepLabel("Pokretanje flowa...");
    setActiveNodes([]);

    const nextLocal = saveFlowSnapshot(flowName || "Learning Flow", nodes, connections);
    setSavedFlows(dedupeFlows(nextLocal.map((x: any) => ({
      id: String(x.id),
      name: String(x.name),
      savedAt: normalizeSavedAt(x.savedAt),
      source: "local" as const,
      nodes: x.nodes,
      connections: x.connections,
    }))));

    let hadError = false;

    for (const [index, node] of ordered.entries()) {
      setActiveNodes([node.id]);
      setCurrentStepLabel(`${index + 1}/${ordered.length} · ${node.label}`);
      log(`▶ ${node.label}`, "info");

      const startedAt = Date.now();
      const res = await executeNode(node);
      const duration = Date.now() - startedAt;

      if (!res?.success) {
        hadError = true;
        log(`✗ ${node.label}: ${res?.error || res?.stderr || "korak nije uspio"}`, "error");
        await syncPreviewFromAgent(false);
        break;
      }

      if (node.kind === "screenshot") {
        const previewRes = await callAgent("preview/current", {}, "GET");
        if (previewRes?.success && previewRes.screenshot_base64) {
          const image = `data:image/png;base64,${previewRes.screenshot_base64}`;
          setPreviewImage(image);
          setPreviewTitle(previewRes.title || previewRes.url || "Screenshot");
          setNodes(prev => prev.map(item => item.id === node.id ? {
            ...item,
            config: {
              ...item.config,
              image,
              title: previewRes.title || previewRes.url || "Screenshot",
              url: previewRes.url || "",
            },
          } : item));
        }
      } else {
        await syncPreviewFromAgent(false);
      }

      log(`✓ ${node.label} (${duration} ms)`, "success");
      await new Promise(r => setTimeout(r, 350));
    }

    setActiveNodes([]);
    setIsRunning(false);
    setCurrentStepLabel(hadError ? "Flow zaustavljen na grešci" : "Flow završen");
    if (!hadError) {
      log("✓ Flow izvršen", "success");
    }
  }, [buildExecutionOrder, callAgent, connections, executeNode, flowName, log, nodes, saveFlowSnapshot, syncPreviewFromAgent]);

  const saveFlow = useCallback(async () => {
    const next = saveFlowSnapshot(flowName || "Learning Flow", nodes, connections);
    setSavedFlows(dedupeFlows(next.map((x: any) => ({
      id: String(x.id),
      name: String(x.name),
      savedAt: normalizeSavedAt(x.savedAt),
      source: "local" as const,
      nodes: x.nodes,
      connections: x.connections,
    }))));
    log("✓ Flow spremljen lokalno", "success");
    await refreshSavedFlows();
  }, [connections, flowName, log, nodes, refreshSavedFlows, saveFlowSnapshot]);

  const loadFlow = useCallback(async (id: string) => {
    const found = savedFlows.find(flow => `${flow.source}:${flow.id}` === id || flow.id === id || flow.name === id);
    if (!found) {
      log("Flow nije pronađen.", "error");
      return;
    }

    if (found.source === "local" && found.nodes?.length) {
      setFlowName(found.name || "Learning Flow");
      setNodes(found.nodes || [getInitialStartNode()]);
      setConnections(found.connections || []);
      setSelectedNode(found.nodes?.[1]?.id || found.nodes?.[0]?.id || null);
      setSelectedConnection(null);
      setCurrentStepLabel("");
      log(`✓ Učitan flow: ${found.name}`, "success");
      setTimeout(() => fitToScreen(), 60);
      return;
    }

    if (found.steps?.length) {
      convertStepsToNodes(found.steps, found.name);
      log(`✓ Učitan flow: ${found.name}`, "success");
      return;
    }

    if (found.source === "agent" && found.agentName) {
      const endpoints = ["record/load", "flows/load", "learning/load", "record/get"];
      for (const endpoint of endpoints) {
        try {
          const res = await callAgent(endpoint, { name: found.agentName, id: found.id });
          const steps = res?.steps || res?.flow?.steps || res?.items || res?.nodes;
          if (Array.isArray(steps) && steps.length > 0) {
            convertStepsToNodes(steps, found.name);
            log(`✓ Učitan flow: ${found.name}`, "success");
            return;
          }
        } catch {
          // ignore probe failures
        }
      }
    }

    log(`Flow ${found.name} je pronađen, ali nema učitljiv sadržaj.`, "error");
  }, [callAgent, convertStepsToNodes, fitToScreen, log, savedFlows]);

  const deleteSelected = useCallback(() => {
    if (selectedNode) {
      setNodes(prev => prev.filter(n => n.id !== selectedNode));
      setConnections(prev => prev.filter(c => c.fromNode !== selectedNode && c.toNode !== selectedNode));
      setSelectedNode(null);
      return;
    }
    if (selectedConnection) {
      setConnections(prev => prev.filter(c => c.id !== selectedConnection));
      setSelectedConnection(null);
    }
  }, [selectedConnection, selectedNode]);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const selectedNodeData = useMemo(() => nodes.find(n => n.id === selectedNode) || null, [nodes, selectedNode]);

  const connectionPaths = useMemo(() => {
    return connections.map(c => {
      const from = nodes.find(n => n.id === c.fromNode);
      const to = nodes.find(n => n.id === c.toNode);
      if (!from || !to) return null;
      const x1 = from.x + NODE_W;
      const y1 = from.y + getNodeHeight(from) / 2;
      const x2 = to.x;
      const y2 = to.y + getNodeHeight(to) / 2;
      const dx = Math.max(90, Math.abs(x2 - x1) * 0.45);
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      return { ...c, d };
    }).filter(Boolean) as Array<LearningConnection & { d: string }>;
  }, [connections, nodes]);

  const exportFlowToBrain = useCallback(() => {
    const steps = buildExecutionOrder().map((n) => {
      if (n.kind === "goto") return { action: "goto", url: n.config?.url, timeout: n.config?.timeout };
      if (n.kind === "click") return { action: "click", selector: n.config?.selector, timeout: n.config?.timeout };
      if (n.kind === "fill") return { action: "fill", selector: n.config?.selector, value: n.config?.value, timeout: n.config?.timeout };
      if (n.kind === "input") return { action: n.config?.key ? "press" : "input", key: n.config?.key, value: n.config?.value };
      if (n.kind === "screenshot") return { action: "screenshot", full_page: n.config?.full_page, timeout: n.config?.timeout };
      if (n.kind === "ai" && n.config?.result) return { action: "ai_improved", code: n.config.result };
      return { action: "click", selector: n.config?.selector || "" };
    });

    localStorage.setItem(LEARNING_TO_BRAIN_BRIDGE_KEY, JSON.stringify({
      flowName: flowName || "Learning Flow",
      steps,
      exportedAt: Date.now(),
    }));
    log("✓ Flow poslan u Mozak", "success");
    return steps;
  }, [buildExecutionOrder, flowName, log]);

  return {
    constants: { CANVAS_W, CANVAS_H, NODE_W, getNodeHeight },
    state: {
      containerRef,
      flowName,
      startUrl,
      agentOnline,
      nodes,
      connections,
      selectedNode,
      selectedConnection,
      selectedNodeData,
      pan,
      zoom,
      vpSize,
      isPanning,
      recording,
      previewImage,
      previewTitle,
      logs,
      activeNodes,
      isRunning,
      flowPrompt,
      draggingNodeId,
      savedFlows,
      connectionPaths,
      currentStepLabel,
      lastImprovedCode,           // novo
    },
    actions: {
      setFlowName,
      setSelectedNode,
      setSelectedConnection,
      setFlowPrompt,
      addNode,
      updateNodeConfig,
      handleNodeMouseDown,
      handleCanvasMouseDown,
      zoomIn,
      zoomOut,
      fitToScreen,
      handleMinimapNav,
      startRecording,
      stopRecording,
      setStartUrl,
      loadPreview,
      improveWithAI,
      saveImprovedCode,           // novo
      generateFlowFromPrompt,
      runFlowAnimated,
      saveFlow,
      loadFlow,
      deleteSelected,
      exportFlowToBrain,
      refreshSavedFlows,
    },
  };
}
