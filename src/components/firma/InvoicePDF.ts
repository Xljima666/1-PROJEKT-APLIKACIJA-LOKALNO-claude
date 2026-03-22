import autoTable from "jspdf-autotable";
import { setupPDF } from "@/lib/pdf-utils";

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_address: string | null;
  client_email: string | null;
  type: string;
  status: string;
  subtotal: number;
  tax_rate: number | null;
  tax_amount: number;
  total: number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
}

const fmt = (val: number) =>
  new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

const fmtDate = (d: string) => {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}.`;
};

export const generateInvoicePDF = async (invoice: Invoice, items: InvoiceItem[]) => {
  const doc = await setupPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const typeLabel = invoice.type === "outgoing" ? "Izlazni" : "Ulazni";
  const fontName = doc.getFontList()["Roboto"] ? "Roboto" : "helvetica";

  doc.setFontSize(18);
  doc.setFont(fontName, "normal");
  doc.text(`${typeLabel} račun br. ${invoice.invoice_number}`, pageWidth / 2, 25, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Datum: ${fmtDate(invoice.created_at)}`, pageWidth - 15, 35, { align: "right" });
  if (invoice.due_date) {
    doc.text(`Rok plaćanja: ${fmtDate(invoice.due_date)}`, pageWidth - 15, 41, { align: "right" });
  }

  let y = 50;
  doc.text("Klijent:", 15, y);
  doc.text(invoice.client_name, 50, y);
  y += 6;

  if (invoice.client_address) {
    doc.text("Adresa:", 15, y);
    doc.text(invoice.client_address, 50, y);
    y += 6;
  }

  if (invoice.client_email) {
    doc.text("Email:", 15, y);
    doc.text(invoice.client_email, 50, y);
    y += 6;
  }

  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["R.br.", "Opis", "Količina", "Cijena", "Iznos"]],
    body: items.map((item, idx) => [
      String(idx + 1),
      item.description || "-",
      String(item.quantity),
      fmt(item.unit_price) + " €",
      fmt(item.total) + " €",
    ]),
    styles: { fontSize: 9, font: fontName },
    headStyles: { fillColor: [220, 38, 38], textColor: 255, font: fontName },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 30;

  doc.setFontSize(10);
  doc.text("Ukupno bez poreza:", pageWidth - 60, finalY + 10, { align: "right" });
  doc.text(fmt(invoice.subtotal) + " €", pageWidth - 15, finalY + 10, { align: "right" });

  doc.text(`PDV (${invoice.tax_rate || 25}%):`, pageWidth - 60, finalY + 17, { align: "right" });
  doc.text(fmt(invoice.tax_amount) + " €", pageWidth - 15, finalY + 17, { align: "right" });

  doc.setFontSize(12);
  doc.text("Ukupan iznos:", pageWidth - 60, finalY + 26, { align: "right" });
  doc.text(fmt(invoice.total) + " €", pageWidth - 15, finalY + 26, { align: "right" });

  if (invoice.notes) {
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(invoice.notes, pageWidth - 30);
    doc.text("Napomene:", 15, finalY + 38);
    doc.text(lines, 15, finalY + 44);
  }

  doc.save(`Racun-${invoice.invoice_number}.pdf`);
};
