import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Copy,
  Eye,
  FolderOpen,
  Loader2,
  Play,
  Save,
  Search,
  Sparkles,
  Square,
  Wand2,
} from "lucide-react";
import {
  MozakCardItem,
  MozakFlowItem,
  MozakPreviewResult,
  agentBaseUrl,
  buildPlaywrightTsFromSteps,
  buildPythonFlowFromSteps,
  cardStorage,
  flowManifestStorage,
  loadSavedFlowsFromAgent,
  requestAgent,
  runSavedFlow,
  startRecording,
  stopRecording,
  type BrowserEventStep,
} from "./mozakv2tech";

export interface MozakV2PanelProps {
  onBack?: () => void;
  onClose?: () => void;
  title?: string;
}

type LeftTab = "flows" | "cards";

type Suggestion = {
  id: string;
  title: string;
  description: string;
  apply: (code: string) => string;
};

const PANEL =
  "rounded-3xl border border-emerald-400/15 bg-[#041611]/90 shadow-[0_0_0_1px_rgba(16,185,129,0.05),0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl";
const BTN =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/85 transition hover:border-emerald-400/30 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50";

const seedCode = `import { test, expect } from '@playwright/test';

test('novi flow', async ({ page }) => {
  await page.goto('https://oss.uredjenazemlja.hr/');
});`;

function formatFlowLabel(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function guessSuggestions(code: string): Suggestion[] {
  const items: Suggestion[] = [];

  if (code.includes("page.click(") && !code.includes("getByRole")) {
    items.push({
      id: "role",
      title: "Stabilniji selektori",
      description: "Kad god možeš, koristi getByRole / getByLabel umjesto sirovog CSS klika.",
      apply: (src) => src.replace(/page\.click\(([^)]+)\);/g, "page.locator($1).click();"),
    });
  }

  if (!code.includes("await page.waitForLoadState") && code.includes("await page.goto")) {
    items.push({
      id: "wait-load",
      title: "Dodaj čekanje učitavanja",
      description: "Nakon goto dodaj waitForLoadState('networkidle') radi stabilnijeg flowa.",
      apply: (src) =>
        src.replace(
          /(await page\.goto\([^\n]+\);)/,
          `$1\n  await page.waitForLoadState('networkidle');`,
        ),
    });
  }

  if (!items.length) {
    items.push({
      id: "clean",
      title: "Kod izgleda uredno",
      description: "Trenutno nema očitih problema. Možeš odmah spremiti ili pokrenuti flow.",
      apply: (src) => src,
    });
  }

  return items;
}

