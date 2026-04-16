export type BrowserEventStep = {
  action: "click" | "fill" | "navigate" | "screenshot" | "wait" | string;
  selector?: string;
  value?: string;
  url?: string;
  description?: string;
  ts?: number;
  text?: string;
};

export type MozakFlowItem = {
  name: string;
  label: string;
  updatedAt: string;
  code: string;
  stepsCount: number;
  recordedSteps?: BrowserEventStep[];
};

export type MozakCardItem = {
  id: string;
  title: string;
  flowName: string;
  versionLabel: string;
  code: string;
  createdAt: string;
};

export type MozakPreviewResult = {
  title: string;
  url: string;
  screenshotBase64: string;
  capturedAt: string;
};

const FLOW_STORAGE_KEY = "stellan_mozak_v2_flows";
const CARD_STORAGE_KEY = "stellan_mozak_v2_cards";

export function agentBaseUrl() {
  return (import.meta as any)?.env?.VITE_AGENT_SERVER_URL || "http://localhost:8432";
}

export function agentApiKey() {
  return (import.meta as any)?.env?.VITE_AGENT_API_KEY || "";
}

export async function requestAgent<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }
  const key = agentApiKey();
  if (key) headers.set("X-API-Key", key);

  const res = await fetch(`${agentBaseUrl()}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.detail || (data as any)?.error || `Agent error ${res.status}`);
  }
  return data as T;
}

export async function startRecording(name: string) {
  return requestAgent("/record/start", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function stopRecording() {
  return requestAgent("/record/stop", {
    method: "POST",
  });
}

export async function loadSavedFlowsFromAgent(): Promise<MozakFlowItem[]> {
  try {
    const res = await requestAgent<{ actions?: { name: string }[] }>("/record/list", { method: "GET" });
    const manifest = flowManifestStorage.list();
    return (res.actions || []).map((item) => {
      const local = manifest.find((m) => m.name === item.name);
      return {
        name: item.name,
        label: formatFlowLabel(item.name),
        updatedAt: local?.updatedAt || new Date().toISOString(),
        code: local?.code || buildPlaywrightTsFromSteps([], item.name),
        stepsCount: local?.stepsCount || 0,
        recordedSteps: local?.recordedSteps || [],
      };
    });
  } catch {
    return flowManifestStorage.list();
  }
}

export async function runSavedFlow(name: string) {
  return requestAgent<any>("/flow/run_with_inputs", {
    method: "POST",
    body: JSON.stringify({ name, inputs: {}, timeout: 90 }),
  });
}

export function formatFlowLabel(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function escapeSingleQuoted(value: string) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function buildPlaywrightTsFromSteps(steps: BrowserEventStep[], flowName: string) {
  const testName = flowName.replace(/_/g, " ");
  const lines = [
    "import { test, expect } from '@playwright/test';",
    "",
    `test('${escapeSingleQuoted(testName)}', async ({ page }) => {`,
  ];

  if (!steps.length) {
    lines.push("  await page.goto('https://oss.uredjenazemlja.hr/');");
  }

  for (const step of steps) {
    if (step.action === "navigate" && step.url) {
      lines.push(`  await page.goto('${escapeSingleQuoted(step.url)}');`);
    } else if (step.action === "click" && step.selector) {
      lines.push(`  await page.locator('${escapeSingleQuoted(step.selector)}').click();`);
    } else if (step.action === "fill" && step.selector) {
      lines.push(`  await page.locator('${escapeSingleQuoted(step.selector)}').fill('${escapeSingleQuoted(step.value || "")}');`);
    } else if (step.action === "screenshot") {
      lines.push(`  await page.screenshot({ path: 'screenshot-${Date.now()}.png', fullPage: false });`);
    } else if (step.action === "wait" && step.selector) {
      lines.push(`  await page.locator('${escapeSingleQuoted(step.selector)}').waitFor();`);
    }
  }

  lines.push("});");
  return lines.join("\n");
}

export function buildPythonFlowFromSteps(steps: BrowserEventStep[], flowName: string) {
  const lines = [
    "import asyncio",
    "from playwright.async_api import async_playwright",
    "",
    "async def main():",
    "    async with async_playwright() as p:",
    "        browser = await p.chromium.launch(headless=False)",
    "        page = await browser.new_page()",
  ];

  if (!steps.length) {
    lines.push("        await page.goto('https://oss.uredjenazemlja.hr/', wait_until='domcontentloaded')");
  }

  for (const step of steps) {
    if (step.action === "navigate" && step.url) {
      lines.push(`        await page.goto('${escapeSingleQuoted(step.url)}', wait_until='domcontentloaded')`);
    } else if (step.action === "click" && step.selector) {
      lines.push(`        await page.click('${escapeSingleQuoted(step.selector)}')`);
    } else if (step.action === "fill" && step.selector) {
      lines.push(`        await page.fill('${escapeSingleQuoted(step.selector)}', '${escapeSingleQuoted(step.value || "")}')`);
    } else if (step.action === "wait" && step.selector) {
      lines.push(`        await page.wait_for_selector('${escapeSingleQuoted(step.selector)}')`);
    } else if (step.action === "screenshot") {
      lines.push(`        await page.screenshot(path='${escapeSingleQuoted(flowName)}.png', full_page=False)`);
    }
  }

  lines.push("        await browser.close()", "", "asyncio.run(main())");
  return lines.join("\n");
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const flowManifestStorage = {
  list(): MozakFlowItem[] {
    return readJson<MozakFlowItem[]>(FLOW_STORAGE_KEY, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  get(name: string) {
    return this.list().find((item) => item.name === name) || null;
  },
  upsert(item: MozakFlowItem) {
    const items = this.list().filter((f) => f.name !== item.name);
    items.unshift(item);
    writeJson(FLOW_STORAGE_KEY, items);
  },
  upsertMany(items: MozakFlowItem[]) {
    const map = new Map<string, MozakFlowItem>();
    [...items, ...this.list()].forEach((item) => map.set(item.name, item));
    writeJson(FLOW_STORAGE_KEY, Array.from(map.values()));
  },
};

export const cardStorage = {
  list(): MozakCardItem[] {
    return readJson<MozakCardItem[]>(CARD_STORAGE_KEY, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  upsert(item: MozakCardItem) {
    const items = this.list().filter((c) => c.id !== item.id);
    items.unshift(item);
    writeJson(CARD_STORAGE_KEY, items);
  },
};
