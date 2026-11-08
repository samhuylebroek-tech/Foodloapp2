/**
 * Veilig externe pagina's en foto's ophalen (SSRF-bescherming).
 *
 * - Enkel http/https, standaardpoorten, geen gebruikersnaam/wachtwoord in de link.
 * - Geen interne of lokale adressen, ook niet via een omleiding (redirect).
 * - Altijd een tijdslimiet en een maximale grootte, zodat één trage of enorme
 *   pagina de server niet kan ophouden of laten vollopen.
 *
 * Puur en zonder serverafhankelijkheden, zodat het eenvoudig te testen is.
 */

export const STANDAARD_TIMEOUT_MS = 10_000;
export const STANDAARD_MAX_OMLEIDINGEN = 5;

/** Diensten die elke naam naar een gekozen (ook intern) IP laten wijzen. */
const DNS_WILDCARD_DIENSTEN = [
  "nip.io",
  "sslip.io",
  "xip.io",
  "localtest.me",
  "lvh.me",
  "traefik.me",
];

const INTERNE_ACHTERVOEGSELS = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".lan",
  ".intranet",
  ".corp",
];

export class OnveiligeUrlFout extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnveiligeUrlFout";
  }
}

export class TeGrootFout extends Error {
  constructor(message = "Het bestand is te groot.") {
    super(message);
    this.name = "TeGrootFout";
  }
}

/** Normaliseert een hostnaam: kleine letters, zonder haken en afsluitende punten. */
export function normaliseerHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
}

/** True als de host lokaal, privé of anders niet publiek bereikbaar hoort te zijn. */
export function isInterneHost(ruweHost: string): boolean {
  const host = normaliseerHost(ruweHost);
  if (!host) return true;
  if (host === "localhost") return true;
  // IPv6-letterlijk (de URL-parser zet ook ::ffff:127.0.0.1 om naar hex-vorm).
  if (host.includes(":")) return true;
  // IPv4-letterlijk; de URL-parser zet decimale/hex/octale vormen om naar a.b.c.d.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return true;
  // Eén label zonder punt (bv. "intranet", "metadata") is nooit een publieke site.
  if (!host.includes(".")) return true;
  if (INTERNE_ACHTERVOEGSELS.some((a) => host.endsWith(a))) return true;
  if (DNS_WILDCARD_DIENSTEN.some((d) => host === d || host.endsWith(`.${d}`))) return true;
  return false;
}

/**
 * Controleert een link en geeft de genormaliseerde vorm terug.
 * Gooit een fout met een gewone, begrijpelijke boodschap als de link niet mag.
 */
export function veiligeUrl(ruw: string): string {
  let u: URL;
  try {
    u = new URL(ruw);
  } catch {
    throw new OnveiligeUrlFout("Dit is geen geldige weblink.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new OnveiligeUrlFout("Alleen gewone weblinks werken.");
  }
  if (u.username || u.password) throw new OnveiligeUrlFout("Deze link kunnen we niet openen.");
  if (u.port && u.port !== "80" && u.port !== "443") {
    throw new OnveiligeUrlFout("Deze link kunnen we niet openen.");
  }
  if (isInterneHost(u.hostname)) throw new OnveiligeUrlFout("Deze link kunnen we niet openen.");
  return u.toString();
}

export type VeiligOphalenOpties = {
  timeoutMs?: number;
  maxOmleidingen?: number;
  /** Voor tests: een andere fetch-implementatie. */
  fetchImpl?: typeof fetch;
};

/**
 * Haalt een externe link op en volgt omleidingen handmatig, waarbij elke
 * tussenstap opnieuw op veiligheid wordt gecontroleerd.
 * Geeft het eindantwoord en de uiteindelijke URL terug.
 */
export async function veiligOphalen(
  url: string,
  init: Omit<RequestInit, "redirect" | "signal"> = {},
  opties: VeiligOphalenOpties = {},
): Promise<{ res: Response; url: string }> {
  const doFetch = opties.fetchImpl ?? fetch;
  const maxOmleidingen = opties.maxOmleidingen ?? STANDAARD_MAX_OMLEIDINGEN;
  const signal = AbortSignal.timeout(opties.timeoutMs ?? STANDAARD_TIMEOUT_MS);

  let huidig = veiligeUrl(url);
  for (let stap = 0; stap <= maxOmleidingen; stap++) {
    const res = await doFetch(huidig, { ...init, redirect: "manual", signal });
    const locatie = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && locatie) {
      // Body van de omleiding niet nodig; vrijgeven.
      await res.body?.cancel().catch(() => undefined);
      let volgende: string;
      try {
        volgende = new URL(locatie, huidig).toString();
      } catch {
        throw new OnveiligeUrlFout("Deze link kunnen we niet openen.");
      }
      huidig = veiligeUrl(volgende);
      continue;
    }
    return { res, url: huidig };
  }
  throw new OnveiligeUrlFout("Deze link stuurt ons te vaak door.");
}

/**
 * Leest de inhoud van een antwoord tot hoogstens `maxBytes`.
 * Stopt meteen (zonder alles in het geheugen te laden) als het te groot wordt.
 */
export async function leesBeperkt(res: Response, maxBytes: number): Promise<Uint8Array> {
  const lengte = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(lengte) && lengte > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    throw new TeGrootFout();
  }
  if (!res.body) return new Uint8Array(await res.arrayBuffer());

  const lezer = res.body.getReader();
  const delen: Uint8Array[] = [];
  let totaal = 0;
  while (true) {
    const { done, value } = await lezer.read();
    if (done) break;
    totaal += value.byteLength;
    if (totaal > maxBytes) {
      await lezer.cancel().catch(() => undefined);
      throw new TeGrootFout();
    }
    delen.push(value);
  }
  const uit = new Uint8Array(totaal);
  let pos = 0;
  for (const deel of delen) {
    uit.set(deel, pos);
    pos += deel.byteLength;
  }
  return uit;
}

/** Zoals `leesBeperkt`, maar als tekst (UTF-8). */
export async function leesTekstBeperkt(res: Response, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await leesBeperkt(res, maxBytes));
}
