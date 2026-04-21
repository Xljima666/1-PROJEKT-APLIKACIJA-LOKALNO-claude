import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .limit(1);
      
      if (error) throw error;
      setIsAdmin((data?.length ?? 0) > 0);
    } catch (error) {
      console.error("Admin role check failed:", error);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up listener FIRST — but do NOT await async work inside the callback.
    // Supabase's onAuthStateChange can deadlock if you make additional Supabase
    // calls (like checkAdminRole) synchronously inside it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return;

        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          // Defer the DB call outside the callback to avoid deadlock
          setTimeout(async () => {
            if (!mounted) return;
            await checkAdminRole(nextSession.user.id);
            if (mounted) setIsLoading(false);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsLoading(false);
        }
      }
    );

    // Then read current session
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await checkAdminRole(currentSession.user.id);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
