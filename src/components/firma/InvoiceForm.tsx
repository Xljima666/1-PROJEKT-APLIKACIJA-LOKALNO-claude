import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
}

const emptyItem = (): InvoiceItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: "1",
  unit_price: "",
});

interface InvoiceFormProps {
  type: "outgoing" | "incoming";
  onSuccess: () => void;
  editInvoice?: any;
}

const InvoiceForm = ({ type, onSuccess, editInvoice }: InvoiceFormProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!editInvoice;

  const [form, setForm] = useState({
    invoice_number: editInvoice?.invoice_number || "",
    client_name: editInvoice?.client_name || "",
    client_address: editInvoice?.client_address || "",
    client_email: editInvoice?.client_email || "",
    due_date: editInvoice?.due_date || "",
    tax_rate: String(editInvoice?.tax_rate ?? "25"),
    notes: editInvoice?.notes || "",
  });

  const { data: existingItems } = useQuery({
    queryKey: ["invoice-items", editInvoice?.id],
    queryFn: async () => {
      if (!editInvoice?.id) return null;
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", editInvoice.id);
      if (error) throw error;
      return data;
    },
    enabled: !!editInvoice?.id,
  });

  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [itemsInitialized, setItemsInitialized] = useState(false);

  if (isEditing && existingItems && !itemsInitialized) {
    const mapped = existingItems.map((ei) => ({
      id: ei.id,
      description: ei.description,
      quantity: String(ei.quantity),
      unit_price: String(ei.unit_price),
    }));
    if (mapped.length > 0) setItems(mapped);
    setItemsInitialized(true);
  }

  const calcTotal = (item: InvoiceItem) => {
    return (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  };

  const subtotal = items.reduce((s, i) => s + calcTotal(i), 0);
  const taxRate = parseFloat(form.tax_rate) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const updateItem = (id: string, field: keyof InvoiceItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (id: string) => {
    if (items.length > 1) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const invoiceData = {
        invoice_number: form.invoice_number,
        client_name: form.client_name,
        client_address: form.client_address || null,
        client_email: form.client_email || null,
        due_date: form.due_date || null,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        subtotal,
        total,
        notes: form.notes || null,
        type,
        status: isEditing ? editInvoice.status : "draft",
      };

      let invoiceId: string;

      if (isEditing) {
        const { error } = await supabase.from("invoices").update(invoiceData).eq("id", editInvoice.id);
        if (error) throw error;
        invoiceId = editInvoice.id;

        await supabase.from("invoice_items").delete().eq("invoice_id", editInvoice.id);
      } else {
        const { data: inv, error } = await supabase
          .from("invoices")
          .insert({ ...invoiceData, created_by: user?.id })
          .select("id")
          .single();
        if (error) throw error;
        invoiceId = inv.id;
      }

      const itemsToInsert = items.map((item) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
        total: calcTotal(item),
      }));

      const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      toast.success(isEditing ? "Račun ažuriran!" : "Račun spremljen!");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onSuccess();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("invoice_items").delete().eq("invoice_id", editInvoice.id);
      const { error } = await supabase.from("invoices").delete().eq("id", editInvoice.id);
      if (error) throw error;
      toast.success("Račun izbrisan!");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onSuccess();
    },
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("hr-HR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createMutation.mutate();
      }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Broj računa</Label>
          <Input
            value={form.invoice_number}
            onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
            placeholder="R-001-2026"
            required
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Rok plaćanja</Label>
          <Input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Klijent</Label>
          <Input
            value={form.client_name}
            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            placeholder="Naziv"
            required
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Adresa</Label>
          <Input
            value={form.client_address}
            onChange={(e) => setForm({ ...form, client_address: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input
            type="email"
            value={form.client_email}
            onChange={(e) => setForm({ ...form, client_email: e.target.value })}
          />
        </div>
      </div>

      {/* Stavke */}
      <div>
        <Label className="text-sm font-medium">Stavke računa</Label>
        <div className="space-y-3 mt-2">
          {items.map((item) => (
            <div key={item.id} className="border border-border rounded-md p-4 relative">
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(item.id)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Opis</Label>
                  <Input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Količina</Label>
                  <Input type="number" min="0" step="any" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cijena</Label>
                  <Input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(item.id, "unit_price", e.target.value)} placeholder="0,00" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3">
          <Button type="button" size="icon" variant="default" className="h-9 w-9 rounded-md bg-primary hover:bg-primary/90" onClick={() => setItems([...items, emptyItem()])}>
            <Plus className="w-4 h-4" />
          </Button>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(total)} €</div>
            <div className="text-sm text-muted-foreground">Bez PDV: {formatCurrency(subtotal)} € | PDV: {formatCurrency(taxAmount)} €</div>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Stopa PDV-a (%)</Label>
        <Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Napomene</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
          {createMutation.isPending ? "SPREMANJE..." : isEditing ? "SPREMI IZMJENE" : "SPREMI RAČUN"}
        </Button>

        {isEditing && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" size="icon" className="shrink-0" disabled={deleteMutation.isPending}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Izbrisati račun?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ova radnja je nepovratna. Račun "{editInvoice.invoice_number}" će biti trajno izbrisan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Odustani</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Izbriši
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </form>
  );
};

export default InvoiceForm;
