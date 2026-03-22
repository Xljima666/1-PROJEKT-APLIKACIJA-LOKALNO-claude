import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImpersonatedUser {
  id: string;
  full_name: string | null;
}

interface ImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  startImpersonation: (user: ImpersonatedUser) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  isImpersonating: boolean;
  isSwapping: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const ADMIN_SESSION_KEY = "admin_session_backup";
const IMPERSONATED_USER_KEY = "impersonated_user";

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(() => {
    const saved = sessionStorage.getItem(IMPERSONATED_USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [isSwapping, setIsSwapping] = useState(false);

  // Persist impersonated user to sessionStorage
  useEffect(() => {
    if (impersonatedUser) {
      sessionStorage.setItem(IMPERSONATED_USER_KEY, JSON.stringify(impersonatedUser));
    } else {
      sessionStorage.removeItem(IMPERSONATED_USER_KEY);
    }
  }, [impersonatedUser]);

  const startImpersonation = useCallback(async (user: ImpersonatedUser) => {
    setIsSwapping(true);
    try {
      // Save current admin session
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      if (!adminSession) throw new Error("Nema admin sesije");

      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      }));

      // Call edge function to get magic link OTP
      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: { target_user_id: user.id },
      });

      if (error || !data?.token) {
        throw new Error(error?.message || data?.error || "Greška pri generiranju tokena");
      }

      // Sign in as target user
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: data.email,
        token: data.token,
        type: 'magiclink',
      });

      if (otpError) throw otpError;

      setImpersonatedUser(user);
      toast.success(`Pregledavate kao: ${user.full_name || "Korisnik"}`);
    } catch (err: any) {
      toast.error("Greška pri impersonaciji: " + (err.message || "Nepoznata greška"));
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } finally {
      setIsSwapping(false);
    }
  }, []);

  const stopImpersonation = useCallback(async () => {
    setIsSwapping(true);
    try {
      const saved = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (!saved) throw new Error("Nema spremljene admin sesije");

      const { access_token, refresh_token } = JSON.parse(saved);

      // Restore admin session
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;

      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      setImpersonatedUser(null);
      toast.success("Vraćeni ste na svoj račun");
    } catch (err: any) {
      toast.error("Greška pri povratku: " + (err.message || "Nepoznata greška"));
      // Fallback: full sign out
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem(IMPERSONATED_USER_KEY);
      setImpersonatedUser(null);
      await supabase.auth.signOut();
    } finally {
      setIsSwapping(false);
    }
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        startImpersonation,
        stopImpersonation,
        isImpersonating: !!impersonatedUser,
        isSwapping,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
};
