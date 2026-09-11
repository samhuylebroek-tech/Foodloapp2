import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MODEL = "google/gemini-3.7-flash";

async function logAi(kind: string, ok: boolean, ms: number, error?: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_events").insert({
      kind,
      model: MODEL,
      ok,
      duration_ms: Math.round(ms),
      error: error ? error.slice(0, 500) : null,
    });
  } catch {
    // meting mag nooit de app breken
  }
}

async function askAI(messages: unknown[], kind = "chat") {
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
      body: JSON.stringify({ model: MODEL, messages }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI-fout: ${res.status} ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    await logAi(kind, true, Date.now() - start);
    return json.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    await logAi(kind, false, Date.now() - start, e instanceof Error ? e.message : String(e));
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
};

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

const SOCIAAL = /(instagram\.com|instagr\.am|tiktok\.com|facebook\.com|fb\.watch|pinterest\.)/i;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function metaTekst(html: string, sleutels: string[]): string {
  const stukken: string[] = [];
  for (const sleutel of sleutels) {
    const patronen = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${sleutel}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${sleutel}["']`, "i"),
    ];
    for (const p of patronen) {
      const m = html.match(p);
      if (m?.[1]) {
        stukken.push(m[1]);
        break;
      }
    }
  }
  return stukken
    .join("\n")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\\n/g, "\n")
    .trim();
}

async function haalPagina(url: string, ua: string) {
  return fetch(url, {
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "nl,en;q=0.8",
    },
    redirect: "follow",
  });
}

export const importRecipeFromUrl = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data }): Promise<ImportedRecipe> => {
    const isSociaal = SOCIAAL.test(data.url);

    let page = await haalPagina(data.url, isSociaal ? "facebookexternalhit/1.1" : BROWSER_UA);
    if (!page.ok && isSociaal) page = await haalPagina(data.url, BROWSER_UA);
    if (!page.ok) throw new Error("De pagina kon niet worden opgehaald.");
    const html = await page.text();

    const platteTekst = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const meta = metaTekst(html, [
      "og:title",
      "og:description",
      "description",
      "twitter:description",
    ]);
    const bijschrift = (() => {
      const m =
        html.match(/"edge_media_to_caption"[\s\S]{0,200}?"text"\s*:\s*"([\s\S]{20,4000}?)"/) ??
        html.match(/"caption"\s*:\s*"([\s\S]{20,4000}?)"/) ??
        html.match(/"desc"\s*:\s*"([\s\S]{20,4000}?)"/);
      return m?.[1]
        ? m[1]
            .replace(/\\n/g, "\n")
            .replace(/\\u([\dA-Fa-f]{4})/g, (_x, c) => String.fromCharCode(parseInt(c, 16)))
            .replace(/\\"/g, '"')
        : "";
    })();

    const bron = isSociaal
      ? [meta, bijschrift].filter(Boolean).join("\n\n").slice(0, 15000)
      : platteTekst.slice(0, 15000);

    if (bron.replace(/\s/g, "").length < 60) {
      throw new Error(
        isSociaal
          ? "Deze Instagram- of TikTok-link is afgeschermd. Kopieer de tekst onder het filmpje en plak die bij 'AI tekst', of neem een schermafbeelding en gebruik 'AI foto'."
          : "Op deze pagina vonden we geen receptinformatie.",
      );
    }

    const raw = await askAI([
      {
        role: "system",
        content: isSociaal
          ? `Je maakt een recept op basis van een bijschrift van Instagram, TikTok of Facebook. Gebruik alles wat in het bijschrift staat en vul ontbrekende hoeveelheden, tijden en stappen aan met een verstandige, realistische schatting, zodat het recept altijd volledig is. ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`
          : `Je haalt recepten uit webpagina's. Neem de bereiding letterlijk en volledig over zoals ze op de pagina staat, zonder stappen weg te laten. ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`,
      },
      { role: "user", content: `Bron: ${data.url}\n\nTekst:\n${bron}` },
    ]);

    const parsed = parseJson<Partial<ImportedRecipe>>(raw, {});
    if (!parsed.title) {
      throw new Error(
        "We konden hier geen recept uit halen. Probeer de tekst te plakken of een schermafbeelding te kiezen.",
      );
    }
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
      image_url: vindAfbeelding(html, data.url),
      is_suggestie: isSociaal,
    };
  });

