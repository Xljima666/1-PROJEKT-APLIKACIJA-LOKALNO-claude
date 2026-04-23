import type { CadDoc, Layer, Shape } from "./types";

export type DwgTemplateLayer = {
  name: string;
  aciColor: number;
  cssColor: string;
  colorName: string;
  lineType: string;
  lineWeight: number;
  plottable: boolean;
  frozen: boolean;
  locked: boolean;
  plotStyleName: string;
};

export type DwgTemplateLayout = {
  name: string;
  media: string;
  plotter: string;
  styleSheet: string;
  standardScale: number;
  paperUnits: number;
  plotType: number;
};

export type DwgTemplatePreset = {
  id: string;
  title: string;
  sourceFile: string;
  variables: Record<string, string | number>;
  layers: DwgTemplateLayer[];
  layouts: DwgTemplateLayout[];
  textStyles: Array<{ name: string; fontFile: string; height: number; width: number; obliqueAngle: number }>;
  dimStyles: string[];
  blocks: string[];
};

export const dwgTemplatePresets = [
  {
    "id": "skica-izmjere-500",
    "title": "Skica izmjere 500",
    "sourceFile": "skica_izmjere_500.dwg",
    "variables": {
      "ACADVER": "20.0",
      "INSUNITS": 4,
      "LUNITS": 2,
      "LUPREC": 4,
      "AUNITS": 0,
      "AUPREC": 0,
      "MEASUREMENT": 1,
      "LTSCALE": 1.0,
      "CELTSCALE": 1.0,
      "PSLTSCALE": 1,
      "MSLTSCALE": 0,
      "DIMSCALE": 1.0,
      "DIMTXT": 0.18,
      "DIMASZ": 0.18,
      "DIMCLRD": 0,
      "DIMCLRE": 0,
      "DIMCLRT": 0,
      "TEXTSIZE": 2.5,
      "CLAYER": "0",
      "CELTYPE": "ByLayer",
      "CECOLOR": "BYLAYER",
      "CELWEIGHT": -1,
      "TILEMODE": 1
    },
    "layers": [
      {
        "name": "0",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "Papir",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "Viewport",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "TEKST",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": 13,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "1_kc_broj",
        "aciColor": 3,
        "cssColor": "#22c55e",
        "colorName": "Green",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_3"
      },
      {
        "name": "8_tocke-novo",
        "aciColor": 65,
        "cssColor": "#10b981",
        "colorName": "ACI 65",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_65"
      },
      {
        "name": "plot_kkp_hatch_150",
        "aciColor": 252,
        "cssColor": "#cbd5e1",
        "colorName": "ACI 252",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_252"
      },
      {
        "name": "si_posjednici",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "si_srafure",
        "aciColor": 4,
        "cssColor": "#06b6d4",
        "colorName": "Cyan",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_4"
      },
      {
        "name": "sit_zbirka_znakovi",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "2_zg_broj",
        "aciColor": 4,
        "cssColor": "#06b6d4",
        "colorName": "Cyan",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_4"
      },
      {
        "name": "2_zg",
        "aciColor": 4,
        "cssColor": "#06b6d4",
        "colorName": "Cyan",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_4"
      },
      {
        "name": "8_tocke",
        "aciColor": 190,
        "cssColor": "#8b5cf6",
        "colorName": "ACI 190",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_190"
      },
      {
        "name": "3_uporaba_broj",
        "aciColor": 5,
        "cssColor": "#3b82f6",
        "colorName": "Blue",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_5"
      },
      {
        "name": "2_k_broj",
        "aciColor": 30,
        "cssColor": "#f59e0b",
        "colorName": "ACI 30",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_30"
      },
      {
        "name": "1_kc_medja",
        "aciColor": 3,
        "cssColor": "#22c55e",
        "colorName": "Green",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_3"
      },
      {
        "name": "2_zg_rb",
        "aciColor": 241,
        "cssColor": "#64748b",
        "colorName": "ACI 241",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_241"
      },
      {
        "name": "si_uporaba_kratice",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "5_toponimi_20",
        "aciColor": 6,
        "cssColor": "#d946ef",
        "colorName": "Magenta",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_6"
      },
      {
        "name": "sit_8_tocke_ogi",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "plot_opis",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "3_uporaba_broj-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "3_uporaba-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "90203-1",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "si_kontrolna_odmjeranja",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "10405-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "plot_kkp_hatch_150-novo",
        "aciColor": 252,
        "cssColor": "#cbd5e1",
        "colorName": "ACI 252",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_252"
      },
      {
        "name": "plot_kkp_hatch_150-zamijenjeno",
        "aciColor": 252,
        "cssColor": "#cbd5e1",
        "colorName": "ACI 252",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_252"
      },
      {
        "name": "plot_kkp_hatch_215-zamijenjeno",
        "aciColor": 254,
        "cssColor": "#f8fafc",
        "colorName": "ACI 254",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_254"
      },
      {
        "name": "2_zg-zamijenjeno",
        "aciColor": 136,
        "cssColor": "#0ea5e9",
        "colorName": "ACI 136",
        "lineType": "90209-1",
        "lineWeight": 20,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_136"
      },
      {
        "name": "8_tocke-zamijenjeno",
        "aciColor": 194,
        "cssColor": "#a78bfa",
        "colorName": "ACI 194",
        "lineType": "90209-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_194"
      },
      {
        "name": "plot_kkp_hatch_215",
        "aciColor": 254,
        "cssColor": "#f8fafc",
        "colorName": "ACI 254",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_254"
      },
      {
        "name": "sit_detalj",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "sit_zgrade",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "1_kc_medja-snimljeno_iskolceno",
        "aciColor": 65,
        "cssColor": "#10b981",
        "colorName": "ACI 65",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_65"
      },
      {
        "name": "2_zg-prilagodjeno",
        "aciColor": 136,
        "cssColor": "#0ea5e9",
        "colorName": "ACI 136",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_136"
      },
      {
        "name": "1_kc_medja-prilagodjeno",
        "aciColor": 65,
        "cssColor": "#10b981",
        "colorName": "ACI 65",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_65"
      },
      {
        "name": "1_kc_medja-zamijenjeno",
        "aciColor": 96,
        "cssColor": "#14b8a6",
        "colorName": "ACI 96",
        "lineType": "90209-1",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_96"
      },
      {
        "name": "2_zg-snimljeno_iskolceno",
        "aciColor": 4,
        "cssColor": "#06b6d4",
        "colorName": "Cyan",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_4"
      },
      {
        "name": "si_zbirka_znakovi_go",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "plot_kkp_hatch_215-novo",
        "aciColor": 254,
        "cssColor": "#f8fafc",
        "colorName": "ACI 254",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_254"
      },
      {
        "name": "1_kc_broj-zamijenjeno",
        "aciColor": 96,
        "cssColor": "#14b8a6",
        "colorName": "ACI 96",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_96"
      },
      {
        "name": "1_kc_broj-snimljeno_iskolceno",
        "aciColor": 65,
        "cssColor": "#10b981",
        "colorName": "ACI 65",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_65"
      },
      {
        "name": "2_zg_broj-zamijenjeno",
        "aciColor": 136,
        "cssColor": "#0ea5e9",
        "colorName": "ACI 136",
        "lineType": "90209-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_136"
      },
      {
        "name": "2_zg_rb-zamijenjeno",
        "aciColor": 243,
        "cssColor": "#94a3b8",
        "colorName": "ACI 243",
        "lineType": "90209-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_243"
      },
      {
        "name": "sit_8_tocke",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "plot_pmp",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "10406-1",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "2_k_broj-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "2_zg_broj-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "2_zg_rb-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "2_zg-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "1_kc_broj-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "1_kc_medja-novo",
        "aciColor": 10,
        "cssColor": "#fb923c",
        "colorName": "ACI 10",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_10"
      },
      {
        "name": "1_kc_medja_ko",
        "aciColor": 6,
        "cssColor": "#d946ef",
        "colorName": "Magenta",
        "lineType": "90104-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_6"
      },
      {
        "name": "5_toponimi_60",
        "aciColor": 6,
        "cssColor": "#d946ef",
        "colorName": "Magenta",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_6"
      },
      {
        "name": "3_uporaba_broj-zamijenjeno",
        "aciColor": 172,
        "cssColor": "#60a5fa",
        "colorName": "ACI 172",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_172"
      },
      {
        "name": "plot_klonovi_si",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "plot_klonovi_kkp",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "plot_klonovi_pns",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "plot_klonovi_spp",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "3_uporaba-zamijenjeno",
        "aciColor": 5,
        "cssColor": "#3b82f6",
        "colorName": "Blue",
        "lineType": "90209-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_5"
      },
      {
        "name": "3_uporaba",
        "aciColor": 5,
        "cssColor": "#3b82f6",
        "colorName": "Blue",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_5"
      }
    ],
    "layouts": [
      {
        "name": "KP_PNS_1000A4",
        "media": "A4",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "KP_PNS_500A4",
        "media": "A4",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "KP_SPP_1000A4",
        "media": "A4",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "KP_SPP_500A4",
        "media": "A4",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "KPPNS_1000A3",
        "media": "A3",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "KPPNS_500A3",
        "media": "A3",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "KPSPP_1000A3",
        "media": "A3",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "KPSPP_500A3",
        "media": "A3",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "Model",
        "media": "",
        "plotter": "iR C2880",
        "styleSheet": "",
        "standardScale": 16,
        "paperUnits": 0,
        "plotType": 5
      },
      {
        "name": "Skica_1000A3",
        "media": "A3",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "Skica_1000A4",
        "media": "A4",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "Skica_500A3",
        "media": "A3",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "Skica_500A4",
        "media": "A4",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      }
    ],
    "textStyles": [
      {
        "name": "Standard",
        "fontFile": "ARIALN.TTF",
        "height": 1.5,
        "width": 1.0,
        "obliqueAngle": 0.0
      },
      {
        "name": "Zbirka_Arial Narrow",
        "fontFile": "ARIALN.TTF",
        "height": 0.0,
        "width": 1.0,
        "obliqueAngle": 0.0
      },
      {
        "name": "Zbirka_Times New Roman",
        "fontFile": "times.ttf",
        "height": 0.0,
        "width": 1.0,
        "obliqueAngle": 0.0
      },
      {
        "name": "Zbirka_Arial",
        "fontFile": "arial.ttf",
        "height": 0.0,
        "width": 1.0,
        "obliqueAngle": 0.0
      }
    ],
    "dimStyles": [
      "Standard"
    ],
    "blocks": [
      "*U0",
      "*U1",
      "kc",
      "tocke",
      "20101-1",
      "ZG",
      "UPORABA",
      "KB",
      "RB_Z",
      "10401-1",
      "dogledanja",
      "sjever1",
      "20301-1",
      "90501-1",
      "30509A-1",
      "30508A-1",
      "90502-1",
      "30504A-1",
      "30507A-1",
      "GEO TERRA",
      "A$C4cbddd4d"
    ]
  },
  {
    "id": "kkp-zk-500",
    "title": "KKP ZK 500",
    "sourceFile": "kkp_zk_500.dwg",
    "variables": {
      "ACADVER": "20.0",
      "INSUNITS": 4,
      "LUNITS": 2,
      "LUPREC": 2,
      "AUNITS": 0,
      "AUPREC": 0,
      "MEASUREMENT": 1,
      "LTSCALE": 1.0,
      "CELTSCALE": 1.0,
      "PSLTSCALE": 1,
      "MSLTSCALE": 0,
      "DIMSCALE": 1.0,
      "DIMTXT": 0.18,
      "DIMASZ": 0.18,
      "DIMCLRD": 0,
      "DIMCLRE": 0,
      "DIMCLRT": 0,
      "TEXTSIZE": 2.5,
      "CLAYER": "0",
      "CELTYPE": "ByLayer",
      "CECOLOR": "BYLAYER",
      "CELWEIGHT": -1,
      "TILEMODE": 1
    },
    "layers": [
      {
        "name": "0",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "PAPIR",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "Viewport",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "TEKST",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": 13,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "plot_kkp_hatch_150-zamijenjeno",
        "aciColor": 252,
        "cssColor": "#cbd5e1",
        "colorName": "ACI 252",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_252"
      },
      {
        "name": "plot_kkp_hatch_150-novo",
        "aciColor": 252,
        "cssColor": "#cbd5e1",
        "colorName": "ACI 252",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_252"
      },
      {
        "name": "plot_opis",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "2_k_broj",
        "aciColor": 30,
        "cssColor": "#f59e0b",
        "colorName": "ACI 30",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_30"
      },
      {
        "name": "2_zg-zamijenjeno",
        "aciColor": 136,
        "cssColor": "#0ea5e9",
        "colorName": "ACI 136",
        "lineType": "Continuous",
        "lineWeight": 20,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_136"
      },
      {
        "name": "1_kc_broj",
        "aciColor": 3,
        "cssColor": "#22c55e",
        "colorName": "Green",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_3"
      },
      {
        "name": "plot_kkp_hatch_150",
        "aciColor": 252,
        "cssColor": "#cbd5e1",
        "colorName": "ACI 252",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_252"
      },
      {
        "name": "1_kc_medja-snimljeno_iskolceno",
        "aciColor": 65,
        "cssColor": "#10b981",
        "colorName": "ACI 65",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_65"
      },
      {
        "name": "1_kc_broj-zamijenjeno",
        "aciColor": 96,
        "cssColor": "#14b8a6",
        "colorName": "ACI 96",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_96"
      },
      {
        "name": "1_kc_medja",
        "aciColor": 3,
        "cssColor": "#22c55e",
        "colorName": "Green",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_3"
      },
      {
        "name": "1_kc_medja-zamijenjeno",
        "aciColor": 96,
        "cssColor": "#14b8a6",
        "colorName": "ACI 96",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_96"
      },
      {
        "name": "2_zg",
        "aciColor": 4,
        "cssColor": "#06b6d4",
        "colorName": "Cyan",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_4"
      },
      {
        "name": "1_kc_medja-prilagodjeno",
        "aciColor": 65,
        "cssColor": "#10b981",
        "colorName": "ACI 65",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_65"
      },
      {
        "name": "2_zg-snimljeno_iskolceno",
        "aciColor": 4,
        "cssColor": "#06b6d4",
        "colorName": "Cyan",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_4"
      },
      {
        "name": "1_kc_broj-snimljeno_iskolceno",
        "aciColor": 65,
        "cssColor": "#10b981",
        "colorName": "ACI 65",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_65"
      },
      {
        "name": "plot_kkp_hatch_215-novo",
        "aciColor": 254,
        "cssColor": "#f8fafc",
        "colorName": "ACI 254",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_254"
      },
      {
        "name": "5_toponimi_20",
        "aciColor": 6,
        "cssColor": "#d946ef",
        "colorName": "Magenta",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_6"
      },
      {
        "name": "2_zg-prilagodjeno",
        "aciColor": 136,
        "cssColor": "#0ea5e9",
        "colorName": "ACI 136",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_136"
      },
      {
        "name": "2_k_broj-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "granica_ko",
        "aciColor": 6,
        "cssColor": "#d946ef",
        "colorName": "Magenta",
        "lineType": "90104-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_6"
      },
      {
        "name": "8_tocke-novo",
        "aciColor": 65,
        "cssColor": "#10b981",
        "colorName": "ACI 65",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_65"
      },
      {
        "name": "si_posjednici",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "si_srafure",
        "aciColor": 4,
        "cssColor": "#06b6d4",
        "colorName": "Cyan",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_4"
      },
      {
        "name": "sit_zbirka_znakovi",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "2_zg_broj",
        "aciColor": 4,
        "cssColor": "#06b6d4",
        "colorName": "Cyan",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_4"
      },
      {
        "name": "8_tocke",
        "aciColor": 190,
        "cssColor": "#8b5cf6",
        "colorName": "ACI 190",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_190"
      },
      {
        "name": "3_uporaba_broj",
        "aciColor": 5,
        "cssColor": "#3b82f6",
        "colorName": "Blue",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_5"
      },
      {
        "name": "2_zg_rb",
        "aciColor": 241,
        "cssColor": "#64748b",
        "colorName": "ACI 241",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_241"
      },
      {
        "name": "si_uporaba_kratice",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "sit_8_tocke_ogi",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "3_uporaba_broj-novo",
        "aciColor": 11,
        "cssColor": "#fdba74",
        "colorName": "ACI 11",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_11"
      },
      {
        "name": "3_uporaba-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "90203-1",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "si_kontrolna_odmjeranja",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "10405-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "plot_kkp_hatch_215-zamijenjeno",
        "aciColor": 254,
        "cssColor": "#f8fafc",
        "colorName": "ACI 254",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_254"
      },
      {
        "name": "8_tocke-zamijenjeno",
        "aciColor": 194,
        "cssColor": "#a78bfa",
        "colorName": "ACI 194",
        "lineType": "90209-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_194"
      },
      {
        "name": "plot_kkp_hatch_215",
        "aciColor": 254,
        "cssColor": "#f8fafc",
        "colorName": "ACI 254",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_254"
      },
      {
        "name": "sit_detalj",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "sit_zgrade",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "si_zbirka_znakovi_go",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "2_zg_broj-zamijenjeno",
        "aciColor": 136,
        "cssColor": "#0ea5e9",
        "colorName": "ACI 136",
        "lineType": "90209-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_136"
      },
      {
        "name": "2_zg_rb-zamijenjeno",
        "aciColor": 243,
        "cssColor": "#94a3b8",
        "colorName": "ACI 243",
        "lineType": "90209-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_243"
      },
      {
        "name": "sit_8_tocke",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "plot_pmp",
        "aciColor": 155,
        "cssColor": "#38bdf8",
        "colorName": "ACI 155",
        "lineType": "10406-1",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_155"
      },
      {
        "name": "2_zg_broj-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "2_zg_rb-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "2_zg-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "1_kc_broj-novo",
        "aciColor": 12,
        "cssColor": "#f97316",
        "colorName": "ACI 12",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_12"
      },
      {
        "name": "1_kc_medja-novo",
        "aciColor": 10,
        "cssColor": "#fb923c",
        "colorName": "ACI 10",
        "lineType": "Continuous",
        "lineWeight": 30,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_10"
      },
      {
        "name": "1_kc_medja_ko",
        "aciColor": 6,
        "cssColor": "#d946ef",
        "colorName": "Magenta",
        "lineType": "90104-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_6"
      },
      {
        "name": "5_toponimi_60",
        "aciColor": 6,
        "cssColor": "#d946ef",
        "colorName": "Magenta",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_6"
      },
      {
        "name": "3_uporaba_broj-zamijenjeno",
        "aciColor": 172,
        "cssColor": "#60a5fa",
        "colorName": "ACI 172",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_172"
      },
      {
        "name": "plot_klonovi_si",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "plot_klonovi_kkp",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "plot_klonovi_pns",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "plot_klonovi_spp",
        "aciColor": 7,
        "cssColor": "#f8fafc",
        "colorName": "White/Black",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_7"
      },
      {
        "name": "3_uporaba-zamijenjeno",
        "aciColor": 5,
        "cssColor": "#3b82f6",
        "colorName": "Blue",
        "lineType": "90209-1",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_5"
      },
      {
        "name": "3_uporaba",
        "aciColor": 5,
        "cssColor": "#3b82f6",
        "colorName": "Blue",
        "lineType": "Continuous",
        "lineWeight": -3,
        "plottable": true,
        "frozen": false,
        "locked": false,
        "plotStyleName": "Color_5"
      }
    ],
    "layouts": [
      {
        "name": "Model",
        "media": "Letter_(8.50_x_11.00_Inches)",
        "plotter": "None",
        "styleSheet": "",
        "standardScale": 16,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "ZK_PNS_500A3",
        "media": "A3",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "ZK_PNS_500A4",
        "media": "A4",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "ZK_SPP_500A3",
        "media": "A3",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      },
      {
        "name": "ZK_SPP_500A4",
        "media": "A4",
        "plotter": "PDF-XChange Standard",
        "styleSheet": "TS za DKP i DGE - dodatak 1 G-DGE.ctb",
        "standardScale": 0,
        "paperUnits": 1,
        "plotType": 5
      }
    ],
    "textStyles": [
      {
        "name": "Standard",
        "fontFile": "ARIALN.TTF",
        "height": 1.5,
        "width": 1.0,
        "obliqueAngle": 0.0
      },
      {
        "name": "Zbirka_Arial Narrow",
        "fontFile": "ARIALN.TTF",
        "height": 0.0,
        "width": 1.0,
        "obliqueAngle": 0.0
      },
      {
        "name": "",
        "fontFile": "",
        "height": 1.5,
        "width": 1.0,
        "obliqueAngle": 0.0
      },
      {
        "name": "Zbirka_Arial",
        "fontFile": "arial.ttf",
        "height": 0.0,
        "width": 1.0,
        "obliqueAngle": 0.0
      }
    ],
    "dimStyles": [
      "Standard"
    ],
    "blocks": [
      "*U1",
      "*U2",
      "kc",
      "kb",
      "sjever1",
      "GEO TERRA"
    ]
  }
] satisfies DwgTemplatePreset[];

