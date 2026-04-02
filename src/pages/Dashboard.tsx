import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useHeaderSearch } from "@/components/layout/DashboardLayout";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  Bell,
  BellOff,
  CalendarDays,
  ClipboardList,
  ListChecks,
  GripVertical,
} from "lucide-react";
import { requestNotificationPermission, isNotificationSupported, getNotificationPermission } from "@/lib/push-notifications";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, addDays } from "date-fns";
import { hr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import WorkBoard from "@/components/dashboard/WorkBoard";
import { useIsMobile } from "@/hooks/use-mobile";
import { PullToRefresh } from "@/components/PullToRefresh";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  color: string;
  user_id: string;
}

interface CardWithDueDate {
  id: string;
  title: string;
  due_date: string;
  column_title?: string;
  board_title?: string;
}

const DashboardContent = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const searchTerm = useHeaderSearch();
  const [mobileTab, setMobileTab] = useState<"calendar" | "workboard" | "tasks">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [cards, setCards] = useState<CardWithDueDate[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", start_time: "", end_time: "", all_day: true });
  const [nextDayEvents, setNextDayEvents] = useState<CalendarEvent[]>([]);
  const [workBoardOverlay, setWorkBoardOverlay] = useState(() => {
    // Show overlay on first visit per session
    const shown = sessionStorage.getItem("workboard_shown");
    return !shown;
  });

  useEffect(() => {
    fetchEvents();
    fetchCards();
  }, [currentMonth]);

  useEffect(() => {
    fetchNextDayEvents();
  }, [events]);

  useEffect(() => {
    if (!user || !isNotificationSupported()) return;
    if (getNotificationPermission() !== "granted") return;

    requestNotificationPermission()
      .then((result) => {
        if (!result.ok) {
          console.warn("Push auto-resubscribe failed:", result.status, result.message ?? "");
        }
      })
      .catch((err) => {
        console.error("Push auto-resubscribe failed:", err);
      });
  }, [user?.id]);

  const fetchEvents = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const { data } = await supabase
      .from("calendar_events")
      .select("*")
      .gte("event_date", format(start, "yyyy-MM-dd"))
      .lte("event_date", format(end, "yyyy-MM-dd"))
      .order("position", { ascending: true });
    if (data) setEvents(data);
  };

  const fetchNextDayEvents = async () => {
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    const { data: first } = await supabase
      .from("calendar_events")
      .select("event_date")
      .gte("event_date", tomorrow)
      .order("event_date", { ascending: true })
      .limit(1);
    if (!first || first.length === 0) { setNextDayEvents([]); return; }
    const nextDate = first[0].event_date;
    const { data } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("event_date", nextDate)
      .order("start_time", { ascending: true });
    setNextDayEvents(data || []);
  };

  const fetchCards = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const { data } = await supabase
      .from("cards")
      .select(`id, title, due_date, columns!inner (title, boards!inner (title))`)
      .not("due_date", "is", null)
      .gte("due_date", start.toISOString())
      .lte("due_date", end.toISOString());
    if (data) {
      setCards(data.map((card: any) => ({
        id: card.id,
        title: card.title,
        due_date: card.due_date,
        column_title: card.columns?.title,
        board_title: card.columns?.boards?.title,
      })));
    }
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setNewEvent({ title: "", description: "", start_time: "", end_time: "", all_day: true });
    setIsDialogOpen(true);
  };

  const handleCreateEvent = async () => {
    if (!selectedDate || !newEvent.title.trim() || !user) return;
    const { error } = await supabase.from("calendar_events").insert({
      user_id: user.id,
      title: newEvent.title.trim(),
      description: newEvent.description || null,
      event_date: format(selectedDate, "yyyy-MM-dd"),
      start_time: newEvent.start_time || null,
      end_time: newEvent.end_time || null,
      all_day: newEvent.all_day,
    });
    if (!error) {
      toast({ title: "Zadatak kreiran" });
      // Send push notification to other users
      supabase.functions.invoke("notify-change", {
        body: { type: "calendar_event", user_id: user.id, title: `${newEvent.title.trim()} (${format(selectedDate, "dd.MM.yyyy")})` },
      }).catch(err => console.error("Notify error:", err));
      setNewEvent({ title: "", description: "", start_time: "", end_time: "", all_day: true });
      setIsDialogOpen(false);
      fetchEvents();
    } else {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const { error, count } = await supabase.from("calendar_events").delete({ count: "exact" }).eq("id", eventId);
    if (error) {
      toast({ title: "Greška pri brisanju", description: error.message, variant: "destructive" });
      return;
    }
    if (count === 0) {
      toast({ title: "Nije moguće obrisati", description: "Nemaš dozvolu za brisanje ovog zadatka.", variant: "destructive" });
      return;
    }
    setEvents(prev => prev.filter(e => e.id !== eventId));
    toast({ title: "Zadatak obrisan" });
  };

  const handleMinimizeOverlay = () => {
    setWorkBoardOverlay(false);
    sessionStorage.setItem("workboard_shown", "1");
  };

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfMonth = startOfMonth(currentMonth);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const numRows = Math.ceil((startOffset + days.length) / 7);
  const weekDays = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

  const getEventColor = (title: string) => {
    const t = title.toUpperCase();
    if (t.startsWith("TERENSKI UVIĐAJ")) return { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-500" };
    if (t.startsWith("ZAKLJUČAK")) return { bg: "bg-rose-500/15", text: "text-rose-400", dot: "bg-rose-500" };
    if (t.startsWith("ELABORAT")) return { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-500" };
    if (t.startsWith("ISKOLČENJE")) return { bg: "bg-violet-500/15", text: "text-violet-400", dot: "bg-violet-500" };
    if (t.startsWith("PARCELACIJA")) return { bg: "bg-cyan-500/15", text: "text-cyan-400", dot: "bg-cyan-500" };
    return { bg: "bg-sky-500/15", text: "text-sky-400", dot: "bg-sky-500" };
  };

  const getItemsForDay = (day: Date) => {
    const dayEvents = events.filter(e => isSameDay(new Date(e.event_date + "T00:00:00"), day));
    const dayCards = cards.filter(c => isSameDay(new Date(c.due_date), day));
    return { events: dayEvents, cards: dayCards };
  };

  const selectedItems = selectedDate ? getItemsForDay(selectedDate) : { events: [], cards: [] };

  const handleReorderEvents = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const srcIdx = result.source.index;
    const destIdx = result.destination.index;
    if (srcIdx === destIdx) return;

    const reordered = Array.from(selectedItems.events);
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(destIdx, 0, moved);

    // Optimistic update
    setEvents(prev => {
      const otherEvents = prev.filter(e => !reordered.find(r => r.id === e.id));
      const updatedReordered = reordered.map((ev, i) => ({ ...ev, position: i }));
      return [...otherEvents, ...updatedReordered];
    });

    // Persist positions
    const updates = reordered.map((ev, i) =>
      supabase.from("calendar_events").update({ position: i } as any).eq("id", ev.id)
    );
    await Promise.all(updates);
  }, [selectedItems.events]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Overlay WorkBoard on first visit */}
      {workBoardOverlay && (
        <WorkBoard isOverlay onMinimize={handleMinimizeOverlay} />
      )}

      {/* Mobile tab bar */}
      {isMobile && (
        <div className="flex border-b border-border bg-card">
          {([
            { key: "calendar" as const, icon: CalendarDays, label: "Kalendar" },
            { key: "workboard" as const, icon: ClipboardList, label: "Ploča" },
            { key: "tasks" as const, icon: ListChecks, label: "Zadaci" },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                mobileTab === tab.key
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-2 pt-3 pb-3 lg:p-4 flex flex-col lg:flex-row gap-2 flex-1 min-h-0 h-full overflow-hidden">
        {/* Left column: Radna ploča + Sljedeći zadaci (desktop always, mobile conditional) */}
        {(!isMobile || mobileTab === "workboard") && (
          <div className={cn("flex flex-col gap-2 min-h-0", isMobile ? "flex-1" : "lg:w-1/3")}>
            <WorkBoard isOverlay={false} onMinimize={() => setWorkBoardOverlay(true)} />
            {/* Next tasks - desktop only here, mobile has its own tab */}
            {!isMobile && (
              <Card className="shrink-0">
                <CardContent className="py-2 px-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-muted-foreground">
                      {nextDayEvents.length > 0
                        ? `Sljedeći zadaci — ${format(new Date(nextDayEvents[0].event_date + "T00:00:00"), "d. MMM yyyy", { locale: hr })}`
                        : "Sljedeći zadaci"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {nextDayEvents.length > 0 ? (
                      nextDayEvents.map(ev => (
                        <div key={ev.id} className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{ev.title}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">Nema nadolazećih zadataka</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Mobile-only: Zadaci tab */}
        {isMobile && mobileTab === "tasks" && (
          <div className="flex flex-col gap-2 min-h-0 flex-1">
            <Card className="flex-1">
              <CardContent className="py-2 px-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    {nextDayEvents.length > 0
                      ? `Sljedeći zadaci — ${format(new Date(nextDayEvents[0].event_date + "T00:00:00"), "d. MMM yyyy", { locale: hr })}`
                      : "Sljedeći zadaci"}
                  </span>
                </div>
                <div className="space-y-1">
                  {nextDayEvents.length > 0 ? (
                    nextDayEvents.map(ev => (
                      <div key={ev.id} className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{ev.title}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Nema nadolazećih zadataka</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Calendar (desktop always, mobile conditional) */}
        {(!isMobile || mobileTab === "calendar") && (
          <Card className="flex flex-col overflow-hidden flex-1 min-h-0 max-h-full">
            <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
              <CardTitle className="text-base">{format(currentMonth, "LLLL yyyy", { locale: hr })}</CardTitle>
              <div className="flex gap-1 items-center">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCurrentMonth(new Date())}>Danas</Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-1"
                    disabled={!isNotificationSupported()}
                    onClick={async () => {
                      if (!isNotificationSupported()) return;
                      const result = await requestNotificationPermission();

                      if (result.ok) {
                        toast({ title: "Push pretplata aktivna" });
                        return;
                      }

                      if (result.status === "permission_denied") {
                        toast({
                          title: "Dozvola je blokirana za ovu domenu",
                          description: `Provjeri postavke za ${window.location.hostname} i osvježi stranicu.`,
                          variant: "destructive",
                        });
                        return;
                      }

                      if (result.status === "vapid_unavailable") {
                        toast({
                          title: "Greška u konfiguraciji obavijesti",
                          description: "Privremeni backend problem s ključem za push.",
                          variant: "destructive",
                        });
                        return;
                      }

                      if (result.status === "not_authenticated") {
                        toast({
                          title: "Sesija je istekla",
                          description: "Ponovno se prijavi pa probaj opet.",
                          variant: "destructive",
                        });
                        return;
                      }

                      toast({
                        title: `Push greška: ${result.status}`,
                        description: result.message || "Osvježi stranicu i klikni zvono ponovno.",
                        variant: "destructive",
                      });
                    }}
                  >
                    {isNotificationSupported() && getNotificationPermission() === "granted" ? (
                      <Bell className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </Button>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0 flex-1 flex flex-col min-h-0">
              <div className="grid grid-cols-7 gap-px mb-1">
                {weekDays.map((d, i) => (
                  <div key={d} className={cn("text-center text-xs font-semibold py-1", i >= 5 ? "text-primary/60" : "text-muted-foreground")}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px" style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))`, flex: '1 1 0', minHeight: 0 }}>
                {Array.from({ length: startOffset }).map((_, i) => {
                  const colIdx = i;
                  const isWeekend = colIdx >= 5;
                  return <div key={`e-${i}`} className={cn("rounded border border-transparent", isWeekend && "bg-primary/[0.03]")} />;
                })}
                {days.map(day => {
                  const { events: de, cards: dc } = getItemsForDay(day);
                  const dayOfWeek = (day.getDay() + 6) % 7;
                  const isWeekend = dayOfWeek >= 5;
                  const sq = searchTerm.toLowerCase().trim();
                  const hasSearchMatch = sq && (
                    de.some(ev => ev.title.toLowerCase().includes(sq)) ||
                    dc.some(c => c.title.toLowerCase().includes(sq))
                  );
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "p-0.5 rounded border transition-all hover:bg-muted/50 flex flex-col items-start overflow-hidden",
                        isToday(day) && "border-primary bg-primary/5",
                        isWeekend && !isToday(day) && "bg-primary/[0.03]",
                        hasSearchMatch && "ring-2 ring-primary border-primary bg-primary/10",
                      )}
                    >
                      <span className={cn("text-xs font-medium leading-none mb-0.5 px-0.5", isToday(day) ? "font-bold text-primary" : isWeekend ? "text-primary/50" : "text-foreground/70")}>{format(day, "d")}</span>
                      {(de.length > 0 || dc.length > 0) && (
                        <div className="flex flex-wrap gap-[3px] px-0.5 mt-auto lg:hidden">
                          {de.slice(0, 3).map((ev, i) => { const c = getEventColor(ev.title); return <div key={`ev-${i}`} className={`w-2 h-2 rounded-full ${c.dot}`} />; })}
                          {dc.slice(0, Math.max(0, 3 - de.length)).map((_, i) => <div key={`cd-${i}`} className="w-2 h-2 rounded-full bg-secondary" />)}
                          {(de.length + dc.length) > 3 && <span className="text-[9px] font-bold text-muted-foreground">+{de.length + dc.length - 3}</span>}
                        </div>
                      )}
                      <div className="hidden lg:flex flex-col gap-px w-full overflow-hidden flex-1">
                        {de.map(ev => {
                          const c = getEventColor(ev.title);
                          const isMatch = sq && ev.title.toLowerCase().includes(sq);
                          return (
                            <div key={ev.id} className={cn(
                              `text-[10px] font-medium leading-tight truncate w-full text-left px-0.5 py-px rounded ${c.bg} ${c.text}`,
                              isMatch && "ring-1 ring-primary font-bold"
                            )}>
                              {ev.title}
                            </div>
                          );
                        })}
                        {dc.map(card => {
                          const isMatch = sq && card.title.toLowerCase().includes(sq);
                          return (
                            <div key={card.id} className={cn(
                              "text-[10px] font-medium leading-tight truncate w-full text-left px-0.5 py-px rounded bg-secondary/15 text-secondary",
                              isMatch && "ring-1 ring-primary font-bold"
                            )}>
                              {card.title}
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
                {Array.from({ length: (numRows * 7) - startOffset - days.length }).map((_, i) => {
                  const totalCells = startOffset + days.length;
                  const colIdx = (totalCells + i) % 7;
                  const isWeekend = colIdx >= 5;
                  return <div key={`t-${i}`} className={cn("rounded border border-transparent", isWeekend && "bg-primary/[0.03]")} />;
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog for adding task on day click */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? `Novi zadatak - ${format(selectedDate, "d. MMMM yyyy", { locale: hr })}` : "Novi zadatak"}
            </DialogTitle>
          </DialogHeader>
          {selectedItems.events.length > 0 && (
            <div className="space-y-2 mb-2">
              <Label className="text-muted-foreground">Postojeći zadaci</Label>
              <DragDropContext onDragEnd={handleReorderEvents}>
                <Droppable droppableId="calendar-events">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {selectedItems.events
                        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
                        .map((ev, index) => (
                        <Draggable key={ev.id} draggableId={ev.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "p-2 rounded-lg border bg-muted/50 flex items-start justify-between group",
                                snapshot.isDragging && "shadow-lg ring-2 ring-primary/20"
                              )}
                            >
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <div {...provided.dragHandleProps} className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium">{ev.title}</span>
                                  {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
                                  {!ev.all_day && ev.start_time && (
                                    <p className="text-xs text-muted-foreground">{ev.start_time}{ev.end_time ? ` - ${ev.end_time}` : ""}</p>
                                  )}
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => handleDeleteEvent(ev.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}
          {selectedItems.cards.length > 0 && (
            <div className="space-y-2 mb-2">
              <Label className="text-muted-foreground">Kanban zadaci</Label>
              {selectedItems.cards.map(card => (
                <div key={card.id} className="p-2 rounded-lg border bg-muted/50">
                  <span className="text-sm font-medium">{card.title}</span>
                  <div className="flex gap-1 mt-1">
                    {card.board_title && <Badge variant="outline" className="text-[10px]">{card.board_title}</Badge>}
                    {card.column_title && <Badge variant="secondary" className="text-[10px]">{card.column_title}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label>Naziv zadatka</Label>
              <Input value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} placeholder="Upiši zadatak..." />
            </div>
            <div>
              <Label>Napomena</Label>
              <Textarea value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} placeholder="Opis ili napomena..." />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newEvent.all_day} onChange={e => setNewEvent(p => ({ ...p, all_day: e.target.checked }))} className="rounded" />
                Cijeli dan
              </label>
            </div>
            {!newEvent.all_day && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Početak</Label>
                  <Input type="time" value={newEvent.start_time} onChange={e => setNewEvent(p => ({ ...p, start_time: e.target.value }))} />
                </div>
                <div>
                  <Label>Kraj</Label>
                  <Input type="time" value={newEvent.end_time} onChange={e => setNewEvent(p => ({ ...p, end_time: e.target.value }))} />
                </div>
              </div>
            )}
            <Button onClick={handleCreateEvent} className="w-full">Spremi zadatak</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Dashboard = () => (
  <DashboardLayout noScroll>
    <PullToRefresh>
      <DashboardContent />
    </PullToRefresh>
  </DashboardLayout>
);

export default Dashboard;
