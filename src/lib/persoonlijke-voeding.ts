/**
 * Persoonlijke voeding (allergieën, intoleranties, dieet, "liever niet") — voor jezelf en per
 * gezinslid. Dit zijn bijzondere gegevens (AVG art. 9): ze gaan nooit naar een externe AI
 * (`voorAI()`), worden alleen op het account bewaard na uitdrukkelijke toestemming en zijn nooit
 * zichtbaar voor anderen, tenzij het lid zelf "delen met mijn gezin" aanzet.
 *
 * Alleen vaste codes voor allergieën, intoleranties en dieet; "liever niet" is een korte lijst
 * termen (max. 20 × 40 tekens), nooit een vrije lap tekst. Zie voorstel 0009 en 0010.
 */
import { ALLERGENEN, type AllergeenId } from "@/lib/allergenen";
import type { Dieet } from "@/lib/kennismaking";

export type IntolerantieId = "lactose" | "gluten" | "fructose" | "histamine";

export const INTOLERANTIES: { id: IntolerantieId; naam: string; allergeen?: AllergeenId }[] = [
  { id: "lactose", naam: "Lactose", allergeen: "melk" },
  { id: "gluten", naam: "Gluten (gevoelig)", allergeen: "gluten" },
  { id: "fructose", naam: "Fructose" },
  { id: "histamine", naam: "Histamine" },
];

export const DIEETEN: { id: Dieet; naam: string }[] = [
  { id: "alles", naam: "Geen speciaal dieet" },
  { id: "weinig-vlees", naam: "Weinig vlees" },
  { id: "pescotarisch", naam: "Pescotarisch (wel vis)" },
  { id: "vegetarisch", naam: "Vegetarisch" },
  { id: "veganistisch", naam: "Veganistisch" },
];

export type Voeding = {
  allergieen: string[];
  intoleranties: string[];
  dieet: Dieet | null;
  uitsluitingen: string[];
};

export const LEGE_VOEDING: Voeding = {
  allergieen: [],
  intoleranties: [],
  dieet: null,
  uitsluitingen: [],
};

export const MAX_TERMEN = 20;
export const MAX_TERM_LENGTE = 40;

const ALLERGEEN_IDS = new Set<string>(ALLERGENEN.map((a) => a.id));
const INTOLERANTIE_IDS = new Set<string>(INTOLERANTIES.map((i) => i.id));
const DIEET_IDS = new Set<string>(DIEETEN.map((d) => d.id));

/** Eén "liever niet"-term opschonen; leeg = niet geldig. */
export function schoneTerm(t: string): string {
  return t.replace(/\s+/g, " ").trim().slice(0, MAX_TERM_LENGTE);
}

/** Alles terug naar vaste codes en korte termen (ook wat uit de databank of het toestel komt). */
export function normaliseerVoeding(v: Partial<Voeding> | null | undefined): Voeding {
  if (!v) return { ...LEGE_VOEDING };
  const uniek = (xs: unknown, mag: (x: string) => boolean) =>
    [
      ...new Set((Array.isArray(xs) ? xs : []).filter((x): x is string => typeof x === "string")),
    ].filter(mag);
  const termen: string[] = [];
  for (const t of Array.isArray(v.uitsluitingen) ? v.uitsluitingen : []) {
    if (typeof t !== "string") continue;
    const s = schoneTerm(t);
    if (s && !termen.some((x) => x.toLowerCase() === s.toLowerCase())) termen.push(s);
    if (termen.length >= MAX_TERMEN) break;
  }
  return {
    allergieen: uniek(v.allergieen, (x) => ALLERGEEN_IDS.has(x)),
    intoleranties: uniek(v.intoleranties, (x) => INTOLERANTIE_IDS.has(x)),
    dieet: typeof v.dieet === "string" && DIEET_IDS.has(v.dieet) ? (v.dieet as Dieet) : null,
    uitsluitingen: termen,
  };
}

/** Voegt een "liever niet"-term toe (geen dubbels, max. 20). */
export function voegTermToe(lijst: readonly string[], term: string): string[] {
  const s = schoneTerm(term);
  if (!s || lijst.length >= MAX_TERMEN) return [...lijst];
  if (lijst.some((x) => x.toLowerCase() === s.toLowerCase())) return [...lijst];
  return [...lijst, s];
}

/**
 * Welke allergeencodes moeten de veiligheidsregels vermijden? Allergieën plus de intoleranties
 * die Foodlo in ingrediënten kan herkennen (lactose → melk, gluten → gluten).
 */
export function teVermijdenAllergenen(v: Pick<Voeding, "allergieen" | "intoleranties">): string[] {
  const uit = new Set(v.allergieen);
  for (const i of v.intoleranties) {
    const a = INTOLERANTIES.find((x) => x.id === i)?.allergeen;
    if (a) uit.add(a);
  }
  return [...uit];
}

/** Heeft deze voeding iets ingevuld? */
export function heeftVoeding(v: Voeding | null | undefined): boolean {
  if (!v) return false;
  return (
    v.allergieen.length > 0 ||
    v.intoleranties.length > 0 ||
    (v.dieet !== null && v.dieet !== "alles") ||
    v.uitsluitingen.length > 0
  );
}

/**
 * Toestel en account samen: de veiligheid kiest altijd de strengste kant. Allergieën worden
 * samengevoegd (nooit één kwijt); het dieet van het account geldt als het ingevuld is, anders
 * dat van het toestel (de terugval zoals vóór 0009).
 */
export function voegSamen(
  toestel: { allergieen: readonly string[]; dieet?: Dieet | null },
  account: Voeding | null | undefined,
): { allergieen: string[]; dieet: Dieet | undefined } {
  if (!account) return { allergieen: [...toestel.allergieen], dieet: toestel.dieet ?? undefined };
  return {
    allergieen: [...new Set([...toestel.allergieen, ...teVermijdenAllergenen(account)])],
    dieet: account.dieet ?? toestel.dieet ?? undefined,
  };
}

/** Datum van de toestemming in Belgische notatie ("14/11/2026"). */
export function toestemmingDatum(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Leesbare samenvatting (alleen voor wie de reden mag zien). */
export function voedingSamenvatting(v: Voeding): string {
  const delen: string[] = [];
  for (const a of v.allergieen) {
    const n = ALLERGENEN.find((x) => x.id === a)?.naam;
    if (n) delen.push(n);
  }
  for (const i of v.intoleranties) {
    const n = INTOLERANTIES.find((x) => x.id === i)?.naam;
    if (n) delen.push(`${n} (intolerantie)`);
  }
  if (v.dieet && v.dieet !== "alles") {
    const n = DIEETEN.find((x) => x.id === v.dieet)?.naam;
    if (n) delen.push(n);
  }
  if (v.uitsluitingen.length) delen.push(`liever geen ${v.uitsluitingen.join(", ")}`);
  return delen.join(" · ");
}
