import DashboardLayout from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Crosshair,
  ExternalLink,
  FileDown,
  FolderOpen,
  Grid3X3,
  Layers,
  MousePointer2,
  Move,
  Ruler,
  Search,
  Settings,
  Square,
  Terminal,
  TriangleRight,
  Upload,
  ZoomIn,
} from "lucide-react";

const menuItems = [
  "File",
  "Edit",
  "View",
  "Insert",
  "Format",
  "Tools",
  "Draw",
  "Dimension",
  "Modify",
  "Parametric",
  "Smart",
  "Express",
  "Window",
  "Help",
  "GeoService",
  "APP+",
  "Tocke",
  "Pomocni",
  "Prikazi",
  "Kartografski znakovi",
  "Digitalni elaborat",
  "Dodaci",
];

const quickLinks = [
  { label: "OSS", url: "https://oss.uredjenazemlja.hr" },
  { label: "SDGE", url: "https://sdge.dgu.hr" },
  { label: "DXF2GML", url: "https://dxf2gml.dgu.hr/" },
  { label: "ISPU", url: "https://ispu.mgipu.hr/#/" },
];

const geoHrIcons = [
  "skica.bmp",
  "gmltxt.bmp",
  "kod.BMP",
  "laydef.BMP",
  "laystil.bmp",
  "linon.bmp",
  "lindt.BMP",
  "mj.bmp",
  "mjon.bmp",
  "mjoff.bmp",
  "Tocka1.bmp",
  "tocka4.bmp",
  "VisinskaTocka.bmp",
  "sud.bmp",
  "sudskatocka.BMP",
  "brposj.bmp",
  "kota.bmp",
  "povrsina.BMP",
  "posj.bmp",
  "postxt.bmp",
  "fron.bmp",
  "frnt1.bmp",
  "frnt2.BMP",
  "pns.BMP",
  "spp.BMP",
  "sn.BMP",
  "f1.bmp",
  "f2.BMP",
  "f3.BMP",
  "f4.BMP",
  "f5.BMP",
  "l1.BMP",
  "l2.BMP",
  "l3.BMP",
  "l4.BMP",
  "l5.BMP",
  "l6.BMP",
  "l7.BMP",
];

const geoHrStats = [
  ["DWG blokovi", "385"],
  ["SLD simboli", "374"],
  ["LISP alati", "123"],
  ["BMP ikone", "102"],
  ["DWT template", "5"],
];

const templates = [
  "Digitalna_skica_original.dwt",
  "Prazan_crtez.dwt",
  "Skica_izmjere.dwt",
  "Skica_izmjere_sud.dwt",
  "Terenska_situacija.dwt",
];

const layerTools = ["S1", "SP", "NS", "SN", "C1", "C2", "L1", "L2", "L3", "L4", "L5", "L6", "L7"];

function ToolbarButton({
  children,
  active,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      title={title}
      className={cn(
        "flex h-6 min-w-6 items-center justify-center border border-[#607181] bg-[#344451] px-1 text-[10px] font-semibold text-slate-100 shadow-[inset_0_1px_rgba(255,255,255,0.12)] hover:bg-[#46596a]",
        active && "border-blue-400 bg-[#1f6fb5] text-white",
      )}
    >
      {children}
    </button>
  );
}

