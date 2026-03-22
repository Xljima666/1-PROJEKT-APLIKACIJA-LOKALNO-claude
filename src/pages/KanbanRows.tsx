import { useEffect, useState, useCallback, useRef } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import DashboardLayout, { useHeaderSearch } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  CalendarIcon,
  GripVertical,
  Archive,
  MoreHorizontal,
  X,
  CreditCard,
  AlignLeft,
  MessageSquare,
  Send,
  Tag,
  Paperclip,
  Users,
  FileText,
  Sparkles,
  MapPin,
  UserSearch,
  ArrowRightLeft,
  Filter,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fillZahtjevPDF, downloadPdfBytes, type ZahtjevData } from "@/lib/pdf-fill-zahtjev";
import { getAvatarColor, getInitials } from "@/lib/avatar-utils";

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
  created_by: string | null;
  created_at: string;
  status: string | null;
  parent_card_id: string | null;
  assigned_to: string | null;
  kontakt: string | null;
  narucitelj_ime: string | null;
  narucitelj_adresa: string | null;
  narucitelj_oib: string | null;
  adresa_cestice: string | null;
  postanski_broj: string | null;
  katastarska_opcina: string | null;
  katastarska_cestica: string | null;
  vrsta_posla: string[] | null;
}

const VRSTA_POSLA_OPTIONS = [
  "G1A - Dioba katastarskih čestica",
  "G1B - Spajanje katastarskih čestica",
  "G2A - Provedba lokacijske dozvole",
  "G2B - Provedba rješenja o utvrđivanju građevne čestice",
  "G2C - Provedba građevinske dozvole",
  "G2D - Provedba UPU-a ili prostornog plana",
  "G2E - Provedba PPUG/GUP-a",
  "G2F - Provedba PP za neizgrađeno građevinsko zemljište",
  "G3A - Evidentiranje pomorskog dobra",
  "G3B - Evidentiranje vodnog dobra",
  "G4 - Spajanje čestica s postojećom zgradom",
  "G5A - Evidentiranje zgrade",
  "G5B - Brisanje zgrade",
  "G5C - Promjena podataka o zgradi",
  "G5D - Evidentiranje druge građevine",
  "G6 - Evidentiranje/promjena načina uporabe",
  "G7 - Evidentiranje stvarnog položaja čestica",
  "G8 - Evidentiranje uređenih međa",
  "G9A - Provedba rješenja o povratu zemljišta",
  "G9B - Provedba sudskih presuda",
  "G10 - Provedba u zemljišnoj knjizi",
  "G11 - Izmjera za ispravljanje ZK",
  "G12 - Ispravljanje propusta u održavanju katastra",
  "G13 - Ispravljanje podataka katastarskog plana",
  "G14 - Promjena područja/granica k.o.",
  "G15 - Evidentiranje izvedenog stanja ceste",
  "G16 - Iskolčenje građevine",
  "G17 - Snimanje izvedenog stanja",
  "G18 - Etažiranje",
  "G19 - Identifikacija čestica",
  "G20 - Ostali geodetski poslovi",
];

// Croatian postal codes lookup by city/place name
const HR_POSTAL_CODES: Record<string, string> = {
  "zagreb": "10000", "sesvete": "10360", "velika gorica": "10410", "samobor": "10430",
  "zaprešić": "10290", "dugo selo": "10370", "sveta nedelja": "10431", "jastrebarsko": "10450",
  "split": "21000", "solin": "21210", "kaštela": "21212", "trogir": "21220", "sinj": "21230",
  "omiš": "21310", "makarska": "21300", "imotski": "21260",
  "rijeka": "51000", "opatija": "51410", "crikvenica": "51260", "krk": "51500",
  "mali lošinj": "51550", "rab": "51280", "senj": "53270",
  "osijek": "31000", "đakovo": "31400", "vinkovci": "32100", "vukovar": "32000",
  "slavonski brod": "35000", "požega": "34000", "nova gradiška": "35400",
  "varaždin": "42000", "čakovec": "40000", "koprivnica": "48000", "križevci": "48260",
  "bjelovar": "43000", "virovitica": "33000", "daruvar": "43500",
  "karlovac": "47000", "sisak": "44000", "petrinja": "44250", "kutina": "44320",
  "zadar": "23000", "šibenik": "22000", "knin": "22300", "biograd na moru": "23210",
  "dubrovnik": "20000", "korčula": "20260", "metković": "20350", "ploče": "20340",
  "pula": "52100", "rovinj": "52210", "poreč": "52440", "umag": "52470",
  "pazin": "52000", "labin": "52220", "buzet": "52420",
  "gospić": "53000", "otočac": "53220", "novalja": "53291",
  "krapina": "49000", "zlatar": "49250", "pregrada": "49218",
  "ivanec": "42240", "ludbreg": "42230", "lepoglava": "42250",
  "đurđevac": "48350", "beli manastir": "31300", "našice": "31500",
  "ogulin": "47300", "slunj": "47240", "duga resa": "47250",
  "vrbovec": "10340", "sveti ivan zelina": "10380", "ivanić-grad": "10310",
  "garešnica": "43280", "čazma": "43240", "grubišno polje": "43290",
  "novska": "44330", "glina": "44400", "popovača": "44317",
  "županja": "32270", "ilok": "32236", "otok": "32252",
  "trilj": "21240", "vrgorac": "21276", "supetar": "21400", "hvar": "21450",
  "vis": "21480", "vela luka": "20270", "lastovo": "20290",
  "benkovac": "23420", "obrovac": "23450", "pag": "23250", "nin": "23232",
  "drniš": "22320", "vodice": "22211", "primošten": "22202", "skradin": "22222",
};

function findPostalCode(address: string): string {
  if (!address) return "";
  const lower = address.toLowerCase().trim();
  // Try exact city match first, then partial
  for (const [city, code] of Object.entries(HR_POSTAL_CODES)) {
    if (lower.includes(city)) return code;
  }
  return "";
}

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const STATUS_OPTIONS = [
  { label: "NA ČEKANJU", color: "#EF4444" },
  { label: "U DOGOVORU", color: "#3B82F6" },
  { label: "TERENSKI UVIĐAJ", color: "#78716C" },
  { label: "U RADU", color: "#F97316" },
  { label: "U KATASTRU", color: "#EAB308" },
  { label: "NA ZAKLJUČKU", color: "#8B5CF6" },
  { label: "GOTOVO", color: "#22C55E" },
  { label: "NAPLAČENO", color: "#14B8A6" },
] as const;

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
  board_id: string | null;
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
  user_name?: string | null;
}

