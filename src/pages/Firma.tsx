import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  FileInput, 
  FileOutput, 
  ClipboardList, 
  Plus,
  FileText,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import WorkOrderForm from "@/components/firma/WorkOrderForm";
import QuoteForm from "@/components/firma/QuoteForm";
import InvoiceForm from "@/components/firma/InvoiceForm";
import CompanySettings from "@/components/firma/CompanySettings";
import { generateWorkOrderPDF } from "@/components/firma/WorkOrderPDF";
import { generateQuotePDF } from "@/components/firma/QuotePDF";
import { generateInvoicePDF } from "@/components/firma/InvoicePDF";
import { toast } from "sonner";

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + " €";

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}.`;
};

const statusConfig: Record<string, { color: string; label: string }> = {
  active: { color: "bg-orange-500", label: "Nije plaćeno" },
  completed: { color: "bg-green-500", label: "Plaćeno" },
  cancelled: { color: "bg-red-500", label: "Stornirano" },
  draft: { color: "bg-orange-500", label: "Nije plaćeno" },
  paid: { color: "bg-green-500", label: "Plaćeno" },
};

const StatusDot = ({ status, onChangeStatus }: { status: string; onChangeStatus: (s: string) => void }) => {
  const st = statusConfig[status] || statusConfig.active;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`w-4 h-4 rounded-full ${st.color} cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-offset-background hover:ring-current transition-all`}
          title={st.label}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem onClick={() => onChangeStatus("completed")} className="gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          Plaćeno
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChangeStatus("active")} className="gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
          Nije plaćeno
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChangeStatus("cancelled")} className="gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
          Stornirano
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// --- Mobile card for documents ---
const DocCard = ({ 
  number, clientName, amount, date, status, 
  onEdit, onPDF, onChangeStatus 
}: { 
  number: string; clientName: string; amount: number; date: string; status: string;
  onEdit: () => void; onPDF: () => void; onChangeStatus: (s: string) => void;
}) => (
  <div className="p-4 border-b border-border/50 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{number}</span>
      <div className="flex items-center gap-3">
        <button onClick={onPDF} className="text-muted-foreground hover:text-primary"><FileText className="w-4 h-4" /></button>
        <StatusDot status={status} onChangeStatus={onChangeStatus} />
      </div>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold cursor-pointer hover:text-primary hover:underline" onClick={onEdit}>{clientName}</span>
      <span className="text-sm font-semibold text-destructive">{formatAmount(amount)}</span>
    </div>
    <div className="text-xs text-muted-foreground">{formatDate(date)}</div>
  </div>
);

// --- Work Orders Tab ---
const WorkOrdersTab = () => {
  const [open, setOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ["work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_orders").select("*").order("order_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("work_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["work-orders"] }),
  });

  const handlePDF = async (order: any) => {
    const { data: items, error } = await supabase.from("work_order_items").select("*").eq("work_order_id", order.id).order("position");
    if (error) { toast.error("Greška pri dohvatu stavki"); return; }
    await generateWorkOrderPDF(order, items || []);
  };

  const grouped = workOrders.reduce<Record<string, any[]>>((acc, order) => {
    const date = new Date(order.order_date);
    const key = `${String(date.getMonth() + 1).padStart(2, "0")} / ${date.getFullYear()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Novi radni nalog
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novi radni nalog</DialogTitle></DialogHeader>
            <WorkOrderForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditOrder(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Uredi radni nalog</DialogTitle></DialogHeader>
          {editOrder && (
            <WorkOrderForm key={editOrder.id} editOrder={editOrder} onSuccess={() => { setEditOpen(false); setEditOrder(null); }} />
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Učitavanje...</div>
      ) : workOrders.length === 0 ? (
        <Card><CardContent><div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-1">Nema radnih naloga</p>
        </div></CardContent></Card>
      ) : (
        Object.entries(grouped).map(([monthKey, orders]) => (
          <Card key={monthKey} className="mb-4">
            <CardContent className="p-0">
              <div className="px-4 sm:px-6 pt-5 pb-3"><h2 className="text-xl font-bold">Radni nalozi</h2></div>
              {/* Desktop header */}
              <div className="hidden sm:grid grid-cols-[1.2fr_1.5fr_auto_1fr_1fr_auto] px-6 py-2 text-sm text-muted-foreground border-b border-border gap-2">
                <span>Broj radnog naloga</span><span>Naručitelj</span><span className="text-center w-10">PDF</span>
                <span className="text-right">Iznos</span><span className="text-right">Datum</span><span className="text-center w-16">Status</span>
              </div>
              {/* Desktop rows */}
              <div className="hidden sm:block">
                {orders.map((order) => (
                  <div key={order.id} className="grid grid-cols-[1.2fr_1.5fr_auto_1fr_1fr_auto] px-6 py-3 items-center border-b border-border/50 hover:bg-muted/30 transition-colors gap-2">
                    <span className="text-sm font-medium">{order.order_number}</span>
                    <span className="text-sm font-semibold cursor-pointer hover:text-primary hover:underline transition-colors" onClick={() => { setEditOrder(order); setEditOpen(true); }}>{order.client_name}</span>
                    <button onClick={() => handlePDF(order)} className="w-10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"><FileText className="w-4 h-4" /></button>
                    <span className="text-sm font-semibold text-right text-destructive">{formatAmount(order.amount)}</span>
                    <span className="text-sm text-right text-muted-foreground">{formatDate(order.order_date)}</span>
                    <div className="w-16 flex justify-center"><StatusDot status={order.status} onChangeStatus={(s) => updateStatus.mutate({ id: order.id, status: s })} /></div>
                  </div>
                ))}
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden">
                {orders.map((order) => (
                  <DocCard
                    key={order.id}
                    number={order.order_number}
                    clientName={order.client_name}
                    amount={order.amount}
                    date={order.order_date}
                    status={order.status}
                    onEdit={() => { setEditOrder(order); setEditOpen(true); }}
                    onPDF={() => handlePDF(order)}
                    onChangeStatus={(s) => updateStatus.mutate({ id: order.id, status: s })}
                  />
                ))}
              </div>
              <div className="text-center py-3 text-sm text-primary/70 font-medium">{monthKey}</div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

// --- Quotes Tab ---
const QuotesTab = () => {
  const [open, setOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotes").select("*").order("quote_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotes"] }),
  });

  const handlePDF = async (quote: any) => {
    const { data: items, error } = await supabase.from("quote_items").select("*").eq("quote_id", quote.id).order("position");
    if (error) { toast.error("Greška pri dohvatu stavki"); return; }
    await generateQuotePDF(quote, items || []);
  };

  const grouped = quotes.reduce<Record<string, any[]>>((acc, q) => {
    const date = new Date(q.quote_date);
    const key = `${String(date.getMonth() + 1).padStart(2, "0")} / ${date.getFullYear()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Nova ponuda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova ponuda</DialogTitle></DialogHeader>
            <QuoteForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditQuote(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Uredi ponudu</DialogTitle></DialogHeader>
          {editQuote && (
            <QuoteForm key={editQuote.id} editQuote={editQuote} onSuccess={() => { setEditOpen(false); setEditQuote(null); }} />
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Učitavanje...</div>
      ) : quotes.length === 0 ? (
        <Card><CardContent><div className="text-center py-12 text-muted-foreground">
          <FileOutput className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-1">Nema ponuda</p>
        </div></CardContent></Card>
      ) : (
        Object.entries(grouped).map(([monthKey, items]) => (
          <Card key={monthKey} className="mb-4">
            <CardContent className="p-0">
              <div className="px-4 sm:px-6 pt-5 pb-3"><h2 className="text-xl font-bold">Ponude</h2></div>
              <div className="hidden sm:grid grid-cols-[1.2fr_1.5fr_auto_1fr_1fr_auto] px-6 py-2 text-sm text-muted-foreground border-b border-border gap-2">
                <span>Broj ponude</span><span>Naručitelj</span><span className="text-center w-10">PDF</span>
                <span className="text-right">Iznos</span><span className="text-right">Datum</span><span className="text-center w-16">Status</span>
              </div>
              <div className="hidden sm:block">
                {items.map((q) => (
                  <div key={q.id} className="grid grid-cols-[1.2fr_1.5fr_auto_1fr_1fr_auto] px-6 py-3 items-center border-b border-border/50 hover:bg-muted/30 transition-colors gap-2">
                    <span className="text-sm font-medium">{q.quote_number}</span>
                    <span className="text-sm font-semibold cursor-pointer hover:text-primary hover:underline transition-colors" onClick={() => { setEditQuote(q); setEditOpen(true); }}>{q.client_name}</span>
                    <button onClick={() => handlePDF(q)} className="w-10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"><FileText className="w-4 h-4" /></button>
                    <span className="text-sm font-semibold text-right text-destructive">{formatAmount(q.total)}</span>
                    <span className="text-sm text-right text-muted-foreground">{formatDate(q.quote_date)}</span>
                    <div className="w-16 flex justify-center"><StatusDot status={q.status} onChangeStatus={(s) => updateStatus.mutate({ id: q.id, status: s })} /></div>
                  </div>
                ))}
              </div>
              <div className="sm:hidden">
                {items.map((q) => (
                  <DocCard
                    key={q.id}
                    number={q.quote_number}
                    clientName={q.client_name}
                    amount={q.total}
                    date={q.quote_date}
                    status={q.status}
                    onEdit={() => { setEditQuote(q); setEditOpen(true); }}
                    onPDF={() => handlePDF(q)}
                    onChangeStatus={(s) => updateStatus.mutate({ id: q.id, status: s })}
                  />
                ))}
              </div>
              <div className="text-center py-3 text-sm text-primary/70 font-medium">{monthKey}</div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

// --- Invoices Tab ---
const InvoicesSection = ({ type, title, icon: Icon }: { type: "outgoing" | "incoming"; title: string; icon: any }) => {
  const [open, setOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", type],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("type", type).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices", type] }),
  });

  const handlePDF = async (inv: any) => {
    const { data: items, error } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
    if (error) { toast.error("Greška pri dohvatu stavki"); return; }
    await generateInvoicePDF(inv, items || []);
  };

  const grouped = invoices.reduce<Record<string, any[]>>((acc, inv) => {
    const date = new Date(inv.created_at);
    const key = `${String(date.getMonth() + 1).padStart(2, "0")} / ${date.getFullYear()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(inv);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Icon className="w-5 h-5" />{title}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Novi račun
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novi {type === "outgoing" ? "izlazni" : "ulazni"} račun</DialogTitle></DialogHeader>
            <InvoiceForm type={type} onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditInvoice(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Uredi {type === "outgoing" ? "izlazni" : "ulazni"} račun</DialogTitle></DialogHeader>
          {editInvoice && (
            <InvoiceForm key={editInvoice.id} type={type} editInvoice={editInvoice} onSuccess={() => { setEditOpen(false); setEditInvoice(null); }} />
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Učitavanje...</div>
      ) : invoices.length === 0 ? (
        <Card><CardContent><div className="text-center py-8 text-muted-foreground">
          <Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">Nema {type === "outgoing" ? "izlaznih" : "ulaznih"} računa</p>
        </div></CardContent></Card>
      ) : (
        Object.entries(grouped).map(([monthKey, items]) => (
          <Card key={monthKey} className="mb-4">
            <CardContent className="p-0">
              <div className="hidden sm:grid grid-cols-[1.2fr_1.5fr_auto_1fr_1fr_auto] px-6 py-2 text-sm text-muted-foreground border-b border-border gap-2">
                <span>Broj računa</span><span>Klijent</span><span className="text-center w-10">PDF</span>
                <span className="text-right">Iznos</span><span className="text-right">Datum</span><span className="text-center w-16">Status</span>
              </div>
              <div className="hidden sm:block">
                {items.map((inv) => (
                  <div key={inv.id} className="grid grid-cols-[1.2fr_1.5fr_auto_1fr_1fr_auto] px-6 py-3 items-center border-b border-border/50 hover:bg-muted/30 transition-colors gap-2">
                    <span className="text-sm font-medium">{inv.invoice_number}</span>
                    <span className="text-sm font-semibold cursor-pointer hover:text-primary hover:underline transition-colors" onClick={() => { setEditInvoice(inv); setEditOpen(true); }}>{inv.client_name}</span>
                    <button onClick={() => handlePDF(inv)} className="w-10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"><FileText className="w-4 h-4" /></button>
                    <span className="text-sm font-semibold text-right text-destructive">{formatAmount(inv.total)}</span>
                    <span className="text-sm text-right text-muted-foreground">{formatDate(inv.created_at)}</span>
                    <div className="w-16 flex justify-center"><StatusDot status={inv.status} onChangeStatus={(s) => updateStatus.mutate({ id: inv.id, status: s })} /></div>
                  </div>
                ))}
              </div>
              <div className="sm:hidden">
                {items.map((inv) => (
                  <DocCard
                    key={inv.id}
                    number={inv.invoice_number}
                    clientName={inv.client_name}
                    amount={inv.total}
                    date={inv.created_at}
                    status={inv.status}
                    onEdit={() => { setEditInvoice(inv); setEditOpen(true); }}
                    onPDF={() => handlePDF(inv)}
                    onChangeStatus={(s) => updateStatus.mutate({ id: inv.id, status: s })}
                  />
                ))}
              </div>
              <div className="text-center py-3 text-sm text-primary/70 font-medium">{monthKey}</div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

// --- Main Page ---
const Firma = () => {
  return (
    <DashboardLayout noScroll>
      <div className="flex flex-col h-full overflow-hidden px-3 sm:px-4 pt-2">
        <Tabs defaultValue="nalozi" className="flex flex-col flex-1 min-h-0 w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4 shrink-0">
            <TabsTrigger value="nalozi" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Radni nalozi</span>
              <span className="sm:hidden">Nalozi</span>
            </TabsTrigger>
            <TabsTrigger value="ponude" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <FileOutput className="w-4 h-4" />
              Ponude
            </TabsTrigger>
            <TabsTrigger value="racuni" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <FileInput className="w-4 h-4" />
              Računi
            </TabsTrigger>
            <TabsTrigger value="firma" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Podaci firme</span>
              <span className="sm:hidden">Firma</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nalozi" className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-6"><WorkOrdersTab /></TabsContent>
          <TabsContent value="ponude" className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-6"><QuotesTab /></TabsContent>
          <TabsContent value="racuni" className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InvoicesSection type="outgoing" title="Izlazni računi" icon={FileOutput} />
              <InvoicesSection type="incoming" title="Ulazni računi" icon={FileInput} />
            </div>
          </TabsContent>
          <TabsContent value="firma" className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-6"><CompanySettings /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Firma;
