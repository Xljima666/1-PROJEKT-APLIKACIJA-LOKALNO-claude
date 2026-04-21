import { ReactNode, useEffect, useState, useRef, createContext, useContext, useCallback } from "react";
import ChatDialog from "@/components/chat/ChatDialog";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  Kanban, 
  FileText, 
  Building2, 
  Settings, 
  LogOut, 
  Users,
  MessageSquareText,
  Search,
  Bot,
  Zap,
  X,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getAvatarColor, getInitials } from "@/lib/avatar-utils";

interface OnlineProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface TabPermission {
  tab_key: string;
}

const mapPermissionForNavigation = (key: string) => {
  const map: Record<string, string> = {
    kontakt_upiti: "kontakt-upiti",
    privatne_biljeske: "privatne-biljeske",
    sve_privatne_biljeske: "privatne-biljeske-sve",
    stellan_only: "samo-stellan",
  };
  return map[key] ?? key;
};

const mergePermissionKeys = (...groups: Array<TabPermission[] | null | undefined>) => {
  const keys = new Set<string>();
  groups.forEach((group) => {
    group?.forEach((permission) => {
      keys.add(mapPermissionForNavigation(permission.tab_key));
      keys.add(permission.tab_key);
    });
  });
  return Array.from(keys);
};

// Search context for global header search
const SearchContext = createContext<string>("");
export const useHeaderSearch = () => useContext(SearchContext);

interface DashboardLayoutProps {
  children: ReactNode;
  headerCenter?: ReactNode;
  noScroll?: boolean;
}

