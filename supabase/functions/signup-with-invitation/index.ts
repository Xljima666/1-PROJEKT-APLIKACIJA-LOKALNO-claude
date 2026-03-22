import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, password, fullName, token } = await req.json();

    if (!email || !password || !token) {
      throw new Error("Missing required fields");
    }

    // Validate invitation token
    const { data: invitation, error: invError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", token)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (invError || !invitation) {
      throw new Error("Invalid or expired invitation");
    }

    if (invitation.email !== email) {
      throw new Error("Email does not match invitation");
    }

    const emailRedirectTo = req.headers.get("origin") ?? undefined;

    // Create user (or handle already existing unconfirmed user)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
      },
    });

    const userAlreadyExists =
      !!createError &&
      createError.message?.toLowerCase().includes("already been registered");

    if (createError && !userAlreadyExists) throw createError;

    // Always attempt to send / resend verification email
    const { error: resendError } = await supabaseAdmin.auth.resend({
      type: "signup",
      email,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    });

    if (resendError) {
      throw new Error("Korisnik je kreiran, ali verifikacijski email nije poslan. Pokušajte ponovno za minutu.");
    }

    // Mark invitation as used only when a new user was successfully created
    if (!userAlreadyExists) {
      await supabaseAdmin
        .from("invitations")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);
    }

    return new Response(JSON.stringify({ success: true, user_id: userData?.user?.id ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
