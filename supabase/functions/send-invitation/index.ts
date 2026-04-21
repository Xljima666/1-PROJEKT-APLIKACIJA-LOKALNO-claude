// =====================================================================
// send-invitation — Supabase Edge Function (Deno)
// Šalje pozivnicu: INSERT u `invitations` + email preko Resend-a
// =====================================================================
// Ovise o environment varijablama u Supabase Dashboard → Edge Functions → Secrets:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY         (ako koristiš Resend — https://resend.com)
//   INVITATION_FROM_EMAIL  (npr. "Geo Terra Info <noreply@tvoja-domena.hr>")
// =====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InvitePayload {
  email: string;
  role: "admin" | "korisnik";
  inviter_id: string;
  app_origin: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload: InvitePayload = await req.json();
    const { email, role, inviter_id, app_origin } = payload;

    if (!email || !inviter_id || !app_origin) {
      return json({ error: "Missing fields" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1) Provjeri je li pozivatelj admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", inviter_id)
      .maybeSingle();

    if (roleRow?.role !== "admin") {
      return json({ error: "Only admin can invite" }, 403);
    }

    // 2) Provjeri postoji li već pending pozivnica za isti email
    const normalized = email.trim().toLowerCase();
    const { data: existing } = await supabase
      .from("invitations")
      .select("id, status")
      .eq("email", normalized)
      .eq("invited_by", inviter_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return json({ error: "Pending invitation already exists for this email" }, 409);
    }

    // 3) Insert pozivnice
    const { data: inv, error: insErr } = await supabase
      .from("invitations")
      .insert({
        email: normalized,
        role: role ?? "korisnik",
        invited_by: inviter_id,
      })
      .select()
      .single();

    if (insErr || !inv) {
      console.error("insert error", insErr);
      return json({ error: insErr?.message ?? "Insert failed" }, 500);
    }

    // 4) Dohvati ime pozivatelja (za tijelo emaila)
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", inviter_id)
      .maybeSingle();

    const inviterName = inviterProfile?.full_name || inviterProfile?.email || "Admin";
    const inviteLink = `${app_origin}/signup?invite=${inv.token}`;

    // 5) Pošalji email preko Resend-a (ako je postavljen)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("INVITATION_FROM_EMAIL") || "onboarding@resend.dev";

    if (resendKey) {
      const html = buildEmailHtml({
        inviterName,
        inviteLink,
        role: inv.role,
      });

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [normalized],
          subject: `${inviterName} te poziva u Geo Terra Info`,
          html,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error("resend error", errText);
        // Ne pucamo — pozivnica je u bazi, admin može kopirati link ručno
        return json({
          ok: true,
          warning: "Invitation saved but email not sent",
          invite: inv,
          link: inviteLink,
        });
      }
    } else {
      console.log("RESEND_API_KEY not set — email not sent, link:", inviteLink);
    }

    return json({ ok: true, invite: inv, link: inviteLink });
  } catch (err) {
    console.error("send-invitation fatal:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildEmailHtml(opts: {
  inviterName: string;
  inviteLink: string;
  role: string;
}) {
  return `<!DOCTYPE html>
<html lang="hr">
  <body style="margin:0;padding:0;background:#0b1020;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e7ecf4;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1020;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#141a2e;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:24px;color:#ffffff;">Pozvani ste u Geo Terra Info</h1>
            <p style="margin:0 0 24px;color:#a6b0c4;line-height:1.6;">
              <strong style="color:#fff;">${escapeHtml(opts.inviterName)}</strong> te poziva da se pridružiš timu kao
              <strong style="color:#60a5fa;">${escapeHtml(opts.role)}</strong>.
            </p>
            <a href="${opts.inviteLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:600;">
              Prihvati pozivnicu
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#6b7590;">
              Ako gumb ne radi, kopiraj ovaj link:<br/>
              <span style="color:#8aa0c8;word-break:break-all;">${opts.inviteLink}</span>
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#6b7590;">Pozivnica vrijedi 7 dana.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
