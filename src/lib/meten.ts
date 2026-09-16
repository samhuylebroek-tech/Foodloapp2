import { supabase } from "@/integrations/supabase/client";

/**
 * Eén centrale meetlaag voor het Control Center.
 *
 * - Elke gebeurtenis hangt aan een echte sessie (user_sessions).
 * - Bij elke gebeurtenis gaan toestel, platform, browser en app-versie mee.
 * - Geen persoonlijke inhoud: enkel ids, korte labels en technische velden.
 * - Meten mag de app nooit hinderen: alles faalt stil.
 */

export const APP_VERSIE = (import.meta.env["VITE_APP_VERSION"] as string | undefined) ?? "web-2026.09";

// ---------------- gebeurtenissen ----------------

export const GEBEURTENISSEN = [
  // authenticatie
  "auth.signup",
  "auth.login",
  "auth.logout",
  "auth.wachtwoord_reset",
  "sessie.start",
  "sessie.einde",
  "app.open",
  "pagina",
  // recepten
  "recept.bekeken",
  "recept.aangemaakt",
  "recept.aangepast",
  "recept.verwijderd",
  "recept.geimporteerd",
  "recept.import_gestart",
  "recept.import_mislukt",
  "recept.favoriet",
  "recept.favoriet_af",
  "recept.gedeeld",
  "recept.gezocht",
  // koken
  "kookmodus.gestart",
  "kookmodus.stap",
  "kookmodus.klaar",
  "timer.gestart",
  "timer.klaar",
  // weekmenu
  "weekmenu.bekeken",
  "weekmenu.aangepast",
  "weekmenu.gerecht_toegevoegd",
  "weekmenu.gerecht_verwijderd",
  // boodschappen
  "boodschappen.bekeken",
  "boodschappen.lijst_aangemaakt",
  "boodschappen.toegevoegd",
  "boodschappen.afgevinkt",
  // voorraad
  "voorraad.bekeken",
  "voorraad.aangepast",
  // AI
  "ai.gebruikt",
  "ai.gestart",
  "ai.klaar",
  "ai.mislukt",
  // klantenkaarten
  "kaart.toegevoegd",
  "kaart.getoond",
  "kaart.gescand",
  // sociaal
  "vrienden.uitnodiging",
  "vrienden.aanvaard",
  "gezin.gedeeld",
  // instellingen en meldingen
  "melding.aangetikt",
  "melding.instelling",
  "voorkeur.aangepast",
] as const;

export type Gebeurtenis = (typeof GEBEURTENISSEN)[number];

export const GEBEURTENIS_LABEL: Record<string, string> = {
  "auth.signup": "Account aangemaakt",
  "auth.login": "Aangemeld",
  "auth.logout": "Afgemeld",
  "auth.wachtwoord_reset": "Wachtwoord opnieuw ingesteld",
  "sessie.start": "Sessie gestart",
  "sessie.einde": "Sessie beëindigd",
  "app.open": "App geopend",
  pagina: "Pagina geopend",
  "recept.bekeken": "Recept geopend",
  "recept.aangemaakt": "Recept aangemaakt",
  "recept.aangepast": "Recept aangepast",
  "recept.verwijderd": "Recept verwijderd",
  "recept.geimporteerd": "Recept geïmporteerd",
  "recept.import_gestart": "Import gestart",
  "recept.import_mislukt": "Import mislukt",
  "recept.favoriet": "Favoriet gezet",
  "recept.favoriet_af": "Favoriet verwijderd",
  "recept.gedeeld": "Recept gedeeld",
  "recept.gezocht": "Gezocht in recepten",
  "kookmodus.gestart": "Kookmodus gestart",
  "kookmodus.stap": "Kookstap afgerond",
  "kookmodus.klaar": "Koken afgerond",
  "timer.gestart": "Timer gestart",
  "timer.klaar": "Timer afgelopen",
  "weekmenu.bekeken": "Weekmenu bekeken",
  "weekmenu.aangepast": "Weekmenu aangepast",
  "weekmenu.gerecht_toegevoegd": "Gerecht ingepland",
  "weekmenu.gerecht_verwijderd": "Gerecht uit planning",
  "boodschappen.bekeken": "Boodschappenlijst geopend",
  "boodschappen.lijst_aangemaakt": "Boodschappenlijst aangemaakt",
  "boodschappen.toegevoegd": "Boodschap toegevoegd",
  "boodschappen.afgevinkt": "Boodschap afgevinkt",
  "voorraad.bekeken": "Voorraadkast bekeken",
  "voorraad.aangepast": "Voorraadkast aangepast",
  "ai.gebruikt": "Slimme functie gebruikt",
  "ai.gestart": "AI-actie gestart",
  "ai.klaar": "AI-actie klaar",
  "ai.mislukt": "AI-actie mislukt",
  "kaart.toegevoegd": "Klantenkaart toegevoegd",
  "kaart.getoond": "Klantenkaart getoond",
  "kaart.gescand": "Barcode gescand",
  "vrienden.uitnodiging": "Uitnodiging verstuurd",
  "vrienden.aanvaard": "Uitnodiging aanvaard",
  "gezin.gedeeld": "Inhoud gedeeld met gezin",
  "melding.aangetikt": "Melding aangetikt",
  "melding.instelling": "Meldinginstelling gewijzigd",
  "voorkeur.aangepast": "Voorkeur aangepast",
};

