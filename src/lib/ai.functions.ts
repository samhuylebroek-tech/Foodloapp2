import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { metCredits, type AiMeter } from "@/lib/credits.server";
import {
  adapterVoor,
  detecteerPlatform,
  haalPagina,
  isSociaal,
  leesReceptKop,
  logImport,
  PLATFORM_LABEL,
  velden,
  type Platform,
} from "@/lib/import.server";


const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MODEL = "google/gemini-3.8-flash";
/** Model voor het zoeken naar gerechten en het uitschrijven ervan. */
const ZOEK_MODEL = "openai/gpt-6-astra";

async function logAi(kind: string, ok: boolean, ms: number, error?: string, model = MODEL) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_events").insert({
      kind,
      model,
      ok,
      duration_ms: Math.round(ms),
      error: error ? error.slice(0, 500) : null,
    });
  } catch {
    // meting mag nooit de app breken
  }
}

async function askAI(messages: unknown[], kind = "chat", meter?: AiMeter, model = MODEL) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is niet beschikbaar.");
  const start = Date.now();
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        // Stukje per stukje antwoorden: zo blijft de verbinding levend en
        // lopen lange antwoorden niet meer vast op een tijdslimiet.
        stream: true,
        stream_options: { include_usage: true },
        ...(model === ZOEK_MODEL ? { reasoning_effort: "low" } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Het is even te druk. Probeer het zo opnieuw.");
      if (res.status === 402)
        throw new Error("De slimme functies zijn tijdelijk niet beschikbaar. Probeer het later opnieuw.");
      throw new Error(`AI-fout: ${res.status} ${text.slice(0, 200)}`);
    }
    if (!res.body) throw new Error("AI gaf geen antwoord.");

    const lezer = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let antwoord = "";
    while (true) {
      const { done, value } = await lezer.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const regels = buffer.split("\n");
      buffer = regels.pop() ?? "";
      for (const regel of regels) {
        const rij = regel.trim();
        if (!rij.startsWith("data:")) continue;
        const inhoud = rij.slice(5).trim();
        if (!inhoud || inhoud === "[DONE]") continue;
        try {
          const brok = JSON.parse(inhoud) as {
            choices?: { delta?: { content?: string } }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          antwoord += brok.choices?.[0]?.delta?.content ?? "";
          if (meter && brok.usage) {
            meter.tokens_in += brok.usage.prompt_tokens ?? 0;
            meter.tokens_out += brok.usage.completion_tokens ?? 0;
          }
        } catch {
          // een half stukje negeren we; het volgende blok vult aan
        }
      }
    }
    // De meting mag het antwoord niet vertragen: ze loopt op de achtergrond.
    void logAi(kind, true, Date.now() - start, undefined, model);
    return antwoord;
  } catch (e) {
    void logAi(kind, false, Date.now() - start, e instanceof Error ? e.message : String(e), model);
    throw e;
  }
}

function parseJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) return fallback;
  try {
    return JSON.parse(cleaned.slice(start)) as T;
  } catch {
    return fallback;
  }
}

export type ImportedRecipe = {
  title: string;
  description: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  category: string;
  difficulty: string;
  tags: string[];
  ingredients: { name: string; quantity: number | null; unit: string }[];
  instructions: string[];
  image_url?: string | null;
  is_suggestie?: boolean;
  bron?: string;
  source_url?: string | null;
  reeds_bekend?: { id: string; title: string } | null;
  platform?: Platform;
  ontbrekend?: string[];
  /** Gevuld wanneer de link niets bruikbaars opleverde: vriendelijke uitleg. */
  fout?: string;

};


function vulAan(parsed: Partial<ImportedRecipe>, extra: Partial<ImportedRecipe> = {}): ImportedRecipe {
  return {
    title: parsed.title ?? "",
    description: parsed.description ?? "",
    servings: Number(parsed.servings) || 4,
    prep_minutes: Number(parsed.prep_minutes) || 0,
    cook_minutes: Number(parsed.cook_minutes) || 0,
    category: parsed.category ?? "hoofdgerecht",
    difficulty: parsed.difficulty ?? "makkelijk",
    tags: parsed.tags ?? [],
    ingredients: parsed.ingredients ?? [],
    instructions: parsed.instructions ?? [],
    ...extra,
  };
}

const STAP_REGELS =
  "De bereiding is het belangrijkste: geef volledige, duidelijke stappen in gewone taal, elke stap één handeling, met tijden en temperaturen waar dat kan. Minstens 4 stappen.";

const JSON_FORMAAT =
  'Formaat: {"title":string,"description":string,"servings":number,"prep_minutes":number,"cook_minutes":number,"category":string,"difficulty":"makkelijk"|"gemiddeld"|"moeilijk","tags":string[],"ingredients":[{"name":string,"quantity":number|null,"unit":string}],"instructions":string[]}';

