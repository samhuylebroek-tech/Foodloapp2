/**
 * Keukenapparatuur (P1 Slimme planner).
 *
 * - Je profiel zegt wat je hebt. Zonder keuze neemt Foodlo "oven + kookplaat" aan en zegt dat
 *   ook op het scherm (geen stille veronderstelling).
 * - Een recept krijgt afgeleide vereisten uit titel, beschrijving, labels en stappen. In de
 *   editor kan je dat aanpassen; wat je zelf kiest, wint.
 * - Een vereiste is een groep "één van": "in de airfryer of de oven" vraagt airfryer óf oven.
 *
 * Puur en zonder netwerk.
 */
import { normaliseerTekst } from "@/lib/zoeken";

export const APPARATEN = [
  { id: "oven", naam: "Oven" },
  { id: "kookplaat", naam: "Kookplaat" },
  { id: "airfryer", naam: "Airfryer" },
  { id: "microgolf", naam: "Microgolfoven" },
  { id: "slowcooker", naam: "Slowcooker" },
  { id: "stoomoven", naam: "Stoomoven" },
  { id: "keukenrobot", naam: "Keukenrobot" },
  { id: "blender", naam: "Blender" },
  { id: "contactgrill", naam: "Contactgrill" },
  { id: "andere", naam: "Iets anders" },
] as const;

export type Apparaat = (typeof APPARATEN)[number]["id"];

/** Wat Foodlo aanneemt zolang je niets kiest. */
export const STANDAARD_APPARATUUR: readonly Apparaat[] = ["oven", "kookplaat"];

const IDS = new Set<string>(APPARATEN.map((a) => a.id));
export function isApparaat(x: unknown): x is Apparaat {
  return typeof x === "string" && IDS.has(x);
}

export function apparaatNaam(id: Apparaat): string {
  return APPARATEN.find((a) => a.id === id)?.naam ?? id;
}

/**
 * Herkenning in de tekst. Alleen woorden die echt om dat toestel vragen: "mix fijn" kan ook met
 * een staafmixer en telt dus niet als blender; "bak" kan in een pan en telt niet als oven.
 */
const WOORDEN: Record<Exclude<Apparaat, "kookplaat" | "andere">, string[]> = {
  oven: ["oven", "ovenschotel", "ovenschaal", "bakplaat", "gratineer", "gratineren"],
  airfryer: ["airfryer", "air fryer", "heteluchtfriteuse"],
  microgolf: ["microgolf", "magnetron"],
  slowcooker: ["slowcooker", "slow cooker", "crockpot"],
  stoomoven: ["stoomoven", "combi-stoomoven"],
  keukenrobot: ["keukenrobot", "thermomix", "monsieur cuisine"],
  blender: ["blender", "smoothiemaker"],
  contactgrill: ["contactgrill", "tosti-ijzer", "tostiijzer"],
};

/**
 * Zwakke aanwijzingen voor een oven ("200 graden", "voorverwarmen"): tellen alleen als er geen
 * ander verwarmend toestel genoemd wordt (een airfryer staat ook op 180 graden).
 */
const ZWAK_OVEN = ["voorverwarm", "graden"];
const ANDER_TOESTEL: Apparaat[] = [
  "airfryer",
  "stoomoven",
  "slowcooker",
  "microgolf",
  "contactgrill",
];

function bevat(tekst: string, woord: string) {
  return new RegExp(`(^|[^a-z])${normaliseerTekst(woord)}`).test(tekst);
}

export type Vereiste = readonly Apparaat[];

/**
 * Welke toestellen vraagt dit recept? Elke groep is "één van". Leeg = niets bijzonders
 * (een kookplaat volstaat of het is koud).
 */
export function herkenApparatuur(r: {
  title: string;
  description?: string | null;
  tags?: readonly string[] | null;
  stappen?: readonly string[] | null;
}): Vereiste[] {
  const ruw = normaliseerTekst(
    [r.title, r.description ?? "", ...(r.tags ?? []), ...(r.stappen ?? [])].join(" \n "),
  );
  // "stoomoven" of "microgolfoven" telt niet als oven: het woord moet los beginnen.
  const gevonden: Apparaat[] = (Object.keys(WOORDEN) as (keyof typeof WOORDEN)[]).filter((id) =>
    WOORDEN[id].some((w) => bevat(ruw, w)),
  );
  if (
    !gevonden.includes("oven") &&
    !gevonden.some((g) => ANDER_TOESTEL.includes(g)) &&
    ZWAK_OVEN.some((w) => bevat(ruw, w))
  )
    gevonden.unshift("oven");
  // "in de airfryer of de oven" / "oven of airfryer": één van beide volstaat.
  const ofOven =
    /(airfryer|air fryer|heteluchtfriteuse)[^.\n]{0,24}\bof\b[^.\n]{0,12}oven|oven[^.\n]{0,12}\bof\b[^.\n]{0,24}(airfryer|air fryer)/;
  if (gevonden.includes("airfryer") && gevonden.includes("oven") && ofOven.test(ruw))
    return [
      ["airfryer", "oven"],
      ...gevonden.filter((g) => g !== "airfryer" && g !== "oven").map((g) => [g]),
    ];
  return gevonden.map((g) => [g]);
}

/** Kan je dit recept maken met wat je hebt? */
export function kanMaken(vereist: readonly Vereiste[], heb: readonly Apparaat[]): boolean {
  return vereist.every((groep) => groep.length === 0 || groep.some((a) => heb.includes(a)));
}

/** De groepen die ontbreken, voor de uitleg ("Vraagt een airfryer"). */
export function ontbrekend(vereist: readonly Vereiste[], heb: readonly Apparaat[]): Vereiste[] {
  return vereist.filter((groep) => groep.length > 0 && !groep.some((a) => heb.includes(a)));
}

/** "airfryer" / "airfryer of oven" in gewone taal (kleine letters). */
export function vereisteTekst(groep: Vereiste): string {
  return groep.map((a) => apparaatNaam(a).toLowerCase()).join(" of ");
}

/**
 * Wat je in de editor zelf aanvinkt, wint van de herkenning. `null` = niets aangepast.
 * Elke aangevinkte waarde is een eigen vereiste.
 */
export function vereistenVoorRecept(
  herkend: readonly Vereiste[],
  zelf: readonly Apparaat[] | null | undefined,
): Vereiste[] {
  if (zelf) return zelf.filter((a) => a !== "kookplaat" && a !== "andere").map((a) => [a]);
  return [...herkend];
}

// ---------------------------------------------------------------- moeilijkheid en tijd

export type Moeilijkheid = "makkelijk" | "gemiddeld" | "moeilijk";

/**
 * Moeilijkheid uit het veld van het recept; ontbreekt het, dan een eerlijke schatting uit het
 * aantal stappen en de tijd (lang en veel stappen = moeilijker).
 */
export function moeilijkheidVan(r: {
  difficulty?: string | null;
  stappen?: readonly string[] | null;
  minuten?: number | null;
}): Moeilijkheid {
  const d = normaliseerTekst(r.difficulty ?? "");
  if (d === "makkelijk" || d === "gemiddeld" || d === "moeilijk") return d;
  const stappen = r.stappen?.length ?? 0;
  const min = r.minuten ?? 0;
  if (stappen >= 10 || min >= 120) return "moeilijk";
  if (stappen >= 6 || min >= 60) return "gemiddeld";
  return "makkelijk";
}
