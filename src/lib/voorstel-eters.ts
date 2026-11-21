/**
 * Voorstellen (Vanavond, "Laat Foodlo kiezen") houden rekening met wie meeeet.
 *
 * - Een gerecht dat niet veilig is voor een mee-eter, stelt Foodlo niet voor.
 * - Kies je het toch zelf, dan staat er "Niet geschikt voor Lotte". De reden (welke allergie,
 *   welk dieet) staat er alleen bij als het lid die deelt, of als jij het lid bent of beheert
 *   (`magRedenZien` in gezin-veiligheid.ts).
 * - Leden waarvan je de gegevens niet mag lezen, krijgen het oordeel van de server (alleen
 *   waar/onwaar, voorstel 0010).
 *
 * Alles op het toestel; niets hiervan gaat naar een AI.
 */
import {
  oordeelVoorEters,
  type EterOordeel,
  type Ernst,
  type HuishoudenLid,
  type LidVoeding,
} from "@/lib/gezin-veiligheid";
import type { Gerecht } from "@/lib/veiligheid";

export type EtersContext = {
  eters: readonly HuishoudenLid[];
  voeding: ReadonlyMap<string, LidVoeding>;
  kijkerId: string | null | undefined;
  /** Serveroordeel per recept-id, per lid-id (alleen voor leden zonder leesbare gegevens). */
  server?: Readonly<Record<string, ReadonlyMap<string, boolean>>>;
};

/** Oordeel per mee-eter voor één gerecht. */
export function oordelenVoor(g: Gerecht & { id: string }, ctx: EtersContext): EterOordeel[] {
  if (!ctx.eters.length) return [];
  return oordeelVoorEters(g, ctx.eters, ctx.voeding, ctx.kijkerId, ctx.server?.[g.id]);
}

/** true als het gerecht voor minstens één mee-eter niet veilig is. */
export function nietGeschikt(g: Gerecht & { id: string }, ctx: EtersContext): boolean {
  return oordelenVoor(g, ctx).some((o) => o.veilig === false);
}

/** Namen opsommen: "Lotte", "Lotte en Gust", "Lotte, Gust en Jan". */
export function namenLijst(namen: readonly string[]): string {
  if (namen.length <= 1) return namen[0] ?? "";
  return `${namen.slice(0, -1).join(", ")} en ${namen[namen.length - 1]}`;
}

/**
 * "Niet geschikt voor Lotte" of, als de reden gedeeld is, "Niet geschikt voor Gust (past niet
 * bij vegetarisch)". Alleen een zachte botsing: "Liever niet voor Jan (Jan: liever geen kokos)".
 * Null als het voor iedereen past.
 */
export function etiketVoorEters(oordelen: readonly EterOordeel[]): string | null {
  const o = beoordeel(oordelen);
  if (!o.titel) return null;
  const groep = o.niveau === "hard" ? o.hard : o.zacht;
  const redenen = groep.filter((x) => x.reden).map((x) => `${x.naam}: ${x.reden}`);
  return redenen.length ? `${o.titel} (${redenen.join("; ")})` : o.titel;
}

// ---------- Eén oordeel voor een maaltijd (overal hetzelfde) ----------

export type Niveau = "hard" | "zacht" | "ok";

export type MaaltijdOordeel = {
  /** Het zwaarste: hard (niet geschikt) wint van zacht (liever niet). */
  niveau: Niveau;
  /** Niet veilig: allergie, intolerantie, strikt dieet (of het serveroordeel "niet veilig"). */
  hard: EterOordeel[];
  /** Liever niet: "liever niet"-termen, "weinig vlees". */
  zacht: EterOordeel[];
  /** Niet te controleren (geen ingrediënten) voor iemand met allergieën. */
  onbekend: EterOordeel[];
  /** "Niet geschikt voor Gust" / "Liever niet voor Jan" / null. */
  titel: string | null;
};

/** Vat de oordelen per eter samen. De redenen staan er alleen in als ze gedeeld mogen worden. */
export function beoordeel(oordelen: readonly EterOordeel[]): MaaltijdOordeel {
  const hard = oordelen.filter((o) => o.veilig === false);
  const zacht = oordelen.filter((o) => o.veilig !== false && o.ernst === "zacht");
  const onbekend = oordelen.filter((o) => o.veilig === null);
  const niveau: Niveau = hard.length ? "hard" : zacht.length ? "zacht" : "ok";
  const titel = hard.length
    ? `Niet geschikt voor ${namenLijst(hard.map((o) => o.naam))}`
    : zacht.length
      ? `Liever niet voor ${namenLijst(zacht.map((o) => o.naam))}`
      : null;
  return { niveau, hard, zacht, onbekend, titel };
}