function vindAfbeelding(html: string, paginaUrl: string): string | null {
  const patronen = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /"image"\s*:\s*"(https?:\/\/[^"]+)"/i,
    /"image"\s*:\s*\[\s*"(https?:\/\/[^"]+)"/i,
    /"image"\s*:\s*\{[^}]*"url"\s*:\s*"(https?:\/\/[^"]+)"/i,
  ];
  for (const p of patronen) {
    const m = html.match(p);
    if (m?.[1]) {
      try {
        return new URL(m[1].replace(/&amp;/g, "&"), paginaUrl).toString();
      } catch {
        // volgende patroon
      }
    }
  }
  return null;
}




/** Verwijdert tracking en maakt van dezelfde pagina altijd dezelfde sleutel. */
export function canoniekeUrl(ruw: string): string {
  try {
    const u = new URL(ruw);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol");
    const weg = [
      /^utm_/i,
      /^fbclid$/i,
      /^gclid$/i,
      /^igshid$/i,
      /^igsh$/i,
      /^si$/i,
      /^feature$/i,
      /^ref$/i,
      /^ref_src$/i,
      /^_nc_/i,
    ];
    for (const sleutel of [...u.searchParams.keys()]) {
      if (weg.some((p) => p.test(sleutel))) u.searchParams.delete(sleutel);
    }
    u.hash = "";
    u.hostname = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return ruw.trim();
  }
}

