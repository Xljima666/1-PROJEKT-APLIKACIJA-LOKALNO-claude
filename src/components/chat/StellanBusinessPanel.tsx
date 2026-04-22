import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookTemplate,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  FileText,
  Loader2,
  Mail,
  MessageSquareText,
  Save,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ActionKey =
  | "document"
  | "pdf"
  | "audit"
  | "workflow"
  | "mail"
  | "team";

interface Props {
  onClose: () => void;
  onUsePrompt: (prompt: string) => void;
}

const jobTypes = [
  "Parcelacija",
  "Uskladenje katastra i zemljisne knjige",
  "Upis zgrade",
  "Iskolcenje",
  "Snimka izvedenog stanja",
  "Evidentiranje mede",
  "Situacija / geodetska snimka",
];

const actionCards: Array<{
  key: ActionKey;
  title: string;
  label: string;
  icon: typeof FileText;
  color: string;
  description: string;
}> = [
  {
    key: "document",
    title: "Zahtjev / dopis",
    label: "2",
    icon: FileText,
    color: "text-orange-300 bg-orange-500/10 border-orange-500/20",
    description: "Napravi sluzbeni zahtjev, dopis katastru, dopis stranci ili popratni tekst za predaju.",
  },
  {
    key: "pdf",
    title: "PDF analiza",
    label: "3",
    icon: FileSearch,
    color: "text-blue-300 bg-blue-500/10 border-blue-500/20",
    description: "Procitaj zakljucak, rjesenje ili povratnicu i izvuci rokove, radnje i rizike.",
  },
  {
    key: "audit",
    title: "Kontrola elaborata",
    label: "10",
    icon: ClipboardCheck,
    color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    description: "Provjeri sto nedostaje prije SDGE predaje i slozi listu gresaka za ispravak.",
  },
  {
    key: "workflow",
    title: "Predlosci poslova",
    label: "11",
    icon: BookTemplate,
    color: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    description: "Dobij workflow po vrsti posla: dokumenti, koraci, rokovi, kontrole i mailovi.",
  },
  {
    key: "mail",
    title: "Mail asistent",
    label: "13",
    icon: Mail,
    color: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
    description: "Napravi profesionalan mail stranci, katastru, opcini, kolegi ili dobavljacu.",
  },
  {
    key: "team",
    title: "Tim i delegiranje",
    label: "14",
    icon: Users,
    color: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    description: "Sažmi sto tko radi, predlozi zadatke i pripremi poruku clanu tima.",
  },
];

