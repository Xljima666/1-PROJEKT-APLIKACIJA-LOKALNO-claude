import { useState, useCallback } from "react";

export function useLearningPanelTech() {
  const AGENT_URL = import.meta.env.VITE_AGENT_SERVER_URL;
  const AGENT_KEY = import.meta.env.VITE_AGENT_API_KEY;

  const [recording, setRecording] = useState(false);
  const [steps, setSteps] = useState<any[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const callAgent = useCallback(async (endpoint: string, body = {}, method = "POST") => {
    try {
      const res = await fetch(`${AGENT_URL}/${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": AGENT_KEY,
        },
        body: method === "GET" ? undefined : JSON.stringify(body),
      });
      return await res.json();
    } catch (e: any) {
      log(`❌ ${e.message}`);
      return null;
    }
  }, []);

  const startRecording = async () => {
    await callAgent("record/start", { name: "flow_temp" });
    setRecording(true);
    log("⏺ Recording started");
  };

  const stopRecording = async () => {
    const res = await callAgent("record/stop");
    setRecording(false);

    if (res?.steps) {
      setSteps(res.steps);
      log(`✅ Steps: ${res.steps.length}`);
    }

    return res?.steps || [];
  };

  const runFlow = async () => {
    log("▶ Running flow...");
    return await callAgent("record/run", { name: "flow_temp" });
  };

  const loadPreview = async () => {
    const res = await callAgent("preview/current", {}, "GET");
    if (res?.screenshot_base64) {
      setPreview(`data:image/png;base64,${res.screenshot_base64}`);
    }
  };

  const improveCode = async (code: string) => {
    const res = await callAgent("code/clean_playwright", { content: code });
    return res?.cleaned_content || code;
  };

  return {
    state: { recording, steps, preview, logs },
    actions: {
      startRecording,
      stopRecording,
      runFlow,
      loadPreview,
      improveCode,
      setSteps,
    },
  };
}
