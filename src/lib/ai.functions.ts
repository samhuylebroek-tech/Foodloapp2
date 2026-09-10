import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function askAI(messages: unknown[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is niet beschikbaar.");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "google/gemini-3.7-flash", messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI-fout: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
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

export const importRecipeFromUrl = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data }): Promise<ImportedRecipe> => {
    const page = await fetch(data.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KookApp/1.0)" },
    });
    if (!page.ok) throw new Error("De pagina kon niet worden opgehaald.");
    const html = await page.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 15000);

    const raw = await askAI([
      {
        role: "system",
        content: `Je haalt recepten uit webpagina's. Neem de bereiding letterlijk en volledig over zoals ze op de pagina staat, zonder stappen weg te laten. ${STAP_REGELS} Antwoord uitsluitend met JSON in het Nederlands, zonder uitleg. ${JSON_FORMAAT}`,
      },
      { role: "user", content: `Bron: ${data.url}\n\nTekst:\n${text}` },
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
      image_url: vindAfbeelding(html, data.url),
      is_suggestie: false,
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
