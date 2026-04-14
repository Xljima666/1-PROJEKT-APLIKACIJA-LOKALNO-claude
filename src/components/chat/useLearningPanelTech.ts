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

export interface SavedLearningFlow {
  id: string;
  name: string;
  savedAt: number;
  source: "local" | "agent";
  file?: string;
}

const CANVAS_W = 5200;
const CANVAS_H = 3200;
const NODE_W = 240;
const LEARNING_TO_BRAIN_BRIDGE_KEY = "stellan_learning_to_brain_bridge_v1";
const LOCAL_FLOW_KEY = "stellan_learning_flows_v2";

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

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useLearningPanelTech() {
  const AGENT_URL = (import.meta as any).env?.VITE_AGENT_SERVER_URL || "";
  const AGENT_KEY = (import.meta as any).env?.VITE_AGENT_API_KEY || "";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [flowName, setFlowName] = useState("Learning Flow");
  const [startUrl, setStartUrl] = useState("https://oss.uredjenazemlja.hr/");
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [nodes, setNodes] = useState<LearningNodeData[]>([
    {
      id: "start_1",
      kind: "start",
      label: "Start",
      category: "trigger",
      x: 220,
      y: 220,
      config: {},
    },
  ]);
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
  const [savedFlows, setSavedFlows] = useState<SavedLearningFlow[]>([]);
  const dragRef = useRef<{
    type: "pan" | "node";
    startX: number;
    startY: number;
    nodeId?: string;
    originX?: number;
    originY?: number;
    panX?: number;
    panY?: number;
  } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);

  const log = useCallback((msg: string, tone?: "info" | "success" | "error") => {
    const time = new Date().toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(prev => [...prev.slice(-250), { time, msg, tone: tone || toneFromMessage(msg) }]);
  }, []);

  const callAgent = useCallback(async (endpoint: string, body: object = {}, method: "POST" | "GET" = "POST") => {
    if (!AGENT_URL) {
      log("AGENT_SERVER_URL nije postavljen!", "error");
      return null;
    }

    try {
      const res = await fetch(`${AGENT_URL}/${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": AGENT_KEY,
          "ngrok-skip-browser-warning": "true",
        },
        body: method === "GET" ? undefined : JSON.stringify(body),
      });
      return await res.json();
    } catch (e: any) {
      log(`Agent greška: ${e.message}`, "error");
      return null;
    }
  }, [AGENT_URL, AGENT_KEY, log]);

  const persistFlowLocally = useCallback((name: string, nextNodes: LearningNodeData[], nextConnections: LearningConnection[]) => {
    const prev = safeJsonParse<any[]>(localStorage.getItem(LOCAL_FLOW_KEY), []);
    const existing = prev.find((x: any) => x?.source !== "agent" && x?.name === name);
    const payload = {
      id: existing?.id || `local:${uid("flow")}`,
      name,
      savedAt: Date.now(),
      source: "local" as const,
      nodes: nextNodes,
      connections: nextConnections,
    };
    const next = [payload, ...prev.filter((x: any) => !(x?.source !== "agent" && x?.name === name))].slice(0, 30);
    localStorage.setItem(LOCAL_FLOW_KEY, JSON.stringify(next));
    return payload;
  }, []);

  const refreshSavedFlows = useCallback(async () => {
    const localItems = safeJsonParse<any[]>(localStorage.getItem(LOCAL_FLOW_KEY), []).map((x: any) => ({
      id: x.id || `local:${x.name}`,
      name: x.name || "Flow",
      savedAt: Number(x.savedAt || Date.now()),
      source: "local" as const,
      file: undefined,
    }));

    const agentItems: SavedLearningFlow[] = [];
    const res = await callAgent("record/list", {}, "GET");
    if (res?.success && Array.isArray(res.actions)) {
      for (const action of res.actions) {
        agentItems.push({
          id: `agent:${action.name}`,
          name: action.name,
          savedAt: Date.now(),
          source: "agent",
          file: action.file,
        });
      }
    }

    const merged = [...localItems, ...agentItems]
      .filter((item, index, arr) => arr.findIndex(other => other.id === item.id) === index)
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

    setSavedFlows(merged);
  }, [callAgent]);

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

  const convertStepsToNodes = useCallback((steps: any[]) => {
    const mapped: LearningNodeData[] = [
      {
        id: "start_1",
        kind: "start",
        label: "Start",
        category: "trigger",
        x: 220,
        y: 220,
        config: {},
      },
    ];

    steps.forEach((s, i) => {
      let kind: LearningNodeKind = "click";
      const action = String(s.action || "").toLowerCase();
      if (action.includes("goto") || action.includes("open") || action.includes("navigate") || s.url) kind = "goto";
      else if (action.includes("fill") || action.includes("type")) kind = "fill";
      else if (action.includes("screenshot")) kind = "screenshot";
      else if (action.includes("input")) kind = "input";

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

    setNodes(mapped);
    connectSequentially(mapped);
    setSelectedNode(mapped[1]?.id || "start_1");
    log(`✓ Flow pretvoren u ${mapped.length - 1} nodeova`, "success");
  }, [connectSequentially, log]);

  const startRecording = useCallback(async (url?: string) => {
    if (isRecordingRef.current) return;
    const targetUrl = url || startUrl || "about:blank";

    log("Otvaranje browsera...", "info");
    callAgent("playwright", { action: "navigate", url: targetUrl, timeout: 45000 })
      .then(r => log(r?.success ? `✓ Browser otvoren: ${targetUrl}` : `Upozorenje: ${r?.error || ""}`, r?.success ? "success" : "info"))
      .catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    log("Browser se otvara u pozadini...", "info");

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
            for (const evt of poll.new_events) {
              const action = String(evt.action || "").toLowerCase();
              let kind: LearningNodeKind = "click";
              if (action === "navigate" || action === "goto" || evt.url) kind = "goto";
              else if (action === "fill" || action === "type") kind = "fill";
              else if (action === "screenshot") kind = "screenshot";

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
              log(`🔴 ${kind.toUpperCase()}: ${evt.selector || evt.url || ""}`, "info");
            }
          }
        } catch {}
      }, 1200);
    } else {
      log(`Greška: ${res?.error || "ne mogu pokrenuti učenje"}`, "error");
    }
  }, [callAgent, flowName, log, startUrl]);

  const stopRecording = useCallback(async () => {
    isRecordingRef.current = false;
    setRecording(false);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    try {
      const poll = await callAgent("record/poll", {}, "GET");
      if (poll?.new_events?.length > 0) {
        for (const evt of poll.new_events) {
          const action = String(evt.action || "").toLowerCase();
          let kind: LearningNodeKind = "click";
          if (action === "navigate" || action === "goto" || evt.url) kind = "goto";
          else if (action === "fill" || action === "type") kind = "fill";
          else if (action === "screenshot") kind = "screenshot";
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
              setConnections(prevConns => [...prevConns, {
                id: `conn_${fromNode.id}_${positioned.id}`,
                fromNode: fromNode.id,
                toNode: positioned.id,
                color: template.color,
              }]);
            }
            return [...prev, positioned];
          });
        }
      }
    } catch {}

    const res = await callAgent("record/stop", {});
    if (res?.success) {
      await callAgent("record/save", { name: flowName || "learning_flow" });
      persistFlowLocally(flowName || "learning_flow", nodes, connections);
      await refreshSavedFlows();
      log(`✓ Snimanje završeno i spremljeno. Koraka: ${res.steps ?? 0}`, "success");
    } else {
      log(`Greška: ${res?.error || "ne mogu zaustaviti učenje"}`, "error");
    }
  }, [callAgent, connections, flowName, log, nodes, persistFlowLocally, refreshSavedFlows]);

  const loadPreview = useCallback(async () => {
    const res = await callAgent("preview/current", {}, "GET");
    if (res?.success && res.screenshot_base64) {
      const image = `data:image/png;base64,${res.screenshot_base64}`;
      setPreviewImage(image);
      setPreviewTitle(res.title || "Preview");
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
      log("✓ Preview node dodan u canvas", "success");
    } else {
      log(`Preview greška: ${res?.error || "nema slike"}`, "error");
    }
  }, [callAgent, nodes.length, log]);

  const improveWithAI = useCallback(async () => {
    const flow = nodes.map(n => ({ label: n.label, kind: n.kind, config: n.config }));
    const res = await callAgent("code/clean_playwright", { content: JSON.stringify(flow, null, 2) });
    if (res?.cleaned_content) {
      const aiNode = addNode("ai", 460, 760);
      updateNodeConfig(aiNode.id, "result", res.cleaned_content);
      log("✓ AI poboljšanje generirano", "success");
    } else {
      log(`Greška: ${res?.error || "AI improve nije uspio"}`, "error");
    }
  }, [callAgent, nodes, addNode, updateNodeConfig, log]);

  const generateFlowFromPrompt = useCallback(async () => {
    if (!flowPrompt.trim()) return;
    const res = await callAgent("ai/generate_flow", { prompt: flowPrompt });
    if (res?.success && Array.isArray(res.steps)) {
      convertStepsToNodes(res.steps);
      log("✓ AI flow generiran", "success");
      return;
    }

    const fallbackSteps = [
      { action: "goto", url: "https://oss.uredjenazemlja.hr/" },
      { action: "click", selector: "text=Prijava" },
    ];
    convertStepsToNodes(fallbackSteps);
    log("AI endpoint nije vratio stepove — ubačen fallback demo flow.", "info");
  }, [callAgent, convertStepsToNodes, flowPrompt, log]);

  const executeNode = useCallback(async (node: LearningNodeData) => {
    const timeout = Number(node.config?.timeout || 20000);

    if (node.kind === "goto") {
      return await callAgent("playwright", {
        action: "navigate",
        url: node.config?.url || startUrl || "about:blank",
        timeout: Number(node.config?.timeout || 45000),
      });
    }

    if (node.kind === "click") {
      const selector = node.config?.selector || "";
      if (!selector) return { success: false, error: "Click node nema selector." };
      return await callAgent("playwright", { action: "click", selector, timeout });
    }

    if (node.kind === "fill") {
      const selector = node.config?.selector || "";
      if (!selector) return { success: false, error: "Fill node nema selector." };
      return await callAgent("playwright", {
        action: "fill",
        selector,
        value: String(node.config?.value || ""),
        timeout,
      });
    }

    if (node.kind === "input") {
      return { success: true, skipped: true };
    }

    if (node.kind === "screenshot") {
      return await callAgent("playwright", {
        action: "screenshot",
        full_page: node.config?.full_page !== false,
        timeout: Number(node.config?.timeout || 15000),
      });
    }

    if (node.kind === "run" || node.kind === "start" || node.kind === "ai") {
      return { success: true, skipped: true };
    }

    return { success: false, error: `Nepodržan node kind: ${node.kind}` };
  }, [callAgent, startUrl]);

  const runFlowAnimated = useCallback(async () => {
    setIsRunning(true);
    setActiveNodes([]);
    try {
      const ordered = nodes.filter(n => !["start", "ai"].includes(n.kind));
      if (ordered.length === 0) {
        const fallback = await callAgent("record/run", { name: flowName || "learning_flow" });
        if (fallback?.success) {
          log("✓ Pokrenut spremljeni flow s agenta", "success");
        } else {
          log(`Greška: ${fallback?.error || fallback?.stderr || "nema koraka za pokretanje"}`, "error");
        }
        return;
      }

      for (const node of ordered) {
        setActiveNodes([node.id]);
        log(`▶ ${node.label}`, "info");
        const result = await executeNode(node);

        if (result?.screenshot_base64) {
          setPreviewImage(`data:image/png;base64,${result.screenshot_base64}`);
          setPreviewTitle(result.title || node.label);
        } else if (result?.title || result?.url) {
          setPreviewTitle(result.title || result.url || node.label);
        }

        if (!result?.success) {
          log(`Greška na "${node.label}": ${result?.error || "nepoznata greška"}`, "error");
          break;
        }

        log(`✓ ${node.label}`, "success");
        await new Promise(r => setTimeout(r, 350));
      }

      setActiveNodes([]);
      log("✓ Flow izvršen", "success");
    } finally {
      setActiveNodes([]);
      setIsRunning(false);
    }
  }, [callAgent, executeNode, flowName, log, nodes]);

  const saveFlow = useCallback(async () => {
    persistFlowLocally(flowName, nodes, connections);
    await refreshSavedFlows();
    log("✓ Flow spremljen lokalno", "success");
  }, [connections, flowName, log, nodes, persistFlowLocally, refreshSavedFlows]);

  const loadFlow = useCallback(async (id: string) => {
    const items = safeJsonParse<any[]>(localStorage.getItem(LOCAL_FLOW_KEY), []);
    const foundLocal =
      items.find((x: any) => x.id === id) ||
      items.find((x: any) => `local:${x.id}` === id) ||
      items.find((x: any) => x.name === id);

    if (foundLocal) {
      setFlowName(foundLocal.name || "Learning Flow");
      setNodes(foundLocal.nodes || []);
      setConnections(foundLocal.connections || []);
      setSelectedNode(foundLocal.nodes?.[0]?.id || null);
      log(`✓ Učitan flow: ${foundLocal.name}`, "success");
      return;
    }

    const agentName = id.startsWith("agent:") ? id.replace(/^agent:/, "") : id;
    const foundAgent = savedFlows.find((f) => f.source === "agent" && (f.id === id || f.name === agentName));
    if (foundAgent) {
      setFlowName(foundAgent.name || "Learning Flow");
      log(`✓ Odabran agent flow: ${foundAgent.name}. Klikni Run Flow za pokretanje.`, "success");
      return;
    }

    log("Flow nije pronađen.", "error");
  }, [log, savedFlows]);

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
    const steps = nodes
      .filter(n => n.kind !== "start" && n.kind !== "ai")
      .map((n) => {
        if (n.kind === "goto") return { action: "goto", url: n.config?.url, timeout: n.config?.timeout };
        if (n.kind === "click") return { action: "click", selector: n.config?.selector, timeout: n.config?.timeout };
        if (n.kind === "fill") return { action: "fill", selector: n.config?.selector, value: n.config?.value, timeout: n.config?.timeout };
        if (n.kind === "input") return { action: "input", key: n.config?.key, value: n.config?.value };
        if (n.kind === "screenshot") return { action: "screenshot", full_page: n.config?.full_page, timeout: n.config?.timeout };
        if (n.kind === "run") return { action: "run" };
        return { action: "click", selector: n.config?.selector || "" };
      });

    localStorage.setItem(LEARNING_TO_BRAIN_BRIDGE_KEY, JSON.stringify({
      flowName: flowName || "Learning Flow",
      steps,
      exportedAt: Date.now(),
    }));
    log("✓ Flow poslan u Mozak", "success");
    return steps;
  }, [flowName, log, nodes]);

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
