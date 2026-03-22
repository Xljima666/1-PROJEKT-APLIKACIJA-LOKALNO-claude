import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Upload, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const CompanySettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const DEFAULT_LOGO = "https://hkdxpehnvcajgfkfdijg.supabase.co/storage/v1/object/public/company-logos/default/logo.jpg";
  const [form, setForm] = useState({
    company_name: "",
    address: "",
    oib: "",
    phone: "",
    email: "",
    logo_url: DEFAULT_LOGO,
  });

  useEffect(() => {
    if (user) fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("company_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setForm({
        company_name: data.company_name || "",
        address: data.address || "",
        oib: data.oib || "",
        phone: data.phone || "",
        email: data.email || "",
        logo_url: data.logo_url || "",
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("company_settings").upsert({
      user_id: user.id,
      ...form,
    }, { onConflict: "user_id" });
    if (error) {
      toast.error("Greška pri spremanju");
    } else {
      toast.success("Podaci spremljeni!");
    }
    setLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Greška pri uploadu loga");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("company-logos")
      .getPublicUrl(path);

    setForm({ ...form, logo_url: urlData.publicUrl });
    setUploading(false);
    toast.success("Logo učitan!");
  };

  const removeLogo = async () => {
    if (!user) return;
    setForm({ ...form, logo_url: "" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="w-5 h-5" />
          Podaci od firme
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo */}
        <div>
          <Label className="text-xs text-muted-foreground">Logo firme</Label>
          <div className="flex items-center gap-4 mt-2">
            {form.logo_url ? (
              <div className="relative">
                <img src={form.logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-lg border border-border bg-muted p-1" />
                <button
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                <Building2 className="w-8 h-8 text-muted-foreground/30" />
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <Button type="button" variant="outline" size="sm" className="gap-2" asChild disabled={uploading}>
                <span>
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "Učitavanje..." : "Učitaj logo"}
                </span>
              </Button>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Naziv firme</Label>
            <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Naziv tvrtke" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">OIB</Label>
            <Input value={form.oib} onChange={(e) => setForm({ ...form, oib: e.target.value })} placeholder="12345678901" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Adresa</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ulica i broj, Grad" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Telefon</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+385 xx xxx xxxx" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@firma.hr" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading} className="gap-2">
          <Save className="w-4 h-4" />
          {loading ? "Spremanje..." : "Spremi podatke"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CompanySettings;