function SelectLike({ label, width = "w-36" }: { label: string; width?: string }) {
  return (
    <button className={cn("flex h-7 items-center justify-between border border-[#607181] bg-[#18232d] px-2 text-[11px] text-slate-200", width)}>
      <span>{label}</span>
      <ChevronDown className="h-3 w-3 text-slate-400" />
    </button>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[70px_1fr] border-b border-[#52616e]/60 px-2 py-1 text-[11px] leading-4">
      <span className="truncate text-slate-300">{label}</span>
      <span className="truncate text-slate-100">{value}</span>
    </div>
  );
}

const Invoices = () => {
  return (
    <DashboardLayout noScroll>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#17232d] text-slate-100">
        <div className="shrink-0 border-b border-[#354653] bg-[#26333f]">
          <div className="flex h-7 items-center gap-4 px-2 text-[13px] text-slate-100">
            {menuItems.map((item) => (
              <button key={item} className="whitespace-nowrap hover:text-blue-300">
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-t border-[#40515f] px-2 py-1">
            <ToolbarButton title="Novi crtez">
              <FolderOpen className="h-3.5 w-3.5 text-sky-300" />
            </ToolbarButton>
            <ToolbarButton title="Import DXF">
              <Upload className="h-3.5 w-3.5 text-cyan-300" />
            </ToolbarButton>
            <ToolbarButton title="Export DXF">
              <FileDown className="h-3.5 w-3.5 text-emerald-300" />
            </ToolbarButton>
            <div className="mx-1 h-5 w-px bg-[#607181]" />
            {layerTools.map((label, index) => (
              <ToolbarButton key={label} active={index === 0}>
                {label}
              </ToolbarButton>
            ))}
            <div className="mx-1 h-5 w-px bg-[#607181]" />
            <SelectLike label="Standard" width="w-32" />
            <SelectLike label="ISO-25" width="w-28" />
            <SelectLike label="ByLayer" width="w-40" />
            <SelectLike label="ByColor" width="w-32" />
          </div>

          <div className="flex min-h-8 items-center gap-1 border-t border-[#40515f] px-2 py-1">
            {geoHrIcons.map((icon) => (
              <button
                key={icon}
                title={icon.replace(/\.(bmp)$/i, "")}
                className="flex h-6 w-6 items-center justify-center border border-[#607181] bg-[#2e3d49] hover:bg-[#415361]"
              >
                <img src={`/geohr/icons/${icon}`} alt="" className="h-4 w-4 image-rendering-pixelated" />
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[230px_minmax(0,1fr)] overflow-hidden">
          <aside className="flex min-h-0 flex-col border-r border-[#354653] bg-[#3a4855]">
            <div className="flex h-9 items-center justify-between border-b border-[#52616e] px-2 text-[12px] font-semibold">
              <span>Properties</span>
              <Settings className="h-3.5 w-3.5 text-slate-300" />
            </div>
            <div className="border-b border-[#52616e] p-2">
              <button className="flex h-7 w-full items-center justify-between bg-[#26333f] px-2 text-left text-[12px] text-slate-200">
                No selection
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="bg-[#273541] px-2 py-1 text-[12px] font-semibold">General</div>
              <PropertyRow label="Color" value="ByLayer" />
              <PropertyRow label="Layer" value="0" />
              <PropertyRow label="Linetype" value="ByLayer" />
              <PropertyRow label="Lineweight" value="Default" />
              <PropertyRow label="Transparency" value="ByLayer" />
              <PropertyRow label="Thickness" value="0" />
              <div className="mt-2 bg-[#273541] px-2 py-1 text-[12px] font-semibold">View</div>
              <PropertyRow label="Center X" value="49.3605" />
              <PropertyRow label="Center Y" value="38.9759" />
              <PropertyRow label="Height" value="481.6516" />
              <PropertyRow label="Width" value="927.7863" />
              <div className="mt-2 bg-[#273541] px-2 py-1 text-[12px] font-semibold">GeoHR</div>
              {geoHrStats.map(([label, value]) => (
                <PropertyRow key={label} label={label} value={value} />
              ))}
            </div>
          </aside>

          <main className="relative min-h-0 overflow-hidden bg-[#18232d]">
            <div className="absolute left-2 top-1 z-10 flex items-center gap-2 text-[11px] text-slate-300">
              <span>[-]</span>
              <span>[Top]</span>
              <span>[2D Wireframe]</span>
              <span>[WCS]</span>
            </div>

            <div className="absolute right-5 top-5 z-10 w-[286px] rounded-sm border border-[#4c5d69] bg-[#202d38]/95 p-3 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center bg-lime-600 text-white">
                  <Grid3X3 className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">GeoHR paket ucitan</p>
                  <p className="text-xs text-slate-300">Ikone, upute, template i popis alata iz zipa.</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                {geoHrStats.slice(0, 3).map(([label, value]) => (
                  <div key={label} className="border border-[#4c5d69] bg-[#151f28] p-1">
                    <div className="font-semibold text-slate-100">{value}</div>
                    <div className="text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute right-8 top-40 z-10 flex h-28 w-28 items-center justify-center rounded-full border-[16px] border-slate-600/30 text-slate-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-300/80 text-[11px] font-bold text-slate-700">
                TOP
              </div>
              <span className="absolute top-1 text-sm font-semibold">N</span>
              <span className="absolute bottom-1 text-sm font-semibold">S</span>
              <span className="absolute right-1 text-sm font-semibold">E</span>
              <span className="absolute left-1 text-sm font-semibold">W</span>
            </div>

            <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <pattern id="cad-grid-small" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(148,163,184,0.035)" strokeWidth="1" />
                </pattern>
                <pattern id="cad-grid" width="120" height="120" patternUnits="userSpaceOnUse">
                  <rect width="120" height="120" fill="url(#cad-grid-small)" />
                  <path d="M 120 0 L 0 0 0 120" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cad-grid)" />
              <g stroke="rgba(226,232,240,0.74)" strokeWidth="1.5">
                <line x1="45%" y1="42%" x2="45%" y2="52%" />
                <line x1="41.5%" y1="47%" x2="48.5%" y2="47%" />
                <rect x="44.6%" y="46.55%" width="0.8%" height="0.9%" fill="none" />
              </g>
              <g transform="translate(38 820)" stroke="rgba(226,232,240,0.78)" strokeWidth="1.4" fill="none">
                <path d="M0 130 L0 20 M0 130 L110 130" />
                <path d="M0 20 L-7 40 M0 20 L7 40" />
                <path d="M110 130 L90 123 M110 130 L90 137" />
                <rect x="-8" y="122" width="16" height="16" />
                <text x="122" y="139" fill="rgba(226,232,240,0.78)" stroke="none" fontSize="22">X</text>
                <text x="-8" y="0" fill="rgba(226,232,240,0.78)" stroke="none" fontSize="22">Y</text>
              </g>
            </svg>

            <div className="absolute bottom-9 left-1/2 z-10 flex h-8 w-[55%] -translate-x-1/2 items-center border border-[#5f6f7c] bg-[#657482]/70 px-3 text-xs text-slate-100">
              <Terminal className="mr-2 h-3.5 w-3.5" />
              Command:
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 flex h-8 items-center justify-between border-t border-[#354653] bg-[#2e3d49] px-2 text-[11px]">
              <div className="flex h-full items-center gap-1">
                <button className="h-full bg-[#4d5c68] px-5 font-semibold text-white">Model</button>
                <button className="h-full px-5 text-slate-200 hover:bg-[#40515f]">Layout1</button>
                <button className="h-full px-5 text-slate-200 hover:bg-[#40515f]">Layout2</button>
              </div>
              <div className="flex items-center gap-1">
                {[MousePointer2, Crosshair, Move, Ruler, Layers, Square, TriangleRight, ZoomIn].map((Icon, index) => (
                  <ToolbarButton key={index} active={index < 2}>
                    <Icon className="h-3.5 w-3.5" />
                  </ToolbarButton>
                ))}
                <span className="ml-2 text-slate-300">millimeters</span>
              </div>
            </div>

            <div className="absolute left-4 top-12 z-10 flex gap-2">
              {quickLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 items-center gap-1 border border-[#607181] bg-[#26333f] px-2 text-[11px] hover:bg-[#40515f]"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
              <a
                href="/geohr/GeoHR_upute.pdf"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 border border-[#607181] bg-[#26333f] px-2 text-[11px] hover:bg-[#40515f]"
              >
                GeoHR upute
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="absolute left-4 top-24 z-10 max-w-[420px] rounded border border-[#425360] bg-[#121d26]/80 p-3 text-xs text-slate-300">
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-100">
                <Search className="h-3.5 w-3.5 text-cyan-300" />
                GeoHR template
              </div>
              <div className="grid grid-cols-1 gap-1">
                {templates.map((name) => (
                  <button key={name} className="flex items-center justify-between border border-[#334451] bg-[#1b2833] px-2 py-1 text-left hover:bg-[#263846]">
                    <span>{name}</span>
                    <span className="text-slate-500">DWT</span>
                  </button>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