export const recipeFromPhoto = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ imageDataUrl: z.string().min(20) }).parse(data))
  .handler(async ({ data }): Promise<ImportedRecipe> => {
    const raw = await askAI([
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
    ]);

    const parsed = parseJson<Partial<ImportedRecipe>>(raw, {});
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
      is_suggestie: true,
    };
  });

export const importRecipeFromScreenshot = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ imageDataUrl: z.string().min(20) }).parse(data))
  .handler(async ({ data }): Promise<ImportedRecipe> => {
    const raw = await askAI([
      {
        role: "system",
        content: `Je krijgt een schermafbeelding van een recept, bijvoorbeeld van Instagram, TikTok, WhatsApp of een website. Lees alle zichtbare tekst en zet die om in een gestructureerd recept. Neem de ingrediënten en de bereiding zo letterlijk mogelijk over; vul enkel aan wat echt ontbreekt. ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Haal het recept uit deze schermafbeelding." },
          { type: "image_url", image_url: { url: data.imageDataUrl } },
        ],
      },
    ]);

    const parsed = parseJson<Partial<ImportedRecipe>>(raw, {});
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
    };
  });

export const importRecipeFromText = createServerFn({ method: "POST" })

  .inputValidator((data) => z.object({ text: z.string().min(5).max(20000) }).parse(data))
  .handler(async ({ data }): Promise<ImportedRecipe> => {
    const raw = await askAI([
      {
        role: "system",
        content:
          `Je zet losse tekst (bijvoorbeeld een bericht, een Instagram-tekst of een handgeschreven receptje) om in een gestructureerd recept. Vul ontbrekende gegevens aan met een verstandige schatting. ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`,
      },
      { role: "user", content: data.text },
    ]);

    const parsed = parseJson<Partial<ImportedRecipe>>(raw, {});
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
    };
  });

export const recognizeIngredients = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ imageDataUrl: z.string().min(20) }).parse(data))
  .handler(async ({ data }): Promise<string[]> => {
    const raw = await askAI([
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
    ]);
    const list = parseJson<string[]>(raw, []);
    return Array.isArray(list) ? list.filter((x) => typeof x === "string").slice(0, 25) : [];
  });

export type InternetSuggestie = {
  title: string;
  keuken: string;
  waarom: string;
  minuten: number;
  category: string;
};

export const ontdekSuggesties = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        bekend: z.array(z.string()).max(200).default([]),
        favorieten: z.array(z.string()).max(50).default([]),
        sfeer: z.string().max(200).default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<InternetSuggestie[]> => {
    const maand = new Date().toLocaleDateString("nl-BE", { month: "long" });
    const heeftSmaak = data.favorieten.length > 0;
    const raw = await askAI([
      {
        role: "system",
        content:
          'Je bent een kookredacteur die populaire gerechten van het internet kent (foodblogs, Instagram, TikTok, klassieke keukens uit de hele wereld). Je stelt gerechten voor die iemand nog niet kent, maar die passen bij de smaak van de gebruiker: kijk vooral naar de gerechten die hij hoog beoordeelde (keuken, smaken, ingrediënten, type gerecht). Antwoord uitsluitend met een JSON-array van 6 objecten: [{"title":"","keuken":"","waarom":"","minuten":30,"category":"hoofdgerecht"}]. "waarom" is één korte, wervende zin in het Nederlands die verwijst naar waarom het bij zijn smaak past. Geen uitleg buiten de JSON.',
      },
      {
        role: "user",
        content: `Maand: ${maand}. ${data.sfeer ? `Weer/sfeer: ${data.sfeer}.` : ""}
Deze gerechten gaf de gebruiker een hoge score (belangrijkste bron voor je keuze):
${heeftSmaak ? data.favorieten.join("\n") : "(nog geen beoordelingen – kies dan gewoon populaire, toegankelijke gerechten)"}

Deze gerechten heeft hij al, stel iets anders voor:
${data.bekend.slice(0, 120).join(", ") || "(nog geen)"}`,
      },
    ]);

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
  });

export const gerechtFoto = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ titel: z.string().min(2).max(120) }).parse(data))
  .handler(async ({ data }): Promise<string | null> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return null;
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
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return null;
    const mime = b64.startsWith("/9j/") ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${b64}`;
  });