/** Blokkeert interne adressen (SSRF-bescherming). */
function veiligeUrl(ruw: string) {
  const u = new URL(ruw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Alleen gewone weblinks werken.");
  const host = u.hostname.toLowerCase();
  const intern =
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.includes(":");
  if (intern) throw new Error("Deze link kunnen we niet openen.");
  return u.toString();
}

function minuten(iso: unknown): number {
  if (typeof iso === "number") return iso;
  if (typeof iso !== "string") return 0;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) {
    const n = Number(iso.replace(/\D/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return (Number(m[1] ?? 0) * 1440) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

function tekstVan(v: unknown): string {
  if (typeof v === "string") return v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (v && typeof v === "object" && "text" in (v as Record<string, unknown>))
    return tekstVan((v as Record<string, unknown>)["text"]);
  if (v && typeof v === "object" && "name" in (v as Record<string, unknown>))
    return tekstVan((v as Record<string, unknown>)["name"]);
  return "";
}

function stappenVan(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string")
    return v
      .split(/\n+|(?<=\.)\s{2,}/)
      .map((s) => tekstVan(s))
      .filter(Boolean);
  if (Array.isArray(v)) {
    const uit: string[] = [];
    for (const item of v) {
      const obj = item as Record<string, unknown> | null;
      if (obj && obj["@type"] === "HowToSection" && Array.isArray(obj["itemListElement"])) {
        uit.push(...stappenVan(obj["itemListElement"]));
      } else {
        const t = tekstVan(item);
        if (t) uit.push(t);
      }
    }
    return uit;
  }
  return [];
}

function splitsIngredient(regel: string): { name: string; quantity: number | null; unit: string } {
  const m = regel
    .trim()
    .match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*([a-zA-Zµ%.]*)\s+(.*)$/);
  if (!m) return { name: regel.trim(), quantity: null, unit: "" };
  const aantal = Number((m[1] ?? "").replace(",", "."));
  const eenheid = (m[2] ?? "").toLowerCase();
  const rest = m[3] ?? "";
  const gekendeEenheden = /^(g|gr|gram|kg|ml|cl|dl|l|el|tl|kop|kopjes?|stuk|stuks|snuf|teen|tenen|blik|pak)$/;
  if (!Number.isFinite(aantal)) return { name: regel.trim(), quantity: null, unit: "" };
  if (eenheid && !gekendeEenheden.test(eenheid)) {
    return { name: `${eenheid} ${rest}`.trim(), quantity: aantal, unit: "" };
  }
  return { name: rest.trim(), quantity: aantal, unit: eenheid };
}

/** Stap 1: volledig recept uit Schema.org/JSON-LD halen. Kost 0 credits. */
export function leesStructuurData(html: string, paginaUrl: string): ImportedRecipe | null {
  const blokken = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  const kandidaten: Record<string, unknown>[] = [];
  for (const blok of blokken) {
    try {
      const json = JSON.parse((blok[1] ?? "").trim());
      const lijst = Array.isArray(json) ? json : [json];
      for (const item of lijst) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;
        const graaf = obj["@graph"];
        if (Array.isArray(graaf)) kandidaten.push(...(graaf as Record<string, unknown>[]));
        kandidaten.push(obj);
      }
    } catch {
      // ongeldige JSON-LD negeren
    }
  }
  const recept = kandidaten.find((o) => {
    const type = o["@type"];
    return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
  });
  if (!recept) return null;

  const ingredienten = (Array.isArray(recept["recipeIngredient"]) ? recept["recipeIngredient"] : [])
    .map((r) => tekstVan(r))
    .filter(Boolean)
    .map(splitsIngredient);
  const stappen = stappenVan(recept["recipeInstructions"]);
  if (ingredienten.length < 2 || stappen.length < 2) return null;

  const opbrengst = recept["recipeYield"];
  const personen = Number(String(Array.isArray(opbrengst) ? opbrengst[0] : (opbrengst ?? "")).replace(/\D/g, ""));

  const tags = [
    ...(Array.isArray(recept["keywords"]) ? recept["keywords"].map(String) : []),
    ...(typeof recept["keywords"] === "string" ? recept["keywords"].split(",") : []),
  ]
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    title: tekstVan(recept["name"]) || "",
    description: tekstVan(recept["description"]).slice(0, 600),
    servings: personen > 0 && personen < 50 ? personen : 4,
    prep_minutes: minuten(recept["prepTime"]),
    cook_minutes: minuten(recept["cookTime"]) || minuten(recept["totalTime"]),
    category: tekstVan(recept["recipeCategory"]) || "hoofdgerecht",
    difficulty: "makkelijk",
    tags,
    ingredients: ingredienten,
    instructions: stappen,
    image_url: vindAfbeelding(html, paginaUrl),
    bron: "paginagegevens",
    source_url: paginaUrl,

  };
}

export const importRecipeFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data, context }): Promise<ImportedRecipe> => {
    const start = Date.now();
    const url = veiligeUrl(canoniekeUrl(data.url));
    const platform = detecteerPlatform(url);
    const sociaal = isSociaal(platform);
    const adapter = adapterVoor(platform);
    const basis = {
      user_id: context.userId,
      source_url: data.url.slice(0, 900),
      canonical_url: url,
      platform,
    };

    // Een link die niets bruikbaars oplevert is geen crash: we geven een
    // vriendelijke uitleg terug, zodat het scherm gewoon blijft staan.
    const geenRecept = (bericht: string): ImportedRecipe => ({
      ...vulAan({}),
      title: "",
      servings: 0,
      platform,
      source_url: url,
      fout: bericht,
    });

    const mislukt = async (code: string, bericht: string) => {
      await logImport({
        ...basis,
        status: "mislukt",
        extraction_method: null,
        ai_used: false,
        credits_used: 0,
        cache_hit: false,
        duration_ms: Date.now() - start,
        fields_found: [],
        fields_missing: [],
        error_code: code,
        error_message: bericht,
      });
      return geenRecept(bericht);
    };

    // Stap 0 — deze link al eens ingelezen? Dan geen nieuwe AI-kost.
    const { data: bestaand } = await context.supabase
      .from("recipes")
      .select("id, title")
      .eq("user_id", context.userId)
      .eq("source_url", url)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (bestaand) {
      await logImport({
        ...basis,
        status: "dubbel",
        extraction_method: "dubbeldetectie",
        ai_used: false,
        credits_used: 0,
        cache_hit: true,
        duration_ms: Date.now() - start,
        fields_found: [],
        fields_missing: [],
      });
      return {
        ...geenRecept(`Je hebt dit recept al: "${bestaand.title}". Open het bij je recepten.`),
        reeds_bekend: { id: bestaand.id, title: bestaand.title },
      };
    }

    let html: string;
    try {
      html = await haalPagina(url, adapter.agents);
    } catch (e) {
      return await mislukt("ophalen", e instanceof Error ? e.message : "De pagina kon niet worden opgehaald.");
    }

    // Stap 1 — gestructureerd recept op de pagina: geen AI, geen credits.
    const structuur = leesStructuurData(html, url);
    if (structuur?.title) {
      const v = velden(structuur);
      await logImport({
        ...basis,
        status: v.ontbrekend.length > 2 ? "gedeeltelijk" : "klaar",
        extraction_method: "structuurdata",
        ai_used: false,
        credits_used: 0,
        cache_hit: false,
        duration_ms: Date.now() - start,
        fields_found: v.gevonden,
        fields_missing: v.ontbrekend,
      });
      return { ...structuur, platform, ontbrekend: v.ontbrekend };
    }

    // Stap 2 — goedkope tekst van het platform (bijschrift, beschrijving, metadata).
    const { tekst, methode } = adapter.tekstUit(html);
    const bron = tekst.slice(0, 15000);

    if (bron.replace(/\s/g, "").length < 60) {
      return await mislukt(
        "te_weinig_info",
        sociaal
          ? `Deze ${PLATFORM_LABEL[platform]}-link is afgeschermd. Kopieer de tekst onder het bericht en plak die bij "AI tekst", of neem een schermafbeelding en gebruik "AI foto".`
          : "Op deze pagina vonden we geen receptinformatie.",
      );
    }


    // Stap 3 — pas nu AI. Zelfde bron = cachetreffer = 0 credits.
    let uitkomst: { resultaat: ImportedRecipe; credits: number; cache: boolean };
    try {
      uitkomst = await metCredits(
        { userId: context.userId, feature: "import_url", cacheSleutel: `${url}|${bron.slice(0, 4000)}`, model: MODEL },
        async (meter) => {
          const raw = await askAI(
            [
              {
                role: "system",
                content: sociaal
                  ? `Je maakt een recept op basis van een bericht van ${PLATFORM_LABEL[platform]}. Gebruik uitsluitend informatie die in de bron staat. Verzin geen hoeveelheden, tijden of stappen: wat ontbreekt laat je leeg (null of lege lijst). ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`
                  : `Je haalt recepten uit webpagina's. Neem de bereiding letterlijk en volledig over zoals ze op de pagina staat. Verzin niets: ontbrekende hoeveelheden, tijden of stappen laat je leeg (null of lege lijst). ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`,
              },
              { role: "user", content: `Bron: ${url}\n\nTekst:\n${bron}` },
            ],
            "import_url",
           meter,
        );
          const parsed = parseJson<Partial<ImportedRecipe>>(raw, {});
          if (!parsed.title) {
            throw new Error(
              "We konden hier geen recept uit halen. Probeer de tekst te plakken of een schermafbeelding te kiezen.",
            );
          }
          return vulAan(parsed, {
            image_url: vindAfbeelding(html, url),
            is_suggestie: false,
            bron: methode,
            source_url: url,
          });
        },
      );
    } catch (e) {
      throw await mislukt("ai", e instanceof Error ? e.message : "Inlezen lukte niet.");
    }

    const v = velden(uitkomst.resultaat);
    await logImport({
      ...basis,
      status: v.ontbrekend.length > 2 ? "gedeeltelijk" : "klaar",
      extraction_method: methode,
      ai_used: !uitkomst.cache,
      credits_used: uitkomst.credits,
      cache_hit: uitkomst.cache,
      duration_ms: Date.now() - start,
      fields_found: v.gevonden,
      fields_missing: v.ontbrekend,
    });
    return { ...uitkomst.resultaat, platform, ontbrekend: v.ontbrekend };
  });


