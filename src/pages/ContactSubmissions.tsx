import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { hr } from "date-fns/locale";
import { Trash2, Mail, User, MessageSquare, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface Submission {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

const ContactSubmissions = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setSubmissions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("contact_submissions")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Greška", description: "Brisanje nije uspjelo.", variant: "destructive" });
    } else {
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Obrisano", description: "Upit je uklonjen." });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground">Kontakt upiti</h1>

        {loading ? (
          <p className="text-muted-foreground text-sm">Učitavanje...</p>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Inbox className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm">Nema kontakt upita.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl bg-card border border-border space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4 shrink-0" />
                      <a href={`mailto:${s.email}`} className="hover:underline truncate">
                        {s.email}
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDelete(s.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-foreground whitespace-pre-wrap">{s.message}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(s.created_at), "dd. MMM yyyy. HH:mm", { locale: hr })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ContactSubmissions;
