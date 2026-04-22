import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ClipboardList,
  Check,
  Plus,
  Trash2,
  Archive,
  ArchiveRestore,
  Minimize2,
  Maximize2,
  Mail,
  MailOpen,
  ChevronDown,
  ChevronRight,
  X,
  Pencil,
  Lock,
  Unlock,
  UserPlus,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getAvatarColor, getInitials as getProfileInitials } from "@/lib/avatar-utils";

interface TeamProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface WorkspaceItem {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  saved_to_card_id: string | null;
  position: number;
  created_at: string;
  archived?: boolean;
  is_private?: boolean;
}

interface Board { id: string; title: string; }
interface Column { id: string; title: string; board_id: string; }
interface KanbanCard { id: string; title: string; column_id: string; }

interface GmailEmail {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

interface WorkBoardProps {
  isOverlay: boolean;
  onMinimize: () => void;
}

const WorkBoard = ({ isOverlay, onMinimize }: WorkBoardProps) => {
  const { user, isAdmin } = useAuth();
  const [canViewPrivate, setCanViewPrivate] = useState(false);
  const [canViewAllPrivate, setCanViewAllPrivate] = useState(false);
  const [usersWithPrivatePermission, setUsersWithPrivatePermission] = useState<string[]>([]);
  const { toast } = useToast();
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<WorkspaceItem[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [newText, setNewText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>([]);
  const [privateOverlayOpen, setPrivateOverlayOpen] = useState(false);
  const [privateOverlayUserId, setPrivateOverlayUserId] = useState<string | null>(null);

  // Private board state
  const [privateItems, setPrivateItems] = useState<WorkspaceItem[]>([]);
  const [privateArchivedItems, setPrivateArchivedItems] = useState<WorkspaceItem[]>([]);
  const [showPrivateArchive, setShowPrivateArchive] = useState(false);
  const [privateNewText, setPrivateNewText] = useState("");
  const privateInputRef = useRef<HTMLInputElement>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Save-to-kanban dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savingItem, setSavingItem] = useState<WorkspaceItem | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [selectedCard, setSelectedCard] = useState("");

  // Gmail state
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [emailCount, setEmailCount] = useState(0);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [connectingGmail, setConnectingGmail] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchPrivateItems();
    fetchEmails();
    fetchTeamProfiles();
    checkPrivatePermission();
    const channelName = `workspace_items_${isOverlay ? 'overlay' : 'inline'}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_items" }, () => {
        fetchItems();
        fetchPrivateItems();
      })
      .subscribe();

    const emailInterval = setInterval(fetchEmails, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(emailInterval);
    };
  }, []);

  const checkPrivatePermission = async () => {
    if (!user) return;
    const mapNewPrivatePermission = (key: string) => {
      if (key === "privatne_biljeske") return "privatne-biljeske";
      if (key === "sve_privatne_biljeske") return "privatne-biljeske-sve";
      return key;
    };

    if (isAdmin) {
      setCanViewPrivate(true);
      setCanViewAllPrivate(true);
      // Admin sees all users with the permission
      const [{ data: oldPerms }, { data: newPerms }] = await Promise.all([
        supabase
        .from("user_tab_permissions")
        .select("user_id")
          .eq("tab_key", "privatne-biljeske"),
        supabase
          .from("tab_permissions")
          .select("user_id")
          .eq("tab_key", "privatne_biljeske")
          .eq("enabled", true),
      ]);
      setUsersWithPrivatePermission([
        ...(oldPerms?.map(p => p.user_id) || []),
        ...(newPerms?.map(p => p.user_id) || []),
      ]);
      return;
    }
    // Check if user has 'privatne-biljeske-sve' (can view ALL private notes)
    const [{ data: oldAllPerms }, { data: newAllPerms }] = await Promise.all([
      supabase
      .from("user_tab_permissions")
      .select("tab_key")
      .eq("user_id", user.id)
        .in("tab_key", ["privatne-biljeske", "privatne-biljeske-sve"]),
      supabase
        .from("tab_permissions")
        .select("tab_key")
        .eq("user_id", user.id)
        .eq("enabled", true)
        .in("tab_key", ["privatne_biljeske", "sve_privatne_biljeske"]),
    ]);
    const userPermKeys = [
      ...(oldAllPerms?.map(p => p.tab_key) || []),
      ...(newAllPerms?.map(p => mapNewPrivatePermission(p.tab_key)) || []),
    ];
    const hasViewAll = userPermKeys.includes("privatne-biljeske-sve");
    const hasBasic = userPermKeys.includes("privatne-biljeske") || hasViewAll;
    setCanViewPrivate(hasBasic);
    setCanViewAllPrivate(hasViewAll);

    // Fetch all users with private permission for avatar display
    const [{ data: oldPermUsers }, { data: newPermUsers }] = await Promise.all([
      supabase
      .from("user_tab_permissions")
      .select("user_id")
        .eq("tab_key", "privatne-biljeske"),
      supabase
        .from("tab_permissions")
        .select("user_id")
        .eq("tab_key", "privatne_biljeske")
        .eq("enabled", true),
    ]);
    const permUserIds = [
      ...(oldPermUsers?.map(p => p.user_id) || []),
      ...(newPermUsers?.map(p => p.user_id) || []),
    ];
    setUsersWithPrivatePermission(permUserIds);
  };

  const fetchTeamProfiles = async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url");
    if (data) setTeamProfiles(data);
  };

  // Main board: only public items
  const fetchItems = async () => {
    const { data } = await supabase
      .from("workspace_items")
      .select("*")
      .eq("is_private", false)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (data) {
      setItems(data.filter(i => !i.archived));
      setArchivedItems(data.filter(i => i.archived));
    }
  };

  // Private board: current user's private items
  const fetchPrivateItems = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("workspace_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_private", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (data) {
      setPrivateItems(data.filter(i => !i.archived));
      setPrivateArchivedItems(data.filter(i => i.archived));
    }
  };

  // Fetch another user's private items (for viewing)
  const [viewingOtherPrivateItems, setViewingOtherPrivateItems] = useState<WorkspaceItem[]>([]);
  const [viewingOtherArchivedItems, setViewingOtherArchivedItems] = useState<WorkspaceItem[]>([]);

  const fetchOtherUserPrivateItems = async (userId: string) => {
    const { data } = await supabase
      .from("workspace_items")
      .select("*")
      .eq("user_id", userId)
      .eq("is_private", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (data) {
      setViewingOtherPrivateItems(data.filter(i => !i.archived));
      setViewingOtherArchivedItems(data.filter(i => i.archived));
    }
  };

  const fetchEmails = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.functions.invoke("fetch-gmail", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) { console.error("Gmail fetch error:", error); return; }
      if (data?.error === "not_connected" || data?.error === "token_expired") {
        setGmailConnected(false); return;
      }
      setGmailConnected(true);
      setEmails(data?.emails || []);
      setEmailCount(data?.count || 0);
    } catch (err) { console.error("Gmail fetch error:", err); }
  };

  const connectGmail = async () => {
    setConnectingGmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("Supabase URL nije postavljen.");
      }
      const res = await fetch(
        `${supabaseUrl}/functions/v1/gmail-auth?action=auth-url`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            appOrigin: window.location.origin,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.url) {
        toast({ title: "Greška", description: "Nije moguće pokrenuti Gmail povezivanje.", variant: "destructive" });
        return;
      }
      window.location.href = data.url;
    } catch {
      toast({ title: "Greška", variant: "destructive" });
    } finally { setConnectingGmail(false); }
  };

  // Add public item to main board
  const addItem = async () => {
    if (!newText.trim() || !user) return;
    const maxPos = items.length > 0 ? Math.max(...items.map(i => i.position)) + 1 : 0;
    const { error } = await supabase.from("workspace_items").insert({
      user_id: user.id,
      text: newText.trim(),
      position: maxPos,
      is_private: false,
    });
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      inputRef.current?.focus();
      return;
    }
    await supabase.functions.invoke("notify-change", {
      body: { type: "workspace_item", user_id: user.id, text: newText.trim() },
    });
    setNewText("");
    await fetchItems();
    inputRef.current?.focus();
  };

  // Add private item
  const addPrivateItem = async () => {
    if (!privateNewText.trim() || !user) return;
    const maxPos = privateItems.length > 0 ? Math.max(...privateItems.map(i => i.position)) + 1 : 0;
    const { error } = await supabase.from("workspace_items").insert({
      user_id: user.id,
      text: privateNewText.trim(),
      position: maxPos,
      is_private: true,
    });
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      privateInputRef.current?.focus();
      return;
    }
    setPrivateNewText("");
    await fetchPrivateItems();
    privateInputRef.current?.focus();
  };

  const handleCheckmark = async (item: WorkspaceItem) => {
    await supabase.from("workspace_items").update({ completed: !item.completed }).eq("id", item.id);
    await fetchItems();
    await fetchPrivateItems();
  };

  const claimItem = async (item: WorkspaceItem) => {
    if (!user || item.user_id === user.id) return;
    await supabase.from("workspace_items").update({ user_id: user.id }).eq("id", item.id);
    toast({ title: "Preuzeto na sebe!" });
    await fetchItems();
    await fetchPrivateItems();
  };

  const fetchBoards = async () => {
    const { data } = await supabase.from("boards").select("id, title").order("position");
    if (data) setBoards(data);
  };
  const fetchColumns = async (boardId: string) => {
    const { data } = await supabase.from("columns").select("id, title, board_id").eq("board_id", boardId).order("position");
    if (data) setColumns(data);
  };
  const fetchCards = async (columnId: string) => {
    const { data } = await supabase.from("cards").select("id, title, column_id").eq("column_id", columnId).order("position");
    if (data) setCards(data);
  };

  const handleBoardChange = (val: string) => {
    setSelectedBoard(val); setSelectedColumn(""); setSelectedCard(""); setColumns([]); setCards([]);
    fetchColumns(val);
  };
  const handleColumnChange = (val: string) => {
    setSelectedColumn(val); setSelectedCard(""); setCards([]);
    fetchCards(val);
  };

  const handleSaveToKanban = async () => {
    if (!savingItem || !selectedCard) return;
    const { data: card } = await supabase.from("cards").select("description").eq("id", selectedCard).single();
    const newDesc = card?.description
      ? `${card.description}\n\n📋 ${savingItem.text}`
      : `📋 ${savingItem.text}`;
    await supabase.from("cards").update({ description: newDesc }).eq("id", selectedCard);
    await supabase.from("workspace_items").update({ saved_to_card_id: selectedCard }).eq("id", savingItem.id);
    toast({ title: "Spremljeno u karticu!" });
    setSaveDialogOpen(false); setSavingItem(null);
    setSelectedBoard(""); setSelectedColumn(""); setSelectedCard("");
  };

  const togglePrivacy = async (item: WorkspaceItem) => {
    if (item.user_id !== user?.id) return;
    await supabase.from("workspace_items").update({ is_private: !item.is_private }).eq("id", item.id);
    await fetchItems();
    await fetchPrivateItems();
    toast({ title: item.is_private ? "Premješteno u javno" : "Premješteno u privatno" });
  };

  const archiveItem = async (id: string) => {
    await supabase.from("workspace_items").update({ archived: true }).eq("id", id);
    await fetchItems();
    await fetchPrivateItems();
  };

  const restoreItem = async (id: string) => {
    await supabase.from("workspace_items").update({ archived: false }).eq("id", id);
    await fetchItems();
    await fetchPrivateItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from("workspace_items").delete().eq("id", id);
    await fetchItems();
    await fetchPrivateItems();
  };

  const formatFrom = (from: string) => {
    const match = from.match(/^(.+?)\s*<.*>$/);
    return match ? match[1].replace(/"/g, '') : from.split("@")[0];
  };

  const saveEditedItem = async (itemId: string) => {
    if (!editingText.trim()) { setEditingItemId(null); return; }
    await supabase.from("workspace_items").update({ text: editingText.trim() }).eq("id", itemId);
    setEditingItemId(null);
    setEditingText("");
    await fetchItems();
    await fetchPrivateItems();
  };

  // Reusable item row
  const renderItem = (item: WorkspaceItem, showActions = true) => {
    const isOwner = item.user_id === user?.id;
    const isEditing = editingItemId === item.id;

    return (
    <div
      key={item.id}
      className={cn(
        "rounded-xl border shadow-sm transition-all group overflow-hidden",
        item.completed
          ? "bg-emerald-500/10 border-emerald-500/30"
          : "bg-card border-border hover:shadow-md"
      )}
    >
      {/* Header bar with avatar and actions */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/30 bg-muted/20">
        {/* User avatar */}
        {(() => {
          const profile = teamProfiles.find(p => p.user_id === item.user_id);
          const initials = getProfileInitials(profile?.full_name ?? null, undefined);
          const colorClass = getAvatarColor(item.user_id, profile?.full_name);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn("shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold", colorClass)}>
                  {initials}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{profile?.full_name || "Korisnik"}</p>
              </TooltipContent>
            </Tooltip>
          );
        })()}
        <span className="text-[10px] text-muted-foreground truncate flex-1">
          {teamProfiles.find(p => p.user_id === item.user_id)?.full_name || ""}
        </span>
        {showActions && !isEditing && (
          <div className="flex items-center gap-0.5">
            {/* Checkmark - everyone */}
            <button
              onClick={() => handleCheckmark(item)}
              className={cn(
                "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                item.completed
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-muted-foreground/40 hover:border-emerald-500"
              )}
            >
              {item.completed && <Check className="w-3 h-3" />}
            </button>
            {/* Edit - everyone */}
            <Button
              variant="ghost" size="icon"
              className="h-5 w-5 shrink-0"
              onClick={() => { setEditingItemId(item.id); setEditingText(item.text); }}
              title="Uredi"
            >
              <Pencil className="w-3 h-3" />
            </Button>
            {/* Privacy toggle - owner only */}
            {isOwner && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => togglePrivacy(item)}
                  >
                    {item.is_private ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{item.is_private ? "Premjesti u javno" : "Premjesti u privatno"}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Claim - non-owners */}
            {!isOwner && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => claimItem(item)}
                  >
                    <UserPlus className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Preuzmi na sebe</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Archive - everyone */}
            <Button
              variant="ghost" size="icon"
              className="h-5 w-5 shrink-0"
              onClick={() => archiveItem(item.id)}
              title="Arhiviraj"
            >
              <Archive className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
      {/* Body - text content */}
      <div className="px-3 py-2">
        {isEditing ? (
          <form
            onSubmit={(e) => { e.preventDefault(); saveEditedItem(item.id); }}
            className="flex flex-col gap-1"
          >
            <Textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setEditingItemId(null); }
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEditedItem(item.id); }
              }}
              className="text-sm min-h-[60px] resize-none"
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingItemId(null)}>Odustani</Button>
              <Button type="submit" size="sm" className="h-6 text-xs">Spremi</Button>
            </div>
          </form>
        ) : (
          <p className={cn("text-sm whitespace-pre-wrap", item.completed && "line-through text-muted-foreground")}>
            {item.text}
          </p>
        )}
      </div>
    </div>
    );
  };

  // Reusable archived section
  const renderArchive = (archivedList: WorkspaceItem[], show: boolean, setShow: (v: boolean) => void) => (
    <div className="border-t border-border/50 pt-2 mt-1">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider hover:text-foreground transition-colors w-full"
      >
        {show ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Archive className="w-3 h-3" />
        Arhiva ({archivedList.length})
      </button>
      {show && (
        <div className="space-y-1 mt-1.5">
          {archivedList.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50 text-center py-2">Nema arhiviranih stavki</p>
          ) : (
            archivedList.map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-1.5 rounded-lg border bg-muted/20 border-border/50 group">
                <span className="text-sm flex-1 min-w-0 truncate text-muted-foreground line-through">{item.text}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => restoreItem(item.id)} title="Vrati iz arhive">
                  <ArchiveRestore className="w-3 h-3" />
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-destructive hover:text-destructive" onClick={() => deleteItem(item.id)} title="Obriši trajno">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  const content = (
    <>
      <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Radna ploča</CardTitle>
          {/* Team member avatars - hide only "G" */}
          <div className="flex items-center gap-0.5 ml-1">
            {[...teamProfiles]
              .sort((a, b) => {
                if (a.user_id === user?.id) return -1;
                if (b.user_id === user?.id) return 1;
                return 0;
              })
              .filter((profile) => {
                const initials = getProfileInitials(
                  profile.full_name,
                  profile.user_id === user?.id ? user?.email : undefined
                );
                if (initials === "G") return false;
                // Show all avatars to everyone
                return true;
              })
              .map((profile) => {
                const isOwnProfile = profile.user_id === user?.id;
                // Can click: own profile always, admin always, or user with 'privatne-biljeske-sve'
                const canClick = isOwnProfile || isAdmin || canViewAllPrivate;
                return (
                <Tooltip key={profile.user_id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (!canClick) return;
                        setPrivateOverlayUserId(profile.user_id);
                        setPrivateOverlayOpen(true);
                        if (!isOwnProfile) {
                          fetchOtherUserPrivateItems(profile.user_id);
                        }
                      }}
                       className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border-2 transition-all",
                        canClick
                          ? "border-card hover:scale-110 hover:ring-1 hover:ring-primary cursor-pointer"
                          : "border-card opacity-50 cursor-default",
                        getAvatarColor(profile.user_id, profile.full_name)
                      )}
                    >
                      {getProfileInitials(profile.full_name, isOwnProfile ? user?.email : undefined)}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">
                      {isOwnProfile
                        ? "Moje privatne bilješke"
                        : canClick
                          ? `${profile.full_name || "Korisnik"} · privatne bilješke`
                          : `${profile.full_name || "Korisnik"} · nemaš dopuštenje`}
                    </p>
                  </TooltipContent>
                </Tooltip>
                );
              })}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMinimize}>
          {isOverlay ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {/* Add new public item */}
        <form onSubmit={(e) => { e.preventDefault(); addItem(); }} className="flex gap-1">
          <Textarea
            ref={inputRef as any}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addItem(); } }}
            placeholder="Zapiši nešto..."
            className="min-h-[40px] max-h-[80px] text-sm resize-none"
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </form>

        {/* Items list */}
        <div className="space-y-2 flex-1 overflow-y-auto scrollbar-hide">
          {items.map((item) => renderItem(item))}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Prazna ploča — zapiši nešto!
            </p>
          )}
        </div>

        {/* Archive section */}
        {renderArchive(archivedItems, showArchive, setShowArchive)}

        {/* Gmail section */}
        <div className="border-t border-border/50 pt-2 mt-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Mail className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Pošta
              {emailCount > 0 && (
                <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{emailCount}</span>
              )}
            </span>
            <a href="https://mail.google.com/mail/u/?authuser=geoterra@geoterrainfo.net" target="_blank" rel="noopener noreferrer"
              className="ml-auto text-[10px] text-primary hover:text-primary/80 font-medium px-2 py-0.5 rounded border border-primary/30 hover:bg-primary/10 transition-colors">
              Otvori Gmail
            </a>
          </div>
          {gmailConnected === false && (
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground" onClick={connectGmail} disabled={connectingGmail}>
              <MailOpen className="w-3 h-3 mr-1" />
              {connectingGmail ? "Povezivanje..." : "Poveži Gmail"}
            </Button>
          )}
          {gmailConnected && emails.length === 0 && (
            <p className="text-[11px] text-muted-foreground/60 text-center py-1">Nema nepročitanih mailova ✓</p>
          )}
          {emails.map((email) => (
            <div key={email.id} className="flex items-start gap-1.5 py-1 px-1 rounded text-[11px] text-muted-foreground hover:bg-muted/30 transition-colors cursor-default"
              title={`${email.from}\n${email.subject}\n${email.snippet}`}>
              <Mail className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground/50" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground/70 truncate">{formatFrom(email.from)}</span>
                </div>
                <p className="truncate text-muted-foreground/70">{email.subject}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Save to Kanban dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={(o) => { if (!o) setSaveDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Spremi u Poslove</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Dodaj "<strong>{savingItem?.text}</strong>" na postojeću karticu:
          </p>
          <div className="space-y-3">
            <div>
              <Label>Board</Label>
              <Select value={selectedBoard} onValueChange={handleBoardChange}>
                <SelectTrigger><SelectValue placeholder="Odaberi board..." /></SelectTrigger>
                <SelectContent>{boards.map(b => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedBoard && (
              <div>
                <Label>Kolona</Label>
                <Select value={selectedColumn} onValueChange={handleColumnChange}>
                  <SelectTrigger><SelectValue placeholder="Odaberi kolonu..." /></SelectTrigger>
                  <SelectContent>{columns.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {selectedColumn && (
              <div>
                <Label>Kartica</Label>
                <Select value={selectedCard} onValueChange={setSelectedCard}>
                  <SelectTrigger><SelectValue placeholder="Odaberi karticu..." /></SelectTrigger>
                  <SelectContent>{cards.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleSaveToKanban} disabled={!selectedCard} className="w-full">Spremi na karticu</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Private board overlay */}
      {privateOverlayOpen && (() => {
        const isViewingOwn = privateOverlayUserId === user?.id;
        const displayItems = isViewingOwn ? privateItems : viewingOtherPrivateItems;
        const displayArchived = isViewingOwn ? privateArchivedItems : viewingOtherArchivedItems;
        const overlayProfile = teamProfiles.find(p => p.user_id === privateOverlayUserId);
        const overlayTitle = isViewingOwn ? "Moje bilješke" : `Bilješke — ${overlayProfile?.full_name || "Korisnik"}`;

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setPrivateOverlayOpen(false)}>
          <Card className="w-full max-w-6xl mx-4 max-h-[95vh] min-h-[70vh] flex flex-col shadow-2xl border-primary/20" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm">{overlayTitle}</CardTitle>
                {privateOverlayUserId && (() => {
                  const profile = teamProfiles.find(p => p.user_id === privateOverlayUserId);
                  const initials = getProfileInitials(profile?.full_name ?? null, profile?.user_id === user?.id ? user?.email : undefined);
                  const colorClass = getAvatarColor(privateOverlayUserId, profile?.full_name);
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold", colorClass)}>
                          {initials}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">{profile?.full_name || "Korisnik"}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })()}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPrivateOverlayOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0 flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              {/* Add new private item - only for own items */}
              {isViewingOwn && (
              <form onSubmit={(e) => { e.preventDefault(); addPrivateItem(); }} className="flex gap-1">
                <Textarea
                  ref={privateInputRef as any}
                  value={privateNewText}
                  onChange={(e) => setPrivateNewText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addPrivateItem(); } }}
                  placeholder="Privatna bilješka..."
                  className="min-h-[40px] max-h-[80px] text-sm resize-none"
                  autoFocus
                />
                <Button type="submit" size="icon" className="h-10 w-10 shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </form>
              )}

              {/* Items list */}
              <div className="space-y-2 flex-1 overflow-y-auto scrollbar-hide">
                {displayItems.map((item) => renderItem(item, isViewingOwn))}
                {displayItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {isViewingOwn ? "Nemaš privatnih bilješki" : "Nema privatnih bilješki"}
                  </p>
                )}
              </div>

              {/* Archive section */}
              {renderArchive(displayArchived, showPrivateArchive, setShowPrivateArchive)}

              {/* Gmail section */}
              <div className="border-t border-border/50 pt-2 mt-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Mail className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    Pošta
                    {emailCount > 0 && (
                      <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{emailCount}</span>
                    )}
                  </span>
                  <a href="https://mail.google.com/mail/u/?authuser=geoterra@geoterrainfo.net" target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-[10px] text-primary hover:text-primary/80 font-medium px-2 py-0.5 rounded border border-primary/30 hover:bg-primary/10 transition-colors">
                    Otvori Gmail
                  </a>
                </div>
                {gmailConnected === false && (
                  <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground" onClick={connectGmail} disabled={connectingGmail}>
                    <MailOpen className="w-3 h-3 mr-1" />
                    {connectingGmail ? "Povezivanje..." : "Poveži Gmail"}
                  </Button>
                )}
                {gmailConnected && emails.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/60 text-center py-1">Nema nepročitanih mailova ✓</p>
                )}
                {emails.map((email) => (
                  <div key={email.id} className="flex items-start gap-1.5 py-1 px-1 rounded text-[11px] text-muted-foreground hover:bg-muted/30 transition-colors cursor-default"
                    title={`${email.from}\n${email.subject}\n${email.snippet}`}>
                    <Mail className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground/70 truncate">{formatFrom(email.from)}</span>
                      </div>
                      <p className="truncate text-muted-foreground/70">{email.subject}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        );
      })()}
    </>
  );

  if (isOverlay) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm">
        <Card className="w-full max-w-6xl mx-4 max-h-[95vh] min-h-[70vh] flex flex-col shadow-2xl border-primary/20">
          {content}
        </Card>
      </div>
    );
  }

  return (
    <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {content}
    </Card>
  );
};

export default WorkBoard;
