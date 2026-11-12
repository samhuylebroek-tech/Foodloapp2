/**
 * WP3 — Vandaag: wat is nú belangrijk, en wat is de volgende logische stap?
 * Pure functies (geen databank, geen klok van zichzelf): makkelijk te testen.
 *
 * Volgorde (de eerste die past, wint):
 * 1. hervatten     — je was aan het koken (stap bewaard, < 12 u)
 * 2. aanvullen     — voor vandaag ontbreekt iets dat nog niet op je lijst staat
 * 3. winkelen      — wat ontbreekt, staat op je lijst maar is nog niet gekocht
 * 4. koken         — alles in huis: start koken (met "begin om …" als dat nuttig is)
 * 5. zonder recept — er staat iets gepland zonder recept
 * 6. morgen        — 's avonds laat: kijk alvast naar morgen
 * 7. kiezen        — niets gepland: wat eten we vandaag?
 * 8. eerste recept — nog geen enkel recept
 */

export type ReceptVandaag = {
  id: string;
  title: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  image_url?: string | null;
  category?: string | null;
  tags?: string[] | null;
  stappen: number;
};

export type MaaltijdVandaag = {
  id: string;
  meal_type: string;
  recept: ReceptVandaag | null;
  custom_title: string | null;
};

export type VandaagInvoer = {
  nu: Date;
  vandaag: MaaltijdVandaag[];
  morgen: MaaltijdVandaag[];
  /** Voor de maaltijden van vandaag: wat ontbreekt (niet in huis, niet op de lijst). */
  ontbreektVandaag: string[];
  /** Voor de maaltijden van vandaag: staat op je lijst, nog niet gekocht. */
  nogKopenVandaag: string[];
  /** Zelfde voor morgen (alleen gebruikt als we naar morgen kijken). */
  ontbreektMorgen: string[];
  /** Bewaarde kookvoortgang per recept (stapindex), of null. */
  voortgang: Record<string, number | null>;
  /** Komende 7 dagen (vandaag inbegrepen) zonder geplande maaltijd. */
  vrijeDagen: number;
  /** Wat er voor de komende maaltijden nog op de lijst moet (Slim aanvullen). */
  aanvullen: number;
  /** Open regels op de lijst. */
  teKopen: number;
  heeftRecepten: boolean;
  /** Eigen etenstijden ("19:30"), per moment; ontbreekt er een, dan geldt ETENSTIJD. */
  etenstijden?: Record<string, string> | undefined;
};

/**
 * Wanneer beginnen, hoe lang, wanneer aan tafel (review 2026-11-12, punt 8: "Wanneer moet ik
 * beginnen?"). Alleen als zowel de etenstijd als de kooktijd bekend zijn; nooit gegokt.
 */
export type Tijdsplan =
  | { soort: "later"; beginOm: string; aanTafel: string; duurMin: number }
  | { soort: "nu"; aanTafel: string; duurMin: number; laat: boolean };

export function tijdsplan(
  moment: string,
  recept: ReceptVandaag,
  nu: Date,
  eigen?: Record<string, string>,
): Tijdsplan | null {
  const tijd = etenstijd(moment, eigen);
  const duur = kooktijd(recept);
  if (!tijd || duur <= 0) return null;
  const nuMin = nu.getHours() * 60 + nu.getMinutes();
  const eten = minuten(tijd);
  if (nuMin > eten + 60) return null;
  const start = eten - duur;
  if (start - nuMin >= 15)
    return { soort: "later", beginOm: alsTijd(start), aanTafel: tijd, duurMin: duur };
  const klaar = Math.max(eten, nuMin + duur);
  return { soort: "nu", aanTafel: alsTijd(klaar), duurMin: duur, laat: klaar > eten + 10 };
}

