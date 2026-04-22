import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type KnowledgeDocument = {
  id: string;
  title: string;
  document_type: string;
  category: string;
  tags?: string[];
  source_url?: string | null;
  updated_at?: string;
  source?: {
    title?: string;
    source_type?: string;
    authority?: string | null;
    official?: boolean;
    source_url?: string | null;
  } | null;
};

type SearchResult = {
  title: string;
  chunk_title?: string;
  source?: string;
  source_url?: string | null;
  authority?: string | null;
  official?: boolean;
  category?: string;
  tags?: string[];
  similarity?: number;
  content: string;
};

type SaveStatus = "idle" | "saving" | "success" | "error";

interface Props {
  onClose: () => void;
}

const categories = [
  { value: "geodezija", label: "Geodezija" },
  { value: "elaborat", label: "Elaborati" },
  { value: "sdge", label: "SDGE" },
  { value: "oss", label: "OSS / Uređena zemlja" },
  { value: "pdf", label: "PDF / obrasci" },
  { value: "pravila-izvora", label: "Propisi i izvori" },
  { value: "firma", label: "GeoTerra interno" },
];

const sourceTypes = [
  { value: "manual", label: "Ručni unos" },
  { value: "pdf", label: "PDF" },
  { value: "sdge", label: "SDGE" },
  { value: "oss", label: "OSS" },
  { value: "dgu", label: "DGU" },
  { value: "narodne_novine", label: "Narodne novine" },
  { value: "firma", label: "Interno" },
];

