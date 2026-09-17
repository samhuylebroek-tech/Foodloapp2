/**
 * Eén importpijplijn voor links (server-only).
 *
 * Volgorde: platform herkennen -> pagina ophalen -> gestructureerde gegevens (gratis)
 * -> metadata/bijschrift -> pas dan AI. Elke poging wordt gelogd voor het Control Center.
 */

export type Platform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "pinterest"
  | "website";

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  pinterest: "Pinterest",
  website: "website",
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const BOT_UA = "facebookexternalhit/1.1";

export function detecteerPlatform(url: string): Platform {
  const h = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (/instagr(am\.com|\.am)$|\.instagram\.com$/.test(h) || h.includes("instagram")) return "instagram";
  if (h.includes("tiktok")) return "tiktok";
  if (h.includes("youtube") || h.includes("youtu.be")) return "youtube";
  if (h.includes("facebook") || h.includes("fb.watch")) return "facebook";
  if (h.includes("pinterest") || h.includes("pin.it")) return "pinterest";
  return "website";
}

export function isSociaal(platform: Platform) {
  return platform !== "website";
}

function ontsnap(tekst: string) {
  return tekst
    .replace(/\\n/g, "\n")
    .replace(/\\u([\dA-Fa-f]{4})/g, (_x, c: string) => String.fromCharCode(parseInt(c, 16)))
    .replace(/\\"/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#039;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Standaardteksten van platforms zijn geen recept: die gooien we weg. */
const RUIS = [
  /bekijk je favoriete video/i,
  /enjoy the videos and music you love/i,
  /geniet van de video's en muziek/i,
  /^watch on tiktok$/i,
  /log in to instagram/i,
  /ai-voorwaarden|AI Terms/i,
  /interacties met ai|interactions with ais/i,

];

/** Haalt herhalingen en platformruis uit de tekst. */
export function schoon(tekst: string): string {
  const gezien = new Set<string>();
  const regels: string[] = [];
  for (const regel of tekst.split("\n")) {
    const r = regel.trim();
    if (!r) continue;
    if (RUIS.some((p) => p.test(r))) continue;
    const sleutel = r.toLowerCase();
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    regels.push(r);
  }
  return regels.join("\n").trim();
}

export function metaTekst(html: string, sleutels: string[]): string {
  const stukken: string[] = [];
  for (const sleutel of sleutels) {
    const patronen = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${sleutel}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${sleutel}["']`, "i"),
    ];
    for (const p of patronen) {
      const m = html.match(p);
      if (m?.[1]) {
        stukken.push(m[1]);
        break;
      }
    }
  }
  return schoon(ontsnap(stukken.join("\n")));
}

/** Leest een JSON-stringwaarde uit ruwe HTML, met respect voor escapes. */
function jsonWaarde(html: string, sleutel: string): string {
  const merk = `"${sleutel}":"`;
  const i = html.indexOf(merk);
  if (i < 0) return "";
  let j = i + merk.length;
  let uit = "";
  while (j < html.length && uit.length < 8000) {
    const c = html[j];
    if (c === "\\") {
      uit += html.slice(j, j + 2);
      j += 2;
      continue;
    }
    if (c === '"') break;
    uit += c;
    j += 1;
  }
  return ontsnap(uit).trim();
}

function bijschrift(html: string): string {
  const kandidaten = ["text", "caption", "desc", "description"];
  for (const sleutel of kandidaten) {
    const waarde = schoon(jsonWaarde(html, sleutel));
    if (waarde.length > 40) return waarde;
  }
  return "";
}

function youtubeBeschrijving(html: string): string {
  return schoon(jsonWaarde(html, "shortDescription"));
}


function platteTekst(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Adapter = {
  platform: Platform;
  /** Volgorde van user-agents waarmee we de pagina proberen op te halen. */
  agents: string[];
  /** Haalt de bruikbare tekst uit de pagina, zo goedkoop mogelijk. */
  tekstUit: (html: string) => { tekst: string; methode: string };
};

const META_SLEUTELS = ["og:title", "og:description", "description", "twitter:description"];

const SOCIALE_ADAPTER = (platform: Platform): Adapter => ({
  platform,
  agents: [BOT_UA, BROWSER_UA],
  tekstUit: (html) => {
    const meta = metaTekst(html, META_SLEUTELS);
    const cap = bijschrift(html);
    const tekst = schoon([meta, cap].filter(Boolean).join("\n\n"));
    return { tekst, methode: cap ? "bijschrift" : "metadata" };
  },
});

export function adapterVoor(platform: Platform): Adapter {
  if (platform === "youtube") {
    return {
      platform,
      agents: [BROWSER_UA, BOT_UA],
      tekstUit: (html) => {
        const beschrijving = youtubeBeschrijving(html);
        const meta = metaTekst(html, META_SLEUTELS);
        const tekst = schoon([meta, beschrijving].filter(Boolean).join("\n\n"));
        return { tekst, methode: beschrijving ? "videobeschrijving" : "metadata" };
      },
    };
  }

  if (platform === "website") {
    return {
      platform,
      agents: [BROWSER_UA, BOT_UA],
      tekstUit: (html) => {
        const tekst = platteTekst(html);
        return {
          tekst: tekst.length > 200 ? tekst : [metaTekst(html, META_SLEUTELS), tekst].join("\n\n"),
          methode: "paginatekst",
        };
      },
    };
  }
  return SOCIALE_ADAPTER(platform);
}

export async function haalPagina(url: string, agents: string[]): Promise<string> {
  let laatste = "";
  for (const ua of agents) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "nl,en;q=0.8",
        },
        redirect: "follow",
      });
      if (res.ok) return await res.text();
      laatste = `status ${res.status}`;
    } catch (e) {
      laatste = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`De pagina kon niet worden opgehaald (${laatste}).`);
}