export type Stap =
  | { soort: "hervatten"; maaltijd: MaaltijdVandaag; recept: ReceptVandaag; stap: number }
  | {
      soort: "aanvullen";
      maaltijd: MaaltijdVandaag;
      recept: ReceptVandaag;
      ontbreekt: string[];
      plan?: Tijdsplan | null;
    }
  | {
      soort: "winkelen";
      maaltijd: MaaltijdVandaag;
      recept: ReceptVandaag;
      nogKopen: string[];
      plan?: Tijdsplan | null;
    }
  | {
      soort: "koken";
      maaltijd: MaaltijdVandaag;
      recept: ReceptVandaag;
      /** "17:40" als het nog te vroeg is om te beginnen; anders null (begin maar). */
      beginOm: string | null;
      plan?: Tijdsplan | null;
    }
  | { soort: "zonder-recept"; maaltijd: MaaltijdVandaag }
  | {
      soort: "morgen";
      /** null: voor morgen staat nog niets gepland. */
      maaltijd: MaaltijdVandaag | null;
      ontbreekt: string[];
    }
  | { soort: "kiezen" }
  | { soort: "eerste-recept" };

export type Signaal =
  | { soort: "aanvullen"; aantal: number }
  | { soort: "week-vrij"; dagen: number }
  | { soort: "lijst"; aantal: number };

/** Standaard etenstijden per moment (lokale tijd). Instelbaar bij Instellingen → Weekmenu. */
export const ETENSTIJD: Record<string, string> = {
  ontbijt: "08:00",
  middageten: "12:30",
  lunch: "12:30",
  avondeten: "18:30",
  maaltijd: "18:30",
};
/** Vanaf dit uur kijken we naar morgen — of later, als je zelf laat eet (zie `avondGrens`). */
export const AVOND_GRENS_UUR = 21;

const GELDIG = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Etenstijd voor een moment: eigen instelling als die geldig is, anders de standaard. */
export function etenstijd(moment: string, eigen?: Record<string, string>): string | undefined {
  const t = eigen?.[moment];
  if (t && GELDIG.test(t)) return t;
  // "Alles in 1 blok" volgt je avondeten.
  if (moment === "maaltijd" && eigen?.["avondeten"] && GELDIG.test(eigen["avondeten"]))
    return eigen["avondeten"];
  return ETENSTIJD[moment];
}

/** Minuten na middernacht vanaf wanneer we naar morgen kijken: 21:00, of 2 uur na je avondeten. */
export function avondGrens(eigen?: Record<string, string>): number {
  const avond = etenstijd("avondeten", eigen) ?? "18:30";
  return Math.max(AVOND_GRENS_UUR * 60, minuten(avond) + 120);
}

const VOLGORDE = ["ontbijt", "middageten", "lunch", "avondeten"];

