import { useEffect, useState, useRef, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  MoreHorizontal,
  Loader2,
  X,
  Archive,
  Trash2,
  AlignLeft,
  CreditCard,
  ArrowRightLeft,
  CalendarIcon,
  MessageSquare,
  Send,
  Tag,
  CheckSquare,
  Paperclip,
  Users,
  MapPin,
  UserSearch,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Board {
  id: string;
  title: string;
  description: string | null;
  background_color: string | null;
  created_at: string;
  position: number;
}

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
  color: string | null;
}

interface ArchivedBoard {
  id: string;
  original_id: string;
  title: string;
  description: string | null;
  archived_at: string;
}

interface ArchivedCard {
  id: string;
  original_id: string;
  title: string;
  description: string | null;
  column_title: string | null;
  board_title: string | null;
  archived_at: string;
}

interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

const KanbanBoards = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isBoardLoading, setIsBoardLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [addingCardToColumn, setAddingCardToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editCardData, setEditCardData] = useState({ title: "", description: "", due_date: "", color: "" });

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  // New column inline
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  // Editing column title inline
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState("");

  // Delete board confirmation
  const [deleteBoardDialog, setDeleteBoardDialog] = useState<Board | null>(null);
  const [deleteBoardConfirmText, setDeleteBoardConfirmText] = useState("");

  // Archive dialog
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archivedBoards, setArchivedBoards] = useState<ArchivedBoard[]>([]);
  const [archivedCards, setArchivedCards] = useState<ArchivedCard[]>([]);

  // New board inline
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");

  useEffect(() => {
    fetchBoards();
  }, []);

  useEffect(() => {
    if (selectedBoardId) {
      fetchBoardContent(selectedBoardId);
      const cleanup = setupRealtimeSubscription(selectedBoardId);
      return cleanup;
    }
  }, [selectedBoardId]);

  const fetchBoards = async () => {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .order("position", { ascending: true });

    if (error) {
      toast({ title: "Greška", description: "Nije moguće učitati ploče.", variant: "destructive" });
    } else {
      setBoards(data || []);
      if (data && data.length > 0 && !selectedBoardId) {
        setSelectedBoardId(data[0].id);
      }
    }
    setIsLoading(false);
  };

  const fetchBoardContent = async (boardId: string) => {
    setIsBoardLoading(true);
    const { data: cols } = await supabase
      .from("columns")
      .select("*")
      .eq("board_id", boardId)
      .order("position");

    setColumns(cols || []);

    if (cols && cols.length > 0) {
      const columnIds = cols.map((c) => c.id);
      const { data: allCards } = await supabase
        .from("cards")
        .select("*")
        .in("column_id", columnIds)
        .order("position");
      setCards(allCards || []);
    } else {
      setCards([]);
    }
    setIsBoardLoading(false);
  };

  const setupRealtimeSubscription = (boardId: string) => {
    const channel = supabase
      .channel(`board-${boardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, () =>
        fetchBoardContent(boardId)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "columns" }, () =>
        fetchBoardContent(boardId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createBoard = async () => {
    if (!newBoardTitle.trim()) return;
    const maxPos = boards.length > 0 ? Math.max(...boards.map(b => b.position ?? 0)) + 1 : 0;
    const { data, error } = await supabase
      .from("boards")
      .insert({ title: newBoardTitle, position: maxPos } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Greška", description: "Nije moguće kreirati ploču.", variant: "destructive" });
    } else {
      setBoards([...boards, data]);
      setSelectedBoardId(data.id);
      setNewBoardTitle("");
      setIsCreatingBoard(false);
      toast({ title: "Uspješno", description: "Ploča je kreirana." });
    }
  };

  const deleteBoard = async (board: Board) => {
    // Archive the board first
    const boardColumns = columns.filter(c => true); // get current columns
    const { data: cols } = await supabase.from("columns").select("*").eq("board_id", board.id);
    
    // Archive all cards from this board
    if (cols && cols.length > 0) {
      const colIds = cols.map(c => c.id);
      const { data: boardCards } = await supabase.from("cards").select("*").in("column_id", colIds);
      
      if (boardCards && boardCards.length > 0) {
        const archivedCardsData = boardCards.map(card => {
          const col = cols.find(c => c.id === card.column_id);
          return {
            original_id: card.id,
            title: card.title,
            description: card.description,
            column_title: col?.title || null,
            board_id: board.id,
            board_title: board.title,
            created_by: card.created_by,
            original_created_at: card.created_at,
            archived_by: user?.id,
          };
        });
        await supabase.from("archived_cards").insert(archivedCardsData);
      }
    }

    // Archive the board itself
    await supabase.from("archived_boards").insert({
      original_id: board.id,
      title: board.title,
      description: board.description,
      background_color: board.background_color,
      created_by: (board as any).created_by || null,
      original_created_at: board.created_at,
      archived_by: user?.id,
    });

    // Now delete (cascade will handle columns/cards)
    const { error } = await supabase.from("boards").delete().eq("id", board.id);
    if (!error) {
      const remaining = boards.filter((b) => b.id !== board.id);
      setBoards(remaining);
      if (selectedBoardId === board.id) {
        setSelectedBoardId(remaining.length > 0 ? remaining[0].id : null);
      }
      setDeleteBoardDialog(null);
      setDeleteBoardConfirmText("");
      toast({ title: "Uspješno", description: "Ploča je arhivirana i obrisana." });
    }
  };

  // Column operations
  const addColumn = async () => {
    if (!newColumnTitle.trim() || !selectedBoardId) return;
    const { error } = await supabase.from("columns").insert({
      board_id: selectedBoardId,
      title: newColumnTitle,
      position: columns.length,
    });
    if (!error) {
      setNewColumnTitle("");
      setIsAddingColumn(false);
      fetchBoardContent(selectedBoardId);
    }
  };

  const renameColumn = async (columnId: string) => {
    if (!editingColumnTitle.trim()) {
      setEditingColumnId(null);
      return;
    }
    const { error } = await supabase.from("columns").update({ title: editingColumnTitle }).eq("id", columnId);
    if (!error) {
      setColumns(prev => prev.map(c => c.id === columnId ? { ...c, title: editingColumnTitle } : c));
    }
    setEditingColumnId(null);
  };

  // Card operations
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const cardId = draggableId;
    const newColumnId = destination.droppableId;
    const newPosition = destination.index;

    setCards((prevCards) => {
      const updatedCards = [...prevCards];
      const cardIndex = updatedCards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return prevCards;
      const [movedCard] = updatedCards.splice(cardIndex, 1);
      movedCard.column_id = newColumnId;
      movedCard.position = newPosition;
      const columnCards = updatedCards.filter((c) => c.column_id === newColumnId);
      columnCards.splice(newPosition, 0, movedCard);
      columnCards.forEach((card, idx) => (card.position = idx));
      return [...updatedCards.filter((c) => c.column_id !== newColumnId), ...columnCards];
    });

    await supabase.from("cards").update({ column_id: newColumnId, position: newPosition }).eq("id", cardId);
  };

  const addCard = async (columnId: string) => {
    if (!newCardTitle.trim()) return;
    const columnCards = cards.filter((c) => c.column_id === columnId);
    const { data, error } = await supabase
      .from("cards")
      .insert({ title: newCardTitle, column_id: columnId, position: columnCards.length, created_by: user?.id })
      .select()
      .single();

    if (error) {
      toast({ title: "Greška", description: "Nije moguće dodati karticu.", variant: "destructive" });
    } else {
      setCards([...cards, data]);
      setNewCardTitle("");
      setAddingCardToColumn(null);
    }
  };

  const updateCard = async (data?: { title: string; description: string; due_date: string; color: string }) => {
    const d = data || editCardData;
    if (!editingCard || !d.title.trim()) return;
    const { error } = await supabase
      .from("cards")
      .update({ title: d.title, description: d.description || null, due_date: d.due_date || null, color: d.color || null } as any)
      .eq("id", editingCard.id);

    if (!error) {
      setCards(prev => prev.map((c) => (c.id === editingCard.id ? { ...c, title: d.title, description: d.description || null, due_date: d.due_date || null, color: d.color || null } : c)));
    }
  };

  // Auto-save debounce
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editCardDataRef = useRef(editCardData);
  editCardDataRef.current = editCardData;
  const editingCardRef = useRef(editingCard);
  editingCardRef.current = editingCard;

  useEffect(() => {
    if (!editingCard) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateCard(editCardDataRef.current);
    }, 800);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [editCardData.title, editCardData.description, editCardData.due_date, editCardData.color]);

  const deleteCard = async (card: Card) => {
    // Archive card first
    const col = columns.find(c => c.id === card.column_id);
    const board = boards.find(b => b.id === selectedBoardId);
    await supabase.from("archived_cards").insert({
      original_id: card.id,
      title: card.title,
      description: card.description,
      column_title: col?.title || null,
      board_id: selectedBoardId,
      board_title: board?.title || null,
      created_by: (card as any).created_by || null,
      original_created_at: (card as any).created_at || null,
      archived_by: user?.id,
    });

    const { error } = await supabase.from("cards").delete().eq("id", card.id);
    if (!error) {
      setCards(cards.filter((c) => c.id !== card.id));
      setEditingCard(null);
      toast({ title: "Uspješno", description: "Kartica je arhivirana." });
    }
  };

  // Comments
  const fetchComments = async (cardId: string) => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("card_id", cardId)
      .order("created_at", { ascending: false });

    if (data) {
      // Get profiles for user names
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const commentsWithNames = data.map(c => ({
        ...c,
        user_name: profiles?.find(p => p.user_id === c.user_id)?.full_name || null,
        user_email: c.user_id === user?.id ? user?.email : undefined,
      }));
      setComments(commentsWithNames);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !editingCard || !user) return;
    const { data, error } = await supabase
      .from("comments")
      .insert({ card_id: editingCard.id, user_id: user.id, content: newComment })
      .select()
      .single();

    if (!error && data) {
      setComments([{ ...data, user_name: null, user_email: user.email }, ...comments]);
      setNewComment("");
      
      // Send push notification to others
      supabase.functions.invoke("notify-change", {
        body: { type: "comment", card_id: editingCard.id, user_id: user.id, content: newComment },
      }).catch(() => {});
    }
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (!error) {
      setComments(comments.filter(c => c.id !== commentId));
    }
  };

  const fetchArchive = async () => {
    const [{ data: ab }, { data: ac }] = await Promise.all([
      supabase.from("archived_boards").select("*").order("archived_at", { ascending: false }),
      supabase.from("archived_cards").select("*").order("archived_at", { ascending: false }),
    ]);
    setArchivedBoards(ab || []);
    setArchivedCards(ac || []);
  };

  const getColumnCards = (columnId: string) => {
    return cards
      .filter((c) => c.column_id === columnId)
      .filter((c) => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.position - b.position);
  };

  const selectedBoard = boards.find(b => b.id === selectedBoardId);

  // Drag-to-scroll for board area
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const tag = (e.target as HTMLElement).closest('button, input, textarea, [data-rbd-draggable-id], [data-rbd-drag-handle-draggable-id]');
    if (tag) return;
    setIsDraggingBoard(true);
    dragStartX.current = e.clientX;
    scrollStartX.current = boardScrollRef.current?.scrollLeft || 0;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingBoard || !boardScrollRef.current) return;
    const dx = e.clientX - dragStartX.current;
    boardScrollRef.current.scrollLeft = scrollStartX.current - dx;
  }, [isDraggingBoard]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingBoard(false);
  }, []);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout noScroll headerCenter={
      <div className="relative w-56">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Pretraži kartice..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>
    }>
      <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* Top bar: Board tabs | Spacer | Archive + Menu */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm px-4 py-2 flex items-center gap-3">
          {/* Left: Board tabs - draggable */}
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-hide">
            {boards.map((board, index) => (
              <button
                key={board.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("board-index", String(index));
                  e.currentTarget.classList.add("opacity-50");
                }}
                onDragEnd={(e) => {
                  e.currentTarget.classList.remove("opacity-50");
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("ring-2", "ring-primary");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("ring-2", "ring-primary");
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("ring-2", "ring-primary");
                  const fromIndex = parseInt(e.dataTransfer.getData("board-index"));
                  const toIndex = index;
                  if (fromIndex === toIndex) return;
                  const newBoards = [...boards];
                  const [moved] = newBoards.splice(fromIndex, 1);
                  newBoards.splice(toIndex, 0, moved);
                  const updated = newBoards.map((b, i) => ({ ...b, position: i }));
                  setBoards(updated);
                  // Persist positions
                  for (const b of updated) {
                    await supabase.from("boards").update({ position: b.position } as any).eq("id", b.id);
                  }
                }}
                onClick={() => setSelectedBoardId(board.id)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors cursor-grab active:cursor-grabbing",
                  selectedBoardId === board.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {board.title}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => { setIsArchiveOpen(true); fetchArchive(); }}
              title="Arhiva"
            >
              <Archive className="w-4 h-4" />
            </Button>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsCreatingBoard(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova ploča
                  </DropdownMenuItem>
                  {selectedBoard && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteBoardDialog(selectedBoard)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Obriši "{selectedBoard.title}"
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Board content */}
        <div
          ref={boardScrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            "flex-1 overflow-x-auto overflow-y-hidden p-4 scrollbar-hide select-none",
            isDraggingBoard && "cursor-grabbing",
            !isDraggingBoard && "cursor-grab"
          )}
        >
          {!selectedBoardId ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p>Nema ploča. Kreirajte prvu ploču za početak.</p>
              {isAdmin && (
                <Button className="mt-4" onClick={() => setIsCreatingBoard(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova ploča
                </Button>
              )}
            </div>
          ) : isBoardLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-4 items-start">
                {columns.map((column) => (
                  <div key={column.id} className="w-80 flex-shrink-0 bg-muted/50 rounded-xl p-3 flex flex-col" style={{ maxHeight: 'calc(100vh - 11.5rem)' }}>
                    <div className="flex items-center justify-between mb-3 px-1">
                      {editingColumnId === column.id ? (
                        <Input
                          value={editingColumnTitle}
                          onChange={(e) => setEditingColumnTitle(e.target.value)}
                          onBlur={() => renameColumn(column.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameColumn(column.id);
                            if (e.key === "Escape") setEditingColumnId(null);
                          }}
                          autoFocus
                          className="h-6 text-sm font-semibold px-1 py-0 border-none shadow-none focus-visible:ring-1"
                        />
                      ) : (
                        <h3
                          className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingColumnId(column.id);
                            setEditingColumnTitle(column.title);
                          }}
                        >
                          {column.title}
                        </h3>
                      )}
                      <span className="text-xs text-muted-foreground">{getColumnCards(column.id).length}</span>
                    </div>

                    <Droppable droppableId={column.id} type="card">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "flex-1 overflow-y-auto space-y-2 min-h-[40px] rounded-lg p-1 transition-colors scrollbar-subtle",
                            snapshot.isDraggingOver && "bg-primary/10"
                          )}
                        >
                          {getColumnCards(column.id).map((card, index) => (
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "bg-card rounded-xl p-4 shadow-md border-2 border-border hover:border-primary/40 hover:shadow-lg transition-all cursor-grab group",
                                    snapshot.isDragging && "shadow-xl rotate-2 border-primary cursor-grabbing"
                                  )}
                                  onClick={() => {
                                    setEditingCard(card);
                                    setEditCardData({ title: card.title, description: card.description || "", due_date: card.due_date || "", color: (card as any).color || "" });
                                    fetchComments(card.id);
                                  }}
                                >
                                  {(card as any).color && (
                                    <div className="h-1.5 rounded-full mb-2 -mt-1" style={{ backgroundColor: (card as any).color }} />
                                  )}
                                  <p className="font-semibold text-sm leading-snug">{card.title}</p>
                                  {card.description && (
                                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{card.description}</p>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>

                    {/* Add card - fixed at bottom of column */}
                    <div className="pt-2 shrink-0">
                      {addingCardToColumn === column.id ? (
                        <div className="space-y-2">
                          <Input
                            placeholder="Naslov kartice..."
                            value={newCardTitle}
                            onChange={(e) => setNewCardTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addCard(column.id);
                              if (e.key === "Escape") { setAddingCardToColumn(null); setNewCardTitle(""); }
                            }}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => addCard(column.id)}>Dodaj</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setAddingCardToColumn(null); setNewCardTitle(""); }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={() => setAddingCardToColumn(column.id)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Dodaj karticu
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {/* + Nova kolona - always to the right */}
                {isAddingColumn ? (
                  <div className="w-80 flex-shrink-0 bg-muted/50 rounded-xl p-3 space-y-2">
                    <Input
                      placeholder="Naziv kolone..."
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addColumn();
                        if (e.key === "Escape") { setIsAddingColumn(false); setNewColumnTitle(""); }
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addColumn}>Dodaj</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setIsAddingColumn(false); setNewColumnTitle(""); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingColumn(true)}
                    className="w-80 flex-shrink-0 bg-muted/30 hover:bg-muted/50 rounded-xl p-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors border-2 border-dashed border-border"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-sm font-medium">Nova kolona</span>
                  </button>
                )}
              </div>
            </DragDropContext>
          )}
        </div>
      </div>

      {/* Create board dialog (simple) */}
      <Dialog open={isCreatingBoard} onOpenChange={setIsCreatingBoard}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova ploča</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Naziv ploče..."
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createBoard(); }}
              autoFocus
            />
            <Button onClick={createBoard} className="w-full" disabled={!newBoardTitle.trim()}>
              Kreiraj
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete board confirmation */}
      <Dialog open={!!deleteBoardDialog} onOpenChange={(open) => { if (!open) { setDeleteBoardDialog(null); setDeleteBoardConfirmText(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Obriši ploču</DialogTitle>
            <DialogDescription>
              Upišite <span className="font-bold text-foreground">"{deleteBoardDialog?.title}"</span> da potvrdite brisanje. Ploča će biti arhivirana.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Upišite naziv ploče..."
              value={deleteBoardConfirmText}
              onChange={(e) => setDeleteBoardConfirmText(e.target.value)}
              autoFocus
            />
            <Button
              variant="destructive"
              className="w-full"
              disabled={deleteBoardConfirmText !== deleteBoardDialog?.title}
              onClick={() => deleteBoardDialog && deleteBoard(deleteBoardDialog)}
            >
              Obriši i arhiviraj
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit card dialog - Trello style */}
      <Dialog open={!!editingCard} onOpenChange={(open) => { if (!open) { setEditingCard(null); setComments([]); setNewComment(""); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 gap-0 overflow-hidden [&>button:last-child]:hidden [caret-color:transparent] [&_input]:![caret-color:hsl(var(--foreground))] [&_textarea]:![caret-color:hsl(var(--foreground))]" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Custom header with three-dot menu + close */}
          <div className="px-8 pt-6 pb-2">
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-muted-foreground mt-1.5 shrink-0" />
              <div className="flex-1">
                <Input
                  value={editCardData.title}
                  onChange={(e) => setEditCardData({ ...editCardData, title: e.target.value })}
                  autoFocus={false}
                  tabIndex={-1}
                  className="text-xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent cursor-default focus:cursor-text"
                />
                {editingCard && (
                  <p className="text-xs text-muted-foreground mt-1">
                    u koloni <span className="font-medium text-foreground">{columns.find(c => c.id === editingCard.column_id)?.title}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
                            <CalendarIcon className="w-4 h-4" />
                            Rok
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" side="left">
                          <Calendar
                            mode="single"
                            selected={editCardData.due_date ? new Date(editCardData.due_date) : undefined}
                            onSelect={(date) => setEditCardData({ ...editCardData, due_date: date ? date.toISOString() : "" })}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
                          <ArrowRightLeft className="w-4 h-4" />
                          Premjesti
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="left" align="start">
                        {columns.map((col) => (
                          <DropdownMenuItem
                            key={col.id}
                            disabled={editingCard?.column_id === col.id}
                            onClick={async () => {
                              if (!editingCard) return;
                              const targetCards = cards.filter(c => c.column_id === col.id);
                              await supabase.from("cards").update({ column_id: col.id, position: targetCards.length }).eq("id", editingCard.id);
                              setCards(cards.map(c => c.id === editingCard.id ? { ...c, column_id: col.id, position: targetCards.length } : c));
                              setEditingCard({ ...editingCard, column_id: col.id });
                              toast({ title: "Premješteno", description: `Kartica premještena u "${col.title}".` });
                            }}
                          >
                            {col.title}
                            {editingCard?.column_id === col.id && <span className="ml-auto text-xs text-muted-foreground">trenutno</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => editingCard && deleteCard(editingCard)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Arhiviraj
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditingCard(null); setComments([]); setNewComment(""); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Due date badge */}
            {editCardData.due_date && (
              <div className="ml-8 mt-2">
                <span className="text-xs bg-muted px-2 py-1 rounded-md inline-flex items-center gap-1.5">
                  <CalendarIcon className="w-3 h-3" />
                  {format(new Date(editCardData.due_date), "dd.MM.yyyy")}
                  <button onClick={() => setEditCardData({ ...editCardData, due_date: "" })} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </div>
            )}

            {/* Action bar: small buttons + members on right */}
            <div className="ml-8 mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Popover>
                   <PopoverTrigger asChild>
                     <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs gap-1.5">
                       <Tag className="w-3 h-3" />
                       Boje
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-auto p-3" align="start">
                     <p className="text-xs font-medium mb-2 text-muted-foreground">Odaberi boju</p>
                     <div className="grid grid-cols-5 gap-1.5">
                       {["#EF4444","#F97316","#EAB308","#22C55E","#14B8A6","#3B82F6","#8B5CF6","#EC4899","#6B7280",""].map((c) => (
                         <button
                           key={c || "none"}
                           onClick={() => setEditCardData({ ...editCardData, color: c })}
                           className={cn(
                             "w-7 h-7 rounded-md border-2 transition-all",
                             c === "" ? "bg-muted border-dashed border-muted-foreground/30" : "border-transparent hover:scale-110",
                             editCardData.color === c && "ring-2 ring-primary ring-offset-2"
                           )}
                           style={c ? { backgroundColor: c } : undefined}
                           title={c || "Bez boje"}
                         >
                           {c === "" && <X className="w-3 h-3 mx-auto text-muted-foreground" />}
                         </button>
                       ))}
                     </div>
                   </PopoverContent>
                 </Popover>
                 <Popover>
                   <PopoverTrigger asChild>
                     <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs gap-1.5">
                       <Paperclip className="w-3 h-3" />
                       Prilozi
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-56 p-2" align="start">
                     <p className="text-xs font-medium mb-2 text-muted-foreground px-1">Dodaj prilog</p>
                     <div className="space-y-0.5">
                       <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left">
                         <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                         Datoteka s računala
                       </button>
                       <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left">
                         <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                         Poveznica (URL)
                       </button>
                     </div>
                   </PopoverContent>
                 </Popover>
                 <Button
                   variant="secondary"
                   size="sm"
                   className="h-7 px-2.5 text-xs gap-1.5"
                   onClick={() => window.open("https://sdge.dgu.hr", "_blank")}
                 >
                   <MapPin className="w-3 h-3" />
                   Ispuni SDGE
                 </Button>
                 <Button
                   variant="secondary"
                   size="sm"
                   className="h-7 px-2.5 text-xs gap-1.5"
                   onClick={() => window.open("ahk://run", "_self")}
                 >
                   <UserSearch className="w-3 h-3" />
                   Povuci podatke o stranci
                 </Button>
              </div>

              <div className="flex-1" />

              {/* Members */}
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold" title={user?.email || ""}>
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <button className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors" title="Dodaj člana">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Two-column body */}
          <div className="flex gap-0 overflow-hidden" style={{ height: 'calc(90vh - 180px)' }}>
            {/* LEFT: Description */}
            <div className="flex-1 overflow-y-auto p-8 pt-4 border-r border-border scrollbar-subtle flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <AlignLeft className="w-5 h-5 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Opis</h4>
              </div>
              <Textarea
                value={editCardData.description}
                onChange={(e) => setEditCardData({ ...editCardData, description: e.target.value })}
                placeholder="Dodajte detaljniji opis..."
                className="bg-muted/50 border-none focus-visible:ring-1 resize-none flex-1"
              />

            </div>

            {/* RIGHT: Comments and activity */}
            <div className="w-[420px] shrink-0 flex flex-col overflow-hidden">
              <div className="px-6 py-3 border-b border-border flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Komentari i aktivnost</h4>
              </div>

              {/* Comment input */}
              <div className="px-6 py-3 border-b border-border">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 flex gap-2">
                    <Input
                      placeholder="Napiši komentar..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
                      className="h-8 text-sm"
                    />
                    <Button size="icon" className="h-8 w-8 shrink-0" onClick={addComment} disabled={!newComment.trim()}>
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Comments list */}
              <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4 scrollbar-subtle">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nema komentara.</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-bold shrink-0">
                        {(comment.user_name || comment.user_email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-sm">{comment.user_name || comment.user_email || "Korisnik"}</span>
                          <span className="text-xs text-primary">{format(new Date(comment.created_at), "dd.MM.yyyy, HH:mm")}</span>
                        </div>
                        <Textarea
                          defaultValue={comment.content}
                          readOnly={comment.user_id !== user?.id}
                          className="bg-muted/50 border-none focus-visible:ring-1 resize-none text-sm mt-1 min-h-[40px]"
                          rows={1}
                          onInput={(e) => {
                            const el = e.currentTarget;
                            el.style.height = "auto";
                            el.style.height = el.scrollHeight + "px";
                          }}
                          onFocus={(e) => {
                            const el = e.currentTarget;
                            el.style.height = "auto";
                            el.style.height = el.scrollHeight + "px";
                          }}
                          onChange={async (e) => {
                            const newContent = e.target.value;
                            if (comment.user_id !== user?.id) return;
                            // Debounced save
                            const key = `comment-save-${comment.id}`;
                            if ((window as any)[key]) clearTimeout((window as any)[key]);
                            (window as any)[key] = setTimeout(async () => {
                              if (newContent.trim()) {
                                await supabase.from("comments").update({ content: newContent.trim() }).eq("id", comment.id);
                                setComments(prev => prev.map(c => c.id === comment.id ? { ...c, content: newContent.trim() } : c));
                              }
                            }, 800);
                          }}
                        />
                        {comment.user_id === user?.id && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <button className="hover:text-destructive transition-colors" onClick={() => deleteComment(comment.id)}>
                              Obriši
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive dialog */}
      <Dialog open={isArchiveOpen} onOpenChange={setIsArchiveOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Arhiva</DialogTitle>
            <DialogDescription>Obrisane ploče i kartice ostaju ovdje zauvijek.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {archivedBoards.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Arhivirane ploče</h4>
                <div className="space-y-2">
                  {archivedBoards.map((b) => (
                    <div key={b.id} className="bg-muted/50 rounded-lg p-3">
                      <p className="font-medium text-sm">{b.title}</p>
                      {b.description && <p className="text-xs text-muted-foreground mt-1">{b.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">Arhivirano: {new Date(b.archived_at).toLocaleDateString("hr")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {archivedCards.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Arhivirane kartice</h4>
                <div className="space-y-2">
                  {archivedCards.map((c) => (
                    <div key={c.id} className="bg-muted/50 rounded-lg p-3">
                      <p className="font-medium text-sm">{c.title}</p>
                      {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Ploča: {c.board_title || "—"} · Kolona: {c.column_title || "—"} · {new Date(c.archived_at).toLocaleDateString("hr")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {archivedBoards.length === 0 && archivedCards.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">Arhiva je prazna.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default KanbanBoards;