/** Waar hoort een gebeurtenis bij? Wordt gebruikt voor functiegebruik. */
export const FEATURES: Record<string, string> = {
  auth: "Account",
  sessie: "Account",
  app: "Account",
  pagina: "Navigatie",
  recept: "Recepten",
  kookmodus: "Kookstand",
  timer: "Kookstand",
  weekmenu: "Weekmenu",
  boodschappen: "Boodschappen",
  voorraad: "Voorraadkast",
  ai: "AI",
  kaart: "Klantenkaarten",
  vrienden: "Vrienden",
  gezin: "Gezin",
  melding: "Meldingen",
  voorkeur: "Instellingen",
};

export function featureVan(event: string) {
  const kop = event.split(".")[0] ?? "";
  return FEATURES[kop] ?? "Overig";
}

// ---------------- toestelinfo ----------------

export type Toestel = {
  device: string;
  platform: string;
  browser: string;
  app_version: string;
};

export function toestelInfo(): Toestel {
  if (typeof navigator === "undefined") {
    return { device: "", platform: "", browser: "", app_version: APP_VERSIE };
  }
  const ua = navigator.userAgent;
  const mobiel = /iPhone|iPad|iPod|Android/i.test(ua);
  const tablet = /iPad|Tablet/i.test(ua);
  const device = tablet ? "Tablet" : mobiel ? "Telefoon" : "Computer";
  const platform = /iPhone|iPad|iPod/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Mac OS X/i.test(ua)
        ? "macOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Onbekend";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Onbekend";
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
  return {
    device,
    platform,
    browser: standalone ? `${browser} (geïnstalleerd)` : browser,
    app_version: APP_VERSIE,
  };
}

// ---------------- sessies ----------------

const SESSIE_SLEUTEL = "foodlo_sessie";
const SESSIE_TIMEOUT_MS = 30 * 60_000;

type SessieCache = { id: string; user: string; laatst: number };

function leesCache(): SessieCache | null {
  try {
    const rauw = sessionStorage.getItem(SESSIE_SLEUTEL) ?? localStorage.getItem(SESSIE_SLEUTEL);
    if (!rauw) return null;
    const c = JSON.parse(rauw) as SessieCache;
    if (!c?.id || !c?.user) return null;
    return c;
  } catch {
    return null;
  }
}

function schrijfCache(c: SessieCache) {
  try {
    const rauw = JSON.stringify(c);
    sessionStorage.setItem(SESSIE_SLEUTEL, rauw);
    localStorage.setItem(SESSIE_SLEUTEL, rauw);
  } catch {
    /* stil */
  }
}

function wisCache() {
  try {
    sessionStorage.removeItem(SESSIE_SLEUTEL);
    localStorage.removeItem(SESSIE_SLEUTEL);
  } catch {
    /* stil */
  }
}

