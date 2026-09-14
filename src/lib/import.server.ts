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
  return ontsnap(stukken.join("\n")).trim();
}

function bijschrift(html: string): string {
  const m =
    html.match(/"edge_media_to_caption"[\s\S]{0,200}?"text"\s*:\s*"([\s\S]{20,4000}?)"/) ??
    html.match(/"caption"\s*:\s*"([\s\S]{20,4000}?)"/) ??
    html.match(/"desc"\s*:\s*"([\s\S]{20,4000}?)"/);
  return m?.[1] ? ontsnap(m[1]) : "";
}

function youtubeBeschrijving(html: string): string {
  const m =
    html.match(/"shortDescription"\s*:\s*"([\s\S]{20,8000}?)"/) ??
    html.match(/"attributedDescription"[\s\S]{0,120}?"content"\s*:\s*"([\s\S]{20,8000}?)"/);
  return m?.[1] ? ontsnap(m[1]) : "";
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
    const tekst = [meta, cap].filter(Boolean).join("\n\n");
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
        const tekst = [meta, beschrijving].filter(Boolean).join("\n\n");
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
