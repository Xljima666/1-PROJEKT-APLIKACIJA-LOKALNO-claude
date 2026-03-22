import autoTable from "jspdf-autotable";
import { setupPDF } from "@/lib/pdf-utils";

interface WorkOrderItem {
  description: string;
  unit: string;
  quantity: number;
  price: number;
  discount_percent: number;
  tax_rate: number;
  total: number;
  position: number;
}

interface WorkOrder {
  id: string;
  order_number: string;
  client_name: string;
  client_type: string;
  address: string | null;
  oib: string | null;
  worker_name: string | null;
  order_date: string;
  fault_description: string | null;
  work_description: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  hide_amounts: boolean;
  amount: number;
  status: string;
  created_at: string;
  created_by: string | null;
}

const fmt = (val: number) =>
  new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

const fmtDate = (d: string) => {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}.`;
};

export const generateWorkOrderPDF = async (order: WorkOrder, items: WorkOrderItem[]) => {
  const doc = await setupPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const fontName = doc.getFontList()["Roboto"] ? "Roboto" : "helvetica";

  // Title
  doc.setFontSize(18);
  doc.setFont(fontName, "normal");
  doc.text(`Radni nalog br. ${order.order_number}`, pageWidth / 2, 25, { align: "center" });

  // Date
  doc.setFontSize(10);
  doc.text(`Datum: ${fmtDate(order.order_date)}`, pageWidth - 15, 35, { align: "right" });

  // Client info
  let y = 45;
  doc.setFontSize(10);
  doc.text("Naručitelj:", 15, y);
  doc.text(order.client_name, 50, y);
  y += 6;

  if (order.address) {
    doc.text("Adresa:", 15, y);
    doc.text(order.address, 50, y);
    y += 6;
  }

  if (order.oib) {
    doc.text("OIB:", 15, y);
    doc.text(order.oib, 50, y);
    y += 6;
  }

  doc.text("Tip kupca:", 15, y);
  doc.text(order.client_type, 50, y);
  y += 6;

  if (order.worker_name) {
    doc.text("Djelatnik:", 15, y);
    doc.text(order.worker_name, 50, y);
    y += 6;
  }

  y += 4;

  if (order.fault_description) {
    doc.text("Opis kvara:", 15, y);
    y += 5;
    const lines = doc.splitTextToSize(order.fault_description, pageWidth - 30);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 4;
  }

  if (order.work_description) {
    doc.text("Opis radova:", 15, y);
    y += 5;
    const lines = doc.splitTextToSize(order.work_description, pageWidth - 30);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 4;
  }

  y += 4;

  const sortedItems = [...items].sort((a, b) => a.position - b.position);

  if (!order.hide_amounts) {
    autoTable(doc, {
      startY: y,
      head: [["R.br.", "Opis proizvoda/usluge", "Jed.", "Kol.", "Cijena", "Porez", "Iznos stavke"]],
      body: sortedItems.map((item, idx) => [
        String(idx + 1),
        item.description || "-",
        item.unit,
        String(item.quantity),
        fmt(item.price) + " €",
        item.tax_rate + "%",
        fmt(item.total) + " €",
      ]),
      styles: { fontSize: 9, font: fontName },
      headStyles: { fillColor: [34, 139, 34], textColor: 255, font: fontName },
      margin: { left: 15, right: 15 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || y + 30;

    doc.setFontSize(10);
    doc.text("Ukupno bez poreza:", pageWidth - 60, finalY + 10, { align: "right" });
    doc.text(fmt(order.subtotal) + " €", pageWidth - 15, finalY + 10, { align: "right" });

    doc.text("Porez:", pageWidth - 60, finalY + 17, { align: "right" });
    doc.text(fmt(order.tax_amount) + " €", pageWidth - 15, finalY + 17, { align: "right" });

    doc.setFontSize(12);
    doc.text("Ukupan iznos:", pageWidth - 60, finalY + 26, { align: "right" });
    doc.text(fmt(order.total) + " €", pageWidth - 15, finalY + 26, { align: "right" });
  } else {
    autoTable(doc, {
      startY: y,
      head: [["R.br.", "Opis proizvoda/usluge", "Jed.", "Kol."]],
      body: sortedItems.map((item, idx) => [
        String(idx + 1),
        item.description || "-",
        item.unit,
        String(item.quantity),
      ]),
      styles: { fontSize: 9, font: fontName },
      headStyles: { fillColor: [34, 139, 34], textColor: 255, font: fontName },
      margin: { left: 15, right: 15 },
    });
  }

  doc.save(`Radni-nalog-${order.order_number}.pdf`);
};