export type ImportLog = {
  user_id: string | null;
  source_url: string | null;
  canonical_url: string | null;
  platform: Platform;
  status: "klaar" | "gedeeltelijk" | "dubbel" | "mislukt";
  extraction_method: string | null;
  ai_used: boolean;
  credits_used: number;
  cache_hit: boolean;
  duration_ms: number;
  fields_found: string[];
  fields_missing: string[];
  error_code?: string | null;
  error_message?: string | null;
};

export async function logImport(row: ImportLog) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("recipe_import_jobs").insert({
      ...row,
      error_message: row.error_message ? row.error_message.slice(0, 400) : null,
    });
  } catch {
    // loggen mag de import nooit breken
  }
}

/** Welke velden vonden we, en welke ontbreken? Basis voor een gedeeltelijke import. */
export function velden(recept: {
  title?: string;
  ingredients?: unknown[];
  instructions?: unknown[];
  servings?: number;
  prep_minutes?: number;
  cook_minutes?: number;
  image_url?: string | null;
}) {
  const checks: [string, boolean][] = [
    ["titel", Boolean(recept.title?.trim())],
    ["ingrediënten", (recept.ingredients?.length ?? 0) > 0],
    ["bereiding", (recept.instructions?.length ?? 0) > 0],
    ["personen", Number(recept.servings) > 0],
    ["tijd", Number(recept.prep_minutes) + Number(recept.cook_minutes) > 0],
    ["foto", Boolean(recept.image_url)],
  ];
  return {
    gevonden: checks.filter(([, ok]) => ok).map(([n]) => n),
    ontbrekend: checks.filter(([, ok]) => !ok).map(([n]) => n),
  };
}

// ---------------- snelle receptcontrole voor zoekresultaten ----------------

export type ReceptKop = {
  titel: string;
  aantalIngredienten: number;
  minuten: number | null;
};

function jsonLdBlokken(html: string): unknown[] {
  const uit: unknown[] = [];
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of matches) {
    const ruw = (m[1] ?? "").trim().replace(/<!--[\s\S]*?-->/g, "");
    try {
      uit.push(JSON.parse(ruw));
    } catch {
      // kapotte json-ld negeren we gewoon
    }
  }
  return uit;
}

function isRecept(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const t = (node as Record<string, unknown>)["@type"];
  const lijst = Array.isArray(t) ? t : [t];
  return lijst.some((x) => typeof x === "string" && x.toLowerCase() === "recipe");
}

function zoekRecept(node: unknown, diep = 0): Record<string, unknown> | null {
  if (diep > 4 || !node) return null;
  if (Array.isArray(node)) {
    for (const k of node) {
      const r = zoekRecept(k, diep + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  if (isRecept(node)) return node as Record<string, unknown>;
  const obj = node as Record<string, unknown>;
  for (const sleutel of ["@graph", "mainEntity", "itemListElement", "mainEntityOfPage"]) {
    const r = zoekRecept(obj[sleutel], diep + 1);
    if (r) return r;
  }
  return null;
}

/** ISO-duur (PT1H20M) naar minuten. */
function duurNaarMinuten(waarde: unknown): number | null {
  if (typeof waarde !== "string") return null;
  const m = waarde.match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const uren = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const totaal = uren * 60 + min;
  return totaal > 0 ? totaal : null;
}

function tekstVan(waarde: unknown): string {
  if (typeof waarde === "string") return waarde.trim();
  if (Array.isArray(waarde)) return tekstVan(waarde[0]);
  if (waarde && typeof waarde === "object") {
    const o = waarde as Record<string, unknown>;
    return tekstVan(o["name"] ?? o["@value"] ?? o["headline"]);
  }
  return "";
}

/**
 * Controleert of een pagina écht een recept bevat en geeft de juiste titel terug.
 * Gebruikt enkel gestructureerde gegevens (JSON-LD/microdata) — geen AI, geen credits.
 */
export async function leesReceptKop(url: string): Promise<ReceptKop | null> {
  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "nl,en;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }
  if (!html) return null;

  for (const blok of jsonLdBlokken(html)) {
    const recept = zoekRecept(blok);
    if (!recept) continue;
    const titel = tekstVan(recept["name"]);
    const ingr = recept["recipeIngredient"] ?? recept["ingredients"];
    const aantal = Array.isArray(ingr)
      ? ingr.filter((x) => tekstVan(x).length > 1).length
      : typeof ingr === "string" && ingr.trim()
        ? 1
        : 0;
    if (!titel || aantal < 2) continue;
    const minuten =
      duurNaarMinuten(recept["totalTime"]) ??
      (duurNaarMinuten(recept["cookTime"]) ?? 0) + (duurNaarMinuten(recept["prepTime"]) ?? 0) ||
      null;
    return {
      titel: titel.slice(0, 160),
      aantalIngredienten: aantal,
      minuten: minuten && minuten > 0 ? minuten : null,
    };
  }

  // microdata als reserve
  if (/itemtype=["']https?:\/\/schema\.org\/Recipe["']/i.test(html)) {
    const ingrs = [...html.matchAll(/itemprop=["']recipeIngredient["'][^>]*>([^<]{2,120})</gi)];
    const naam = html.match(/itemprop=["']name["'][^>]*>([^<]{2,160})</i)?.[1];
    if (naam && ingrs.length >= 2) {
      return { titel: schoon(naam).slice(0, 160), aantalIngredienten: ingrs.length, minuten: null };
    }
  }
  return null;
}