const DashboardLayout = ({ children, headerCenter, noScroll }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const { impersonatedUser, isImpersonating, stopImpersonation, isSwapping } = useImpersonation();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [allProfiles, setAllProfiles] = useState<OnlineProfile[]>([]);
  const [userTabPermissions, setUserTabPermissions] = useState<string[]>([]);
  const [impersonatedPermissions, setImpersonatedPermissions] = useState<string[]>([]);
  const [headerSearchTerm, setHeaderSearchTerm] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canSeeUpiti = isAdmin || userTabPermissions.includes("kontakt-upiti");

  const fetchUnreadCount = useCallback(async () => {
    if (!canSeeUpiti) return;
    const lastSeen = localStorage.getItem("upiti_last_seen_at");
    let query = supabase.from("contact_submissions").select("id", { count: "exact", head: true });
    if (lastSeen) {
      query = query.gt("created_at", lastSeen);
    }
    const { count } = await query;
    setUnreadCount(count ?? 0);
  }, [canSeeUpiti]);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url");
      if (data) {
        const current = data.find(p => p.user_id === user.id);
        if (current) setProfileName(current.full_name);
        setAllProfiles(data);
      }
    };
    const fetchTabPermissions = async () => {
      if (!user || isAdmin) return;
      const [{ data: legacyPermissions }, { data: currentPermissions }] = await Promise.all([
        supabase
          .from("user_tab_permissions")
          .select("tab_key")
          .eq("user_id", user.id),
        supabase
          .from("tab_permissions")
          .select("tab_key")
          .eq("user_id", user.id)
          .eq("enabled", true),
      ]);
      setUserTabPermissions(mergePermissionKeys(legacyPermissions, currentPermissions));
    };
    fetchProfiles();
    fetchTabPermissions();
  }, [user, isAdmin]);

  // Fetch impersonated user's permissions
  useEffect(() => {
    if (!isImpersonating || !impersonatedUser) {
      setImpersonatedPermissions([]);
      return;
    }
    const fetchImpPerms = async () => {
      const [{ data: legacyPermissions }, { data: currentPermissions }] = await Promise.all([
        supabase
          .from("user_tab_permissions")
          .select("tab_key")
          .eq("user_id", impersonatedUser.id),
        supabase
          .from("tab_permissions")
          .select("tab_key")
          .eq("user_id", impersonatedUser.id)
          .eq("enabled", true),
      ]);
      setImpersonatedPermissions(mergePermissionKeys(legacyPermissions, currentPermissions));
    };
    fetchImpPerms();
  }, [isImpersonating, impersonatedUser]);

  // Fetch unread count and subscribe to realtime changes
  useEffect(() => {
    fetchUnreadCount();
    const channel = supabase
      .channel("contact_submissions_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_submissions" }, () => {
        fetchUnreadCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchUnreadCount]);

  // Mark as read when visiting contact-submissions page
  useEffect(() => {
    if (location.pathname === "/contact-submissions" && canSeeUpiti) {
      localStorage.setItem("upiti_last_seen_at", new Date().toISOString());
      setUnreadCount(0);
    }
  }, [location.pathname, canSeeUpiti]);

  // Force dark mode for dashboard (Windows 11 style)
  useEffect(() => {
    document.documentElement.classList.add("dark", "dashboard-theme");
    return () => {
      document.documentElement.classList.remove("dark", "dashboard-theme");
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Organizator", permKey: null },
    { path: "/kanban-rows", icon: Kanban, label: "Poslovi", permKey: "poslovi" },
    { path: "/invoices", icon: FileText, label: "Geodezija", permKey: "geodezija" },
    { path: "/firma", icon: Building2, label: "Firma", permKey: "firma" },
    { path: "/team", icon: Users, label: "Tim", permKey: "tim" },
    { path: "/settings", icon: Settings, label: "Postavke", permKey: "postavke" },
  ];

  const activePermissions = isImpersonating ? impersonatedPermissions : userTabPermissions;
  const isStellanOnly = activePermissions.includes("samo-stellan");

  const filteredNavItems = navItems.filter(item => {
    if (isStellanOnly) return false; // samo-stellan users see no nav items
    if (isImpersonating) {
      return item.permKey === null || activePermissions.includes(item.permKey);
    }
    if (isAdmin) return true;
    return item.permKey === null || userTabPermissions.includes(item.permKey);
  });
  const userInitials = getInitials(profileName, user?.email);

  // Other users (exclude current logged-in user)
  const otherProfiles = allProfiles.filter(p => p.user_id !== user?.id);

  return (
    <div className="bg-background flex flex-col dashboard-theme overflow-hidden" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Impersonation banner */}
      {isImpersonating && impersonatedUser && (
        <div className="bg-amber-500/90 text-black px-4 py-1.5 flex items-center justify-between shrink-0 text-sm font-medium">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span>Pregledavate kao: <strong>{impersonatedUser.full_name || "Nepoznato"}</strong></span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-black hover:bg-amber-600/50" onClick={stopImpersonation} disabled={isSwapping}>
            <X className="w-3.5 h-3.5 mr-1" />
            {isSwapping ? "Vraćam..." : "Izađi"}
          </Button>
        </div>
      )}
      {/* Top bar */}
      <header className="h-12 bg-card border-b border-border flex items-center px-4 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-gradient">GEO TERRA INFO</span>
          {canSeeUpiti && (
            <Link to="/contact-submissions" className={cn(
              "relative flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
              location.pathname === "/contact-submissions"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}>
              <MessageSquareText className={cn("w-3.5 h-3.5", unreadCount > 0 && "animate-pulse text-primary")} />
              <span className="hidden sm:inline">Upiti</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>
          )}
          <button
            onClick={() => setChatOpen(true)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stellan</span>
          </button>
          {isAdmin && (
            <Link
              to="/token-usage"
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                location.pathname === "/token-usage"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tokeni</span>
            </Link>
          )}
        </div>
        <div className="flex-1 flex justify-center mx-2">
          {headerCenter || (
            <>
              {/* Desktop: always visible */}
              <div className="relative w-full max-w-56 hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={headerSearchTerm}
                  onChange={(e) => setHeaderSearchTerm(e.target.value)}
                  placeholder="Pretraži..."
                  className="pl-8 h-8 text-sm bg-muted/50 border-border"
                />
              </div>
              {/* Mobile: icon toggle */}
              <div className="sm:hidden flex items-center justify-center">
                {searchOpen ? (
                  <div className="relative w-full max-w-48 animate-in fade-in slide-in-from-right-2 duration-200">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      autoFocus
                      value={headerSearchTerm}
                      onChange={(e) => setHeaderSearchTerm(e.target.value)}
                      onBlur={() => { if (!headerSearchTerm) setSearchOpen(false); }}
                      onKeyDown={(e) => { if (e.key === "Escape") { setHeaderSearchTerm(""); setSearchOpen(false); } }}
                      placeholder="Pretraži..."
                      className="pl-8 h-8 text-sm bg-muted/50 border-border"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Current user avatar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-7 h-7 rounded-full gradient-primary border-2 border-card flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                {userInitials}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{profileName || user?.email || "Korisnik"}</p>
            </TooltipContent>
          </Tooltip>
          {/* Logout button */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content - exactly between header (h-12) and bottom nav (h-14) */}
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
          className={cn("flex-1 min-h-0 scrollbar-hide flex flex-col", noScroll ? "overflow-hidden" : "overflow-y-auto")}
        >
          <SearchContext.Provider value={headerSearchTerm}>
            {children}
          </SearchContext.Provider>
        </motion.main>
      </AnimatePresence>

      {/* Bottom Tab Bar */}
      <nav className="shrink-0 bg-card border-t border-border flex items-center justify-around z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: '3.5rem' }}>
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === "/kanban" && location.pathname.startsWith("/kanban") && !location.pathname.startsWith("/kanban-rows")) ||
            (item.path === "/kanban-rows" && location.pathname.startsWith("/kanban-rows"));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all min-w-[56px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
              <span className={cn("text-[10px] font-medium hidden sm:block", isActive && "font-bold")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <ChatDialog open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default DashboardLayout;