export const recipeFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ imageDataUrl: z.string().min(20) }).parse(data))
  .handler(async ({ data, context }): Promise<ImportedRecipe> => {
    const { resultaat } = await metCredits(
      {
        userId: context.userId,
        feature: "gerecht_foto",
        cacheSleutel: data.imageDataUrl.slice(0, 5000),
        model: MODEL,
      },
      async (meter) => {
        const raw = await askAI(
          [
            {
              role: "system",
              content: `Je bekijkt een foto van een klaargemaakt gerecht en bedenkt een volledig, realistisch recept om het na te maken. Je mag inventief zijn: schat de ingrediënten en hoeveelheden in. Zet in "description" duidelijk dat dit een voorstel is op basis van de foto. ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Welk gerecht is dit en hoe maak ik het?" },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          "gerecht_foto",
         meter,
        );
        return vulAan(parseJson<Partial<ImportedRecipe>>(raw, {}), { is_suggestie: true, bron: "foto" });
      },
    );
    return resultaat;
  });

export const importRecipeFromScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ imageDataUrl: z.string().min(20) }).parse(data))
  .handler(async ({ data, context }): Promise<ImportedRecipe> => {
    const { resultaat } = await metCredits(
      {
        userId: context.userId,
        feature: "import_foto",
        cacheSleutel: data.imageDataUrl.slice(0, 5000),
        model: MODEL,
      },
      async (meter) => {
        const raw = await askAI(
          [
            {
              role: "system",
              content: `Je krijgt een schermafbeelding van een recept, bijvoorbeeld van Instagram, TikTok, WhatsApp of een website. Lees alle zichtbare tekst en zet die om in een gestructureerd recept. Neem de ingrediënten en de bereiding zo letterlijk mogelijk over; verzin geen hoeveelheden die er niet staan. ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Haal het recept uit deze schermafbeelding." },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          "import_foto",
         meter,
        );
        return vulAan(parseJson<Partial<ImportedRecipe>>(raw, {}), { bron: "schermafbeelding" });
      },
    );
    return resultaat;
  });

export const importRecipeFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ text: z.string().min(5).max(20000) }).parse(data))
  .handler(async ({ data, context }): Promise<ImportedRecipe> => {
    const { resultaat } = await metCredits(
      { userId: context.userId, feature: "import_tekst", cacheSleutel: data.text, model: MODEL },
      async (meter) => {
        const raw = await askAI(
          [
            {
              role: "system",
              content: `Je zet losse tekst (bijvoorbeeld een bericht, een Instagram-tekst of een handgeschreven receptje) om in een gestructureerd recept. Vul ontbrekende gegevens aan met een verstandige schatting. ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`,
            },
            { role: "user", content: data.text },
          ],
          "import_tekst",
         meter,
        );
        return vulAan(parseJson<Partial<ImportedRecipe>>(raw, {}), { bron: "tekst" });
      },
    );
    return resultaat;
  });

