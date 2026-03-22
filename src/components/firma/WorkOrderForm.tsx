import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
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

interface OrderItem {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  price: string;
  discount_percent: string;
  tax_rate: string;
}

const emptyItem = (): OrderItem => ({
  id: crypto.randomUUID(),
  description: "",
  unit: "kom",
  quantity: "1",
  price: "",
  discount_percent: "0",
  tax_rate: "25",
});

const calcItemTotal = (item: OrderItem) => {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.price) || 0;
  const discount = parseFloat(item.discount_percent) || 0;
  const tax = parseFloat(item.tax_rate) || 0;
  const base = qty * price * (1 - discount / 100);
  return base * (1 + tax / 100);
};

const calcItemSubtotal = (item: OrderItem) => {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.price) || 0;
  const discount = parseFloat(item.discount_percent) || 0;
  return qty * price * (1 - discount / 100);
};

interface WorkOrderFormProps {
  onSuccess: () => void;
  editOrder?: any; // existing work order to edit
}

const WorkOrderForm = ({ onSuccess, editOrder }: WorkOrderFormProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!editOrder;

  const [form, setForm] = useState({
    client_type: editOrder?.client_type || "B2C",
    order_number: editOrder?.order_number || "",
    hide_amounts: editOrder?.hide_amounts || false,
    client_name: editOrder?.client_name || "",
    address: editOrder?.address || "",
    oib: editOrder?.oib || "",
    vat_id: "",
    kpd_oznaka: "",
    worker_name: editOrder?.worker_name || "",
    order_date: editOrder?.order_date || format(new Date(), "yyyy-MM-dd"),
    fault_description: editOrder?.fault_description || "",
    work_description: editOrder?.work_description || "",
    currency: editOrder?.currency || "EUR",
  });

  // Load existing items when editing
  const { data: existingItems } = useQuery({
    queryKey: ["work-order-items", editOrder?.id],
    queryFn: async () => {
      if (!editOrder?.id) return null;
      const { data, error } = await supabase
        .from("work_order_items")
        .select("*")
        .eq("work_order_id", editOrder.id)
        .order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!editOrder?.id,
  });

  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);
  const [itemsInitialized, setItemsInitialized] = useState(false);

  // Initialize items from DB when editing
  if (isEditing && existingItems && !itemsInitialized) {
    const mapped = existingItems.map((ei) => ({
      id: ei.id,
      description: ei.description,
      unit: ei.unit,
      quantity: String(ei.quantity),
      price: String(ei.price),
      discount_percent: String(ei.discount_percent),
      tax_rate: String(ei.tax_rate),
    }));
    if (mapped.length > 0) {
      setItems(mapped);
    }
    setItemsInitialized(true);
  }

  const totalWithTax = items.reduce((s, i) => s + calcItemTotal(i), 0);
  const subtotal = items.reduce((s, i) => s + calcItemSubtotal(i), 0);

  const updateItem = (id: string, field: keyof OrderItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (id: string) => {
    if (items.length > 1) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isEditing) {
        // Update existing work order
        const { error: woError } = await supabase
          .from("work_orders")
          .update({
            order_number: form.order_number,
            client_name: form.client_name,
            client_type: form.client_type,
            address: form.address || null,
            oib: form.oib || null,
            worker_name: form.worker_name || null,
            fault_description: form.fault_description || null,
            work_description: form.work_description || null,
            hide_amounts: form.hide_amounts,
            currency: form.currency,
            amount: totalWithTax,
            subtotal,
            tax_amount: totalWithTax - subtotal,
            total: totalWithTax,
            order_date: form.order_date,
          })
          .eq("id", editOrder.id);
        if (woError) throw woError;

        // Delete old items and re-insert
        const { error: delError } = await supabase
          .from("work_order_items")
          .delete()
          .eq("work_order_id", editOrder.id);
        if (delError) throw delError;

        const itemsToInsert = items.map((item, idx) => ({
          work_order_id: editOrder.id,
          description: item.description,
          unit: item.unit,
          quantity: parseFloat(item.quantity) || 1,
          price: parseFloat(item.price) || 0,
          discount_percent: parseFloat(item.discount_percent) || 0,
          tax_rate: parseFloat(item.tax_rate) || 25,
          total: calcItemTotal(item),
          position: idx,
        }));

        const { error: itemsError } = await supabase
          .from("work_order_items")
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;

        toast.success("Radni nalog ažuriran!");
      } else {
        // Create new work order
        const { data: wo, error: woError } = await supabase
          .from("work_orders")
          .insert({
            order_number: form.order_number,
            client_name: form.client_name,
            client_type: form.client_type,
            address: form.address || null,
            oib: form.oib || null,
            worker_name: form.worker_name || null,
            fault_description: form.fault_description || null,
            work_description: form.work_description || null,
            hide_amounts: form.hide_amounts,
            currency: form.currency,
            amount: totalWithTax,
            subtotal,
            tax_amount: totalWithTax - subtotal,
            total: totalWithTax,
            order_date: form.order_date,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (woError) throw woError;

        const itemsToInsert = items.map((item, idx) => ({
          work_order_id: wo.id,
          description: item.description,
          unit: item.unit,
          quantity: parseFloat(item.quantity) || 1,
          price: parseFloat(item.price) || 0,
          discount_percent: parseFloat(item.discount_percent) || 0,
          tax_rate: parseFloat(item.tax_rate) || 25,
          total: calcItemTotal(item),
          position: idx,
        }));

        const { error: itemsError } = await supabase
          .from("work_order_items")
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;

        // Create quote with same data
        const quoteNumber = `P-${form.order_number}`;
        const { data: quote, error: quoteError } = await supabase
          .from("quotes")
          .insert({
            quote_number: quoteNumber,
            client_name: form.client_name,
            client_type: form.client_type,
            address: form.address || null,
            oib: form.oib || null,
            currency: form.currency,
            amount: totalWithTax,
            subtotal,
            tax_amount: totalWithTax - subtotal,
            total: totalWithTax,
            quote_date: form.order_date,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (quoteError) throw quoteError;

        const quoteItems = items.map((item, idx) => ({
          quote_id: quote.id,
          description: item.description,
          unit: item.unit,
          quantity: parseFloat(item.quantity) || 1,
          price: parseFloat(item.price) || 0,
          discount_percent: parseFloat(item.discount_percent) || 0,
          tax_rate: parseFloat(item.tax_rate) || 25,
          total: calcItemTotal(item),
          position: idx,
        }));

        const { error: quoteItemsError } = await supabase
          .from("quote_items")
          .insert(quoteItems);
        if (quoteItemsError) throw quoteItemsError;

        // Create outgoing invoice with same data
        const invoiceNumber = `R-${form.order_number}`;
        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            invoice_number: invoiceNumber,
            client_name: form.client_name,
            client_address: form.address || null,
            type: "outgoing",
            status: "draft",
            subtotal,
            tax_rate: items.length > 0 ? parseFloat(items[0].tax_rate) || 25 : 25,
            tax_amount: totalWithTax - subtotal,
            total: totalWithTax,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (invoiceError) throw invoiceError;

        const invoiceItems = items.map((item) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: parseFloat(item.quantity) || 1,
          unit_price: parseFloat(item.price) || 0,
          total: calcItemTotal(item),
        }));

        const { error: invItemsError } = await supabase
          .from("invoice_items")
          .insert(invoiceItems);
        if (invItemsError) throw invItemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", "outgoing"] });
      onSuccess();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Delete items first, then the order
      const { error: itemsError } = await supabase
        .from("work_order_items")
        .delete()
        .eq("work_order_id", editOrder.id);
      if (itemsError) throw itemsError;

      const { error } = await supabase
        .from("work_orders")
        .delete()
        .eq("id", editOrder.id);
      if (error) throw error;

      toast.success("Radni nalog izbrisan!");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
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
      {/* Row 1: Tip kupca, Broj, Sakrij iznose */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
        <div>
          <Label className="text-xs text-muted-foreground">Tip kupca</Label>
          <Select
            value={form.client_type}
            onValueChange={(v) => {
              setForm({ ...form, client_type: v });
              if (v === "EU" || v === "INT") {
                setItems((prev) =>
                  prev.map((item) => ({ ...item, tax_rate: "0" }))
                );
              } else {
                setItems((prev) =>
                  prev.map((item) =>
                    item.tax_rate === "0" ? { ...item, tax_rate: "25" } : item
                  )
                );
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="B2C">B2C – Fizička osoba</SelectItem>
              <SelectItem value="B2B">B2B – Poslovni subjekt iz HR</SelectItem>
              <SelectItem value="B2G">B2G – Država i javna nabava</SelectItem>
              <SelectItem value="EU">EU – Unutar europske unije</SelectItem>
              <SelectItem value="INT">INT – Ostatak svijeta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Broj radnog naloga</Label>
          <Input
            value={form.order_number}
            onChange={(e) => setForm({ ...form, order_number: e.target.value })}
            placeholder="001-2026"
            required
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            id="hide-amounts"
            checked={form.hide_amounts}
            onCheckedChange={(v) =>
              setForm({ ...form, hide_amounts: v === true })
            }
          />
          <Label htmlFor="hide-amounts" className="text-xs text-muted-foreground cursor-pointer">
            Sakrij iznose
          </Label>
        </div>
      </div>

      {/* Row 2: Naručitelj + dynamic fields based on client type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">
            {form.client_type === "B2C" ? "Naručitelj" : "Naziv tvrtke / Naručitelj"}
          </Label>
          <Input
            value={form.client_name}
            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            placeholder={form.client_type === "B2C" ? "Ime i prezime" : "Naziv tvrtke"}
            required
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Adresa</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            {form.client_type === "EU" ? "VAT ID" : "OIB"}
          </Label>
          <Input
            value={form.client_type === "EU" ? form.vat_id : form.oib}
            onChange={(e) =>
              form.client_type === "EU"
                ? setForm({ ...form, vat_id: e.target.value })
                : setForm({ ...form, oib: e.target.value })
            }
            placeholder={form.client_type === "EU" ? "HR12345678901" : "12345678901"}
            required={form.client_type === "B2B" || form.client_type === "B2G"}
          />
        </div>
      </div>

      {/* KPD oznaka - visible for B2B and B2G */}
      {(form.client_type === "B2B" || form.client_type === "B2G") && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              KPD oznaka <span className="text-muted-foreground/60">(kupoprodajni dokument)</span>
            </Label>
            <Input
              value={form.kpd_oznaka}
              onChange={(e) => setForm({ ...form, kpd_oznaka: e.target.value })}
              placeholder="KPD-001-2026"
            />
          </div>
        </div>
      )}

      {/* EU VAT notice */}
      {form.client_type === "EU" && (
        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          Prijenos porezne obveze – reverse charge (čl. 75. Zakona o PDV-u). Stopa PDV-a: 0%.
        </p>
      )}

      {/* INT notice */}
      {form.client_type === "INT" && (
        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          Izvoz – oslobođeno PDV-a (čl. 45. Zakona o PDV-u). Stopa PDV-a: 0%.
        </p>
      )}

      {/* Stavke radnog naloga */}
      <div>
        <Label className="text-sm font-medium">Stavke radnog naloga</Label>
        <div className="space-y-3 mt-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-border rounded-md p-4 relative"
            >
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="mb-3">
                <Label className="text-xs text-muted-foreground">
                  Opis usluge/proizvoda
                </Label>
                <Textarea
                  value={item.description}
                  onChange={(e) =>
                    updateItem(item.id, "description", e.target.value)
                  }
                  placeholder="Upis objekta na k. č. br."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Jed. mjera</Label>
                  <Select
                    value={item.unit}
                    onValueChange={(v) => updateItem(item.id, "unit", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kom">kom</SelectItem>
                      <SelectItem value="sat">sat</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                      <SelectItem value="m2">m²</SelectItem>
                      <SelectItem value="m3">m³</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="l">l</SelectItem>
                      <SelectItem value="pauš">pauš</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Količina</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, "quantity", e.target.value)
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      x
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cijena</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) =>
                        updateItem(item.id, "price", e.target.value)
                      }
                      placeholder="0,00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      €
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Popust</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={item.discount_percent}
                      onChange={(e) =>
                        updateItem(item.id, "discount_percent", e.target.value)
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Porez. stopa</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={item.tax_rate}
                      onChange={(e) =>
                        updateItem(item.id, "tax_rate", e.target.value)
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3">
          <Button
            type="button"
            size="icon"
            variant="default"
            className="h-9 w-9 rounded-md bg-primary hover:bg-primary/90"
            onClick={() => setItems([...items, emptyItem()])}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(totalWithTax)}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(subtotal)}</div>
          </div>
        </div>
      </div>

      {/* Djelatnik + Datum */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">
            Djelatnik <span className="text-muted-foreground/60">(koji je izvršio radove)</span>
          </Label>
          <Input
            value={form.worker_name}
            onChange={(e) => setForm({ ...form, worker_name: e.target.value })}
            placeholder="Ime i prezime"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Datum rad. naloga</Label>
          <Input
            type="date"
            value={form.order_date}
            onChange={(e) => setForm({ ...form, order_date: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Opis kvara */}
      <div>
        <Label className="text-xs text-muted-foreground">
          Opis kvara <span className="text-muted-foreground/60">(ili upisati napomene)</span>
        </Label>
        <Textarea
          value={form.fault_description}
          onChange={(e) =>
            setForm({ ...form, fault_description: e.target.value })
          }
          rows={2}
        />
      </div>

      {/* Opis radova */}
      <div>
        <Label className="text-xs text-muted-foreground">Opis radova</Label>
        <Textarea
          value={form.work_description}
          onChange={(e) =>
            setForm({ ...form, work_description: e.target.value })
          }
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="submit"
          className="flex-1"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? "SPREMANJE..."
            : isEditing
            ? "SPREMI IZMJENE"
            : "SPREMI PROMJENE"}
        </Button>

        {isEditing && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="shrink-0"
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Izbrisati radni nalog?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ova radnja je nepovratna. Radni nalog "{editOrder.order_number}" će biti trajno izbrisan.
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

export default WorkOrderForm;