function minuten(hhmm: string) {
  const [u, m] = hhmm.split(":").map(Number);
  return (u ?? 0) * 60 + (m ?? 0);
}
function alsTijd(min: number) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function kooktijd(r: ReceptVandaag) {
  return (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
}

/**
 * De maaltijd die er nú toe doet: de eerstvolgende die nog niet voorbij is, bij voorkeur met
 * recept; anders de laatste van de dag.
 */
export function huidigeMaaltijd(
  maaltijden: MaaltijdVandaag[],
  nu: Date,
  eigen?: Record<string, string>,
) {
  if (!maaltijden.length) return null;
  const nuMin = nu.getHours() * 60 + nu.getMinutes();
  const gesorteerd = [...maaltijden].sort(
    (a, b) =>
      (VOLGORDE.indexOf(a.meal_type) + 1 || 9) - (VOLGORDE.indexOf(b.meal_type) + 1 || 9) ||
      (b.recept ? 1 : 0) - (a.recept ? 1 : 0),
  );
  // Een maaltijd is "voorbij" 1 uur na de etenstijd.
  const komend = gesorteerd.filter((m) => {
    const tijd = etenstijd(m.meal_type, eigen);
    return !tijd || minuten(tijd) + 60 > nuMin;
  });
  const kandidaten = komend.length ? komend : gesorteerd.slice(-1);
  return kandidaten.find((m) => m.recept) ?? kandidaten[0]!;
}

export function hoofdStap(i: VandaagInvoer): Stap {
  // 1. Hervatten gaat altijd voor (ook 's avonds laat).
  for (const m of i.vandaag) {
    const r = m.recept;
    const stap = r ? i.voortgang[r.id] : null;
    if (r && stap != null && stap > 0 && stap < r.stappen)
      return { soort: "hervatten", maaltijd: m, recept: r, stap };
  }

  const nuMin = i.nu.getHours() * 60 + i.nu.getMinutes();
  if (nuMin >= avondGrens(i.etenstijden)) {
    // Voor morgen tonen we het avondeten (met recept), anders wat er is.
    const m =
      i.morgen.find((x) => x.meal_type === "avondeten" && x.recept) ??
      i.morgen.find((x) => x.recept) ??
      i.morgen[0] ??
      null;
    if (m || i.heeftRecepten)
      return { soort: "morgen", maaltijd: m, ontbreekt: m?.recept ? i.ontbreektMorgen : [] };
  }

  const m = huidigeMaaltijd(i.vandaag, i.nu, i.etenstijden);
  if (!m) return i.heeftRecepten ? { soort: "kiezen" } : { soort: "eerste-recept" };
  const r = m.recept;
  if (!r) return { soort: "zonder-recept", maaltijd: m };
  const plan = tijdsplan(m.meal_type, r, i.nu, i.etenstijden);
  if (i.ontbreektVandaag.length)
    return { soort: "aanvullen", maaltijd: m, recept: r, ontbreekt: i.ontbreektVandaag, plan };
  if (i.nogKopenVandaag.length)
    return { soort: "winkelen", maaltijd: m, recept: r, nogKopen: i.nogKopenVandaag, plan };

  const tijd = etenstijd(m.meal_type, i.etenstijden);
  const duur = kooktijd(r);
  let beginOm: string | null = null;
  if (tijd && duur > 0) {
    const start = minuten(tijd) - duur;
    // Pas "begin om" tonen als dat nog minstens 15 minuten weg is.
    if (start - nuMin >= 15) beginOm = alsTijd(start);
  }
  return { soort: "koken", maaltijd: m, recept: r, beginOm, plan };
}

/**
 * Wat er daarnaast speelt, in gewone taal — hooguit drie, nooit iets dat de hoofdstap al zegt.
 */
export function signalen(i: VandaagInvoer, hoofd: Stap): Signaal[] {
  const uit: Signaal[] = [];
  // De hoofdstap gaat al over boodschappen voor vandaag? Dan tellen we die niet nog eens.
  const vandaagAlGezegd = hoofd.soort === "aanvullen" ? hoofd.ontbreekt.length : 0;
  const aanvullen = Math.max(0, i.aanvullen - vandaagAlGezegd);
  if (aanvullen > 0 && hoofd.soort !== "aanvullen")
    uit.push({ soort: "aanvullen", aantal: aanvullen });
  if (i.vrijeDagen > 0 && hoofd.soort !== "kiezen")
    uit.push({ soort: "week-vrij", dagen: i.vrijeDagen });
  if (i.teKopen > 0 && hoofd.soort !== "winkelen") uit.push({ soort: "lijst", aantal: i.teKopen });
  return uit.slice(0, 3);
}

/** Korte opsomming: "melk, ui en 2 andere". */
export function opsomming(namen: string[], max = 2): string {
  const uniek = [...new Set(namen)];
  if (uniek.length <= max + 1) {
    if (uniek.length <= 1) return uniek.join("");
    return `${uniek.slice(0, -1).join(", ")} en ${uniek.at(-1)}`;
  }
  const rest = uniek.length - max;
  return `${uniek.slice(0, max).join(", ")} en ${rest} andere`;
}
