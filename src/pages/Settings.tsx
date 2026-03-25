import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ApiKeysManager from "@/components/settings/ApiKeysManager";
import AgentStatusCard from "@/components/settings/AgentStatusCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Lock, 
  Bell,
  Save,
  Mail,
  Unlink,
  Link2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: "",
    avatar_url: "",
  });
  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      checkGoogleConnection();
    }
  }, [user]);

  const checkGoogleConnection = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("google_tokens")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    setGoogleConnected(!!data);
  };

  const handleConnectGoogle = async () => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;

    // Dinamički uzimamo trenutnu domenu da uvijek bude ispravan redirect
    const redirectUri = `${window.location.origin}/auth/callback`;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-auth?action=auth-url&redirect_uri=${encodeURIComponent(redirectUri)}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    );
    const json = await res.json();
    if (json.url) {
      window.location.href = json.url;
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("google_tokens")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Greška", description: "Nije moguće odspojiti Google", variant: "destructive" });
    } else {
      setGoogleConnected(false);
      toast({ title: "Uspjeh", description: "Google račun je odspojen" });
    }
  };

  const fetchProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setProfileData({
        full_name: data.full_name || "",
        avatar_url: data.avatar_url || "",
      });
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    setIsLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profileData.full_name,
        avatar_url: profileData.avatar_url,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Greška",
        description: "Nije moguće ažurirati profil",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Uspjeh",
        description: "Profil je ažuriran",
      });
    }
    setIsLoading(false);
  };

  const handleUpdatePassword = async () => {
    if (passwordData.new !== passwordData.confirm) {
      toast({
        title: "Greška",
        description: "Lozinke se ne podudaraju",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.new.length < 6) {
      toast({
        title: "Greška",
        description: "Lozinka mora imati najmanje 6 znakova",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: passwordData.new,
    });

    if (error) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Uspjeh",
        description: "Lozinka je promijenjena",
      });
      setPasswordData({ current: "", new: "", confirm: "" });
    }
    setIsLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 max-w-3xl pb-24">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Postavke</h1>
          <p className="text-muted-foreground">Upravljanje vašim računom</p>
        </div>

        {/* Profile Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profil
            </CardTitle>
            <CardDescription>
              Ažurirajte svoje osobne podatke
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email adresa se ne može promijeniti
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Ime i prezime</Label>
              <Input
                id="full_name"
                value={profileData.full_name}
                onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                placeholder="Vaše ime i prezime"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar_url">URL slike profila</Label>
              <Input
                id="avatar_url"
                value={profileData.avatar_url}
                onChange={(e) => setProfileData({ ...profileData, avatar_url: e.target.value })}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            <Button onClick={handleUpdateProfile} disabled={isLoading}>
              <Save className="w-4 h-4 mr-2" />
              Spremi promjene
            </Button>
          </CardContent>
        </Card>

        {/* Password Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Lozinka
            </CardTitle>
            <CardDescription>
              Promijenite svoju lozinku
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">Nova lozinka</Label>
              <Input
                id="new_password"
                type="password"
                value={passwordData.new}
                onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Potvrdite lozinku</Label>
              <Input
                id="confirm_password"
                type="password"
                value={passwordData.confirm}
                onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <Button onClick={handleUpdatePassword} disabled={isLoading}>
              <Lock className="w-4 h-4 mr-2" />
              Promijeni lozinku
            </Button>
          </CardContent>
        </Card>

        {/* Google Integration */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Google (Gmail + Drive)
            </CardTitle>
            <CardDescription>
              Povežite Google račun za pristup Gmailu i Google Driveu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {googleConnected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-emerald-500 font-medium">Povezano</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Nije povezano</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {googleConnected && (
                  <Button variant="destructive" size="sm" onClick={handleDisconnectGoogle}>
                    <Unlink className="w-4 h-4 mr-1" />
                    Odspoji
                  </Button>
                )}
                <Button variant={googleConnected ? "outline" : "default"} size="sm" onClick={handleConnectGoogle}>
                  <Link2 className="w-4 h-4 mr-1" />
                  {googleConnected ? "Ponovo poveži" : "Poveži Google"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agent Status */}
        <div className="mt-6">
          <AgentStatusCard />
        </div>

        {/* API Keys Management */}
        <div className="mt-6">
          <ApiKeysManager />
        </div>

        {/* Account Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Informacije o računu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID korisnika:</span>
                <span className="font-mono text-xs">{user?.id}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email potvrđen:</span>
                <span>{user?.email_confirmed_at ? "Da" : "Ne"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zadnja prijava:</span>
                <span>{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("hr-HR") : "-"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