export const recognizeIngredients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ imageDataUrl: z.string().min(20) }).parse(data))
  .handler(async ({ data, context }): Promise<string[]> => {
    const { resultaat } = await metCredits(
      {
        userId: context.userId,
        feature: "ingredienten_foto",
        cacheSleutel: data.imageDataUrl.slice(0, 5000),
        model: MODEL,
      },
      async (meter) => {
        const raw = await askAI(
          [
            {
              role: "system",
              content:
                'Je herkent voedingsmiddelen op foto\'s. Antwoord uitsluitend met een JSON-array van Nederlandse ingrediëntnamen, bijvoorbeeld ["ui","tomaat"]. Geen uitleg.',
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Welke ingrediënten zie je op deze foto?" },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          "ingredienten_foto",
         meter,
        );
        const list = parseJson<string[]>(raw, []);
        return Array.isArray(list) ? list.filter((x) => typeof x === "string").slice(0, 25) : [];
      },
    );
    return resultaat;
  });

export type InternetSuggestie = {
  title: string;
  keuken: string;
  waarom: string;
  minuten: number;
  category: string;
};

export const ontdekSuggesties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bekend: z.array(z.string()).max(200).default([]),
        favorieten: z.array(z.string()).max(50).default([]),
        sfeer: z.string().max(200).default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<InternetSuggestie[]> => {
    const maand = new Date().toLocaleDateString("nl-BE", { month: "long" });
    const heeftSmaak = data.favorieten.length > 0;
    const { resultaat } = await metCredits(
      {
        userId: context.userId,
        feature: "suggesties",
        cacheSleutel: `${maand}|${data.sfeer}|${data.favorieten.slice(0, 15).join(",")}|${data.bekend.slice(0, 40).join(",")}`,
        model: MODEL,
      },
      async (meter) => {
        const raw = await askAI(
          [
            {
              role: "system",
              content:
                'Je bent een kookredacteur die populaire gerechten van het internet kent. Je stelt gerechten voor die iemand nog niet kent, maar die passen bij de gerechten die hij hoog beoordeelde. Antwoord uitsluitend met een JSON-array van 6 objecten: [{"title":"","keuken":"","waarom":"","minuten":30,"category":"hoofdgerecht"}]. "waarom" is één korte zin in het Nederlands.',
            },
            {
              role: "user",
              content: `Maand: ${maand}. ${data.sfeer ? `Weer/sfeer: ${data.sfeer}.` : ""}
Hoog beoordeeld:
${heeftSmaak ? data.favorieten.join("\n") : "(nog geen beoordelingen)"}

Heeft hij al:
${data.bekend.slice(0, 120).join(", ") || "(nog geen)"}`,
            },
          ],
          "suggesties",
         meter,
        );
        const list = parseJson<Partial<InternetSuggestie>[]>(raw, []);
        if (!Array.isArray(list)) return [];
        return list
          .filter((s) => typeof s?.title === "string" && s.title.trim())
          .slice(0, 6)
          .map((s) => ({
            title: String(s.title).trim(),
            keuken: String(s.keuken ?? "").trim(),
            waarom: String(s.waarom ?? "").trim(),
            minuten: Number(s.minuten) || 30,
            category: String(s.category ?? "hoofdgerecht"),
          }));
      },
    );
    return resultaat;
  });

export const gerechtFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ titel: z.string().min(2).max(120) }).parse(data))
  .handler(async ({ data, context }): Promise<string | null> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return null;
    try {
      const { resultaat } = await metCredits(
        {
          userId: context.userId,
          feature: "foto_maken",
          cacheSleutel: data.titel,
          model: "google/gemini-3.1-flash-lite-image",
        },
        async (meter) => {
          meter.beelden += 1;
          const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-lite-image",
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `Een smakelijke, realistische foodfoto van het gerecht "${data.titel}", mooi opgediend op een bord, natuurlijk daglicht, bovenaanzicht, warme keukensfeer. Geen tekst of letters in beeld.`,
                    },
                  ],
                },
              ],
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
            }),
          });
          if (!res.ok) throw new Error(`foto ${res.status}`);
          const json = (await res.json()) as { data?: { b64_json?: string }[] };
          const b64 = json.data?.[0]?.b64_json;
          if (!b64) throw new Error("geen foto");
          const mime = b64.startsWith("/9j/") ? "image/jpeg" : "image/png";
          return `data:${mime};base64,${b64}`;
        },
      );
      return resultaat;
    } catch {
      // een sfeerfoto is nooit verplicht
      return null;
    }
  });

export type GerechtVoorstel = {
  title: string;
  omschrijving: string;
  minuten: number;
};

