import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, Mail, Lock, Eye, EyeOff, ArrowLeft, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    password: "",
  });

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidating(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("validate-invitation", {
          body: { token },
        });

        if (error || !data?.valid) {
          setIsValidToken(false);
        } else {
          setIsValidToken(true);
          setInvitationEmail(data.email);
        }
      } catch {
        setIsValidToken(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Use edge function to create user with auto-confirm
      const { data, error: fnError } = await supabase.functions.invoke("signup-with-invitation", {
        body: {
          email: invitationEmail,
          password: formData.password,
          fullName: formData.fullName,
          token,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Račun kreiran!",
        description: "Provjerite email za potvrdu računa prije prijave.",
      });

      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Greška pri registraciji",
        description: error.message || "Došlo je do pogreške.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg mx-auto mb-4 animate-pulse">
            <MapPin className="w-7 h-7 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Provjerava se pozivnica...</p>
        </div>
      </div>
    );
  }

  if (!token || !isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Natrag na početnu
          </Link>

          <div className="bg-card border border-destructive/50 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Nevaljana pozivnica</h1>
            <p className="text-muted-foreground mb-6">
              Pozivnica je istekla, već korištena ili nije valjana. 
              Kontaktirajte administratora za novu pozivnicu.
            </p>
            <Button variant="outline" asChild>
              <Link to="/">Povratak na početnu</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Natrag na početnu
        </Link>

        <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <MapPin className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-gradient">GeoTerrainInfo</span>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Kreirajte račun</h1>
          <p className="text-muted-foreground text-center mb-8">
            Pozvani ste na email: <span className="font-medium text-foreground">{invitationEmail}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium">
                Ime i prezime
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Ivan Horvat"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email adresa
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={invitationEmail}
                  className="pl-10 bg-muted"
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Lozinka
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimalno 6 znakova"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gradient-primary text-primary-foreground"
              disabled={isLoading}
            >
              {isLoading ? "Kreiranje..." : "Kreiraj račun"}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-sm mt-6">
            Već imate račun?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Prijavite se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
