import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  ArrowLeft, 
  MoreHorizontal, 
  Loader2,
  GripVertical,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Column {
  id: string;
  title: string;
  position: number;
  board_id: string;
}

interface Card {
  id: string;
  title: string;
  description: string | null;
  column_id: string;
  position: number;
  due_date: string | null;
}

interface Board {
  id: string;
  title: string;
  description: string | null;
}

const KanbanBoard = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingCardToColumn, setAddingCardToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editCardData, setEditCardData] = useState({ title: "", description: "" });

  useEffect(() => {
    if (boardId) {
      fetchBoardData();
      setupRealtimeSubscription();
    }
  }, [boardId]);

  const fetchBoardData = async () => {
    const [boardRes, columnsRes, cardsRes] = await Promise.all([
      supabase.from("boards").select("*").eq("id", boardId).single(),
      supabase.from("columns").select("*").eq("board_id", boardId).order("position"),
      supabase.from("cards").select("*").eq("column_id", boardId).order("position"),
    ]);

    if (boardRes.error) {
      toast({
        title: "Greška",
        description: "Ploča nije pronađena.",
        variant: "destructive",
      });
      return;
    }

    setBoard(boardRes.data);
    setColumns(columnsRes.data || []);
    
    // Fetch cards for all columns
    if (columnsRes.data && columnsRes.data.length > 0) {
      const columnIds = columnsRes.data.map(c => c.id);
      const { data: allCards } = await supabase
        .from("cards")
        .select("*")
        .in("column_id", columnIds)
        .order("position");
      setCards(allCards || []);
    }
    
    setIsLoading(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`board-${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards" },
        () => fetchBoardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "columns" },
        () => fetchBoardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === "card") {
      const cardId = draggableId;
      const newColumnId = destination.droppableId;
      const newPosition = destination.index;

      // Optimistic update
      setCards(prevCards => {
        const updatedCards = [...prevCards];
        const cardIndex = updatedCards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return prevCards;

        const [movedCard] = updatedCards.splice(cardIndex, 1);
        movedCard.column_id = newColumnId;
        movedCard.position = newPosition;
        
        // Update positions for affected cards
        const columnCards = updatedCards.filter(c => c.column_id === newColumnId);
        columnCards.splice(newPosition, 0, movedCard);
        columnCards.forEach((card, idx) => card.position = idx);

        return [...updatedCards.filter(c => c.column_id !== newColumnId), ...columnCards];
      });

      // Update in database
      await supabase
        .from("cards")
        .update({ column_id: newColumnId, position: newPosition })
        .eq("id", cardId);
    }
  };

  const addCard = async (columnId: string) => {
    if (!newCardTitle.trim()) return;

    const columnCards = cards.filter(c => c.column_id === columnId);
    const position = columnCards.length;

    const { data, error } = await supabase
      .from("cards")
      .insert({
        title: newCardTitle,
        column_id: columnId,
        position,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Greška",
        description: "Nije moguće dodati karticu.",
        variant: "destructive",
      });
    } else {
      setCards([...cards, data]);
      setNewCardTitle("");
      setAddingCardToColumn(null);
    }
  };

  const updateCard = async () => {
    if (!editingCard || !editCardData.title.trim()) return;

    const { error } = await supabase
      .from("cards")
      .update({
        title: editCardData.title,
        description: editCardData.description || null,
      })
      .eq("id", editingCard.id);

    if (error) {
      toast({
        title: "Greška",
        description: "Nije moguće ažurirati karticu.",
        variant: "destructive",
      });
    } else {
      setCards(cards.map(c => 
        c.id === editingCard.id 
          ? { ...c, title: editCardData.title, description: editCardData.description || null }
          : c
      ));
      setEditingCard(null);
      toast({ title: "Uspješno", description: "Kartica je ažurirana." });
    }
  };

  const deleteCard = async (cardId: string) => {
    const { error } = await supabase.from("cards").delete().eq("id", cardId);
    
    if (!error) {
      setCards(cards.filter(c => c.id !== cardId));
      setEditingCard(null);
      toast({ title: "Uspješno", description: "Kartica je obrisana." });
    }
  };

  const getColumnCards = (columnId: string) => {
    return cards
      .filter(c => c.column_id === columnId)
      .sort((a, b) => a.position - b.position);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!board) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground mb-4">Ploča nije pronađena.</p>
          <Button asChild>
            <Link to="/kanban">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Natrag na ploče
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/kanban">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{board.title}</h1>
              {board.description && (
                <p className="text-sm text-muted-foreground">{board.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-x-auto p-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 h-full">
              {columns.map((column) => (
                <div
                  key={column.id}
                  className="w-80 flex-shrink-0 bg-muted/50 rounded-xl p-3 flex flex-col"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-semibold text-sm">
                      {column.title}
                      <span className="ml-2 text-muted-foreground">
                        {getColumnCards(column.id).length}
                      </span>
                    </h3>
                  </div>

                  {/* Cards */}
                  <Droppable droppableId={column.id} type="card">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 overflow-y-auto space-y-2 min-h-[100px] rounded-lg p-1 transition-colors",
                          snapshot.isDraggingOver && "bg-primary/10"
                        )}
                      >
                        {getColumnCards(column.id).map((card, index) => (
                          <Draggable key={card.id} draggableId={card.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "bg-card rounded-xl p-4 shadow-md border-2 border-border hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer group",
                                  snapshot.isDragging && "shadow-xl rotate-2 border-primary"
                                )}
                                onClick={() => {
                                  setEditingCard(card);
                                  setEditCardData({
                                    title: card.title,
                                    description: card.description || "",
                                  });
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                                  >
                                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm leading-snug">{card.title}</p>
                                    {card.description && (
                                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">
                                        {card.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  {/* Add Card */}
                  {addingCardToColumn === column.id ? (
                    <div className="mt-2 space-y-2">
                      <Input
                        placeholder="Naslov kartice..."
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addCard(column.id);
                          if (e.key === "Escape") {
                            setAddingCardToColumn(null);
                            setNewCardTitle("");
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => addCard(column.id)}>
                          Dodaj
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingCardToColumn(null);
                            setNewCardTitle("");
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      className="mt-2 w-full justify-start text-muted-foreground"
                      onClick={() => setAddingCardToColumn(column.id)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Dodaj karticu
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>
      </div>

      {/* Edit Card Dialog */}
      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Uredi karticu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="cardTitle">Naslov</Label>
              <Input
                id="cardTitle"
                value={editCardData.title}
                onChange={(e) => setEditCardData({ ...editCardData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardDescription">Opis</Label>
              <Textarea
                id="cardDescription"
                value={editCardData.description}
                onChange={(e) => setEditCardData({ ...editCardData, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="flex justify-between">
              <Button
                variant="destructive"
                onClick={() => editingCard && deleteCard(editingCard.id)}
              >
                Obriši
              </Button>
              <Button onClick={updateCard}>Spremi</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default KanbanBoard;