/** Zoekt varianten van een gerecht op naam, zodat je de juiste kan kiezen. */
export const gerechtVoorstellen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ term: z.string().min(2).max(120) }).parse(data))
  .handler(async ({ data, context }): Promise<GerechtVoorstel[]> => {
    const term = data.term.trim();
    const { resultaat } = await metCredits(
      {
        userId: context.userId,
        feature: "suggesties",
        cacheSleutel: `zoek|${term.toLowerCase()}`,
        model: ZOEK_MODEL,
      },
      async (meter) => {
        const raw = await askAI(
          [
            {
              role: "system",
              content:
                'Je kent klassieke en moderne gerechten. De gebruiker typt een gerechtnaam en jij geeft 5 concrete varianten van dat gerecht. Antwoord uitsluitend met een JSON-array: [{"title":"","omschrijving":"","minuten":30}]. "title" is de naam van de variant in het Nederlands, "omschrijving" is één korte zin met wat het onderscheidt. Geen uitleg buiten de JSON.',
            },
            { role: "user", content: term },
          ],
          "gerecht_zoeken",
          meter,
          ZOEK_MODEL,
        );
        const list = parseJson<Partial<GerechtVoorstel>[]>(raw, []);
        if (!Array.isArray(list)) return [];
        return list
          .filter((s) => typeof s?.title === "string" && s.title.trim())
          .slice(0, 5)
          .map((s) => ({
            title: String(s.title).trim(),
            omschrijving: String(s.omschrijving ?? "").trim(),
            minuten: Number(s.minuten) || 30,
          }));
      },
    );
    return resultaat;
  });

/** Schrijft een volledig recept uit op basis van enkel de naam van een gerecht. */
export const receptVanNaam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ titel: z.string().min(2).max(160), hint: z.string().max(300).default("") }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ImportedRecipe> => {
    const { resultaat } = await metCredits(
      {
        userId: context.userId,
        feature: "import_tekst",
        cacheSleutel: `naam|${data.titel.toLowerCase()}|${data.hint}`,
        model: ZOEK_MODEL,
      },
      async (meter) => {
        const raw = await askAI(
          [
            {
              role: "system",
              content: `Je schrijft een volledig, realistisch recept voor het gerecht dat de gebruiker noemt. Gebruik gangbare hoeveelheden voor 4 personen. ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`,
            },
            { role: "user", content: `${data.titel}${data.hint ? `\n${data.hint}` : ""}` },
          ],
          "gerecht_zoeken_recept",
          meter,
          ZOEK_MODEL,
        );
        return vulAan(parseJson<Partial<ImportedRecipe>>(raw, {}), { bron: "tekst" });
      },
    );
    return resultaat;
  });

// ---------------- echte receptpagina's zoeken op het web ----------------

export type WebResultaat = {
  titel: string;
  url: string;
  site: string;
  fragment: string;
  aantalIngredienten?: number;
  minuten?: number | null;
};

/** Sites die zelden een volledig recept bevatten of niet te lezen zijn. */
const ZOEK_RUIS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "pinterest.com",
  "pinterest.be",
  "x.com",
  "twitter.com",
  "reddit.com",
  "amazon.",
  "bol.com",
  "wikipedia.org",
];

/** Bekende receptsites krijgen voorrang in de volgorde. */
const ZOEK_VOORKEUR = [
  "dagelijksekost.vrt.be",
  "dagelijksekost.een.be",
  "vtm.be",
  "njam.tv",
  "libelle-lekker.be",
  "15gram.be",
  "colruyt.be",
  "delhaize.be",
  "ah.nl",
  "allerhande.nl",
  "leukerecepten.nl",
  "24kitchen.nl",
  "smulweb.nl",
  "jeroenmeus.be",
  "lekkervanbijons.be",
  "solomijnrecepten.be",
];