async function extractPdfText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = Math.min(pdf.numPages, 80);
  let fullText = "";

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) fullText += `\n--- Stranica ${pageNumber} ---\n${pageText}`;
  }

  return {
    text: fullText.trim() || "_Nema tekstualnog sadržaja. Dokument je možda skeniran._",
    pages: pdf.numPages,
  };
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function StellanKnowledgePanel({ onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("geodezija");
  const [sourceType, setSourceType] = useState("manual");
  const [sourceUrl, setSourceUrl] = useState("");
  const [authority, setAuthority] = useState("");
  const [tags, setTags] = useState("");
  const [official, setOfficial] = useState(false);
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [searching, setSearching] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const canSave = title.trim().length > 1 && content.trim().length > 20 && saveStatus !== "saving";
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);

  const callKnowledge = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("stellan-knowledge", { body });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Stellan knowledge error");
    return data;
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      const data = await callKnowledge({ action: "list_documents", limit: 18 });
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch {
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, [callKnowledge]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleFile = async (file: File) => {
    setExtracting(true);
    setStatusMessage("");
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        const extracted = await extractPdfText(file);
        setTitle((prev) => prev || file.name.replace(/\.pdf$/i, ""));
        setSourceType("pdf");
        setContent(extracted.text);
        setStatusMessage(`PDF učitan: ${extracted.pages} stranica.`);
      } else {
        const text = await file.text();
        setTitle((prev) => prev || file.name.replace(/\.[^.]+$/i, ""));
        setSourceType("manual");
        setContent(text);
        setStatusMessage("Datoteka učitana.");
      }
    } catch (error) {
      setStatusMessage(`Ne mogu pročitati datoteku: ${String((error as Error)?.message || error)}`);
    } finally {
      setExtracting(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaveStatus("saving");
    setStatusMessage("");
    try {
      const data = await callKnowledge({
        action: "save_document",
        title: title.trim(),
        content: content.trim(),
        category,
        tags: parseTags(tags),
        source_type: sourceType,
        source_title: title.trim(),
        source_ref: sourceUrl.trim() || title.trim(),
        source_url: sourceUrl.trim() || null,
        authority: authority.trim() || null,
        official,
        document_type: sourceType === "pdf" ? "pdf" : "text",
        mime_type: sourceType === "pdf" ? "application/pdf" : "text/markdown",
      });
      setSaveStatus("success");
      setStatusMessage(`Spremljeno: ${data.chunks} chunkova, ${data.embedded_chunks} embeddinga.`);
      await loadDocuments();
    } catch (error) {
      setSaveStatus("error");
      setStatusMessage(String((error as Error)?.message || error));
    }
  };

  const search = async (queryOverride?: string) => {
    const queryText = (queryOverride ?? searchQuery).trim();
    if (!queryText) return;
    setSearching(true);
    try {
      const data = await callKnowledge({
        action: "search",
        query: queryText,
        limit: 8,
      });
      setSearchResults(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      setSearchResults([
        {
          title: "Greška",
          content: String((error as Error)?.message || error),
        },
      ]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Natrag
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Stellan znanje</div>
            <div className="text-[11px] text-muted-foreground">Elaborati, geodezija, SDGE, OSS i PDF izvori</div>
          </div>
        </div>
        <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(420px,0.9fr)_minmax(420px,1.1fr)] gap-0 overflow-hidden">
        <section className="flex min-h-0 flex-col border-r border-border">
          <div className="shrink-0 border-b border-border px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Nauči novi izvor</h2>
                <p className="text-xs text-muted-foreground">Zalijepi tekst ili učitaj PDF/tekstualnu datoteku.</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Učitaj
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv,.json,.xml,.html,.sql,text/*,application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Naslov</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="npr. Elaborat - kontrolna lista za parcelaciju"
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Kategorija</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                  >
                    {categories.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Izvor</span>
                  <select
                    value={sourceType}
                    onChange={(event) => setSourceType(event.target.value)}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                  >
                    {sourceTypes.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Institucija / autor</span>
                  <input
                    value={authority}
                    onChange={(event) => setAuthority(event.target.value)}
                    placeholder="DGU, Narodne novine, GeoTerra..."
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">URL izvora</span>
                  <input
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="https://..."
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                  />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Tagovi</span>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="elaborat, parcelacija, sdge"
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                />
              </label>

              <label className="inline-flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={official}
                  onChange={(event) => setOfficial(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Službeni izvor
              </label>

              <label className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Sadržaj</span>
                  <span className="text-[11px] text-muted-foreground">{wordCount} riječi</span>
                </div>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Zalijepi tekst, upute, izvadak iz elaborata, pravilnik ili sadržaj PDF-a..."
                  className="min-h-[280px] resize-none rounded-lg border border-border bg-background px-3 py-3 text-sm leading-relaxed outline-none focus:border-primary/60"
                />
              </label>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => void save()}
                  disabled={!canSave}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
                    canSave
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {saveStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Spremi znanje
                </button>
                {statusMessage && (
                  <span
                    className={cn(
                      "text-xs",
                      saveStatus === "success" ? "text-emerald-400" : saveStatus === "error" ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {statusMessage}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="shrink-0 border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold">Pretraga i zadnje znanje</h2>
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void search();
                  }}
                  placeholder="Pretraži naučeno znanje..."
                  className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/60"
                />
              </div>
              <button
                onClick={() => void search()}
                disabled={searching || !searchQuery.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Traži
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(180px,0.7fr)]">
            <div className="min-h-0 overflow-y-auto border-b border-border px-5 py-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rezultati</div>
              {searchResults.length === 0 ? (
                <div className="flex h-full min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  Pretraži po pojmu, čestici, elaboratu, SDGE-u ili proceduri.
                </div>
              ) : (
                <div className="grid gap-3">
                  {searchResults.map((result, index) => (
                    <article key={`${result.title}-${index}`} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{result.title}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {result.official ? "Službeni izvor" : "Interno"} · {result.source || "corpus"} · {result.category || "general"}
                          </div>
                        </div>
                        {typeof result.similarity === "number" && (
                          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {result.similarity.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 line-clamp-5 text-xs leading-relaxed text-muted-foreground">{result.content}</p>
                      {result.source_url && (
                        <a
                          href={result.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-[11px] text-primary hover:underline"
                        >
                          Otvori izvor
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zadnje spremljeno</div>
                {loadingDocuments && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <div className="grid gap-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSearchQuery(doc.title);
                      void search(doc.title);
                    }}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{doc.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {doc.category} · {doc.source?.official ? "službeno" : "interno"} · {doc.source?.source_type || doc.document_type}
                      </div>
                    </div>
                  </button>
                ))}
                {!documents.length && !loadingDocuments && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Još nema spremljenih dokumenata.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