function buildPrompt(key: ActionKey, values: Record<string, string>) {
  const subject = values.subject.trim() || "[upiši predmet / stranku / česticu]";
  const jobType = values.jobType.trim() || "[vrsta posla]";
  const details = values.details.trim() || "[kratko opiši situaciju]";

  if (key === "document") {
    return `Napravi mi sluzbeni geodetski zahtjev/dopis.

Predmet: ${subject}
Vrsta posla: ${jobType}
Kontekst: ${details}

Struktura:
1. naslov i primatelj
2. kratak uvod
3. sto trazimo / sto dostavljamo
4. popis priloga
5. profesionalan zavrsetak

Ton: kratak, jasan, sluzben, hrvatski jezik. Ako fale podaci, prvo navedi sto fali, zatim daj najbolju verziju s oznakama [dopuniti].`;
  }

  if (key === "pdf") {
    return `Analiziraj PDF koji sam prilozio u chat.

Predmet: ${subject}
Vrsta posla: ${jobType}

Izvuci:
1. broj predmeta / klasu / urbroj ako postoji
2. katastarsku opcinu i cestice
3. rokove i datume
4. sto tocno trazi katastar/SDGE/OSS
5. sto moram napraviti kao sljedeci korak
6. koje dokumente trebam pripremiti
7. rizike ili nejasnoce

Na kraju napravi kratku checklistu za karticu posla. Ako je PDF skeniran i tekst nije citljiv, reci mi to jasno.`;
  }

  if (key === "audit") {
    return `Napravi kontrolu elaborata prije predaje.

Predmet: ${subject}
Vrsta posla: ${jobType}
Kontekst: ${details}

Provjeri kao geodetski reviewer:
1. jesu li jasni narucitelj, k.o., cestice i vrsta posla
2. popis obaveznih sastavnih dijelova elaborata
3. tehnicko izvjesce
4. skice, prijavni listovi i atributni podaci
5. potpisi, prilozi i dokazna dokumentacija
6. SDGE/OSS koraci predaje
7. najcesce greske za ovu vrstu elaborata

Vrati rezultat u tablici: Stavka | Status | Sto popraviti | Prioritet.`;
  }

  if (key === "workflow") {
    return `Napravi mi operativni predlozak za geodetski posao.

Vrsta posla: ${jobType}
Primjer/predmet: ${subject}
Kontekst: ${details}

Zelim:
1. faze posla od upita do naplate
2. dokumente koje treba prikupiti
3. radnje na terenu
4. uredske/geodetske obrade
5. SDGE/OSS/katastar korake
6. kontrolnu listu prije predaje
7. predloske statusa za kartice
8. predloske mailova prema stranci i prema instituciji`;
  }

  if (key === "mail") {
    return `Napiši profesionalan mail.

Primatelj: ${values.recipient.trim() || "[stranka / katastar / općina / kolega]"}
Predmet: ${subject}
Vrsta posla: ${jobType}
Sto zelim reci: ${details}

Napravi:
1. kratak naslov maila
2. mail tekst
3. ako treba, verziju za stranku i verziju za instituciju
4. popis priloga koje bi trebalo dodati

Ton: ljudski, profesionalan, bez previse objasnjavanja.`;
  }

  return `Napravi timski plan rada.

Predmet / grupa poslova: ${subject}
Vrsta posla: ${jobType}
Kontekst: ${details}

Zelim:
1. sto treba napraviti
2. sto moze Marko
3. sto moze Dario ili drugi clan tima
4. prioriteti danas / ovaj tjedan
5. kratka poruka koju mogu poslati clanu tima
6. upozorenja: rokovi, cekanja, blokade`;
}