/** Het centrale oordeel voor één gerecht en de mensen die meeëten. */
export function maaltijdOordeel(g: Gerecht & { id: string }, ctx: EtersContext): MaaltijdOordeel {
  return beoordeel(oordelenVoor(g, ctx));
}

/** Eén regel per eter met een botsing: "Gust: past niet bij vegetarisch" of alleen "Lotte". */
export function redenRegel(o: EterOordeel): string {
  return o.reden ? `${o.naam}: ${o.reden}` : o.naam;
}

/**
 * Kookstand: "Let op: bevat mogelijk eieren — Lotte eet mee". Zonder gedeelde reden alleen
 * "Let op: niet geschikt voor Lotte — Lotte eet mee" (nooit welke allergie).
 */
export function kookWaarschuwingen(o: MaaltijdOordeel): { ernst: Ernst; tekst: string }[] {
  return [
    ...o.hard.map((e) => ({
      ernst: "hard" as const,
      tekst: `Let op: ${e.reden ?? `niet geschikt voor ${e.naam}`} — ${e.naam} eet mee`,
    })),
    ...o.zacht.map((e) => ({
      ernst: "zacht" as const,
      tekst: `Liever niet: ${e.reden ?? "voorkeur"} — ${e.naam} eet mee`,
    })),
  ];
}

/**
 * Welke mee-eters botsen met dit ene ingrediënt? Alleen eters met een gedeelde reden: een
 * markering bij "hazelnoten" zou anders verraden wat Lotte niet mag.
 */
export function ingredientBotsing(
  ingredient: string,
  o: MaaltijdOordeel,
): { ernst: Ernst; namen: string[]; tekst: string } | null {
  const raakt = (e: EterOordeel) => !!e.reden && (e.ingredienten ?? []).includes(ingredient);
  const hard = o.hard.filter(raakt);
  const zacht = o.zacht.filter(raakt);
  if (hard.length) {
    const namen = hard.map((e) => e.naam);
    return { ernst: "hard", namen, tekst: `Niet voor ${namenLijst(namen)}` };
  }
  if (zacht.length) {
    const namen = zacht.map((e) => e.naam);
    return { ernst: "zacht", namen, tekst: `Liever niet voor ${namenLijst(namen)}` };
  }
  return null;
}

/**
 * Boodschappenlijst: botst dit product met iemand die meeëet? Alleen gedeelde redenen tellen
 * (zie `ingredientBotsing`); het serveroordeel gaat over recepten en telt hier niet mee.
 */
export function productOordeel(
  product: string,
  ctx: Omit<EtersContext, "server">,
): MaaltijdOordeel {
  const oordelen = oordeelVoorEters(
    { title: product, ingredienten: [product] },
    ctx.eters,
    ctx.voeding,
    ctx.kijkerId,
  ).filter((e) => (e.veilig === true && !e.ernst) || !!e.reden);
  return beoordeel(oordelen);
}

/**
 * Filtert voorstellen: eerst wat voor iedereen past. Past niets, dan blijven de gerechten wel
 * staan (met etiket), zodat er nooit een leeg scherm is zonder uitleg.
 */
export function veiligVoorEters<T extends { id: string }>(
  lijst: readonly T[],
  gerecht: (x: T) => Gerecht,
  ctx: EtersContext,
): { veilig: T[]; weggelaten: number } {
  if (!ctx.eters.length) return { veilig: [...lijst], weggelaten: 0 };
  const veilig = lijst.filter((x) => !nietGeschikt({ ...gerecht(x), id: x.id }, ctx));
  return { veilig, weggelaten: lijst.length - veilig.length };
}

/** "Voorgesteld voor Marie, Jan, Lotte en Gust." */
export function voorWieTekst(eters: readonly Pick<HuishoudenLid, "naam">[]): string | null {
  if (!eters.length) return null;
  return `Rekening gehouden met ${namenLijst(eters.map((e) => e.naam))}`;
}
