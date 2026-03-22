import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface ZahtjevData {
  // Podnositelj zahtjeva
  ime: string;
  adresa: string;
  kontakt: string;
  oib: string;
  email: string;
  // Područni ured
  podrucniUred: string;
  odjel: string;
  ispostava: string;
  // Elaborat
  katastarskiOpcina: string;
  katastarskeCestice: string;
  // Svrha
  svrhaZOG: boolean; // Zakon o gradnji
  svrhaZOPU: boolean; // Zakon o prostornom uređenju
  // Napomena
  napomena: string;
  // Potpis
  mjestoIDatum: string;
  podnositelj: string;
}

export async function fillZahtjevPDF(data: ZahtjevData): Promise<Uint8Array> {
  const templateBytes = await fetch("/templates/zahtjev-potvrda-zog-zopu.pdf").then(r => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  const color = rgb(0, 0, 0);

  // Page is A4: 595.28 x 841.89 points
  // PDF coordinates: (0,0) is bottom-left
  const pageHeight = page.getHeight();

  // Helper: convert "top-down" Y to PDF Y
  const y = (topY: number) => pageHeight - topY;

  // Left column - Podnositelj info (below "Podnositelj zahtjeva" header)
  // ime i prezime - on the line above "(ime i prezime/naziv pravne osobe)"
  page.drawText(data.ime, { x: 62, y: y(193), size: fontSize, font, color });

  // adresa - on the line above "(ulica, poštanski broj i mjesto)"
  page.drawText(data.adresa, { x: 62, y: y(233), size: fontSize, font, color });

  // kontakt
  page.drawText(data.kontakt, { x: 62, y: y(273), size: fontSize, font, color });

  // OIB
  page.drawText(data.oib, { x: 62, y: y(313), size: fontSize, font, color });

  // email
  page.drawText(data.email, { x: 62, y: y(353), size: fontSize, font, color });

  // Right column - DGU info
  // Područni ured za katastar
  page.drawText(data.podrucniUred, { x: 390, y: y(185), size: 9, font, color });

  // Odjel za katastar nekretnina
  page.drawText(data.odjel, { x: 390, y: y(210), size: 9, font, color });

  // Ispostava
  page.drawText(data.ispostava, { x: 390, y: y(240), size: 9, font, color });

  // Katastarska općina - on the line below "Katastarska općina:"
  page.drawText(data.katastarskiOpcina, { x: 62, y: y(530), size: fontSize, font, color });

  // Katastarske čestice - first line
  page.drawText(data.katastarskeCestice, { x: 62, y: y(575), size: fontSize, font, color });

  // Svrha checkboxes - draw "X" marks
  if (data.svrhaZOG) {
    page.drawText("X", { x: 62, y: y(635), size: 12, font, color });
  }
  if (data.svrhaZOPU) {
    page.drawText("X", { x: 62, y: y(655), size: 12, font, color });
  }

  // Napomena
  if (data.napomena) {
    page.drawText(data.napomena, { x: 62, y: y(710), size: fontSize, font, color });
  }

  // Mjesto i datum
  page.drawText(data.mjestoIDatum, { x: 80, y: y(770), size: fontSize, font, color });

  // Podnositelj zahtjeva (potpis)
  page.drawText(data.podnositelj, { x: 390, y: y(770), size: fontSize, font, color });

  return pdfDoc.save();
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
