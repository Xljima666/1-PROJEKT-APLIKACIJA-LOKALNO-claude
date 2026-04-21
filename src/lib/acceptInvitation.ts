// =====================================================================
// acceptInvitationIfPresent
// Pozovi odmah nakon uspješne registracije (supabase.auth.signUp) u Signup.tsx
// =====================================================================
import { supabase } from "@/integrations/supabase/client";

/**
 * Ako URL sadrži ?invite=TOKEN, pozovi RPC accept_invitation da poveže
 * novog korisnika s adminom koji ga je pozvao i postavi mu ulogu.
 * Returna true ako je pozivnica uspješno prihvaćena.
 */
export async function acceptInvitationIfPresent(): Promise<{
  accepted: boolean;
  error?: string;
  role?: string;
}> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("invite");
  if (!token) return { accepted: false };

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });

  if (error) {
    console.error("[acceptInvitation] rpc error:", error);
    return { accepted: false, error: error.message };
  }

  const result = data as { ok: boolean; error?: string; role?: string } | null;
  if (!result?.ok) {
    return { accepted: false, error: result?.error ?? "unknown" };
  }

  return { accepted: true, role: result.role };
}

/**
 * Primjer korištenja u Signup.tsx:
 *
 * const { data, error } = await supabase.auth.signUp({ email, password });
 * if (!error && data.user) {
 *   const res = await acceptInvitationIfPresent();
 *   if (res.accepted) {
 *     toast({ title: "Dobrodošao u tim!" });
 *   }
 * }
 */