function ontdubbelTekst(ruw: string): string {
  return ruw
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Zet een DuckDuckGo-omleiding om naar de echte pagina-URL. */
function echteUrl(href: string): string | null {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const door = u.searchParams.get("uddg");
    const doel = door ? decodeURIComponent(door) : u.toString();
    if (!/^https?:\/\//i.test(doel)) return null;
    return doel;
  } catch {
    return null;
  }
}

type ZoekTaal = "nl" | "en" | "fr" | "de";

/** Per taal: het woord waarmee we zoeken, de taalkop en de domeinen die voorgaan. */
const TAAL_ZOEK: Record<ZoekTaal, { woord: string; kop: string; domeinen: string[] }> = {
  nl: { woord: "recept", kop: "nl-BE,nl;q=0.9,en;q=0.5", domeinen: [".be", ".nl"] },
  fr: { woord: "recette", kop: "fr-BE,fr;q=0.9,en;q=0.5", domeinen: [".fr", ".be"] },
  de: { woord: "rezept", kop: "de-DE,de;q=0.9,en;q=0.5", domeinen: [".de", ".at"] },
  en: { woord: "recipe", kop: "en-GB,en;q=0.9", domeinen: [".uk", ".com"] },
};

function scoreVan(host: string, taal: ZoekTaal): number {
  const { domeinen } = TAAL_ZOEK[taal];
  if (taal === "nl" && ZOEK_VOORKEUR.some((h) => host === h || host.endsWith(`.${h}`))) return 3;
  if (domeinen[0] && host.endsWith(domeinen[0])) return 2;
  if (domeinen[1] && host.endsWith(domeinen[1])) return 1;
  return 0;
}

/**
 * Zoekt echte receptpagina's op het web. Kost geen credits: we lezen enkel
 * de zoekresultaten. Pas als je een resultaat kiest, loopt het door de
 * gewone import (structuurdata eerst, AI enkel als het echt nodig is).
 */
export const zoekReceptenOpWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        term: z.string().min(3).max(120),
        taal: z.enum(["nl", "en", "fr", "de"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<WebResultaat[]> => {
    const term = data.term.trim();
    const taal: ZoekTaal = data.taal ?? "nl";
    const sleutel = `web|${taal}|${term.toLowerCase()}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. eerst de cache: hetzelfde zoekwoord binnen 24 u hoeft niet opnieuw
    try {
      const { data: cache } = await supabaseAdmin
        .from("ai_cache")
        .select("result, expires_at, hits")
        .eq("input_hash", sleutel)
        .maybeSingle();
      if (cache?.result && (!cache.expires_at || new Date(cache.expires_at) > new Date())) {
        void supabaseAdmin
          .from("ai_cache")
          .update({ hits: (cache.hits ?? 0) + 1 })
          .eq("input_hash", sleutel);
        return cache.result as WebResultaat[];
      }
    } catch {
      // cache is nooit verplicht
    }

    // 2. zoeken via sleutelloze zoekpagina's (tweede bron als de eerste hapert)
    const kop = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": TAAL_ZOEK[taal].kop,
    };
    const vraag = encodeURIComponent(`${term} ${TAAL_ZOEK[taal].woord}`);
    const bronnen = [
      `https://search.brave.com/search?q=${vraag}`,
      `https://html.duckduckgo.com/html/?q=${vraag}`,
    ];

    const gezien = new Set<string>();
    const rijen: (WebResultaat & { score: number })[] = [];

    // Beide zoekbronnen tegelijk bevragen; een trage bron houdt niets op.
    const paginas = await Promise.all(
      bronnen.map(async (bron) => {
        try {
          const res = await fetch(bron, { headers: kop, signal: AbortSignal.timeout(6000) });
          return res.ok ? await res.text() : "";
        } catch {
          return "";
        }
      }),
    );

    for (const html of paginas) {
      if (rijen.length >= 12) break;
      if (!html) continue;

      const links = [
        ...html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{0,6000}?)<\/a>/gi),
      ];

      for (const link of links) {
        const doel = echteUrl((link[1] ?? "").replace(/&amp;/g, "&"));
        if (!doel) continue;

        let net = "";
        try {
          net = veiligeUrl(canoniekeUrl(doel));
        } catch {
          continue;
        }
        const host = new URL(net).hostname.replace(/^www\./i, "").toLowerCase();
        if (ZOEK_RUIS.some((r) => host.includes(r))) continue;
        if (/brave\.|duckduckgo\.|hackerone\.|mozilla\.|search\./.test(host)) continue;
        if (gezien.has(net) || gezien.has(host)) continue;

        const tekst = ontdubbelTekst(link[2] ?? "").replace(/\u203a/g, "›");
        if (tekst.length < 8) continue;
        // breadcrumbs ("site › pad › Titel") wegfilteren
        const delen = tekst.split("›").map((d) => d.trim()).filter(Boolean);
        let kern = delen.length > 1 ? delen[delen.length - 1]! : tekst;
        // losse url-stukjes en bereidingstijden vooraan weghalen
        kern = kern
          .replace(/^[a-z0-9][a-z0-9-]{4,}(\.html?)?\s+/i, "")
          .replace(/^(\d+\s*(u|uur|min|m)[.,]?\s*)+/i, "")
          .trim();
        // Titel = eerste zin/regel, netjes op een woordgrens afgekapt.
        const eersteZin = kern.split(/(?<=[.!?])\s+|\s+[-–|]\s+/)[0]!.trim();
        let titel = eersteZin.length >= 6 ? eersteZin : kern;
        if (titel.length > 140) {
          const kort = titel.slice(0, 140);
          const spatie = kort.lastIndexOf(" ");
          titel = `${(spatie > 60 ? kort.slice(0, spatie) : kort).trim()}…`;
        }
        if (titel.length < 6 || /^https?:/i.test(titel)) continue;

        gezien.add(net);
        gezien.add(host);
        const rest = kern.slice(eersteZin.length).trim();
        const fragment = (rest.length > 10 ? rest : tekst).slice(0, 180);
        rijen.push({ titel, url: net, site: host, fragment, score: scoreVan(host, taal) });
        if (rijen.length >= 12) break;
      }
    }
    console.log("[zoek]", term, "paginas", paginas.map((p) => p.length), "rijen", rijen.length);
    if (rijen.length === 0) return [];


    // 3. elke kandidaat nakijken: staat er écht een recept op de pagina?
    const kandidaten = rijen
      .map((r, i) => ({ ...r, volgorde: i }))
      .sort((a, b) => b.score - a.score || a.volgorde - b.volgorde)
      .slice(0, 8);

    async function keur(r: (typeof kandidaten)[number]): Promise<WebResultaat | null> {
      const kop = await leesReceptKop(r.url);
      if (!kop) return null;
      const stukjes = [
        `${kop.aantalIngredienten} ingrediënten`,
        kop.minuten ? `${kop.minuten} min` : "",
      ].filter(Boolean);
      return {
        titel: kop.titel,
        url: r.url,
        site: r.site,
        fragment: stukjes.join(" · "),
        aantalIngredienten: kop.aantalIngredienten,
        minuten: kop.minuten,
      } satisfies WebResultaat;
    }

    // Eerst de vijf beste; enkel als er te weinig overblijven kijken we verder.
    const eerste = (await Promise.all(kandidaten.slice(0, 5).map(keur))).filter(
      (r): r is WebResultaat => r !== null,
    );
    let gekeurd = eerste;
    if (eerste.length < 3 && kandidaten.length > 5) {
      const extra = (await Promise.all(kandidaten.slice(5).map(keur))).filter(
        (r): r is WebResultaat => r !== null,
      );
      gekeurd = [...eerste, ...extra];
    }

    console.log("[zoek] gekeurd", gekeurd.length, "van", kandidaten.length);
    const resultaat: WebResultaat[] = gekeurd.slice(0, 5);
    if (resultaat.length === 0) return [];

    // 4. bewaren voor 24 u
    try {
      await supabaseAdmin.from("ai_cache").upsert({
        input_hash: sleutel,
        feature: "web_zoeken",
        model: "geen",
        prompt_version: 1,
        result: resultaat,
        hits: 0,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch {
      // cache is nooit verplicht
    }

    return resultaat;
  });

// ---------------- weekmenu laten voorstellen ----------------

export type WeekmenuIdee = {
  title: string;
  soort: "vlees" | "vis" | "vega";
  minuten: number;
  waarom: string;
};

/** Nieuwe ideeën voor een weekmenu, buiten je eigen recepten. */
export const weekmenuIdeeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        aantal: z.number().int().min(1).max(7),
        wensen: z.string().max(300).default(""),
        vermijd: z.string().max(300).default(""),
        maxMinuten: z.number().int().min(0).max(240).default(0),
        bekend: z.array(z.string()).max(100).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<WeekmenuIdee[]> => {
    const maand = new Date().toLocaleDateString("nl-BE", { month: "long" });
    const { resultaat } = await metCredits(
      {
        userId: context.userId,
        feature: "suggesties",
        cacheSleutel: `weekmenu|${maand}|${data.aantal}|${data.wensen}|${data.vermijd}|${data.maxMinuten}`,
        model: ZOEK_MODEL,
      },
      async (meter) => {
        const raw = await askAI(
          [
            {
              role: "system",
              content:
                'Je stelt een gevarieerd weekmenu samen met alledaagse gerechten die mensen thuis koken. Antwoord uitsluitend met een JSON-array: [{"title":"","soort":"vlees|vis|vega","minuten":30,"waarom":""}]. "title" is een concrete gerechtnaam in het Nederlands, "waarom" is één korte zin.',
            },
            {
              role: "user",
              content: `Maand: ${maand}. Geef ${data.aantal} verschillende gerechten.
${data.wensen ? `Verdeling deze week: ${data.wensen}.` : ""}
${data.maxMinuten ? `Elk gerecht is klaar in maximaal ${data.maxMinuten} minuten.` : ""}
${data.vermijd ? `Vermijd: ${data.vermijd}.` : ""}
Niet herhalen: ${data.bekend.slice(0, 60).join(", ") || "(niets)"}`,
            },
          ],
          "weekmenu_ideeen",
          meter,
          ZOEK_MODEL,
        );
        const list = parseJson<Partial<WeekmenuIdee>[]>(raw, []);
        if (!Array.isArray(list)) return [];
        return list
          .filter((s) => typeof s?.title === "string" && s.title.trim())
          .slice(0, data.aantal)
          .map((s) => ({
            title: String(s.title).trim(),
            soort: (["vlees", "vis", "vega"] as const).includes(s.soort as "vlees")
              ? (s.soort as "vlees" | "vis" | "vega")
              : "vega",
            minuten: Number(s.minuten) || 30,
            waarom: String(s.waarom ?? "").trim(),
          }));
      },
    );
    return resultaat;
  });

/**
 * Haalt een gevonden receptfoto op als data-URL, zodat de app ze in de eigen
 * opslag kan bewaren. Externe links verdwijnen of worden geblokkeerd; een
 * eigen kopie blijft werken.
 */
export const haalAfbeelding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().min(8) }).parse(data))
  .handler(async ({ data }) => {
    const url = veiligeUrl(data.url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Foodlo/1.0)", Accept: "image/*" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error("De foto kon niet worden opgehaald.");
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!/^image\/(jpeg|jpg|png|webp|avif|gif)$/.test(type)) {
      throw new Error("Dit is geen gewone afbeelding.");
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.byteLength || buf.byteLength > 8_000_000) throw new Error("De foto is te groot.");
    let binair = "";
    for (let i = 0; i < buf.length; i += 8192) {
      binair += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    return { dataUrl: `data:${type};base64,${btoa(binair)}` };
  });
