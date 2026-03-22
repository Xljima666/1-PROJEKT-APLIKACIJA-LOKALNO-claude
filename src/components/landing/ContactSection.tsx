import { useState } from "react";
import { Send, Mail, Phone, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const GEOTERRA_EMAIL = "geoterra@geoterrainfo.net";

const ContactSection = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Save to database
      const { error } = await supabase.from("contact_submissions").insert({
        name: formData.name.trim(),
        email: formData.email.trim(),
        message: formData.message.trim(),
      });

      if (error) throw error;

      toast({
        title: "Upit poslan!",
        description: "Hvala na upitu. Javit ćemo vam se u najkraćem roku.",
      });

      setFormData({ name: "", email: "", message: "" });
    } catch {
      toast({
        title: "Greška",
        description: "Došlo je do greške. Pokušajte ponovo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="kontakt" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Side - Info */}
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                <span className="text-gradient">Kontaktirajte nas</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Trebate geodetsku uslugu? Pošaljite upit ili nas nazovite — rado ćemo vam pomoći s besplatnom procjenom.
              </p>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Email</p>
                    <p className="text-muted-foreground">{GEOTERRA_EMAIL}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold">Telefon</p>
                    <p className="text-muted-foreground">095/918-4775</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">Adresa</p>
                    <p className="text-muted-foreground">Draše 57b, 49290 Kraljevec na Sutli</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Form */}
            <div className="p-8 rounded-2xl bg-card border border-border shadow-lg">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Ime i prezime
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Vaše ime"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="pl-10"
                      required
                      maxLength={100}
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
                      placeholder="vas@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-10"
                      required
                      maxLength={255}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">
                    Opišite što vam treba
                  </label>
                  <Textarea
                    id="message"
                    placeholder="Npr. trebam parcelaciju parcele u Zagrebu..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                    required
                    maxLength={1000}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-primary text-primary-foreground"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    "Slanje..."
                  ) : (
                    <>
                      Pošalji upit
                      <Send className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