export default function StellanBusinessPanel({ onClose, onUsePrompt }: Props) {
  const [active, setActive] = useState<ActionKey>("document");
  const [subject, setSubject] = useState("");
  const [jobType, setJobType] = useState(jobTypes[0]);
  const [recipient, setRecipient] = useState("");
  const [details, setDetails] = useState("");
  const [wrong, setWrong] = useState("");
  const [right, setRight] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const activeCard = actionCards.find((card) => card.key === active) || actionCards[0];
  const ActiveIcon = activeCard.icon;
  const generatedPrompt = useMemo(
    () => buildPrompt(active, { subject, jobType, recipient, details }),
    [active, subject, jobType, recipient, details],
  );

  const saveCorrection = async () => {
    if (!wrong.trim() || !right.trim()) {
      setSaveStatus("Upiši što je bilo krivo i kako treba biti.");
      return;
    }

    setSavingCorrection(true);
    setSaveStatus("");
    try {
      const content = `# Ispravak Stellan ponašanja

Kada Stellan napravi ili predloži:
${wrong.trim()}

Ispravno pravilo / način rada:
${right.trim()}

Kontekst:
${details.trim() || "Opce pravilo za GeoTerra rad."}
`;
      const { data, error } = await supabase.functions.invoke("stellan-knowledge", {
        body: {
          action: "save_document",
          title: `Ispravak: ${right.trim().slice(0, 80)}`,
          content,
          category: "firma",
          tags: ["ispravak", "stil-rada", "pravilo", "geoterra"],
          source_type: "firma",
          source_title: "Stellan ispravak",
          document_type: "text",
          mime_type: "text/markdown",
          official: false,
        },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Spremanje nije uspjelo");
      setSaveStatus("Ispravak je spremljen u Stellan znanje.");
      setWrong("");
      setRight("");
    } catch (error) {
      setSaveStatus(String((error as Error)?.message || error));
    } finally {
      setSavingCorrection(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[hsl(220,15%,7%)] text-white">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] bg-black/20 px-4 py-2.5">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Natrag
        </button>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-emerald-300" />
          <div>
            <div className="text-sm font-semibold">Stellan Posao</div>
            <div className="text-[11px] text-white/38">Zahtjevi, PDF-ovi, elaborati, mailovi, tim i ispravci</div>
          </div>
        </div>
        <button onClick={onClose} className="ml-auto text-white/35 hover:text-white/80">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_360px] gap-0 overflow-hidden">
        <aside className="border-r border-white/[0.08] bg-black/12 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/35">Akcije</div>
          <div className="space-y-2">
            {actionCards.map((card) => {
              const Icon = card.icon;
              const selected = active === card.key;
              return (
                <button
                  key={card.key}
                  onClick={() => setActive(card.key)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    selected ? "border-primary/45 bg-primary/12" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", card.color)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-white/88">{card.title}</span>
                        <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-white/50">{card.label}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/42">{card.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto p-5 scrollbar-hide">
          <div className="mb-5 rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-2 flex items-center gap-2">
              <ActiveIcon className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">{activeCard.title}</h2>
            </div>
            <p className="text-sm leading-6 text-white/55">{activeCard.description}</p>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-white/55">Predmet / stranka / čestica</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="npr. 001-2026 Pogačić Ivica - Radakovo - parcelacija"
                className="h-10 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/22 focus:border-primary/45"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-white/55">Vrsta posla</span>
                <select
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value)}
                  className="h-10 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none focus:border-primary/45"
                >
                  {jobTypes.map((type) => (
                    <option key={type} value={type} className="bg-slate-950">
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-white/55">Primatelj maila/dopisa</span>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="stranka, katastar, općina, Dario..."
                  className="h-10 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/22 focus:border-primary/45"
                />
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-white/55">Kontekst</span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Ukratko napiši situaciju, što želiš dobiti, rok, problem ili napomenu..."
                className="min-h-[120px] rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/22 focus:border-primary/45"
              />
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-white/[0.08] bg-black/20">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                <MessageSquareText className="h-4 w-4 text-emerald-300" />
                Prompt koji ide Stellanu
              </div>
              <button
                onClick={() => onUsePrompt(generatedPrompt)}
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Ubaci u chat
              </button>
            </div>
            <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-white/62 scrollbar-hide">
              {generatedPrompt}
            </pre>
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-white/[0.08] bg-black/12 p-4 scrollbar-hide">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Kako koristiti
            </div>
            <div className="space-y-2 text-xs leading-5 text-white/55">
              <p>Za PDF analizu prvo priloži PDF u chat, zatim klikni akciju PDF analiza.</p>
              <p>Za dopis/mail popuni predmet i kontekst pa ubaci prompt u chat.</p>
              <p>Za kontrolu elaborata zalijepi popis dokumenata ili dodaj PDF-ove kao privitke.</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/82">
              <Save className="h-4 w-4 text-blue-300" />
              Nauči iz ispravka
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs text-white/50">Što je bilo krivo?</span>
              <textarea
                value={wrong}
                onChange={(e) => setWrong(e.target.value)}
                placeholder="npr. predug mail, krivi ton, fali pozivanje na česticu..."
                className="min-h-[82px] rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-xs leading-5 text-white outline-none placeholder:text-white/22 focus:border-blue-400/50"
              />
            </label>
            <label className="mt-3 grid gap-1.5">
              <span className="text-xs text-white/50">Kako treba ubuduće?</span>
              <textarea
                value={right}
                onChange={(e) => setRight(e.target.value)}
                placeholder="npr. za katastar koristi kratak službeni stil i uvijek navedi k.o. i česticu..."
                className="min-h-[92px] rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-xs leading-5 text-white outline-none placeholder:text-white/22 focus:border-blue-400/50"
              />
            </label>
            <button
              onClick={saveCorrection}
              disabled={savingCorrection}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-3 text-xs font-semibold text-white hover:bg-blue-400 disabled:opacity-60"
            >
              {savingCorrection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Spremi pravilo
            </button>
            {saveStatus && (
              <p className="mt-2 text-xs leading-5 text-white/50">{saveStatus}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
