import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { hr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CardWithDueDate {
  id: string;
  title: string;
  due_date: string;
  column_id: string;
  column_title?: string;
  board_title?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  color: string | null;
}

const Calendar = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cards, setCards] = useState<CardWithDueDate[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskNote, setNewTaskNote] = useState("");
  const [isSyncingSdge, setIsSyncingSdge] = useState(false);
  useEffect(() => {
    fetchCardsWithDueDates();
    fetchEvents();
  }, [currentMonth]);

  const fetchCardsWithDueDates = async () => {
    setIsLoading(true);
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const { data: cardsData, error } = await supabase
      .from("cards")
      .select(`
        id,
        title,
        due_date,
        column_id,
        columns!inner (
          title,
          board_id,
          boards!inner (
            title
          )
        )
      `)
      .not("due_date", "is", null)
      .gte("due_date", start.toISOString())
      .lte("due_date", end.toISOString());

    if (!error && cardsData) {
      const formattedCards = cardsData.map((card: any) => ({
        id: card.id,
        title: card.title,
        due_date: card.due_date,
        column_id: card.column_id,
        column_title: card.columns?.title,
        board_title: card.columns?.boards?.title,
      }));
      setCards(formattedCards);
    }
    setIsLoading(false);
  };

  const fetchEvents = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, description, event_date, color")
      .gte("event_date", format(start, "yyyy-MM-dd"))
      .lte("event_date", format(end, "yyyy-MM-dd"));
    if (data) setEvents(data);
  };

  const addEvent = async () => {
    if (!newTaskTitle.trim() || !selectedDate || !user) return;
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        title: newTaskTitle.trim(),
        description: newTaskNote.trim() || null,
        event_date: format(selectedDate, "yyyy-MM-dd"),
        user_id: user.id,
      })
      .select()
      .single();

    if (!error && data) {
      setEvents([...events, data]);
      setNewTaskTitle("");
      setNewTaskNote("");
      toast({ title: "Dodano", description: "Zadatak je dodan u kalendar." });
    }
  };

  const syncSdge = async () => {
    if (!user) return;
    setIsSyncingSdge(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-sdge", {
        body: { user_id: user.id },
      });
      if (error) throw error;
      toast({
        title: "SDGE sinkronizacija",
        description: data?.message || `Završeno. Novih događaja: ${data?.new_events_created || 0}`,
      });
      fetchEvents();
    } catch (err: any) {
      toast({
        title: "SDGE greška",
        description: err.message || "Nije moguće sinkronizirati SDGE.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingSdge(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const { error } = await supabase.from("calendar_events").delete().eq("id", eventId);

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      return;
    }

    setEvents((prev) => prev.filter((event) => event.id !== eventId));
    toast({ title: "Zadatak obrisan" });
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getCardsForDay = (day: Date) => {
    return cards.filter(card => isSameDay(new Date(card.due_date), day));
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(e => isSameDay(new Date(e.event_date), day));
  };

  const getSelectedDayCards = () => {
    if (!selectedDate) return [];
    return getCardsForDay(selectedDate);
  };

  const getSelectedDayEvents = () => {
    if (!selectedDate) return [];
    return getEventsForDay(selectedDate);
  };

  const weekDays = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
  const firstDayOfMonth = startOfMonth(currentMonth);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setDialogOpen(true);
    setNewTaskTitle("");
    setNewTaskNote("");
  };

  return (
    <DashboardLayout noScroll>
      <div className="p-4 lg:p-6 h-full overflow-y-auto scrollbar-hide">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Kalendar</h1>
            <p className="text-muted-foreground">Pregled rokova zadataka</p>
          </div>
          <Button variant="outline" size="sm" onClick={syncSdge} disabled={isSyncingSdge}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isSyncingSdge && "animate-spin")} />
            {isSyncingSdge ? "Sinkronizacija..." : "Osvježi SDGE"}
          </Button>
        </div>

        {/* Calendar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl">
              {format(currentMonth, "LLLL yyyy", { locale: hr })}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                Danas
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startOffset }).map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}

              {days.map((day) => {
                const dayCards = getCardsForDay(day);
                const dayEvents = getEventsForDay(day);
                const totalItems = dayCards.length + dayEvents.length;

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "aspect-square p-1 rounded-lg border transition-all hover:bg-muted relative",
                      isToday(day) && "border-primary",
                      selectedDate && isSameDay(day, selectedDate) && "bg-primary/10 border-primary",
                      !isSameMonth(day, currentMonth) && "opacity-50"
                    )}
                  >
                    <span className={cn("text-sm", isToday(day) && "font-bold text-primary")}>
                      {format(day, "d")}
                    </span>
                    {totalItems > 0 && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {Array.from({ length: Math.min(totalItems, 3) }).map((_, i) => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
                        ))}
                        {totalItems > 3 && (
                          <span className="text-[10px] text-muted-foreground ml-0.5">+{totalItems - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming tasks */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Nadolazeći rokovi ovog mjeseca</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Učitavanje...</p>
            ) : cards.length === 0 ? (
              <p className="text-muted-foreground">Nema zadataka s rokom ovaj mjesec</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards
                  .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                  .map((card) => (
                    <div key={card.id} className="p-4 rounded-lg border hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{card.title}</h4>
                        <Badge
                          variant={new Date(card.due_date) < new Date() ? "destructive" : "outline"}
                          className="ml-2 shrink-0"
                        >
                          {format(new Date(card.due_date), "dd.MM.")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {card.board_title} → {card.column_title}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Day detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              {selectedDate ? format(selectedDate, "d. MMMM yyyy", { locale: hr }) : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">Zadaci i događaji za odabrani dan</DialogDescription>
          </DialogHeader>

          <div className="flex gap-0 overflow-hidden" style={{ height: "min(60vh, 500px)" }}>
            {/* LEFT: Add new task */}
            <div className="flex-1 border-r border-border p-6 flex flex-col">
              <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Novi zadatak
              </h4>
              <div className="space-y-3 flex-1 flex flex-col">
                <Input
                  placeholder="Naziv zadatka..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newTaskTitle.trim()) addEvent(); }}
                />
                <Textarea
                  placeholder="Napomena..."
                  value={newTaskNote}
                  onChange={(e) => setNewTaskNote(e.target.value)}
                  className="flex-1 resize-none bg-muted/50 border-none focus-visible:ring-1"
                />
                <Button onClick={addEvent} disabled={!newTaskTitle.trim()} size="sm" className="self-start">
                  Dodaj
                </Button>
              </div>
            </div>

            {/* RIGHT: Existing tasks */}
            <div className="w-[320px] shrink-0 overflow-y-auto p-6 scrollbar-subtle">
              <h4 className="font-semibold text-sm mb-4">Postojeći zadaci</h4>
              
              {getSelectedDayCards().length === 0 && getSelectedDayEvents().length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nema zadataka</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getSelectedDayCards().map((card) => (
                    <div key={card.id} className="p-3 rounded-lg border bg-card">
                      <h5 className="font-medium text-sm">{card.title}</h5>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {card.board_title && <Badge variant="outline" className="text-[10px]">{card.board_title}</Badge>}
                        {card.column_title && <Badge variant="secondary" className="text-[10px]">{card.column_title}</Badge>}
                      </div>
                    </div>
                  ))}
                  {getSelectedDayEvents().map((event) => {
                    const isSdge = event.description?.startsWith("[SDGE]") || false;
                    const isTerenski = event.color === "#F97316";
                    return (
                      <div key={event.id} className="p-3 rounded-lg border bg-card" style={isSdge ? { borderLeftWidth: 3, borderLeftColor: event.color || undefined } : undefined}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h5 className="font-medium text-sm truncate">{event.title}</h5>
                            {isSdge && (
                              <Badge className="text-[10px]" style={{ backgroundColor: event.color || "#F97316", color: "#fff" }}>
                                {isTerenski ? "Uviđaj" : "Zaključak"}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => handleDeleteEvent(event.id)}
                            aria-label="Obriši događaj"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1">{isSdge ? event.description.replace("[SDGE] ", "") : event.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Calendar;
