import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Mail, 
  UserPlus,
  Trash2,
  Clock,
  CheckCircle,
  Shield,
  User,
  Copy,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { hr } from "date-fns/locale";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  role?: string;
}

interface Invitation {
  id: string;
  email: string;
  token: string;
  invited_by: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

const TAB_KEYS = [
  { key: "organizator", label: "Organizator" },
  { key: "poslovi", label: "Poslovi" },
  { key: "geodezija", label: "Geodezija" },
  { key: "firma", label: "Firma" },
  { key: "tim", label: "Tim" },
  { key: "postavke", label: "Postavke" },
  { key: "privatne-biljeske", label: "Privatne bilješke" },
  { key: "privatne-biljeske-sve", label: "Sve privatne bilješke" },
  { key: "kontakt-upiti", label: "Kontakt upiti" },
];

const Team = () => {
  const { isAdmin, user } = useAuth();
  const { startImpersonation } = useImpersonation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [tabPermissions, setTabPermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch profiles with roles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesData) {
      const profilesWithRoles = await Promise.all(
        profilesData.map(async (profile) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.user_id)
            .single();
          
          return {
            ...profile,
            role: roleData?.role || "user",
          };
        })
      );
      setProfiles(profilesWithRoles);
    }

    // Fetch invitations (admin only)
    if (isAdmin) {
      const { data: invitationsData } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false });
      
      setInvitations(invitationsData || []);

      // Fetch tab permissions for all users
      const { data: permsData } = await supabase
        .from("user_tab_permissions")
        .select("user_id, tab_key");
      
      if (permsData) {
        const permsMap: Record<string, string[]> = {};
        permsData.forEach((p: { user_id: string; tab_key: string }) => {
          if (!permsMap[p.user_id]) permsMap[p.user_id] = [];
          permsMap[p.user_id].push(p.tab_key);
        });
        setTabPermissions(permsMap);
      }
    }

    setIsLoading(false);
  };

  const handleTogglePermission = useCallback(async (userId: string, tabKey: string, enabled: boolean) => {
    if (enabled) {
      await supabase.from("user_tab_permissions").insert({ user_id: userId, tab_key: tabKey });
    } else {
      await supabase.from("user_tab_permissions").delete().eq("user_id", userId).eq("tab_key", tabKey);
    }
    // Update local state
    setTabPermissions(prev => {
      const userPerms = prev[userId] || [];
      if (enabled) {
        return { ...prev, [userId]: [...userPerms, tabKey] };
      } else {
        return { ...prev, [userId]: userPerms.filter(k => k !== tabKey) };
      }
    });
  }, []);

  const handleSendInvitation = async () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      toast({
        title: "Greška",
        description: "Unesite valjanu email adresu",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    // Check if invitation already exists
    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("id")
      .eq("email", inviteEmail.toLowerCase())
      .is("used_at", null)
      .single();

    if (existingInvite) {
      toast({
        title: "Greška",
        description: "Pozivnica za ovu email adresu već postoji",
        variant: "destructive",
      });
      setIsSending(false);
      return;
    }

    // Create invitation
    const { data: invitation, error } = await supabase
      .from("invitations")
      .insert({
        email: inviteEmail.toLowerCase(),
        invited_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Greška",
        description: "Nije moguće poslati pozivnicu",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Uspjeh",
        description: `Pozivnica je kreirana za ${inviteEmail}`,
      });
      setInviteEmail("");
      setIsDialogOpen(false);
      fetchData();
    }

    setIsSending(false);
  };

  const handleDeleteInvitation = async (id: string) => {
    if (!confirm("Jeste li sigurni da želite obrisati ovu pozivnicu?")) return;

    const { error } = await supabase
      .from("invitations")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Greška",
        description: "Nije moguće obrisati pozivnicu",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Uspjeh",
        description: "Pozivnica je obrisana",
      });
      fetchData();
    }
  };

  const handleRemoveMember = async (profile: Profile) => {
    if (profile.user_id === user?.id) {
      toast({ title: "Greška", description: "Ne možete ukloniti sami sebe", variant: "destructive" });
      return;
    }
    if (!confirm(`Jeste li sigurni da želite ukloniti ${profile.full_name || "ovog korisnika"} iz tima? Ova radnja se ne može poništiti.`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: profile.user_id },
      });

      if (error || data?.error) {
        toast({ title: "Greška", description: data?.error || error?.message || "Nije moguće ukloniti korisnika", variant: "destructive" });
        return;
      }

      toast({ title: "Uspjeh", description: `${profile.full_name || "Korisnik"} je uklonjen iz tima` });
      fetchData();
    } catch {
      toast({ title: "Greška", description: "Nije moguće ukloniti korisnika", variant: "destructive" });
    }
  };

  const handleImpersonate = async (profile: Profile) => {
    await startImpersonation({ id: profile.user_id, full_name: profile.full_name });
    navigate("/stellan");
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return (
        <Badge className="bg-primary">
          <Shield className="w-3 h-3 mr-1" />
          Admin
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <User className="w-3 h-3 mr-1" />
        Korisnik
      </Badge>
    );
  };

  const getInvitationStatus = (invitation: Invitation) => {
    if (invitation.used_at) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Iskorišteno
        </Badge>
      );
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return (
        <Badge variant="destructive">
          <Clock className="w-3 h-3 mr-1" />
          Isteklo
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <Clock className="w-3 h-3 mr-1" />
        Čeka
      </Badge>
    );
  };

  if (!isAdmin) {
    return (
      <DashboardLayout noScroll>
        <div className="p-4 lg:p-6 h-full overflow-y-auto scrollbar-hide">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Tim</h1>
            <p className="text-muted-foreground">Članovi tima</p>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Učitavanje...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Korisnik</TableHead>
                      <TableHead>Uloga</TableHead>
                      <TableHead>Član od</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                              {profile.avatar_url ? (
                                <img
                                  src={profile.avatar_url}
                                  alt=""
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-bold text-muted-foreground">
                                  {profile.full_name
                                    ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                                    : "?"}
                                </span>
                              )}
                            </div>
                            <span className="font-medium">
                              {profile.full_name || "Nepoznato"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(profile.role || "user")}</TableCell>
                        <TableCell>
                          {format(new Date(profile.created_at), "dd.MM.yyyy", { locale: hr })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout noScroll>
      <div className="p-4 lg:p-6 h-full overflow-y-auto scrollbar-hide">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Tim</h1>
            <p className="text-muted-foreground">Upravljanje članovima i pozivnicama</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Pozovi člana
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pozovi novog člana</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Email adresa</label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Pozivnica se kreira u sustavu; zatim kopirajte link i pošaljite ga korisniku. Pozivnica vrijedi 7 dana.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Odustani
                  </Button>
                  <Button onClick={handleSendInvitation} disabled={isSending}>
                    {isSending ? "Slanje..." : "Pošalji pozivnicu"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Team Members */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Članovi tima ({profiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Učitavanje...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Korisnik</TableHead>
                    <TableHead>Uloga</TableHead>
                    <TableHead>Član od</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                            {profile.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-bold text-muted-foreground">
                                {profile.full_name
                                  ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                                  : "?"}
                              </span>
                            )}
                          </div>
                          <span className="font-medium">
                            {profile.full_name || "Nepoznato"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(profile.role || "user")}</TableCell>
                      <TableCell>
                        {format(new Date(profile.created_at), "dd.MM.yyyy", { locale: hr })}
                      </TableCell>
                       <TableCell className="text-right space-x-1">
                         {profile.user_id !== user?.id && (
                           <>
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handleImpersonate(profile)}
                               title="Pregledaj kao ovaj korisnik"
                             >
                               <Eye className="w-4 h-4 text-primary" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handleRemoveMember(profile)}
                               title="Ukloni člana"
                             >
                               <Trash2 className="w-4 h-4 text-destructive" />
                             </Button>
                           </>
                         )}
                       </TableCell>
                     </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Invitations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Pozivnice ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invitations.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nema poslanih pozivnica</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Poslano</TableHead>
                    <TableHead>Ističe</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>{getInvitationStatus(invitation)}</TableCell>
                      <TableCell>
                        {format(new Date(invitation.created_at), "dd.MM.yyyy", { locale: hr })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invitation.expires_at), "dd.MM.yyyy", { locale: hr })}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {!invitation.used_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const baseUrl = 'https://geoterrainfo.lovable.app';
                              const link = `${baseUrl}/signup?token=${invitation.token}`;
                              navigator.clipboard.writeText(link);
                              toast({
                                title: "Kopirano!",
                                description: "Link za pozivnicu kopiran u clipboard",
                              });
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteInvitation(invitation.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Tab Permissions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Dopuštenja za tabove
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Korisnik</TableHead>
                  {TAB_KEYS.map(t => (
                    <TableHead key={t.key} className="text-center">{t.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles
                  .filter(p => p.role !== "admin")
                  .map(profile => (
                    <TableRow key={profile.user_id}>
                      <TableCell className="font-medium">
                        {profile.full_name || "Nepoznato"}
                      </TableCell>
                      {TAB_KEYS.map(t => {
                        const checked = (tabPermissions[profile.user_id] || []).includes(t.key);
                        return (
                          <TableCell key={t.key} className="text-center">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(val) =>
                                handleTogglePermission(profile.user_id, t.key, !!val)
                              }
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Team;