export default function MozakV2Panel({ onBack, title = "Playwright Studio" }: MozakV2PanelProps) {
  const [leftTab, setLeftTab] = useState<LeftTab>("flows");
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("Pamćenje je spremno.");
  const [currentName, setCurrentName] = useState("oss_prijava");
  const [code, setCode] = useState(seedCode);
  const [recordedSteps, setRecordedSteps] = useState<BrowserEventStep[]>([]);
  const [flows, setFlows] = useState<MozakFlowItem[]>([]);
  const [cards, setCards] = useState<MozakCardItem[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string>("");
  const [selectedPreview, setSelectedPreview] = useState<MozakPreviewResult | null>(null);
  const [lastRun, setLastRun] = useState<{ ok: boolean; message: string } | null>(null);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const pollTimer = useRef<number | null>(null);

  const filteredFlows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flows.filter((f) => !q || f.label.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
  }, [flows, search]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => !q || c.title.toLowerCase().includes(q) || c.flowName.toLowerCase().includes(q));
  }, [cards, search]);

  const suggestions = useMemo(() => guessSuggestions(code), [code]);

  useEffect(() => {
    void bootstrap();
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, []);

  async function bootstrap() {
    setCards(cardStorage.list());
    const manifest = flowManifestStorage.list();
    const remote = await loadSavedFlowsFromAgent();
    setFlows(remote.length ? remote : manifest);
    if (remote.length) flowManifestStorage.upsertMany(remote);
    try {
      const health = await requestAgent<{ status: string }>("/health", { method: "GET" });
      setAgentOnline(health.status === "ok");
    } catch {
      setAgentOnline(false);
    }
  }

  async function handleStartRecording() {
    setBusy("record");
    try {
      const name = currentName.trim() || "novi_flow";
      await startRecording(name);
      setRecording(true);
      setRecordedSteps([]);
      setStatus("Pamćenje radi. Chromium je otvoren i koraci se bilježe uživo.");
      startPolling();
    } catch (error: any) {
      setStatus(error?.message || "Ne mogu pokrenuti pamćenje.");
    } finally {
      setBusy(null);
    }
  }

  async function handleStopRecording() {
    setBusy("record-stop");
    try {
      await stopRecording();
      setRecording(false);
      stopPolling();
      setStatus("Pamćenje zaustavljeno.");
    } catch (error: any) {
      setStatus(error?.message || "Greška pri zaustavljanju pamćenja.");
    } finally {
      setBusy(null);
    }
  }

  function startPolling() {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    pollTimer.current = window.setInterval(async () => {
      try {
        const res = await requestAgent<{ new_events?: BrowserEventStep[]; recording?: boolean }>("/record/poll", {
          method: "GET",
        });
        const nextEvents = res.new_events || [];
        if (nextEvents.length) {
          setRecordedSteps((prev) => {
            const merged = [...prev, ...nextEvents];
            const nextCode = buildPlaywrightTsFromSteps(merged, currentName || "novi_flow");
            setCode(nextCode);
            flowManifestStorage.upsert({
              name: (currentName || "novi_flow").trim().replace(/\s+/g, "_").toLowerCase(),
              label: formatFlowLabel((currentName || "novi_flow").trim().replace(/\s+/g, "_").toLowerCase()),
              updatedAt: new Date().toISOString(),
              code: nextCode,
              stepsCount: merged.length,
              recordedSteps: merged,
            });
            return merged;
          });
        }
        if (res.recording === false) {
          setRecording(false);
          stopPolling();
        }
      } catch {
        setRecording(false);
        stopPolling();
      }
    }, 1200);
  }

  function stopPolling() {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function handleSaveFlow() {
    setBusy("save");
    try {
      const safeName = (currentName.trim() || "novi_flow").replace(/\s+/g, "_").toLowerCase();
      const pythonContent = buildPythonFlowFromSteps(recordedSteps, safeName);
      await requestAgent("/flow/learn", {
        method: "POST",
        body: JSON.stringify({
          name: safeName,
          content: pythonContent,
          metadata: {
            name: safeName,
            description: "Playwright Studio flow",
            portal: "Playwright",
            tags: ["playwright", "mozak-v2"],
          },
        }),
      });

      const item: MozakFlowItem = {
        name: safeName,
        label: formatFlowLabel(safeName),
        updatedAt: new Date().toISOString(),
        code,
        stepsCount: recordedSteps.length,
        recordedSteps,
      };
      flowManifestStorage.upsert(item);
      const remote = await loadSavedFlowsFromAgent();
      setFlows(remote.length ? remote : flowManifestStorage.list());
      setSelectedFlow(safeName);
      setStatus("Flow je spremljen i odmah vidljiv na lijevoj listi.");
    } catch (error: any) {
      setStatus(error?.message || "Spremanje flowa nije uspjelo.");
    } finally {
      setBusy(null);
    }
  }

  async function handleLoadFlow(flowName: string) {
    setBusy(`load:${flowName}`);
    try {
      await requestAgent("/record/read", {
        method: "POST",
        body: JSON.stringify({ name: flowName }),
      }).catch(() => null);
      const manifest = flowManifestStorage.get(flowName);
      setSelectedFlow(flowName);
      setCurrentName(flowName);
      setCode(manifest?.code || buildPlaywrightTsFromSteps([], flowName));
      setRecordedSteps(manifest?.recordedSteps || []);
      setStatus(`Flow '${flowName}' učitan.`);
    } catch (error: any) {
      setStatus(error?.message || "Ne mogu učitati flow.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRunFlow() {
    setBusy("run");
    try {
      const safeName = (selectedFlow || currentName).trim().replace(/\s+/g, "_").toLowerCase();
      if (!safeName) throw new Error("Prvo spremi ili odaberi flow.");
      const res = await runSavedFlow(safeName);
      setLastRun({
        ok: !!res.success,
        message: res.stderr || res.stdout || (res.success ? "Flow je prošao." : "Flow nije prošao."),
      });
      setStatus(res.success ? "Run Flow je završen." : "Run Flow je pao.");
      await refreshPreview();
    } catch (error: any) {
      setLastRun({ ok: false, message: error?.message || "Run Flow nije uspio." });
      setStatus(error?.message || "Run Flow nije uspio.");
    } finally {
      setBusy(null);
    }
  }

  async function handleValidate() {
    setBusy("validate");
    try {
      const pythonContent = buildPythonFlowFromSteps(recordedSteps, currentName);
      const res = await requestAgent("/code/run_temp", {
        method: "POST",
        body: JSON.stringify({ content: pythonContent, timeout: 90 }),
      });
      setLastRun({
        ok: !!res.success,
        message: res.stderr || res.stdout || (res.success ? "Provjera je prošla." : "Provjera nije prošla."),
      });
      if ((res as any).screenshot_base64) {
        setSelectedPreview({
          title: "Mini pregled (Chromium)",
          url: "",
          screenshotBase64: (res as any).screenshot_base64,
          capturedAt: new Date().toISOString(),
        });
      }
      setStatus((res as any).success ? "Provjera flowa je prošla." : "Provjera flowa je vratila grešku.");
    } catch (error: any) {
      setLastRun({ ok: false, message: error?.message || "Provjera nije uspjela." });
      setStatus(error?.message || "Provjera nije uspjela.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshPreview() {
    setBusy("preview");
    try {
      const res = await requestAgent<any>("/preview/current", { method: "GET" });
      if (res.success) {
        setSelectedPreview({
          title: res.title || "Live preview",
          url: res.url || "",
          screenshotBase64: res.screenshot_base64,
          capturedAt: res.captured_at || new Date().toISOString(),
        });
        setStatus("Mini pregled je osvježen.");
      }
    } catch (error: any) {
      setStatus(error?.message || "Preview nije dostupan.");
    } finally {
      setBusy(null);
    }
  }

  function handleConvertToCard() {
    const flowName = (selectedFlow || currentName).trim().replace(/\s+/g, "_").toLowerCase();
    if (!flowName) {
      setStatus("Prvo spremi flow pa ga pretvori u karticu.");
      return;
    }
    const card: MozakCardItem = {
      id: `${flowName}-${Date.now()}`,
      title: `Kartica: ${formatFlowLabel(flowName)}`,
      flowName,
      versionLabel: `Verzija ${new Date().toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}`,
      code,
      createdAt: new Date().toISOString(),
    };
    cardStorage.upsert(card);
    setCards(cardStorage.list());
    setLeftTab("cards");
    setStatus("Flow je pretvoren u karticu i spremljen za FME copy sučelje.");
  }

  const statusTone = agentOnline === false ? "text-amber-300" : "text-emerald-300";

  return (
    <div className="h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,#073b2f,transparent_30%),linear-gradient(180deg,#02100d,#031713_40%,#02120e)] text-white">
      <div className="flex h-full flex-col">
        <div className="border-b border-emerald-400/10 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className={BTN}>
                <ArrowLeft className="h-4 w-4" /> Nazad na Stellan
              </button>
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-white/[0.03] px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-semibold tracking-tight">{title}</div>
                  <div className="text-xs text-white/45">{recordedSteps.length} čvorova • {recording ? "snimanje uključeno" : "spremno"}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={recording ? handleStopRecording : handleStartRecording} className={recording ? BTN_PRIMARY : BTN} disabled={busy === "record" || busy === "record-stop"}>
                {busy === "record" || busy === "record-stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                Pamćenje
              </button>
              <button onClick={handleSaveFlow} className={BTN} disabled={busy === "save"}>
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Spremi
              </button>
              <button onClick={() => bootstrap()} className={BTN}>
                <FolderOpen className="h-4 w-4" /> Učitaj
              </button>
            </div>
          </div>

          <div className={`mt-4 ${PANEL} flex items-center justify-between px-4 py-3`}>
            <div>
              <div className="text-sm font-semibold">{status}</div>
              <div className={`text-xs ${statusTone}`}>{agentOnline === false ? `Agent offline — provjeri ${agentBaseUrl()}` : "Chromium i Playwright spremni za rad."}</div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${recording ? "bg-red-400" : "bg-emerald-400"}`} />
              {recording ? "Pamćenje uključeno" : "Pamćenje isključeno"}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_380px] gap-4 px-5 py-4">
          <aside className={`${PANEL} flex min-h-0 flex-col p-4`}>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <Search className="h-4 w-4 text-white/35" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pretraži flowove i kartice..." className="w-full bg-transparent text-sm outline-none placeholder:text-white/25" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
              <button className={leftTab === "flows" ? `${BTN_PRIMARY} py-2` : `${BTN} py-2`} onClick={() => setLeftTab("flows")}>Flowovi</button>
              <button className={leftTab === "cards" ? `${BTN_PRIMARY} py-2` : `${BTN} py-2`} onClick={() => setLeftTab("cards")}>Kartice</button>
            </div>

            {leftTab === "flows" ? (
              <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1">
                <div className="mb-3 text-sm text-white/55">Spremi flow i odmah ga vidi na popisu.</div>
                <div className="space-y-2">
                  {filteredFlows.map((flow) => (
                    <button key={flow.name} onClick={() => void handleLoadFlow(flow.name)} className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedFlow === flow.name ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/8 bg-white/[0.03] hover:border-emerald-400/20 hover:bg-white/[0.05]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white/90">{flow.label}</div>
                          <div className="mt-1 text-xs text-white/40">{new Date(flow.updatedAt).toLocaleString("hr-HR")}</div>
                        </div>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] text-emerald-300">{flow.stepsCount || 0}</span>
                      </div>
                    </button>
                  ))}
                  {!filteredFlows.length && <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/35">Još nema spremljenih flowova.</div>}
                </div>
              </div>
            ) : (
              <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1">
                <div className="mb-3 text-sm text-white/55">Kartice za FME copy dio.</div>
                <div className="space-y-2">
                  {filteredCards.map((card) => (
                    <div key={card.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <div className="font-semibold text-white/90">{card.title}</div>
                      <div className="mt-1 text-xs text-white/40">{card.versionLabel}</div>
                    </div>
                  ))}
                  {!filteredCards.length && <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/35">Još nema kartica.</div>}
                </div>
              </div>
            )}
          </aside>

          <section className={`${PANEL} min-h-0 overflow-hidden p-4`}>
            <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
              <div>
                <div className="text-lg font-semibold">Trenutni Playwright kod</div>
                <div className="mt-1 text-xs text-white/45">Kod se puni uživo dok je uključeno Pamćenje.</div>
              </div>
              <div className="flex items-center gap-2">
                <input value={currentName} onChange={(e) => setCurrentName(e.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none" />
                <button onClick={() => navigator.clipboard.writeText(code)} className={BTN}><Copy className="h-4 w-4" /> Kopiraj</button>
              </div>
            </div>

            <div className="mt-4 h-[calc(100%-88px)] overflow-hidden rounded-3xl border border-white/8 bg-[#02110d]">
              <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-7 text-emerald-50/95 outline-none" />
            </div>
          </section>

          <aside className="flex min-h-0 flex-col gap-4">
            <div className={`${PANEL} p-4`}>
              <div className="text-xl font-semibold">Uredi i pokreni</div>
              <div className="mt-1 text-sm text-white/45">Provjeri radi li tvoj flow.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => void handleRunFlow()} className={BTN_PRIMARY} disabled={busy === "run"}>{busy === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run Flow</button>
                <button onClick={() => void handleValidate()} className={BTN} disabled={busy === "validate"}>{busy === "validate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Provjeri</button>
                <button onClick={() => void refreshPreview()} className={BTN} disabled={busy === "preview"}>{busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview</button>
              </div>
              {lastRun && (
                <div className={`mt-4 rounded-2xl border px-3 py-3 text-sm ${lastRun.ok ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-rose-400/20 bg-rose-500/10 text-rose-200"}`}>
                  {lastRun.message}
                </div>
              )}
            </div>

            <div className={`${PANEL} p-4`}>
              <div className="text-lg font-semibold">Pretvori u karticu</div>
              <div className="mt-1 text-sm text-white/45">Validirani flow spremi za FME copy sučelje.</div>
              <button onClick={handleConvertToCard} className={`${BTN_PRIMARY} mt-4 w-full`}>
                <FolderOpen className="h-4 w-4" /> Pretvori u karticu
              </button>
            </div>

            <div className={`${PANEL} p-4`}>
              <div className="mb-3 flex items-center gap-2 text-lg font-semibold"><Wand2 className="h-4 w-4 text-emerald-300" /> Stellan prijedlozi</div>
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="font-medium text-white/90">{suggestion.title}</div>
                    <div className="mt-1 text-sm text-white/45">{suggestion.description}</div>
                    <button onClick={() => setCode(suggestion.apply(code))} className={`${BTN_PRIMARY} mt-3 w-full`}>
                      Primijeni prijedlog
                    </button>
                  </div>
                ))}
              </div>
            </div>
 
            <div className={`${PANEL} min-h-[260px] p-4`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">Mini pregled (Chromium)</div>
                  <div className="text-sm text-white/45">Live preview iz Playwright browsera.</div>
                </div>
                <button onClick={() => void refreshPreview()} className={BTN}><Eye className="h-4 w-4" /></button>
              </div>
              <div className="mt-4 overflow-hidden rounded-3xl border border-white/8 bg-black/20">
                {selectedPreview?.screenshotBase64 ? (
                  <img src={`data:image/png;base64,${selectedPreview.screenshotBase64}`} alt="preview" className="h-64 w-full object-cover object-top" />
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-white/30">Preview će se pojaviti nakon Run / Preview.</div>
                )}
              </div>
              {selectedPreview?.url && <div className="mt-3 truncate text-xs text-white/45">{selectedPreview.url}</div>}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