export function makeCadDocFromDwgTemplate(template: DwgTemplatePreset, shapes: Shape[] = [], sourceLayers: Layer[] = []): CadDoc {
  const layers: Layer[] = template.layers.map((layer, index) => ({
    id: `dwg-${template.id}-${index}`,
    name: layer.name,
    color: layer.cssColor,
    visible: !layer.frozen,
    locked: layer.locked,
    aciColor: layer.aciColor,
    colorName: layer.colorName,
    lineType: layer.lineType,
    lineWeight: layer.lineWeight,
    plottable: layer.plottable,
    plotStyleName: layer.plotStyleName,
  }));
  const activeLayerId = layers.find((layer) => layer.name !== "0" && !layer.locked)?.id || layers[0]?.id || "0";
  const nextLayerByName = new Map(layers.map((layer) => [layer.name.toUpperCase(), layer.id]));
  const sourceLayerById = new Map(sourceLayers.map((layer) => [layer.id, layer.name.toUpperCase()]));
  return {
    version: 1,
    layers,
    activeLayerId,
    shapes: shapes.map((shape) => {
      const sourceName = sourceLayerById.get(shape.layerId);
      return { ...shape, layerId: (sourceName && nextLayerByName.get(sourceName)) || activeLayerId };
    }),
  };
}
