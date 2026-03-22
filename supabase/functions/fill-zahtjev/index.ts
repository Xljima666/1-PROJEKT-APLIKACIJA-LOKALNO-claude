import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cardData, companyData } = await req.json();

    const GROK_API_KEY = Deno.env.get("GROK_API_KEY");
    if (!GROK_API_KEY) {
      return new Response(JSON.stringify({ error: "GROK_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Ti si stručni asistent za geodetske poslove u Hrvatskoj. Tvoj zadatak je popuniti obrazac "Zahtjev za izdavanje potvrde" na temelju podataka s kartice posla.

VAŽNO - Područni uredi za katastar u Hrvatskoj i njihove ispostave:
- Bjelovar (ispostave: Bjelovar, Čazma, Daruvar, Garešnica, Grubišno Polje)
- Čakovec (ispostave: Čakovec, Prelog)
- Dubrovnik (ispostave: Dubrovnik, Korčula, Lastovo, Metković, Ploče)
- Gospić (ispostave: Gospić, Otočac, Senj)
- Karlovac (ispostave: Karlovac, Duga Resa, Ogulin, Ozalj, Slunj)
- Koprivnica (ispostave: Koprivnica, Đurđevac, Križevci)
- Krapina (ispostave: Krapina, Klanjec, Pregrada, Zabok, Zlatar)
- Kutina (ispostave: Kutina, Ivanić-Grad, Novska)
- Osijek (ispostave: Osijek, Beli Manastir, Donji Miholjac, Đakovo, Našice, Valpovo)
- Pazin (ispostave: Pazin, Buje, Labin, Poreč, Rovinj)
- Požega (ispostave: Požega, Pakrac)
- Pula (ispostave: Pula, Vodnjan)
- Rijeka (ispostave: Rijeka, Cres, Crikvenica, Krk, Opatija, Rab)
- Sisak (ispostave: Sisak, Glina, Hrvatska Kostajnica, Petrinja)
- Slavonski Brod (ispostave: Slavonski Brod, Nova Gradiška)
- Split (ispostave: Split, Brač, Hvar, Imotski, Kaštela, Makarska, Omiš, Sinj, Solin, Trogir, Vis)
- Šibenik (ispostave: Šibenik, Drniš, Knin)
- Varaždin (ispostave: Varaždin, Ivanec, Ludbreg, Novi Marof)
- Velika Gorica (ispostave: Velika Gorica, Jastrebarsko, Samobor, Sveta Nedelja, Vrbovec, Zaprešić)
- Vinkovci (ispostave: Vinkovci, Županja)
- Virovitica (ispostave: Virovitica, Orahovica, Slatina)
- Vukovar (ispostave: Vukovar, Ilok)
- Zadar (ispostave: Zadar, Biograd na Moru, Pag)
- Zagreb (ispostave: Centar, Črnomerec, Dubrava, Maksimir, Novi Zagreb, Peščenica, Sesvete, Susedgrad, Trešnjevka, Trnje)

Na temelju katastarske općine, odredi koji je područni ured i ispostava nadležna.
Odjel je uvijek "Odjel za katastar nekretnina" osim ako vrsta posla sugerira drugačije.

Za svrhu:
- ZOG (Zakon o gradnji) = true ako vrsta posla uključuje: G2C, građevinska dozvola, uporabna dozvola, ili slično
- ZOPU (Zakon o prostornom uređenju) = true ako vrsta posla uključuje: G2A, lokacijska dozvola, lokacijska informacija, ili slično
- Ako niti jedan ne odgovara, označi oba kao false

Vrati ISKLJUČIVO JSON objekt bez dodatnog teksta.`;

    const userPrompt = `Podaci s kartice posla:
- Naslov: ${cardData.title || "N/A"}
- Katastarska općina: ${cardData.katastarska_opcina || "N/A"}
- Katastarska čestica: ${cardData.katastarska_cestica || "N/A"}
- Adresa čestice: ${cardData.adresa_cestice || "N/A"}
- Poštanski broj: ${cardData.postanski_broj || "N/A"}
- Vrsta posla: ${(cardData.vrsta_posla || []).join(", ") || "N/A"}
- Naručitelj ime: ${cardData.narucitelj_ime || "N/A"}
- Naručitelj adresa: ${cardData.narucitelj_adresa || "N/A"}
- Naručitelj OIB: ${cardData.narucitelj_oib || "N/A"}
- Kontakt: ${cardData.kontakt || "N/A"}
- Opis: ${cardData.description || "N/A"}

Podaci tvrtke (podnositelj zahtjeva):
- Naziv: ${companyData?.company_name || "N/A"}
- Adresa: ${companyData?.address || "N/A"}
- OIB: ${companyData?.oib || "N/A"}
- Telefon: ${companyData?.phone || "N/A"}
- Email: ${companyData?.email || "N/A"}

Popuni zahtjev i vrati JSON.`;

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-3-mini-fast",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "fill_zahtjev",
              description: "Popuni polja zahtjeva za izdavanje potvrde",
              parameters: {
                type: "object",
                properties: {
                  ime: { type: "string", description: "Ime i prezime / naziv pravne osobe podnositelja" },
                  adresa: { type: "string", description: "Ulica, poštanski broj i mjesto podnositelja" },
                  kontakt: { type: "string", description: "Kontakt telefon podnositelja" },
                  oib: { type: "string", description: "OIB podnositelja" },
                  email: { type: "string", description: "Email podnositelja" },
                  podrucniUred: { type: "string", description: "Područni ured za katastar (npr. Zagreb, Split...)" },
                  odjel: { type: "string", description: "Odjel (npr. Odjel za katastar nekretnina)" },
                  ispostava: { type: "string", description: "Ispostava (npr. Centar, Sesvete...)" },
                  katastarskiOpcina: { type: "string", description: "Katastarska općina" },
                  katastarskeCestice: { type: "string", description: "Katastarske čestice" },
                  svrhaZOG: { type: "boolean", description: "Svrha - Zakon o gradnji" },
                  svrhaZOPU: { type: "boolean", description: "Svrha - Zakon o prostornom uređenju" },
                  napomena: { type: "string", description: "Napomena (opcionalno)" },
                  podnositelj: { type: "string", description: "Potpis - ime podnositelja zahtjeva" },
                },
                required: [
                  "ime", "adresa", "kontakt", "oib", "email",
                  "podrucniUred", "odjel", "ispostava",
                  "katastarskiOpcina", "katastarskeCestice",
                  "svrhaZOG", "svrhaZOPU", "napomena", "podnositelj",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "fill_zahtjev" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Grok API error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI servis nije dostupan" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI nije vratio strukturirani odgovor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zahtjevData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ zahtjevData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fill-zahtjev error:", err);
    return new Response(JSON.stringify({ error: err.message || "Interna greška" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
