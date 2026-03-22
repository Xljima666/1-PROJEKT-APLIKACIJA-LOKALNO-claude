import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface QuoteItem {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  price: string;
  discount_percent: string;
  tax_rate: string;
}

const emptyItem = (): QuoteItem => ({
  id: crypto.randomUUID(),
  description: "",
  unit: "kom",
  quantity: "1",
  price: "",
  discount_percent: "0",
  tax_rate: "25",
});

const calcItemTotal = (item: QuoteItem) => {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.price) || 0;
  const discount = parseFloat(item.discount_percent) || 0;
  const tax = parseFloat(item.tax_rate) || 0;
  const base = qty * price * (1 - discount / 100);
  return base * (1 + tax / 100);
};

const calcItemSubtotal = (item: QuoteItem) => {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.price) || 0;
  const discount = parseFloat(item.discount_percent) || 0;
  return qty * price * (1 - discount / 100);
};

interface QuoteFormProps {
  onSuccess: () => void;
  editQuote?: any;
}

const QuoteForm = ({ onSuccess, editQuote }: QuoteFormProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!editQuote;

  const [form, setForm] = useState({
    client_type: editQuote?.client_type || "B2C",
    quote_number: editQuote?.quote_number || "",
    client_name: editQuote?.client_name || "",
    address: editQuote?.address || "",
    oib: editQuote?.oib || "",
    quote_date: editQuote?.quote_date || format(new Date(), "yyyy-MM-dd"),
    valid_until: editQuote?.valid_until || "",
    currency: editQuote?.currency || "EUR",
  });

  const { data: existingItems } = useQuery({
    queryKey: ["quote-items", editQuote?.id],
    queryFn: async () => {
      if (!editQuote?.id) return null;
      const { data, error } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", editQuote.id)
        .order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!editQuote?.id,
  });

  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  const [itemsInitialized, setItemsInitialized] = useState(false);

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
    if (mapped.length > 0) setItems(mapped);
    setItemsInitialized(true);
  }

  const totalWithTax = items.reduce((s, i) => s + calcItemTotal(i), 0);
  const subtotal = items.reduce((s, i) => s + calcItemSubtotal(i), 0);

  const updateItem = (id: string, field: keyof QuoteItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (id: string) => {
    if (items.length > 1) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const quoteData = {
        quote_number: form.quote_number,
        client_name: form.client_name,
        client_type: form.client_type,
        address: form.address || null,
        oib: form.oib || null,
        amount: totalWithTax,
        subtotal,
        tax_amount: totalWithTax - subtotal,
        total: totalWithTax,
        quote_date: form.quote_date,
        valid_until: form.valid_until || null,
        currency: form.currency,
      };

      if (isEditing) {
        const { error } = await supabase.from("quotes").update(quoteData).eq("id", editQuote.id);
        if (error) throw error;

        await supabase.from("quote_items").delete().eq("quote_id", editQuote.id);
      } else {
        const { data: q, error: qError } = await supabase
          .from("quotes")
          .insert({ ...quoteData, created_by: user?.id })
          .select("id")
          .single();
        if (qError) throw qError;
        editQuote = q; // use for items insert
      }

      const itemsToInsert = items.map((item, idx) => ({
        quote_id: isEditing ? editQuote.id : (editQuote as any).id,
        description: item.description,
        unit: item.unit,
        quantity: parseFloat(item.quantity) || 1,
        price: parseFloat(item.price) || 0,
        discount_percent: parseFloat(item.discount_percent) || 0,
        tax_rate: parseFloat(item.tax_rate) || 25,
        total: calcItemTotal(item),
        position: idx,
      }));

      const { error: itemsError } = await supabase.from("quote_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      toast.success(isEditing ? "Ponuda ažurirana!" : "Ponuda spremljena!");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onSuccess();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("quote_items").delete().eq("quote_id", editQuote.id);
      const { error } = await supabase.from("quotes").delete().eq("id", editQuote.id);
      if (error) throw error;
      toast.success("Ponuda izbrisana!");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <Label className="text-xs text-muted-foreground">Tip kupca</Label>
          <Select
            value={form.client_type}
            onValueChange={(v) => {
              setForm({ ...form, client_type: v });
              if (v === "EU" || v === "INT") {
                setItems((prev) => prev.map((item) => ({ ...item, tax_rate: "0" })));
              } else {
                setItems((prev) =>
                  prev.map((item) =>
                    item.tax_rate === "0" ? { ...item, tax_rate: "25" } : item
                  )
                );
              }
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Label className="text-xs text-muted-foreground">Broj ponude</Label>
          <Input
            value={form.quote_number}
            onChange={(e) => setForm({ ...form, quote_number: e.target.value })}
            placeholder="P-001-2026"
            required
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Vrijedi do</Label>
          <Input
            type="date"
            value={form.valid_until}
            onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Naručitelj</Label>
          <Input
            value={form.client_name}
            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            placeholder="Ime / naziv tvrtke"
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
          <Label className="text-xs text-muted-foreground">OIB</Label>
          <Input
            value={form.oib}
            onChange={(e) => setForm({ ...form, oib: e.target.value })}
          />
        </div>
      </div>

      {/* Stavke */}
      <div>
        <Label className="text-sm font-medium">Stavke ponude</Label>
        <div className="space-y-3 mt-2">
          {items.map((item) => (
            <div key={item.id} className="border border-border rounded-md p-4 relative">
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(item.id)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="mb-3">
                <Label className="text-xs text-muted-foreground">Opis</Label>
                <Textarea value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Jed.</Label>
                  <Select value={item.unit} onValueChange={(v) => updateItem(item.id, "unit", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kom">kom</SelectItem>
                      <SelectItem value="sat">sat</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                      <SelectItem value="m2">m²</SelectItem>
                      <SelectItem value="pauš">pauš</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Količina</Label>
                  <Input type="number" min="0" step="any" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cijena</Label>
                  <Input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(item.id, "price", e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Popust %</Label>
                  <Input type="number" min="0" max="100" value={item.discount_percent} onChange={(e) => updateItem(item.id, "discount_percent", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Porez %</Label>
                  <Input type="number" min="0" max="100" value={item.tax_rate} onChange={(e) => updateItem(item.id, "tax_rate", e.target.value)} />
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
            <div className="text-2xl font-bold">{formatCurrency(totalWithTax)}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(subtotal)}</div>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Datum ponude</Label>
        <Input type="date" value={form.quote_date} onChange={(e) => setForm({ ...form, quote_date: e.target.value })} required />
      </div>

      <div className="flex gap-3">
        <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
          {createMutation.isPending ? "SPREMANJE..." : isEditing ? "SPREMI IZMJENE" : "SPREMI PONUDU"}
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
                <AlertDialogTitle>Izbrisati ponudu?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ova radnja je nepovratna. Ponuda "{editQuote.quote_number}" će biti trajno izbrisana.
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

export default QuoteForm;