const KanbanRows = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const search = useHeaderSearch();
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());

  // Board rename
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [renamingBoardTitle, setRenamingBoardTitle] = useState("");

  // Card editor (Trello style)
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editCardData, setEditCardData] = useState({
    title: "", description: "", due_date: "", color: "", status: "",
    kontakt: "", narucitelj_ime: "", narucitelj_adresa: "", narucitelj_oib: "",
    adresa_cestice: "", postanski_broj: "", katastarska_opcina: "", katastarska_cestica: "",
    vrsta_posla: [] as string[],
  });

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  // Delete board
  const [deleteBoardDialog, setDeleteBoardDialog] = useState<Board | null>(null);
  const [deleteBoardConfirmText, setDeleteBoardConfirmText] = useState("");

  // Archive
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archivedBoards, setArchivedBoards] = useState<ArchivedBoard[]>([]);
  const [archivedCards, setArchivedCards] = useState<ArchivedCard[]>([]);

  // New card
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [showNewSubTab, setShowNewSubTab] = useState(false);
  const [newSubTabTitle, setNewSubTabTitle] = useState("");
  const [addingSubCardTo, setAddingSubCardTo] = useState<string | null>(null);
  const [newSubCardTitle, setNewSubCardTitle] = useState("");
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>([]);
  const [filterUser, setFilterUser] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url");
    if (data) setTeamProfiles(data);
  }, []);

  useEffect(() => { fetchProfiles(); }, []);

  const fetchBoards = useCallback(async () => {
    const { data } = await supabase.from("boards").select("*").order("position");
    if (data) {
      setBoards(data);
      if (!selectedBoard && data.length > 0) setSelectedBoard(data[0].id);
    }
    setLoading(false);
  }, [selectedBoard]);

  const fetchBoardContent = useCallback(async (boardId: string) => {
    const { data: cols } = await supabase.from("columns").select("*").eq("board_id", boardId).order("position");
    if (cols) {
      setColumns(cols);
      // Auto-select first column if none selected
      setSelectedColumn(prev => {
        if (!prev || !cols.find(c => c.id === prev)) {
          return cols.length > 0 ? cols[0].id : null;
        }
        return prev;
      });
      const colIds = cols.map(c => c.id);
      if (colIds.length > 0) {
        const { data: crds } = await supabase.from("cards").select("*").in("column_id", colIds).order("position");
        if (crds) setCards(crds);
      } else {
        setCards([]);
      }
    }
  }, []);

  useEffect(() => { fetchBoards(); }, []);
  useEffect(() => { if (selectedBoard) fetchBoardContent(selectedBoard); }, [selectedBoard]);

  // Realtime
  useEffect(() => {
    if (!selectedBoard) return;
    const channel = supabase
      .channel(`rows-board-${selectedBoard}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, () => fetchBoardContent(selectedBoard))
      .on("postgres_changes", { event: "*", schema: "public", table: "columns" }, () => fetchBoardContent(selectedBoard))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedBoard]);

  // Auto-save card edits
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editCardDataRef = useRef(editCardData);
  editCardDataRef.current = editCardData;

  useEffect(() => {
    if (!editingCard) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const d = editCardDataRef.current;
      supabase.from("cards").update({
        title: d.title,
        description: d.description || null,
        due_date: d.due_date || null,
        color: d.color || null,
        kontakt: d.kontakt || null,
        narucitelj_ime: d.narucitelj_ime || null,
        narucitelj_adresa: d.narucitelj_adresa || null,
        narucitelj_oib: d.narucitelj_oib || null,
        adresa_cestice: d.adresa_cestice || null,
        postanski_broj: d.postanski_broj || null,
        katastarska_opcina: d.katastarska_opcina || null,
        katastarska_cestica: d.katastarska_cestica || null,
        vrsta_posla: d.vrsta_posla.length > 0 ? d.vrsta_posla : null,
      } as any).eq("id", editingCard.id).then(() => {
        setCards(prev => prev.map(c => c.id === editingCard.id
          ? { ...c, title: d.title, description: d.description || null, due_date: d.due_date || null, color: d.color || null, kontakt: d.kontakt || null, narucitelj_ime: d.narucitelj_ime || null, narucitelj_adresa: d.narucitelj_adresa || null, narucitelj_oib: d.narucitelj_oib || null, adresa_cestice: d.adresa_cestice || null, postanski_broj: d.postanski_broj || null, katastarska_opcina: d.katastarska_opcina || null, katastarska_cestica: d.katastarska_cestica || null, vrsta_posla: d.vrsta_posla.length > 0 ? d.vrsta_posla : null }
          : c
        ));
      });
    }, 800);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [editCardData]);

  const toggleCollapse = (colId: string) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId); else next.add(colId);
      return next;
    });
  };

  const handleCardDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.index === destination.index && source.droppableId === destination.droppableId) return;

    const colId = source.droppableId;
    const parentCards = cards
      .filter(c => c.column_id === colId && !c.parent_card_id)
      .filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.position - b.position);

    const reordered = [...parentCards];
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    // Optimistic update
    const updatedCards = cards.map(c => {
      const idx = reordered.findIndex(r => r.id === c.id);
      if (idx !== -1) return { ...c, position: idx };
      return c;
    });
    setCards(updatedCards);

    // Persist
    await Promise.all(reordered.map((card, idx) =>
      supabase.from("cards").update({ position: idx }).eq("id", card.id)
    ));
  };

  const getColumnCards = (colId: string) =>
    cards.filter(c => c.column_id === colId)
      .filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()))
      .filter(c => !filterUser || c.assigned_to === filterUser)
      .filter(c => !filterStatus || (c as any).status === filterStatus)
      .sort((a, b) => a.position - b.position);

  const createBoard = async () => {
    if (!newBoardTitle.trim() || !user) return;
    const maxPos = boards.length > 0 ? Math.max(...boards.map(b => b.position ?? 0)) + 1 : 0;
    const { data, error } = await supabase.from("boards").insert({ title: newBoardTitle.trim(), created_by: user.id, position: maxPos } as any).select().single();
    if (!error && data) {
      setBoards([...boards, data]);
      setSelectedBoard(data.id);
    }
    setNewBoardTitle("");
    setShowNewBoard(false);
  };

  const renameBoard = async () => {
    if (!renamingBoardId || !renamingBoardTitle.trim()) { setRenamingBoardId(null); return; }
    await supabase.from("boards").update({ title: renamingBoardTitle.trim() }).eq("id", renamingBoardId);
    setBoards(prev => prev.map(b => b.id === renamingBoardId ? { ...b, title: renamingBoardTitle.trim() } : b));
    setRenamingBoardId(null);
  };

  const deleteBoard = async (board: Board) => {
    // Archive cards
    const { data: cols } = await supabase.from("columns").select("*").eq("board_id", board.id);
    if (cols && cols.length > 0) {
      const colIds = cols.map(c => c.id);
      const { data: boardCards } = await supabase.from("cards").select("*").in("column_id", colIds);
      if (boardCards && boardCards.length > 0) {
        const archived = boardCards.map(card => {
          const col = cols.find(c => c.id === card.column_id);
          return {
            original_id: card.id, title: card.title, description: card.description,
            column_title: col?.title || null, board_id: board.id, board_title: board.title,
            created_by: card.created_by, original_created_at: card.created_at, archived_by: user?.id,
          };
        });
        await supabase.from("archived_cards").insert(archived);
      }
    }
    // Archive board
    await supabase.from("archived_boards").insert({
      original_id: board.id, title: board.title, description: board.description,
      background_color: board.background_color, created_by: board.created_at ? null : null,
      original_created_at: board.created_at, archived_by: user?.id,
    });
    const { error } = await supabase.from("boards").delete().eq("id", board.id);
    if (!error) {
      const remaining = boards.filter(b => b.id !== board.id);
      setBoards(remaining);
      if (selectedBoard === board.id) setSelectedBoard(remaining.length > 0 ? remaining[0].id : null);
      setDeleteBoardDialog(null);
      setDeleteBoardConfirmText("");
      toast({ title: "Ploča arhivirana i obrisana." });
    }
  };

  const createSubTab = async () => {
    if (!newSubTabTitle.trim() || !selectedBoard) return;
    const maxPos = columns.length > 0 ? Math.max(...columns.map(c => c.position)) + 1 : 0;
    const { data, error } = await supabase.from("columns").insert({ title: newSubTabTitle.trim(), board_id: selectedBoard, position: maxPos }).select().single();
    if (!error && data) {
      setColumns([...columns, data]);
      setSelectedColumn(data.id);
    }
    setNewSubTabTitle("");
    setShowNewSubTab(false);
  };

  const addCard = async (columnId: string) => {
    if (!newCardTitle.trim()) return;
    const colCards = cards.filter(c => c.column_id === columnId);
    const maxPos = colCards.length > 0 ? Math.max(...colCards.map(c => c.position)) + 1 : 0;
    const defaultStatus = STATUS_OPTIONS[0];
    const { data, error } = await supabase.from("cards").insert({ title: newCardTitle.trim(), column_id: columnId, position: maxPos, created_by: user?.id, status: defaultStatus.label, color: defaultStatus.color } as any).select().single();
    if (!error && data) setCards([...cards, data]);
    setNewCardTitle("");
    setAddingToColumn(null);
  };

  const addSubCard = async (parentId: string, columnId: string) => {
    if (!newSubCardTitle.trim()) return;
    const colCards = cards.filter(c => c.column_id === columnId);
    const maxPos = colCards.length > 0 ? Math.max(...colCards.map(c => c.position)) + 1 : 0;
    const defaultStatus = STATUS_OPTIONS[0];
    const { data, error } = await supabase.from("cards").insert({ title: newSubCardTitle.trim(), column_id: columnId, position: maxPos, created_by: user?.id, parent_card_id: parentId, status: defaultStatus.label, color: defaultStatus.color } as any).select().single();
    if (!error && data) setCards([...cards, data as Card]);
    setNewSubCardTitle("");
    setAddingSubCardTo(null);
  };

  const deleteCard = async (card: Card) => {
    const col = columns.find(c => c.id === card.column_id);
    const board = boards.find(b => b.id === selectedBoard);
    await supabase.from("archived_cards").insert({
      original_id: card.id, title: card.title, description: card.description,
      column_title: col?.title || null, board_id: selectedBoard,
      board_title: board?.title || null, created_by: card.created_by,
      original_created_at: card.created_at, archived_by: user?.id,
    });
    const { error } = await supabase.from("cards").delete().eq("id", card.id);
    if (!error) {
      setCards(cards.filter(c => c.id !== card.id));
      setEditingCard(null);
      toast({ title: "Kartica arhivirana." });
    }
  };

  // Comments
  const fetchComments = async (cardId: string) => {
    const { data } = await supabase.from("comments").select("*").eq("card_id", cardId).order("created_at", { ascending: false });
    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      setComments(data.map(c => ({
        ...c,
        user_name: profiles?.find(p => p.user_id === c.user_id)?.full_name || null,
        user_email: c.user_id === user?.id ? user?.email : undefined,
      })));
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !editingCard || !user) return;
    const { data, error } = await supabase.from("comments").insert({ card_id: editingCard.id, user_id: user.id, content: newComment }).select().single();
    if (!error && data) {
      setComments([{ ...data, user_name: null, user_email: user.email }, ...comments]);
      setNewComment("");
      supabase.functions.invoke("notify-change", {
        body: { type: "comment", card_id: editingCard.id, user_id: user.id, content: newComment },
      }).catch(() => {});
    }
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (!error) setComments(comments.filter(c => c.id !== commentId));
  };

  const fetchArchive = async () => {
    const [{ data: ab }, { data: ac }] = await Promise.all([
      supabase.from("archived_boards").select("*").order("archived_at", { ascending: false }),
      supabase.from("archived_cards").select("*").order("archived_at", { ascending: false }),
    ]);
    setArchivedBoards(ab || []);
    setArchivedCards(ac || []);
  };

  const currentBoard = boards.find(b => b.id === selectedBoard);

  // Selected column sub-tab (null = show all)
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

  

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
    </DashboardLayout>
    );
  }

  const displayedColumns = selectedColumn
    ? columns.filter(c => c.id === selectedColumn)
    : columns;

  return (
    <DashboardLayout noScroll>
      <div className="p-4 space-y-3 h-full overflow-y-auto overflow-x-hidden scrollbar-hide">
        {/* Board tabs + actions */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {boards.map(b => (
            renamingBoardId === b.id ? (
              <form key={b.id} onSubmit={e => { e.preventDefault(); renameBoard(); }} className="shrink-0">
                <Input
                  value={renamingBoardTitle}
                  onChange={e => setRenamingBoardTitle(e.target.value)}
                  onBlur={() => renameBoard()}
                  onKeyDown={e => { if (e.key === "Escape") setRenamingBoardId(null); }}
                  className="h-8 w-36 text-sm"
                  autoFocus
                />
              </form>
            ) : (
              <Button
                key={b.id}
                variant={selectedBoard === b.id ? "default" : "outline"}
                size="sm"
                onClick={() => { setSelectedBoard(b.id); setSelectedColumn(null); }}
                onDoubleClick={() => { setRenamingBoardId(b.id); setRenamingBoardTitle(b.title); }}
                className="shrink-0"
              >
                {b.title}
              </Button>
            )
          ))}
          {showNewBoard && (
            <form onSubmit={e => { e.preventDefault(); createBoard(); }} className="flex gap-1 shrink-0">
              <Input value={newBoardTitle} onChange={e => setNewBoardTitle(e.target.value)} placeholder="Naziv ploče..." className="h-8 w-36 text-sm" autoFocus onBlur={() => { if (!newBoardTitle.trim()) setShowNewBoard(false); }} />
              <Button type="submit" size="sm" className="h-8"><Plus className="w-3.5 h-3.5" /></Button>
            </form>
          )}

          <div className="flex-1" />

          {/* Archive + menu */}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0" onClick={() => { setIsArchiveOpen(true); fetchArchive(); }} title="Arhiva">
            <Archive className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowNewBoard(true)}>
                <Plus className="w-4 h-4 mr-2" /> Nova ploča
              </DropdownMenuItem>
              {currentBoard && (
                <>
                  <DropdownMenuItem onClick={() => setShowNewSubTab(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Novi podtab
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setRenamingBoardId(currentBoard.id); setRenamingBoardTitle(currentBoard.title); }}>
                    <Tag className="w-4 h-4 mr-2" /> Preimenuj ploču
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteBoardDialog(currentBoard)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Obriši "{currentBoard.title}"
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Column sub-tabs + filters */}
        {selectedBoard && columns.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
              {columns.map(col => (
                <Tooltip key={col.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={selectedColumn === col.id ? "default" : "outline"}
                      size="sm"
                      className="shrink-0"
                      onClick={() => setSelectedColumn(col.id)}
                    >
                      <span className="hidden sm:inline">{col.title}</span>
                      <span className="sm:hidden">{col.title.split(' ').map(w => w[0]).join('').slice(0, 3)}</span>
                      <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5">{getColumnCards(col.id).length}</Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="sm:hidden">
                    <p className="text-xs">{col.title}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {showNewSubTab && (
                <form onSubmit={e => { e.preventDefault(); createSubTab(); }} className="flex gap-1 shrink-0">
                  <Input value={newSubTabTitle} onChange={e => setNewSubTabTitle(e.target.value)} placeholder="Naziv podtaba..." className="h-8 w-36 text-sm" autoFocus onBlur={() => { if (!newSubTabTitle.trim()) setShowNewSubTab(false); }} />
                  <Button type="submit" size="sm" className="h-8"><Plus className="w-3.5 h-3.5" /></Button>
                </form>
              )}
            </div>
            {/* Filters */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={filterStatus ? "default" : "outline"} size="sm" className="h-8 gap-1.5">
                    <Filter className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{filterStatus || "Status"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2" align="end">
                  <button
                    onClick={() => setFilterStatus("")}
                    className={cn("w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent", !filterStatus && "bg-accent font-medium")}
                  >
                    Svi
                  </button>
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s.label}
                      onClick={() => setFilterStatus(s.label)}
                      className={cn("w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent", filterStatus === s.label && "bg-accent font-medium")}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={filterUser ? "default" : "outline"} size="sm" className="h-8 gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{filterUser ? (teamProfiles.find(p => p.user_id === filterUser)?.full_name || "Korisnik") : "Član"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <button
                    onClick={() => setFilterUser("")}
                    className={cn("w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent", !filterUser && "bg-accent font-medium")}
                  >
                    Svi
                  </button>
                  {teamProfiles.map(p => (
                    <button
                      key={p.user_id}
                      onClick={() => setFilterUser(p.user_id)}
                      className={cn("w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent", filterUser === p.user_id && "bg-accent font-medium")}
                    >
                      {p.full_name || p.user_id.slice(0, 8)}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              {(filterUser || filterStatus) && (
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setFilterUser(""); setFilterStatus(""); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Row-based board */}
        {selectedBoard && columns.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">Ova ploča nema kolona. Dodaj ih u "Poslovi".</p>
        )}

        <div className="space-y-4">
          {displayedColumns.map(col => {
            const colCards = getColumnCards(col.id);
            const isCollapsed = collapsedColumns.has(col.id);
            return (
              <div key={col.id} className="rounded-lg border border-border bg-card/50 overflow-hidden">
                {!selectedColumn && (
                  <button onClick={() => toggleCollapse(col.id)} className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-semibold text-sm">{col.title}</span>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{colCards.length}</Badge>
                  </button>
                )}
                {(!isCollapsed || selectedColumn) && (
                  <div className={cn(!selectedColumn && "border-t border-border")}>
                    <DragDropContext onDragEnd={handleCardDragEnd}>
                      <Droppable droppableId={col.id}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps}>
                            {colCards.filter(c => !(c as any).parent_card_id).map((card, cardIndex) => {
                              const subCards = colCards.filter(c => (c as any).parent_card_id === card.id);
                              const statusLabel = card.status || (STATUS_OPTIONS.find(s => s.color === card.color)?.label);
                              const assignedProfile = card.assigned_to ? teamProfiles.find(p => p.user_id === card.assigned_to) : null;
                              return (
                                <Draggable key={card.id} draggableId={card.id} index={cardIndex}>
                                  {(dragProvided, snapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      className={cn("group/card relative", snapshot.isDragging && "z-50")}
                                    >
                                      <div
                                        onClick={() => {
                                          setEditingCard(card);
                                          setEditCardData({ title: card.title, description: card.description || "", due_date: card.due_date || "", color: card.color || "", status: (card as any).status || "", kontakt: (card as any).kontakt || "", narucitelj_ime: (card as any).narucitelj_ime || "", narucitelj_adresa: (card as any).narucitelj_adresa || "", narucitelj_oib: (card as any).narucitelj_oib || "", adresa_cestice: (card as any).adresa_cestice || "", postanski_broj: (card as any).postanski_broj || "", katastarska_opcina: (card as any).katastarska_opcina || "", katastarska_cestica: (card as any).katastarska_cestica || "", vrsta_posla: (card as any).vrsta_posla || [] });
                                          fetchComments(card.id);
                                        }}
                                        className={cn("mx-3 my-1.5 px-4 py-2.5 rounded-2xl transition-all cursor-pointer hover:shadow-md", snapshot.isDragging && "shadow-lg")}
                                        style={{ backgroundColor: card.color ? `${card.color}20` : 'hsl(var(--muted) / 0.3)', borderLeft: card.color ? `3px solid ${card.color}` : '3px solid transparent' }}
                                        title={statusLabel || undefined}
                                      >
                                        <div className="flex items-center gap-2">
                                          {card.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: card.color }} />}
                                          <span className="text-sm flex-1 min-w-0 truncate font-medium">{card.title}</span>
                                          {statusLabel && (
                                            <span className="text-[11px] font-bold shrink-0 px-2 py-0.5 rounded-md" style={{ color: 'white', backgroundColor: card.color || 'hsl(var(--muted-foreground))' }}>
                                              {statusLabel}
                                            </span>
                                          )}
                                          {assignedProfile && (
                                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", getAvatarColor(assignedProfile.user_id, assignedProfile.full_name))} title={assignedProfile.full_name || ""}>
                                              {getInitials(assignedProfile.full_name || null)}
                                            </div>
                                          )}
                                          {card.due_date && (
                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                                              <CalendarIcon className="w-3 h-3" />
                                              {format(new Date(card.due_date), "dd.MM.")}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {/* Sub-cards on hover */}
                                      {subCards.length > 0 && (
                                        <div className="max-h-0 overflow-hidden group-hover/card:max-h-96 transition-all duration-300 ease-in-out">
                                          {subCards.map(sc => {
                                            const scStatus = sc.status || (STATUS_OPTIONS.find(s => s.color === sc.color)?.label);
                                            const scAssigned = sc.assigned_to ? teamProfiles.find(p => p.user_id === sc.assigned_to) : null;
                                            return (
                                              <div
                                                key={sc.id}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingCard(sc);
                                                  setEditCardData({ title: sc.title, description: sc.description || "", due_date: sc.due_date || "", color: sc.color || "", status: (sc as any).status || "", kontakt: (sc as any).kontakt || "", narucitelj_ime: (sc as any).narucitelj_ime || "", narucitelj_adresa: (sc as any).narucitelj_adresa || "", narucitelj_oib: (sc as any).narucitelj_oib || "", adresa_cestice: (sc as any).adresa_cestice || "", postanski_broj: (sc as any).postanski_broj || "", katastarska_opcina: (sc as any).katastarska_opcina || "", katastarska_cestica: (sc as any).katastarska_cestica || "", vrsta_posla: (sc as any).vrsta_posla || [] });
                                                  fetchComments(sc.id);
                                                }}
                                                className="mx-6 my-0.5 px-3 py-1.5 rounded-xl cursor-pointer transition-colors text-xs hover:shadow-sm"
                                                style={{ backgroundColor: sc.color ? `${sc.color}15` : 'hsl(var(--muted) / 0.4)', borderLeft: sc.color ? `2px solid ${sc.color}` : '2px solid transparent' }}
                                              >
                                                <div className="flex items-center gap-2">
                                                  {sc.color && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc.color }} />}
                                                  <span className="flex-1 min-w-0 truncate">{sc.title}</span>
                                                  {scStatus && (
                                                    <span className="text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: sc.color || 'hsl(var(--muted-foreground))' }}>
                                                      {scStatus}
                                                    </span>
                                                  )}
                                                  {scAssigned && (
                                                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0", getAvatarColor(scAssigned.user_id, scAssigned.full_name))} title={scAssigned.full_name || ""}>
                                                      {getInitials(scAssigned.full_name || null)}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {/* Add sub-card on hover */}
                                      <div className="max-h-0 overflow-hidden group-hover/card:max-h-12 transition-all duration-300">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setAddingSubCardTo(card.id); setNewSubCardTitle(""); }}
                                          className="mx-6 my-0.5 px-3 py-1 rounded-xl text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center gap-1"
                                        >
                                          <Plus className="w-3 h-3" /> Podkartica
                                        </button>
                                      </div>
                                      {addingSubCardTo === card.id && (
                                        <form onSubmit={e => { e.preventDefault(); addSubCard(card.id, col.id); }} className="mx-6 my-1 flex gap-1">
                                          <Input value={newSubCardTitle} onChange={e => setNewSubCardTitle(e.target.value)} placeholder="Naziv podkartice..." className="h-6 text-xs flex-1" autoFocus onBlur={() => { if (!newSubCardTitle.trim()) setAddingSubCardTo(null); }} />
                                          <Button type="submit" size="sm" className="h-6 text-[10px] px-2">OK</Button>
                                        </form>
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                    {addingToColumn === col.id ? (
                      <form onSubmit={e => { e.preventDefault(); addCard(col.id); }} className="flex items-center gap-2 px-4 py-2">
                        <Input value={newCardTitle} onChange={e => setNewCardTitle(e.target.value)} placeholder="Naziv kartice..." className="h-7 text-sm flex-1" autoFocus onBlur={() => { if (!newCardTitle.trim()) setAddingToColumn(null); }} />
                        <Button type="submit" size="sm" className="h-7 text-xs">Dodaj</Button>
                      </form>
                    ) : (
                      <button onClick={() => { setAddingToColumn(col.id); setNewCardTitle(""); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Dodaj karticu
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Trello-style card editor dialog (same as Poslovi) ===== */}
      <Dialog open={!!editingCard} onOpenChange={(open) => { if (!open) { setEditingCard(null); setComments([]); setNewComment(""); } }}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] sm:max-h-[90vh] p-0 gap-0 overflow-y-auto sm:overflow-hidden [&>button:last-child]:hidden [caret-color:transparent] [&_input]:![caret-color:hsl(var(--foreground))] [&_textarea]:![caret-color:hsl(var(--foreground))]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-2">
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
                            <CalendarIcon className="w-4 h-4" /> Rok
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
                          <ArrowRightLeft className="w-4 h-4" /> Premjesti
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
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => editingCard && deleteCard(editingCard)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Arhiviraj
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditingCard(null); setComments([]); setNewComment(""); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

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

            {/* Status + avatars: visible in header on desktop, hidden on mobile (moved to scroll area) */}
            <div className="hidden sm:block ml-8 mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {STATUS_OPTIONS.map(s => (
                  <Button
                    key={s.label}
                    size="sm"
                    className="h-7 px-2.5 text-xs font-semibold text-white border-0"
                    style={{ backgroundColor: editCardData.status === s.label ? s.color : `${s.color}80` }}
                    onClick={async () => {
                      const isActive = editCardData.status === s.label;
                      const newColor = isActive ? "" : s.color;
                      const newStatus = isActive ? "" : s.label;
                      setEditCardData({ ...editCardData, color: newColor, status: newStatus });
                      if (editingCard) {
                        await supabase.from("cards").update({ color: newColor || null, status: newStatus || null } as any).eq("id", editingCard.id);
                        setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, color: newColor || null, status: newStatus || null } as Card : c));
                      }
                    }}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                {teamProfiles.map(p => {
                  const isAssigned = editingCard?.assigned_to === p.user_id;
                  return (
                    <button
                      key={p.user_id}
                      onClick={async () => {
                        if (!editingCard) return;
                        const newAssigned = isAssigned ? null : p.user_id;
                        await supabase.from("cards").update({ assigned_to: newAssigned } as any).eq("id", editingCard.id);
                        setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, assigned_to: newAssigned } : c));
                        setEditingCard({ ...editingCard, assigned_to: newAssigned });
                      }}
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all",
                        isAssigned
                          ? cn(getAvatarColor(p.user_id, p.full_name), "ring-2 ring-primary ring-offset-2 ring-offset-background")
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                      title={p.full_name || "Korisnik"}
                    >
                      {getInitials(p.full_name || null)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Two-column body - stacked on mobile */}
          <div className="flex flex-col sm:flex-row gap-0 sm:overflow-hidden sm:flex-1" style={{ minHeight: 0 }}>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 sm:pt-4 border-b sm:border-b-0 sm:border-r border-border scrollbar-subtle flex flex-col gap-4">
              {/* Status + avatars on mobile only (inside scroll area) */}
              <div className="sm:hidden flex flex-col gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {STATUS_OPTIONS.map(s => (
                    <Button
                      key={s.label}
                      size="sm"
                      className="h-7 px-2 text-[10px] font-semibold text-white border-0"
                      style={{ backgroundColor: editCardData.status === s.label ? s.color : `${s.color}80` }}
                      onClick={async () => {
                        const isActive = editCardData.status === s.label;
                        const newColor = isActive ? "" : s.color;
                        const newStatus = isActive ? "" : s.label;
                        setEditCardData({ ...editCardData, color: newColor, status: newStatus });
                        if (editingCard) {
                          await supabase.from("cards").update({ color: newColor || null, status: newStatus || null } as any).eq("id", editingCard.id);
                          setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, color: newColor || null, status: newStatus || null } as Card : c));
                        }
                      }}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  {teamProfiles.map(p => {
                    const isAssigned = editingCard?.assigned_to === p.user_id;
                    return (
                      <button
                        key={p.user_id}
                        onClick={async () => {
                          if (!editingCard) return;
                          const newAssigned = isAssigned ? null : p.user_id;
                          await supabase.from("cards").update({ assigned_to: newAssigned } as any).eq("id", editingCard.id);
                          setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, assigned_to: newAssigned } : c));
                          setEditingCard({ ...editingCard, assigned_to: newAssigned });
                        }}
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all",
                          isAssigned
                            ? cn(getAvatarColor(p.user_id, p.full_name), "ring-2 ring-primary ring-offset-2 ring-offset-background")
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                        title={p.full_name || "Korisnik"}
                      >
                        {getInitials(p.full_name || null)}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Kontakt */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kontakt</label>
                <Input
                  value={editCardData.kontakt}
                  onChange={(e) => setEditCardData({ ...editCardData, kontakt: e.target.value })}
                  placeholder="Telefon / email kontakt..."
                  className="mt-1 h-8 text-sm"
                />
              </div>

              {/* Naručitelj */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Naručitelj</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <Input
                    value={editCardData.narucitelj_ime}
                    onChange={(e) => setEditCardData({ ...editCardData, narucitelj_ime: e.target.value })}
                    placeholder="Ime i prezime"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={editCardData.narucitelj_oib}
                    onChange={(e) => setEditCardData({ ...editCardData, narucitelj_oib: e.target.value })}
                    placeholder="OIB"
                    className="h-8 text-sm"
                  />
                </div>
                <Input
                  value={editCardData.narucitelj_adresa}
                  onChange={(e) => {
                    const val = e.target.value;
                    const pb = findPostalCode(val);
                    if (pb) {
                      // Replace city name with "postal_code city" format
                      const lower = val.toLowerCase().trim();
                      for (const [city, code] of Object.entries(HR_POSTAL_CODES)) {
                        if (lower.includes(city)) {
                          const regex = new RegExp(city, 'i');
                          const replaced = val.replace(regex, `${code} ${city.charAt(0).toUpperCase() + city.slice(1)}`);
                          setEditCardData({ ...editCardData, narucitelj_adresa: replaced, postanski_broj: code });
                          return;
                        }
                      }
                    }
                    setEditCardData({ ...editCardData, narucitelj_adresa: val });
                  }}
                  placeholder="Adresa naručitelja"
                  className="h-8 text-sm mt-2"
                />
              </div>

              {/* Adresa predmetne čestice */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adresa predmetne čestice</label>
                <Input
                  value={editCardData.adresa_cestice}
                  onChange={(e) => {
                    const val = e.target.value;
                    const pb = findPostalCode(val);
                    if (pb) {
                      const lower = val.toLowerCase().trim();
                      for (const [city, code] of Object.entries(HR_POSTAL_CODES)) {
                        if (lower.includes(city)) {
                          const regex = new RegExp(city, 'i');
                          const replaced = val.replace(regex, `${code} ${city.charAt(0).toUpperCase() + city.slice(1)}`);
                          setEditCardData({ ...editCardData, adresa_cestice: replaced, postanski_broj: code });
                          return;
                        }
                      }
                    }
                    setEditCardData({ ...editCardData, adresa_cestice: val });
                  }}
                  placeholder="Ulica i kućni broj, mjesto"
                  className="h-8 text-sm mt-1"
                />
              </div>

              {/* Katastarska općina i čestica */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Katastar</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <Input
                    value={editCardData.katastarska_opcina}
                    onChange={(e) => setEditCardData({ ...editCardData, katastarska_opcina: e.target.value })}
                    placeholder="Katastarska općina"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={editCardData.katastarska_cestica}
                    onChange={(e) => setEditCardData({ ...editCardData, katastarska_cestica: e.target.value })}
                    placeholder="Katastarska čestica"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Vrsta posla - multi-select */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vrsta posla</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-1 h-auto min-h-[32px] justify-start text-left font-normal text-sm px-3 py-1.5">
                      {editCardData.vrsta_posla.length > 0
                        ? <div className="flex flex-wrap gap-1">{editCardData.vrsta_posla.map(v => (
                            <Badge key={v} variant="secondary" className="text-xs font-normal">
                              {v.split(" - ")[0]}
                              <button className="ml-1 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setEditCardData({ ...editCardData, vrsta_posla: editCardData.vrsta_posla.filter(x => x !== v) }); }}>
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}</div>
                        : <span className="text-muted-foreground">Odaberite vrstu posla...</span>
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 max-h-[300px] overflow-y-auto" align="start">
                    {VRSTA_POSLA_OPTIONS.map(opt => {
                      const selected = editCardData.vrsta_posla.includes(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => {
                            setEditCardData({
                              ...editCardData,
                              vrsta_posla: selected
                                ? editCardData.vrsta_posla.filter(x => x !== opt)
                                : [...editCardData.vrsta_posla, opt]
                            });
                          }}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                            selected && "bg-accent/50 font-medium"
                          )}
                        >
                          <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", selected ? "bg-primary border-primary" : "border-input")}>
                            {selected && <span className="text-primary-foreground text-xs">✓</span>}
                          </div>
                          {opt}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Popuni zahtjev PDF */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 text-sm"
                  onClick={async () => {
                    try {
                      const { data: company } = await supabase
                        .from("company_settings")
                        .select("*")
                        .eq("user_id", user?.id || "")
                        .single();

                      const today = new Date();
                      const formattedDate = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}.`;

                      const zahtjevData: ZahtjevData = {
                        ime: company?.company_name || editCardData.narucitelj_ime || "",
                        adresa: company?.address || editCardData.narucitelj_adresa || "",
                        kontakt: company?.phone || editCardData.kontakt || "",
                        oib: company?.oib || editCardData.narucitelj_oib || "",
                        email: company?.email || "",
                        podrucniUred: "",
                        odjel: "",
                        ispostava: "",
                        katastarskiOpcina: editCardData.katastarska_opcina || "",
                        katastarskeCestice: editCardData.katastarska_cestica || "",
                        svrhaZOG: editCardData.vrsta_posla.some(v => v.includes("G2C") || v.includes("građevins")),
                        svrhaZOPU: editCardData.vrsta_posla.some(v => v.includes("G2A") || v.includes("lokacijs")),
                        napomena: "",
                        mjestoIDatum: formattedDate,
                        podnositelj: company?.company_name || editCardData.narucitelj_ime || "",
                      };

                      const pdfBytes = await fillZahtjevPDF(zahtjevData);
                      const filename = `Zahtjev-${editCardData.katastarska_opcina || "potvrda"}-${editCardData.katastarska_cestica || ""}.pdf`;
                      downloadPdfBytes(pdfBytes, filename);
                      toast({ title: "PDF zahtjev generiran", description: filename });
                    } catch (err) {
                      console.error("PDF fill error:", err);
                      toast({ title: "Greška", description: "Nije moguće generirati PDF.", variant: "destructive" });
                    }
                  }}
                >
                  <FileText className="w-4 h-4" />
                  Popuni zahtjev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-sm border-primary/30 text-primary hover:bg-primary/5"
                  onClick={async () => {
                    try {
                      toast({ title: "Stellan popunjava...", description: "AI analizira podatke kartice" });

                      const { data: company } = await supabase
                        .from("company_settings")
                        .select("*")
                        .eq("user_id", user?.id || "")
                        .single();

                      const { data: fnData, error: fnError } = await supabase.functions.invoke("fill-zahtjev", {
                        body: {
                          cardData: {
                            title: editCardData.title,
                            katastarska_opcina: editCardData.katastarska_opcina,
                            katastarska_cestica: editCardData.katastarska_cestica,
                            adresa_cestice: editCardData.adresa_cestice,
                            postanski_broj: editCardData.postanski_broj,
                            vrsta_posla: editCardData.vrsta_posla,
                            narucitelj_ime: editCardData.narucitelj_ime,
                            narucitelj_adresa: editCardData.narucitelj_adresa,
                            narucitelj_oib: editCardData.narucitelj_oib,
                            kontakt: editCardData.kontakt,
                            description: editCardData.description,
                          },
                          companyData: company,
                        },
                      });

                      if (fnError) throw fnError;

                      const ai = fnData.zahtjevData;
                      const today = new Date();
                      const formattedDate = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}.`;

                      const zahtjevData: ZahtjevData = {
                        ime: ai.ime || "",
                        adresa: ai.adresa || "",
                        kontakt: ai.kontakt || "",
                        oib: ai.oib || "",
                        email: ai.email || "",
                        podrucniUred: ai.podrucniUred || "",
                        odjel: ai.odjel || "",
                        ispostava: ai.ispostava || "",
                        katastarskiOpcina: ai.katastarskiOpcina || "",
                        katastarskeCestice: ai.katastarskeCestice || "",
                        svrhaZOG: !!ai.svrhaZOG,
                        svrhaZOPU: !!ai.svrhaZOPU,
                        napomena: ai.napomena || "",
                        mjestoIDatum: formattedDate,
                        podnositelj: ai.podnositelj || "",
                      };

                      const pdfBytes = await fillZahtjevPDF(zahtjevData);
                      const filename = `Zahtjev-AI-${editCardData.katastarska_opcina || "potvrda"}-${editCardData.katastarska_cestica || ""}.pdf`;
                      downloadPdfBytes(pdfBytes, filename);
                      toast({ title: "✨ Stellan je popunio zahtjev", description: filename });
                    } catch (err) {
                      console.error("AI fill error:", err);
                      toast({ title: "Greška", description: "Stellan nije mogao popuniti zahtjev.", variant: "destructive" });
                    }
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Stellan
                </Button>
              </div>

              {/* Opis - smanjen, na dnu */}
              <div className="mt-auto pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <AlignLeft className="w-4 h-4 text-muted-foreground" />
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opis</label>
                </div>
                <Textarea
                  value={editCardData.description}
                  onChange={(e) => setEditCardData({ ...editCardData, description: e.target.value })}
                  placeholder="Dodajte detaljniji opis..."
                  className="bg-muted/50 border-none focus-visible:ring-1 resize-none min-h-[60px] text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="w-full sm:w-[420px] shrink-0 flex flex-col overflow-hidden">
              <div className="px-6 py-3 border-b border-border flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Komentari i aktivnost</h4>
              </div>
              <div className="px-6 py-3 border-b border-border">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 flex gap-2">
                    <Input placeholder="Napiši komentar..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addComment(); }} className="h-8 text-sm" />
                    <Button size="icon" className="h-8 w-8 shrink-0" onClick={addComment} disabled={!newComment.trim()}>
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
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
                          onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                          onFocus={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                          onChange={async (e) => {
                            const newContent = e.target.value;
                            if (comment.user_id !== user?.id) return;
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
                            <button className="hover:text-destructive transition-colors" onClick={() => deleteComment(comment.id)}>Obriši</button>
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
            <Input placeholder="Upišite naziv ploče..." value={deleteBoardConfirmText} onChange={(e) => setDeleteBoardConfirmText(e.target.value)} autoFocus />
            <Button variant="destructive" className="w-full" disabled={deleteBoardConfirmText !== deleteBoardDialog?.title} onClick={() => deleteBoardDialog && deleteBoard(deleteBoardDialog)}>
              Obriši i arhiviraj
            </Button>
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
                    <div key={b.id} className="bg-muted/50 rounded-lg p-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{b.title}</p>
                        {b.description && <p className="text-xs text-muted-foreground mt-1">{b.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">Arhivirano: {new Date(b.archived_at).toLocaleDateString("hr")}</p>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" title="Trajno obriši" onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const { error: err1 } = await supabase.from("archived_cards").delete().eq("board_id", b.original_id);
                          if (err1) console.error("Delete archived cards error:", err1);
                          const { error: err2 } = await supabase.from("archived_boards").delete().eq("id", b.id);
                          if (err2) console.error("Delete archived board error:", err2);
                          fetchArchive();
                          toast({ title: "Ploča trajno obrisana" });
                        }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
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
                    <div key={c.id} className="bg-muted/50 rounded-lg p-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{c.title}</p>
                        {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          Ploča: {c.board_title || "—"} · Kolona: {c.column_title || "—"} · {new Date(c.archived_at).toLocaleDateString("hr")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Vrati karticu" onClick={async () => {
                          const targetBoardId = c.board_id;
                          if (!targetBoardId) {
                            toast({ title: "Greška", description: "Izvorna ploča nije poznata", variant: "destructive" });
                            return;
                          }
                          const board = boards.find(b => b.id === targetBoardId);
                          if (!board) {
                            toast({ title: "Greška", description: "Izvorna ploča više ne postoji", variant: "destructive" });
                            return;
                          }
                          const boardCols = columns.filter(col => col.board_id === targetBoardId).sort((a, b) => a.position - b.position);
                          if (boardCols.length === 0) {
                            toast({ title: "Greška", description: "Ploča nema stupaca", variant: "destructive" });
                            return;
                          }
                          const targetCol = boardCols[0];
                          const { error } = await supabase.from("cards").insert({
                            title: c.title,
                            description: c.description,
                            column_id: targetCol.id,
                            position: 0,
                          });
                          if (error) {
                            toast({ title: "Greška pri vraćanju", variant: "destructive" });
                            return;
                          }
                          await supabase.from("archived_cards").delete().eq("id", c.id);
                          fetchArchive();
                          fetchBoards();
                          toast({ title: "Kartica vraćena", description: `U stupac "${targetCol.title}" na ploči "${board.title}"` });
                        }}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Trajno obriši" onClick={async (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const { error } = await supabase.from("archived_cards").delete().eq("id", c.id);
                            if (error) {
                              console.error("Delete archived card error:", error);
                              toast({ title: "Greška pri brisanju", variant: "destructive" });
                              return;
                            }
                            fetchArchive();
                            toast({ title: "Kartica trajno obrisana" });
                          }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
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

export default KanbanRows;
