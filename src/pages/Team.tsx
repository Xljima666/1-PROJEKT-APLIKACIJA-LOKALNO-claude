import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Eye,
  Copy,
  RefreshCw,
  Loader2,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

// Tabovi za koje se mogu davati dopuštenja
const TAB_KEYS = [
  { key: "stellan_only", label: "Samo Stellan" },
  { key: "poslovi", label: "Poslovi" },
  { key: "geodezija", label: "Geodezija" },
  { key: "firma", label: "Firma" },
  { key: "tim", label: "Tim" },
  { key: "postavke", label: "Postavke" },
  { key: "privatne_biljeske", label: "Privatne bilješke" },
  { key: "sve_privatne_biljeske", label: "Sve privatne bilješke" },
  { key: "kontakt_upiti", label: "Kontakt upiti" },
] as const;

type TabKey = (typeof TAB_KEYS)[number]["key"];

interface TeamMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "korisnik";
  created_at: string;
  avatar_url: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: "admin" | "korisnik";
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
  expires_at: string;
}

interface Permissions {
  [userId: string]: {
    [tab: string]: boolean;
  };
}

const getInitials = (name: string | null, email: string | null): string => {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
};

const Team = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [permissions, setPermissions] = useState<Permissions>({});

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "korisnik">("korisnik");
  const [inviting, setInviting] = useState(false);

  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] = useState<Invitation | null>(null);

  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [savingPerms, setSavingPerms] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // BOOTSTRAP: odmah postavi sebe u listu, kasnije nadogradi podacima iz baze
    const bootstrapSelf = (isAdmin: boolean): TeamMember => ({
      user_id: user.id,
      full_name:
        (user.user_metadata?.full_name as string) ||
        (user.email ? user.email.split("@")[0] : "Korisnik"),
      email: user.email ?? null,
      avatar_url: null,
      created_at: (user.created_at as string) ?? new Date().toISOString(),
      role: isAdmin ? "admin" : "korisnik",
    });

    try {
      // 1) Provjeri je li trenutni korisnik admin
      const { data: myRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdmin = myRole?.role === "admin";
      setCurrentUserIsAdmin(isAdmin);

      // 2) Odredi organization_id (admin_user_id) za filtriranje članova
      // Ako je user admin - njegov ID je org. Ako je korisnik - gleda čiji je član.
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("user_id, admin_user_id, full_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      const orgAdminId = isAdmin ? user.id : (myProfile?.admin_user_id ?? user.id);

      // 3) Dohvati sve profile u organizaciji (admin + korisnici)
      // Prvo probaj s emailom, ako kolona ne postoji — fallback bez emaila
      let profilesData: any[] | null = null;
      let profilesError: any = null;

      const withEmail = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url, created_at, admin_user_id")
        .or(`user_id.eq.${orgAdminId},admin_user_id.eq.${orgAdminId}`);

      if (withEmail.error && /column .*email.* does not exist/i.test(withEmail.error.message)) {
        // Fallback: stara shema bez email kolone
        const withoutEmail = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, created_at, admin_user_id")
          .or(`user_id.eq.${orgAdminId},admin_user_id.eq.${orgAdminId}`);
        profilesData = withoutEmail.data;
        profilesError = withoutEmail.error;
      } else {
        profilesData = withEmail.data;
        profilesError = withEmail.error;
      }

      if (profilesError) throw profilesError;

      // Ako nema profila a korisnik je ulogiran — nađe barem sebe u auth
      if ((!profilesData || profilesData.length === 0) && user) {
        profilesData = [{
          user_id: user.id,
          full_name: user.user_metadata?.full_name ?? null,
          email: user.email ?? null,
          avatar_url: null,
          created_at: user.created_at ?? new Date().toISOString(),
          admin_user_id: null,
        }];
      }

      // SIGURNOSNI FALLBACK: osiguraj da je trenutni ulogirani korisnik
      // UVIJEK u listi (čak i ako profil ima rupe ili filter nije našao)
      if (user && !profilesData!.some((p: any) => p.user_id === user.id)) {
        profilesData!.unshift({
          user_id: user.id,
          full_name: user.user_metadata?.full_name ?? null,
          email: user.email ?? null,
          avatar_url: null,
          created_at: user.created_at ?? new Date().toISOString(),
          admin_user_id: isAdmin ? null : (myProfile?.admin_user_id ?? null),
        });
      }

      // 4) Dohvati uloge
      const userIds = (profilesData ?? []).map((p) => p.user_id);
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      const roleMap = new Map<string, "admin" | "korisnik">();
      (rolesData ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));

      const mappedMembers: TeamMember[] = (profilesData ?? []).map((p: any) => {
        // Fallback za ime: profile.full_name → auth metadata → dio emaila prije @
        const isCurrentUser = user && p.user_id === user.id;
        const fallbackName =
          p.full_name ||
          (isCurrentUser ? user?.user_metadata?.full_name : null) ||
          (p.email ? p.email.split("@")[0] : null);

        // Fallback za email: ono što je u profilu → ako sam ja → auth email
        const fallbackEmail = p.email || (isCurrentUser ? user?.email : null);

        return {
          user_id: p.user_id,
          full_name: fallbackName,
          email: fallbackEmail,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          role:
            roleMap.get(p.user_id) ??
            // Ako nema eksplicitne uloge: ja sam admin ako sam prošao isAdmin
            (isCurrentUser && isAdmin
              ? "admin"
              : p.user_id === orgAdminId
              ? "admin"
              : "korisnik"),
        };
      });

      // Admin prvi, ostali sortirani po datumu
      mappedMembers.sort((a, b) => {
        if (a.role === "admin" && b.role !== "admin") return -1;
        if (b.role === "admin" && a.role !== "admin") return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setMembers(mappedMembers);

      // 5) Pozivnice - samo admin ih vidi i šalje
      if (isAdmin) {
        const { data: invData } = await supabase
          .from("invitations")
          .select("*")
          .eq("invited_by", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        setInvitations((invData ?? []) as Invitation[]);
      } else {
        setInvitations([]);
      }

      // 6) Tab dopuštenja
      const { data: permsData } = await supabase
        .from("tab_permissions")
        .select("user_id, tab_key, enabled")
        .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      const permsMap: Permissions = {};
      (permsData ?? []).forEach((row: any) => {
        if (!permsMap[row.user_id]) permsMap[row.user_id] = {};
        permsMap[row.user_id][row.tab_key] = row.enabled;
      });
      setPermissions(permsMap);
    } catch (err: any) {
      console.error("[Team] fetchAll error:", err);
      // Ako query puca iz bilo kojeg razloga — pokaži barem sebe u listi
      // da UI nije mrtav
      setMembers([bootstrapSelf(currentUserIsAdmin)]);
      toast({
        title: "Greška",
        description: err?.message ?? "Nije moguće dohvatiti članove tima",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, currentUserIsAdmin]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSendInvite = async () => {
    if (!user || !inviteEmail.trim()) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Neispravan email",
        description: "Unesi valjanu email adresu",
        variant: "destructive",
      });
      return;
    }

    if (email === user.email?.toLowerCase()) {
      toast({
        title: "Ne možeš pozvati sebe",
        description: "Već si admin ovog tima",
        variant: "destructive",
      });
      return;
    }

    setInviting(true);
    let inviteLink: string | null = null;
    let emailSent = false;

    try {
      // 1) Pokušaj preko edge funkcije (slat će i email)
      try {
        const { data, error } = await supabase.functions.invoke("send-invitation", {
          body: {
            email,
            role: inviteRole,
            inviter_id: user.id,
            app_origin: window.location.origin,
          },
        });

        if (error) throw error;

        if (data?.ok && data?.invite?.token) {
          inviteLink = `${window.location.origin}/signup?invite=${data.invite.token}`;
          emailSent = !data.warning;
        } else {
          throw new Error(data?.error || "Edge funkcija nije vratila token");
        }
      } catch (fnErr: any) {
        // 2) Fallback: direktan INSERT u invitations tablicu
        // (radi i bez deploya edge funkcije; email moraš poslati ručno)
        console.warn("[Team] Edge function nedostupna, koristim fallback:", fnErr?.message);

        const { data: inv, error: insErr } = await supabase
          .from("invitations")
          .insert({
            email,
            role: inviteRole,
            invited_by: user.id,
          })
          .select()
          .single();

        if (insErr) throw insErr;

        inviteLink = `${window.location.origin}/signup?invite=${inv.token}`;
        emailSent = false;
      }

      // Kopiraj link u clipboard za svaki slučaj
      if (inviteLink) {
        try {
          await navigator.clipboard.writeText(inviteLink);
        } catch {
          /* clipboard može biti blokiran */
        }
      }

      toast({
        title: emailSent ? "Pozivnica poslana" : "Pozivnica kreirana",
        description: emailSent
          ? `${email} će dobiti email s linkom.`
          : `Email nije poslan automatski. Link kopiran u clipboard — pošalji ga ručno.`,
      });

      setInviteEmail("");
      setInviteRole("korisnik");
      setInviteDialogOpen(false);
      await fetchAll();
    } catch (err: any) {
      console.error("[Team] invite error:", err);
      toast({
        title: "Greška",
        description: err?.message ?? "Nije moguće kreirati pozivnicu",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleCopyInviteLink = (token: string) => {
    const link = `${window.location.origin}/signup?invite=${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link kopiran", description: link });
  };

  const handleRevokeInvitation = async () => {
    if (!invitationToRevoke) return;
    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitationToRevoke.id);

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pozivnica opozvana" });
      setInvitationToRevoke(null);
      fetchAll();
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToDelete || !user) return;

    try {
      // Obriši tab_permissions
      await supabase.from("tab_permissions").delete().eq("user_id", memberToDelete.user_id);

      // Raskini vezu admin_user_id u profilu
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ admin_user_id: null })
        .eq("user_id", memberToDelete.user_id);
      if (profErr) throw profErr;

      // Obriši ulogu
      await supabase.from("user_roles").delete().eq("user_id", memberToDelete.user_id);

      toast({ title: "Član uklonjen iz tima" });
      setMemberToDelete(null);
      fetchAll();
    } catch (err: any) {
      toast({
        title: "Greška",
        description: err?.message ?? "Nije moguće ukloniti člana",
        variant: "destructive",
      });
    }
  };

  const handleTogglePermission = async (userId: string, tabKey: TabKey, next: boolean) => {
    if (!currentUserIsAdmin) return;
    setSavingPerms(`${userId}:${tabKey}`);

    // Optimistic update
    setPermissions((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? {}), [tabKey]: next },
    }));

    const { data: updatedRows, error: updateError } = await supabase
      .from("tab_permissions")
      .update({ enabled: next, granted_by: user?.id })
      .eq("user_id", userId)
      .eq("tab_key", tabKey)
      .select("id");

    const insertResult =
      !updateError && (updatedRows?.length ?? 0) === 0
        ? await supabase
            .from("tab_permissions")
            .insert({ user_id: userId, tab_key: tabKey, enabled: next, granted_by: user?.id })
        : { error: null };

    const error = updateError ?? insertResult.error;

    if (error) {
      // Rollback
      setPermissions((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] ?? {}), [tabKey]: !next },
      }));
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    }
    setSavingPerms(null);
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 max-w-7xl mx-auto pb-24">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Tim</h1>
            <p className="text-muted-foreground">Upravljanje članovima i pozivnicama</p>
          </div>
          {currentUserIsAdmin && (
            <Button onClick={() => setInviteDialogOpen(true)} size="lg">
              <UserPlus className="w-4 h-4 mr-2" />
              Pozovi člana
            </Button>
          )}
        </div>

        {/* Members */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Članovi tima ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nema članova</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground border-b">
                      <th className="pb-3 pr-4">Korisnik</th>
                      <th className="pb-3 pr-4">Uloga</th>
                      <th className="pb-3 pr-4">Član od</th>
                      <th className="pb-3 text-right">Akcije</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.user_id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                              {getInitials(m.full_name, m.email)}
                            </div>
                            <div>
                              <div className="font-medium">{m.full_name || "—"}</div>
                              {m.email && (
                                <div className="text-xs text-muted-foreground">{m.email}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {m.role === "admin" ? (
                            <Badge className="gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <UserIcon className="w-3 h-3" />
                              Korisnik
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-sm">
                          {new Date(m.created_at).toLocaleDateString("hr-HR")}
                        </td>
                        <td className="py-3 text-right">
                          {currentUserIsAdmin && m.role !== "admin" && (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" title="Detalji">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Ukloni"
                                onClick={() => setMemberToDelete(m)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invitations */}
        {currentUserIsAdmin && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Pozivnice ({invitations.length})
              </CardTitle>
              <CardDescription>Aktivne pozivnice koje čekaju prihvaćanje</CardDescription>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Nema poslanih pozivnica</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{inv.email}</div>
                          <div className="text-xs text-muted-foreground">
                            Uloga: {inv.role} · Ističe:{" "}
                            {new Date(inv.expires_at).toLocaleDateString("hr-HR")}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Kopiraj link"
                          onClick={() => handleCopyInviteLink(inv.token)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Opozovi"
                          onClick={() => setInvitationToRevoke(inv)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab permissions — uvijek vidljivo adminu */}
        {currentUserIsAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Dopuštenja za tabove
              </CardTitle>
              <CardDescription>
                Odaberi koje tabove pojedini član tima može vidjeti. Admin uvijek vidi sve.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {members.filter((m) => m.role !== "admin").length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Shield className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Još nema članova kojima možeš dodjeljivati dopuštenja
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Pošalji pozivnicu — kad se prihvati, korisnik se pojavi u matrici ispod
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInviteDialogOpen(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Pozovi prvog člana
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-muted-foreground border-b">
                        <th className="pb-3 pr-4 min-w-[160px]">Korisnik</th>
                        {TAB_KEYS.map((t) => (
                          <th key={t.key} className="pb-3 px-2 text-center whitespace-nowrap">
                            {t.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members
                        .filter((m) => m.role !== "admin")
                        .map((m) => (
                          <tr key={m.user_id} className="border-b last:border-0">
                            <td className="py-3 pr-4 font-medium">
                              {m.full_name || m.email || "—"}
                            </td>
                            {TAB_KEYS.map((t) => {
                              const enabled = permissions[m.user_id]?.[t.key] ?? false;
                              const saving = savingPerms === `${m.user_id}:${t.key}`;
                              return (
                                <td key={t.key} className="py-3 px-2 text-center">
                                  {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                                  ) : (
                                    <Checkbox
                                      checked={enabled}
                                      onCheckedChange={(v) =>
                                        handleTogglePermission(m.user_id, t.key, !!v)
                                      }
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pozovi novog člana</DialogTitle>
            <DialogDescription>
              Pošalji pozivnicu na email. Ako email sustav nije aktivan, link će biti
              kopiran u clipboard pa ga pošalji ručno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inv-email">Email</Label>
              <Input
                id="inv-email"
                type="email"
                placeholder="ime.prezime@tvrtka.hr"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Uloga</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={inviteRole === "korisnik" ? "default" : "outline"}
                  onClick={() => setInviteRole("korisnik")}
                  className="flex-1"
                >
                  <UserIcon className="w-4 h-4 mr-2" /> Korisnik
                </Button>
                <Button
                  type="button"
                  variant={inviteRole === "admin" ? "default" : "outline"}
                  onClick={() => setInviteRole("admin")}
                  className="flex-1"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" /> Admin
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Odustani
            </Button>
            <Button onClick={handleSendInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Šaljem...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" /> Pošalji pozivnicu
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm remove member */}
      <AlertDialog
        open={!!memberToDelete}
        onOpenChange={(o) => !o && setMemberToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ukloniti člana iz tima?</AlertDialogTitle>
            <AlertDialogDescription>
              Član <strong>{memberToDelete?.full_name || memberToDelete?.email}</strong> više neće
              imati pristup tvojoj organizaciji. Ova akcija se može poništiti ponovnim pozivom.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember}>Ukloni</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm revoke invitation */}
      <AlertDialog
        open={!!invitationToRevoke}
        onOpenChange={(o) => !o && setInvitationToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opozvati pozivnicu?</AlertDialogTitle>
            <AlertDialogDescription>
              Pozivnica za <strong>{invitationToRevoke?.email}</strong> više neće raditi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeInvitation}>Opozovi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Team;
