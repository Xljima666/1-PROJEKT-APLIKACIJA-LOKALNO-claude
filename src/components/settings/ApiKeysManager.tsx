import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Shield,
  CheckCircle2,
  XCircle,
  Server,
} from "lucide-react";

// Predefined key templates grouped by category
const PREDEFINED_KEYS = [
  { key_name: "GROK_API_KEY", label: "Grok (xAI) API Key", category: "ai" },
  { key_name: "OPENAI_API_KEY", label: "OpenAI API Key", category: "ai" },
  { key_name: "GOOGLE_CLIENT_ID", label: "Google Client ID", category: "google" },
  { key_name: "GOOGLE_CLIENT_SECRET", label: "Google Client Secret", category: "google" },
  { key_name: "GOOGLE_BRAIN_CLIENT_ID", label: "Google Brain Client ID", category: "google" },
  { key_name: "GOOGLE_BRAIN_CLIENT_SECRET", label: "Google Brain Client Secret", category: "google" },
  { key_name: "SDGE_USERNAME", label: "SDGE Korisničko ime", category: "sdge" },
  { key_name: "SDGE_PASSWORD", label: "SDGE Lozinka", category: "sdge" },
  { key_name: "SDGE_API_KEY", label: "SDGE API Key", category: "sdge" },
  { key_name: "TRELLO_API_KEY", label: "Trello API Key", category: "trello" },
  { key_name: "TRELLO_TOKEN", label: "Trello Token", category: "trello" },
  { key_name: "FIRECRAWL_API_KEY", label: "Firecrawl API Key", category: "tools" },
  { key_name: "VAPID_PUBLIC_KEY", label: "VAPID Public Key", category: "push" },
  { key_name: "VAPID_PRIVATE_KEY", label: "VAPID Private Key", category: "push" },
  { key_name: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", category: "payment" },
  { key_name: "STRIPE_PUBLISHABLE_KEY", label: "Stripe Publishable Key", category: "payment" },
];

const CATEGORIES: Record<string, { label: string; color: string }> = {
  ai: { label: "AI", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  google: { label: "Google", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  sdge: { label: "SDGE", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  trello: { label: "Trello", color: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  tools: { label: "Alati", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  push: { label: "Push", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  payment: { label: "Plaćanje", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  custom: { label: "Custom", color: "bg-muted text-muted-foreground border-border" },
  system: { label: "Sustav", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  agent: { label: "Agent", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  supabase: { label: "Supabase", color: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
};

// System-level secrets that exist on the backend
const SYSTEM_SECRETS = [
  { name: "GROK_API_KEY", label: "Grok (xAI) API Key", category: "ai", description: "Stellan AI asistent" },
  { name: "OPENAI_API_KEY", label: "OpenAI API Key", category: "ai", description: "OpenAI integracija" },
  { name: "GOOGLE_CLIENT_ID", label: "Google Client ID", category: "google", description: "Gmail & Drive OAuth" },
  { name: "GOOGLE_CLIENT_SECRET", label: "Google Client Secret", category: "google", description: "Gmail & Drive OAuth" },
  { name: "GOOGLE_BRAIN_CLIENT_ID", label: "Google Brain Client ID", category: "google", description: "Stellan Brain OAuth" },
  { name: "GOOGLE_BRAIN_CLIENT_SECRET", label: "Google Brain Client Secret", category: "google", description: "Stellan Brain OAuth" },
  { name: "SDGE_USERNAME", label: "SDGE Korisničko ime", category: "sdge", description: "SDGE portal prijava" },
  { name: "SDGE_PASSWORD", label: "SDGE Lozinka", category: "sdge", description: "SDGE portal prijava" },
  { name: "SDGE_API_KEY", label: "SDGE API Key", category: "sdge", description: "SDGE scraping zaštita" },
  { name: "TRELLO_API_KEY", label: "Trello API Key", category: "trello", description: "Trello pretraga" },
  { name: "TRELLO_TOKEN", label: "Trello Token", category: "trello", description: "Trello pristup" },
  { name: "FIRECRAWL_API_KEY", label: "Firecrawl API Key", category: "tools", description: "Web scraping (connector)" },
  { name: "VAPID_PUBLIC_KEY", label: "VAPID Public Key", category: "push", description: "Push obavijesti" },
  { name: "VAPID_PRIVATE_KEY", label: "VAPID Private Key", category: "push", description: "Push obavijesti" },
  { name: "AGENT_SERVER_URL", label: "Agent Server URL", category: "agent", description: "Lokalni Python agent" },
  { name: "AGENT_API_KEY", label: "Agent API Key", category: "agent", description: "Lokalni agent autentifikacija" },
  { name: "SUPABASE_URL", label: "Supabase URL", category: "supabase", description: "Backend URL" },
  { name: "SUPABASE_ANON_KEY", label: "Supabase Anon Key", category: "supabase", description: "Backend javni ključ" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", label: "Service Role Key", category: "supabase", description: "Backend admin ključ" },
  { name: "SUPABASE_PUBLISHABLE_KEY", label: "Publishable Key", category: "supabase", description: "Backend javni ključ" },
  { name: "SUPABASE_DB_URL", label: "Database URL", category: "supabase", description: "Direktni pristup bazi" },
  { name: "LOVABLE_API_KEY", label: "Lovable API Key", category: "system", description: "Lovable connector gateway" },
  { name: "CRON_SECRET", label: "Cron Secret", category: "system", description: "Zakazani zadaci" },
];

type ApiKeyRow = {
  id: string;
  key_name: string;
  key_value: string;
  key_label: string | null;
  key_category: string;
};

export default function ApiKeysManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState({ key_name: "", key_value: "", key_label: "", key_category: "custom" });
  const [selectedPreset, setSelectedPreset] = useState("");
  const [showSystemSecrets, setShowSystemSecrets] = useState(false);

  useEffect(() => {
    if (user) fetchKeys();
  }, [user]);

  const fetchKeys = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("user_api_keys" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("key_category", { ascending: true })
      .order("key_name", { ascending: true });

    if (!error && data) {
      setKeys(data as any);
      const edits: Record<string, string> = {};
      (data as any).forEach((k: ApiKeyRow) => { edits[k.id] = k.key_value; });
      setEditValues(edits);
    }
    setLoading(false);
  };

  const toggleVisible = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async (key: ApiKeyRow) => {
    const newValue = editValues[key.id];
    if (newValue === key.key_value) return;

    const { error } = await supabase
      .from("user_api_keys" as any)
      .update({ key_value: newValue } as any)
      .eq("id", key.id);

    if (error) {
      toast({ title: "Greška", description: "Nije moguće spremiti", variant: "destructive" });
    } else {
      toast({ title: "Spremljeno", description: `${key.key_label || key.key_name} ažuriran` });
      fetchKeys();
    }
  };

  const handleDelete = async (key: ApiKeyRow) => {
    const { error } = await supabase
      .from("user_api_keys" as any)
      .delete()
      .eq("id", key.id);

    if (error) {
      toast({ title: "Greška", description: "Nije moguće obrisati", variant: "destructive" });
    } else {
      toast({ title: "Obrisano", description: `${key.key_label || key.key_name} uklonjen` });
      fetchKeys();
    }
  };

  const handleAdd = async () => {
    if (!user || !newKey.key_name || !newKey.key_value) {
      toast({ title: "Greška", description: "Naziv i vrijednost su obavezni", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("user_api_keys" as any)
      .insert({
        user_id: user.id,
        key_name: newKey.key_name,
        key_value: newKey.key_value,
        key_label: newKey.key_label || newKey.key_name,
        key_category: newKey.key_category,
      } as any);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Greška", description: "Ključ s tim nazivom već postoji", variant: "destructive" });
      } else {
        toast({ title: "Greška", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Dodano", description: `${newKey.key_label || newKey.key_name} spremljen` });
      setNewKey({ key_name: "", key_value: "", key_label: "", key_category: "custom" });
      setSelectedPreset("");
      setShowAddForm(false);
      fetchKeys();
    }
  };

  const handlePresetSelect = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = PREDEFINED_KEYS.find((p) => p.key_name === presetName);
    if (preset) {
      setNewKey({
        key_name: preset.key_name,
        key_label: preset.label,
        key_category: preset.category,
        key_value: "",
      });
    }
  };

  // Filter out presets that already exist
  const availablePresets = PREDEFINED_KEYS.filter(
    (p) => !keys.some((k) => k.key_name === p.key_name)
  );

  const maskValue = (val: string) => {
    if (val.length <= 8) return "••••••••";
    return val.slice(0, 4) + "••••" + val.slice(-4);
  };

  // Group keys by category
  const grouped = keys.reduce<Record<string, ApiKeyRow[]>>((acc, k) => {
    const cat = k.key_category || "custom";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(k);
    return acc;
  }, {});

  // Group system secrets by category
  const systemGrouped = SYSTEM_SECRETS.reduce<Record<string, typeof SYSTEM_SECRETS>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const totalSystemSecrets = SYSTEM_SECRETS.length;

  return (
    <div className="space-y-4">
      {/* System Secrets Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="w-5 h-5" />
              Sistemske Tajne & Ključevi
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {totalSystemSecrets} konfigurirano
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSystemSecrets(!showSystemSecrets)}
                className="h-7 text-xs"
              >
                {showSystemSecrets ? "Sakrij" : "Prikaži sve"}
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs">
            Pregled svih ključeva i tajni konfiguriranih na backend razini (Edge Functions).
            Ovi se ne mogu mijenjati iz aplikacije.
          </CardDescription>
        </CardHeader>
        {showSystemSecrets && (
          <CardContent className="pt-0 space-y-3">
            {Object.entries(systemGrouped).map(([cat, secrets]) => (
              <div key={cat} className="space-y-1.5">
                <Badge variant="outline" className={`text-[10px] ${CATEGORIES[cat]?.color || CATEGORIES.custom.color}`}>
                  {CATEGORIES[cat]?.label || cat}
                </Badge>
                <div className="grid gap-1">
                  {secrets.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40 border border-border/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-xs font-medium truncate">{s.label}</span>
                        <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">{s.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{s.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* User API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Vaši API Ključevi
          </CardTitle>
          <CardDescription>
            Privatni ključevi vezani uz vaš račun. Koriste se kad BYOK (Bring Your Own Key) način rada zamijeni sistemske ključeve.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Security notice */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <Shield className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Ključevi su pohranjeni šifrirano u bazi i dostupni samo vašem računu putem RLS zaštite.
            </p>
          </div>

          {/* Existing keys grouped */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Učitavanje...</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nemate spremljenih ključeva. Dodajte prvi koristeći gumb ispod.</p>
          ) : (
            Object.entries(grouped).map(([cat, catKeys]) => (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2 pt-2">
                  <Badge variant="outline" className={CATEGORIES[cat]?.color || CATEGORIES.custom.color}>
                    {CATEGORIES[cat]?.label || cat}
                  </Badge>
                </div>
                {catKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-2 p-2 rounded-md border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{k.key_label || k.key_name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{k.key_name}</span>
                      </div>
                      <div className="mt-1">
                        <Input
                          type={visibleKeys.has(k.id) ? "text" : "password"}
                          value={editValues[k.id] ?? k.key_value}
                          onChange={(e) => setEditValues({ ...editValues, [k.id]: e.target.value })}
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleVisible(k.id)}
                      >
                        {visibleKeys.has(k.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleSave(k)}
                        disabled={editValues[k.id] === k.key_value}
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(k)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}

          <Separator />

          {/* Add new key */}
          {showAddForm ? (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <h4 className="text-sm font-medium">Dodaj novi ključ</h4>

              {/* Preset selector */}
              {availablePresets.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Odaberi predložak (opcionalno)</Label>
                  <Select value={selectedPreset} onValueChange={handlePresetSelect}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Odaberi postojeći servis..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePresets.map((p) => (
                        <SelectItem key={p.key_name} value={p.key_name}>
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${CATEGORIES[p.category]?.color}`}>
                              {CATEGORIES[p.category]?.label}
                            </Badge>
                            {p.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Naziv ključa (KEY_NAME)</Label>
                  <Input
                    value={newKey.key_name}
                    onChange={(e) => setNewKey({ ...newKey, key_name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })}
                    placeholder="MOJ_API_KEY"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Oznaka</Label>
                  <Input
                    value={newKey.key_label}
                    onChange={(e) => setNewKey({ ...newKey, key_label: e.target.value })}
                    placeholder="Moj API Key"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Vrijednost</Label>
                <Input
                  type="password"
                  value={newKey.key_value}
                  onChange={(e) => setNewKey({ ...newKey, key_value: e.target.value })}
                  placeholder="sk-..."
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Kategorija</Label>
                <Select value={newKey.key_category} onValueChange={(v) => setNewKey({ ...newKey, key_category: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).filter(([k]) => !["system", "supabase", "agent"].includes(k)).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} className="h-8">
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Spremi
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setSelectedPreset(""); }} className="h-8">
                  Odustani
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Dodaj novi ključ
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}