let bezig: Promise<string | null> | null = null;

/** Geeft de actieve sessie-id terug; start er één als er nog geen loopt. */
export async function huidigeSessie(userId: string): Promise<string | null> {
  const cache = leesCache();
  const nu = Date.now();
  if (cache && cache.user === userId && nu - cache.laatst < SESSIE_TIMEOUT_MS) {
    if (nu - cache.laatst > 60_000) {
      schrijfCache({ ...cache, laatst: nu });
      void supabase
        .from("user_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", cache.id);
    } else {
      schrijfCache({ ...cache, laatst: nu });
    }
    return cache.id;
  }

  if (cache && cache.user === userId) void sluitSessie(cache.id, true);
  if (bezig) return bezig;

  bezig = (async () => {
    try {
      const t = toestelInfo();
      const { data, error } = await supabase
        .from("user_sessions")
        .insert({
          user_id: userId,
          ...t,
          taal: typeof navigator !== "undefined" ? navigator.language : "",
          tijdzone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
        })
        .select("id")
        .single();
      if (error || !data) return null;
      schrijfCache({ id: data.id, user: userId, laatst: Date.now() });
      return data.id;
    } catch {
      return null;
    } finally {
      bezig = null;
    }
  })();

  return bezig;
}

export async function sluitSessie(sessionId?: string, geschat = false) {
  try {
    const id = sessionId ?? leesCache()?.id;
    if (!id) return;
    await supabase
      .from("user_sessions")
      .update({ ended_at: new Date().toISOString(), einde_geschat: geschat })
      .eq("id", id)
      .is("ended_at", null);
    if (!sessionId) wisCache();
  } catch {
    /* stil */
  }
}

/** Bij afmelden: sessie netjes afsluiten (geen schatting). */
export async function beeindigSessie() {
  const cache = leesCache();
  if (!cache) return;
  await meet("auth.logout");
  await sluitSessie(cache.id, false);
  wisCache();
}

// ---------------- meten ----------------

function pad(path?: string) {
  return path ?? (typeof window !== "undefined" ? window.location.pathname : null);
}

export type MeetOpties = {
  path?: string;
  detail?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  ok?: boolean;
  durationMs?: number;
};

/**
 * Centrale tracking-service. Oude vorm meet(event, path, detail) blijft werken,
 * nieuwe vorm meet(event, { entityType, entityId, ... }).
 */
export async function meet(
  event: string,
  pathOfOpties?: string | MeetOpties,
  detail?: Record<string, unknown>,
) {
  try {
    const o: MeetOpties =
      typeof pathOfOpties === "string" || pathOfOpties === undefined
        ? { path: pathOfOpties as string | undefined, detail }
        : pathOfOpties;

    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    const sessionId = await huidigeSessie(userId);
    const t = toestelInfo();

    await supabase.from("usage_events").insert({
      user_id: userId,
      event,
      path: pad(o.path),
      detail: (o.detail ?? {}) as never,
      session_id: sessionId,
      feature: featureVan(event),
      entity_type: o.entityType ?? null,
      entity_id: o.entityId ?? null,
      entity_label: o.entityLabel ?? null,
      ok: o.ok ?? null,
      duration_ms: o.durationMs ?? null,
      ...t,
    });
  } catch {
    /* meten mag de app nooit hinderen */
  }
}

/** Fout die een gebruiker effectief zag. Nooit tokens of wachtwoorden meesturen. */
export async function meldFout(opts: {
  soort?: string;
  feature?: string;
  bericht: string;
  detail?: string;
  path?: string;
}) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    const sessionId = await huidigeSessie(userId);
    const t = toestelInfo();
    await supabase.from("app_errors").insert({
      user_id: userId,
      soort: opts.soort ?? "runtime",
      feature: opts.feature ?? "",
      bericht: opts.bericht.slice(0, 500),
      detail: (opts.detail ?? "").slice(0, 4000),
      path: pad(opts.path),
      session_id: sessionId,
      ...t,
    });
  } catch {
    /* fouten melden mag nooit een tweede fout veroorzaken */
  }
}
