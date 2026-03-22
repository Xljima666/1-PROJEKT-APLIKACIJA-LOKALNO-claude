import autoTable from "jspdf-autotable";
import { setupPDF } from "@/lib/pdf-utils";

interface QuoteItem {
  description: string;
  unit: string;
  quantity: number;
  price: number;
  discount_percent: number;
  tax_rate: number;
  total: number;
  position: number;
}

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_type: string;
  address: string | null;
  oib: string | null;
  quote_date: string;
  valid_until: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  amount: number;
  status: string;
}

const fmt = (val: number) =>
  new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

const fmtDate = (d: string) => {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}.`;
};

export const generateQuotePDF = async (quote: Quote, items: QuoteItem[]) => {
  const doc = await setupPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const fontName = doc.getFontList()["Roboto"] ? "Roboto" : "helvetica";

  doc.setFontSize(18);
  doc.setFont(fontName, "normal");
  doc.text(`Ponuda br. ${quote.quote_number}`, pageWidth / 2, 25, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Datum: ${fmtDate(quote.quote_date)}`, pageWidth - 15, 35, { align: "right" });
  if (quote.valid_until) {
    doc.text(`Vrijedi do: ${fmtDate(quote.valid_until)}`, pageWidth - 15, 41, { align: "right" });
  }

  let y = 50;
  doc.text("Naručitelj:", 15, y);
  doc.text(quote.client_name, 50, y);
  y += 6;

  if (quote.address) {
    doc.text("Adresa:", 15, y);
    doc.text(quote.address, 50, y);
    y += 6;
  }

  if (quote.oib) {
    doc.text("OIB:", 15, y);
    doc.text(quote.oib, 50, y);
    y += 6;
  }

  doc.text("Tip kupca:", 15, y);
  doc.text(quote.client_type, 50, y);
  y += 10;

  const sortedItems = [...items].sort((a, b) => a.position - b.position);

  autoTable(doc, {
    startY: y,
    head: [["R.br.", "Opis", "Jed.", "Kol.", "Cijena", "Popust", "Porez", "Iznos"]],
    body: sortedItems.map((item, idx) => [
      String(idx + 1),
      item.description || "-",
      item.unit,
      String(item.quantity),
      fmt(item.price) + " €",
      item.discount_percent + "%",
      item.tax_rate + "%",
      fmt(item.total) + " €",
    ]),
    styles: { fontSize: 9, font: fontName },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, font: fontName },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 30;

  doc.setFontSize(10);
  doc.text("Ukupno bez poreza:", pageWidth - 60, finalY + 10, { align: "right" });
  doc.text(fmt(quote.subtotal) + " €", pageWidth - 15, finalY + 10, { align: "right" });

  doc.text("Porez:", pageWidth - 60, finalY + 17, { align: "right" });
  doc.text(fmt(quote.tax_amount) + " €", pageWidth - 15, finalY + 17, { align: "right" });

  doc.setFontSize(12);
  doc.text("Ukupan iznos:", pageWidth - 60, finalY + 26, { align: "right" });
  doc.text(fmt(quote.total) + " €", pageWidth - 15, finalY + 26, { align: "right" });

  doc.save(`Ponuda-${quote.quote_number}.pdf`);
};
