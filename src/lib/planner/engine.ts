/**
 * Slimme planner (P1) — de ene planning-engine van Foodlo.
 *
 * Vanavond-voorstellen (`beveelAan`), "Vul aan met voorstellen" (`vulAan`) en "Stel mijn week
 * samen" (`stelMenuSamen`) gebruiken dezelfde stappen:
 *
 *   harde filters → score → porties uit het aantal eters → kost → budgetcontrole → redenen
 *
 * Harde filters, in deze volgorde (de eerste twee worden nooit versoepeld):
 *  1. veiligheid: allergie, dieet, "liever niet", "Niet nu" (één regel voor heel Foodlo);
 *  2. eters: past voor iedereen die die dag meeëet (allergie en dieet per persoon);
 *  3. moment: ontbijt bij ontbijt, geen ontbijtgerecht als avondeten;
 *  4. apparatuur: je hebt wat het recept vraagt;
 *  5. tijd: klaar binnen de tijd van die dag ("Weinig tijd" = hooguit 30 min);
 *  6. ervaring: beginners krijgen geen moeilijke recepten;
 *  7. herhaling: geen gerecht twee keer binnen 7 dagen, niets wat al gepland staat.
 * Blijft er niets over, dan zegt de uitkomst welke filter het krapst was en of je die mag
 * versoepelen (nooit veiligheid of eters).
 *
 * Score: de bestaande beoordeling (`beoordeel`: voorraad en restjes alleen als ze geregistreerd
 * zijn, seizoen, weer, gewoonte, sterren, favorieten, Niet nu) plus variatie over de week (soort,
 * hoofdingrediënt, keuken), ingrediëntoverlap met de rest van de week, kost tegenover het budget
 * en "Feestelijk".
 *
 * Deterministisch: dezelfde invoer en dezelfde `seed` geven hetzelfde menu. Geen AI, geen
 * netwerk; allergieën en dieet blijven op het toestel.
 */
import {
  schatGerecht,
  budgetOordeel,
  SCHATTING,
  type GerechtKost,
  type PrijsBron,
} from "@/lib/budget";
import type { Dieet } from "@/lib/kennismaking";
import { canoniekeNaam } from "@/lib/product-herkenning";
import { nietGeschikt, type EtersContext } from "@/lib/voorstel-eters";
import { isBasis } from "@/lib/voorraad-match";
import { soortVan, type Soortkeuze } from "@/lib/weekmenu-voorstel";
import type { Recipe } from "@/lib/types";
import { normaliseerTekst } from "@/lib/zoeken";
import { euro } from "@/lib/budget";
import { bepaalContext, type Context, type Weer } from "@/lib/intelligentie/context";
import type { OudInHuis } from "@/lib/intelligentie/gebruik-eerst";
import { dagenTussen, type Geschiedenis } from "@/lib/intelligentie/geschiedenis";
import {
  beoordeel,
  toegelaten,
  type Aanbeveling,
  type Invoer,
  type Kandidaat,
  type Reden,
} from "@/lib/intelligentie/voorstel";
import { kanMaken, type Apparaat, type Moeilijkheid, type Vereiste } from "./apparatuur";
import type { Kookervaring } from "./profiel";

// ---------------------------------------------------------------- typen

export type PlanKandidaat = Kandidaat & {
  /** Voor hoeveel personen het recept geschreven is. */
  servings?: number | null | undefined;
  /** Ingrediënten met hoeveelheden (voor kost en porties). */
  regels?: readonly { name: string; quantity: number | null; unit: string }[] | undefined;
  /** Apparatuur (groepen "één van"); leeg = niets bijzonders. */
  vereist?: readonly Vereiste[] | undefined;
  moeilijkheid?: Moeilijkheid | undefined;
};

export type DagChip = "weinig-tijd" | "niet-thuis" | "feestelijk" | "restjes";

export const CHIPS: { id: DagChip; label: string }[] = [
  { id: "weinig-tijd", label: "Weinig tijd" },
  { id: "niet-thuis", label: "Niet thuis" },
  { id: "feestelijk", label: "Feestelijk" },
  { id: "restjes", label: "Restjesdag" },
];

/** "Weinig tijd" betekent: hooguit zoveel minuten. */
export const WEINIG_TIJD = 30;

export type PlanDag = {
  datum: string;
  /** "avondeten", "ontbijt", "middageten" … Weggelaten = elk maaltijdgerecht. */
  moment?: string | undefined;
  /** Porties: het aantal mensen dat meeëet (plus gasten). */
  personen?: number | undefined;
  /** Wie eet mee (veiligheid per persoon). Weggelaten = alleen jouw eigen regels. */
  eters?: EtersContext | null | undefined;
  /** 0 = maakt niet uit. */
  maxMinuten?: number | undefined;
  chips?: readonly DagChip[] | undefined;
  soort?: Soortkeuze | undefined;
  weer?: Weer | null | undefined;
  /** Een eigen context (Vanavond: het echte uur). Anders: die dag om 17 u. */
  context?: Context | undefined;
};

export type Filter =
  "veiligheid" | "eters" | "moment" | "apparatuur" | "tijd" | "ervaring" | "herhaling";

/** Deze filters mag je versoepelen; veiligheid en eters nooit. */
export const VERSOEPELBAAR: readonly Filter[] = ["apparatuur", "tijd", "ervaring", "herhaling"];

export const FILTER_TEKST: Record<Filter, { waarom: string; versoepel: string | null }> = {
  veiligheid: {
    waarom: "Geen van je recepten past bij je allergieën, dieet of 'liever niet'.",
    versoepel: null,
  },
  eters: {
    waarom: "Geen van je recepten past voor iedereen die meeëet.",
    versoepel: null,
  },
  moment: { waarom: "Je hebt geen recepten voor dit moment van de dag.", versoepel: null },
  apparatuur: {
    waarom: "De recepten die passen, vragen een toestel dat je niet hebt.",
    versoepel: "Toon ook recepten voor andere toestellen",
  },
  tijd: {
    waarom: "Geen recept dat past, is op tijd klaar.",
    versoepel: "Mag het wat langer duren",
  },
  ervaring: {
    waarom: "De recepten die passen, zijn moeilijk voor een beginner.",
    versoepel: "Toon ook moeilijkere recepten",
  },
  herhaling: {
    waarom: "Alle passende recepten staan deze week al op het menu.",
    versoepel: "Mag een gerecht twee keer in de week",
  },
};

export type PlanContext = {
  dagen: readonly PlanDag[];
  kandidaten: readonly PlanKandidaat[];
  /** Je eigen regels (toestel + account). */
  allergieen?: readonly string[] | undefined;
  dieet?: Dieet | undefined;
  vermijd?: string | undefined;
  nietNu?: readonly string[] | undefined;
  /** Wat je hebt. Weggelaten = geen apparatuurfilter. */
  apparatuur?: readonly Apparaat[] | null | undefined;
  kookervaring?: Kookervaring | null | undefined;
  /** Alleen wat geregistreerd is; onbekend = niet in huis. */
  voorraad?: readonly string[] | undefined;
  oudInHuis?: OudInHuis[] | undefined;
  onlangsGekocht?: string[] | undefined;
  geschiedenis?: Geschiedenis | undefined;
  sterren?: Record<string, number> | undefined;
  favorieten?: string[] | undefined;
  /** Weekbudget in euro (schatting). Bij meerdere weken geldt het per 7 dagen. */
  budget?: number | null | undefined;
  /** Recept-ids die al gepland staan (komen niet opnieuw). */
  alGepland?: ReadonlySet<string> | undefined;
  /** Wat al vastligt in de periode (bestaande maaltijden): telt mee voor variatie. */
  vast?: readonly { datum: string; recipeId: string }[] | undefined;
  /** Per slot (datum|moment): recepten die niet (meer) mogen (al getoond, weggeklikt). */
  uitgesloten?: Readonly<Record<string, readonly string[]>> | undefined;
  versoepel?: readonly Filter[] | undefined;
  /** Met een seed: kleine vaste variatie tussen gelijkwaardige gerechten ("Opnieuw"). */
  seed?: number | undefined;
  prijsBron?: PrijsBron | undefined;
};

export type DagKeuze = Aanbeveling & {
  kandidaat: PlanKandidaat;
  personen: number;
  kost: GerechtKost | null;
  minuten: number;
};

export type DagUitkomst = {
  datum: string;
  moment: string | undefined;
  status: "gekozen" | "niet-thuis" | "restjes" | "leeg";
  keuze?: DagKeuze | undefined;
  /** Bij "leeg": de filter waarna niets overbleef. */
  krapste?: Filter | undefined;
};

export type MenuVoorstel = {
  dagen: DagUitkomst[];
  kost: { totaal: number; geschat: number; nietGeschat: number };
  /** Per 7 dagen, als er een budget is. */
  budget: { bedrag: number; status: "binnen" | "bijna" | "over"; verschil: number } | null;
};

// ---------------------------------------------------------------- hulp

export const sleutelVan = (d: Pick<PlanDag, "datum" | "moment">) => `${d.datum}|${d.moment ?? ""}`;

const ONTBIJT = /ontbijt|brunch/;
const isOntbijtMoment = (m: string | undefined) => !!m && ONTBIJT.test(m);
const isOntbijtGerecht = (k: Kandidaat) =>
  k.category === "ontbijt" || k.tags.some((t) => ONTBIJT.test(normaliseerTekst(t)));

const FEEST = ["feest", "feestelijk", "kerst", "verjaardag", "gourmet", "fondue", "luxe", "wild"];
const KEUKENS = [
  "belgisch",
  "italiaans",
  "frans",
  "grieks",
  "spaans",
  "aziatisch",
  "indisch",
  "thais",
  "japans",
  "chinees",
  "mexicaans",
  "marokkaans",
];
const WEEKDAG = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

function soortVanKandidaat(k: Kandidaat) {
  return soortVan(
    { title: k.title, description: "", tags: k.tags } as unknown as Recipe,
    k.ingredienten,
  );
}

function hoofdingredient(k: Kandidaat): string | null {
  for (const n of k.ingredienten) if (n.trim() && !isBasis(n)) return canoniekeNaam(n) || null;
  return null;
}

function keukenVan(k: Kandidaat): string | null {
  const tags = k.tags.map((t) => normaliseerTekst(t));
  return KEUKENS.find((w) => tags.includes(w)) ?? null;
}

function productenVan(k: Kandidaat): Set<string> {
  return new Set(
    k.ingredienten
      .filter((n) => n.trim() && !isBasis(n))
      .map((n) => canoniekeNaam(n))
      .filter(Boolean),
  );
}

/** Kleine vaste variatie (0 … 0,6) per recept en dag: geen Math.random, dus herhaalbaar. */
function ruis(seed: number, id: string, datum: string): number {
  let h = 2166136261 ^ seed;
  for (const c of `${id}|${datum}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (((h >>> 0) % 1000) / 1000) * 0.6;
}

function grensVoor(dag: PlanDag): number {
  const max = dag.maxMinuten ?? 0;
  if (dag.chips?.includes("weinig-tijd")) return max > 0 ? Math.min(max, WEINIG_TIJD) : WEINIG_TIJD;
  return max;
}

function personenVan(dag: PlanDag): number {
  const p = dag.personen ?? (dag.eters?.eters.length || 0);
  return p > 0 ? Math.min(50, Math.round(p)) : 1;
}

export function kostVoor(
  k: PlanKandidaat,
  personen: number,
  bron: PrijsBron = SCHATTING,
): GerechtKost | null {
  if (!k.regels?.length) return null;
  const basis = k.servings && k.servings > 0 ? k.servings : personen;
  return schatGerecht(k.regels, personen / basis, bron);
}

/** Een kost telt alleen als de meeste ingrediënten geschat konden worden. */
export function bekendeKost(kost: GerechtKost | null | undefined): number | null {
  if (!kost || kost.dekking < 0.5) return null;
  return kost.totaal;
}

// ---------------------------------------------------------------- harde filters

type Gekozen = { datum: string; kandidaat: PlanKandidaat };

const FILTERS: Filter[] = [
  "veiligheid",
  "eters",
  "moment",
  "apparatuur",
  "tijd",
  "ervaring",
  "herhaling",
];

function slaagt(
  f: Filter,
  k: PlanKandidaat,
  dag: PlanDag,
  ctx: PlanContext,
  gekozen: readonly Gekozen[],
): boolean {
  switch (f) {
    case "veiligheid":
      return toegelaten(k, {
        voorkeur: { maxMinuten: 0, soort: null, vermijd: ctx.vermijd ?? "", dieet: ctx.dieet },
        ...(ctx.allergieen ? { allergieen: [...ctx.allergieen] } : {}),
        ...(ctx.nietNu ? { nietNu: [...ctx.nietNu] } : {}),
      });
    case "eters":
      return !dag.eters || !nietGeschikt(k, dag.eters);
    case "moment":
      if (!dag.moment) return true;
      return isOntbijtMoment(dag.moment) ? isOntbijtGerecht(k) : k.category !== "ontbijt";
    case "apparatuur":
      return !ctx.apparatuur || kanMaken(k.vereist ?? [], ctx.apparatuur);
    case "tijd": {
      const grens = grensVoor(dag);
      // Onbekende tijd telt niet als snel.
      return grens <= 0 || (k.minuten > 0 && k.minuten <= grens);
    }
    case "ervaring":
      return ctx.kookervaring !== "beginner" || k.moeilijkheid !== "moeilijk";
    case "herhaling": {
      if (ctx.alGepland?.has(k.id)) return false;
      if (ctx.uitgesloten?.[sleutelVan(dag)]?.includes(k.id)) return false;
      return !gekozen.some(
        (g) => g.kandidaat.id === k.id && Math.abs(dagenTussen(g.datum, dag.datum)) < 7,
      );
    }
  }
}

/** Wat de harde filters overlaten, en anders de filter waarna niets overbleef. */
export function filterVoorDag(
  ctx: PlanContext,
  dag: PlanDag,
  gekozen: readonly Gekozen[] = [],
): { over: PlanKandidaat[]; krapste: Filter | null } {
  let over = [...ctx.kandidaten];
  for (const f of FILTERS) {
    if (ctx.versoepel?.includes(f) && VERSOEPELBAAR.includes(f)) continue;
    const na = over.filter((k) => slaagt(f, k, dag, ctx, gekozen));
    if (!na.length) return { over: [], krapste: f };
    over = na;
  }
  return { over, krapste: null };
}

// ---------------------------------------------------------------- score

function contextVan(dag: PlanDag): Context {
  return dag.context ?? bepaalContext(new Date(`${dag.datum}T17:00:00`), dag.weer ?? null);
}

const GEEN_GESCHIEDENIS: Geschiedenis = { laatst: {}, komend: new Set(), minutenPerWeekdag: {} };

function invoerVoor(ctx: PlanContext, dag: PlanDag): Invoer {
  return {
    kandidaten: [],
    context: contextVan(dag),
    voorraad: [...(ctx.voorraad ?? [])],
    ...(ctx.oudInHuis ? { oudInHuis: ctx.oudInHuis } : {}),
    ...(ctx.onlangsGekocht ? { onlangsGekocht: ctx.onlangsGekocht } : {}),
    geschiedenis: ctx.geschiedenis ?? GEEN_GESCHIEDENIS,
    ...(ctx.sterren ? { sterren: ctx.sterren } : {}),
    ...(ctx.favorieten ? { favorieten: ctx.favorieten } : {}),
    voorkeur: {
      // "Feestelijk": geen haast, de gewone kooktijd van die weekdag telt niet.
      maxMinuten: dag.chips?.includes("feestelijk") ? 0 : grensVoor(dag),
      soort: dag.soort ?? null,
      vermijd: ctx.vermijd ?? "",
      dieet: ctx.dieet,
    },
  };
}

type Gescoord = DagKeuze;

function scoor(
  k: PlanKandidaat,
  dag: PlanDag,
  ctx: PlanContext,
  gekozen: readonly Gekozen[],
  doelPerMaaltijd: number | null,
): Gescoord {
  const a = beoordeel(k, invoerVoor(ctx, dag));
  let score = a.score;
  const extra: Reden[] = [];
  const c = contextVan(dag);

  // Variatie over de week: niet twee dagen na elkaar dezelfde soort, niet steeds hetzelfde
  // hoofdingrediënt of dezelfde keuken.
  const dichtbij = gekozen.filter((g) => Math.abs(dagenTussen(g.datum, dag.datum)) <= 6);
  if (dichtbij.length) {
    const soort = soortVanKandidaat(k);
    const gisteren = gekozen.find((g) => dagenTussen(g.datum, dag.datum) === 1);
    if (gisteren && soortVanKandidaat(gisteren.kandidaat) === soort) score -= 3;
    const hoofd = hoofdingredient(k);
    if (hoofd && dichtbij.some((g) => hoofdingredient(g.kandidaat) === hoofd)) score -= 4;
    const keuken = keukenVan(k);
    if (keuken && dichtbij.filter((g) => keukenVan(g.kandidaat) === keuken).length >= 2) score -= 2;
    // Ingrediëntoverlap: wat je toch koopt, twee keer gebruiken (minder verspilling).
    const eigen = productenVan(k);
    const gedeeld = new Map<string, string>();
    for (const g of dichtbij)
      for (const p of productenVan(g.kandidaat))
        if (eigen.has(p) && !gedeeld.has(p)) gedeeld.set(p, g.datum);
    if (gedeeld.size) {
      const punten = Math.min(gedeeld.size * 1.5, 4.5);
      score += punten;
      const [product, datum] = [...gedeeld.entries()][0]!;
      const wd = WEEKDAG[(new Date(`${datum}T12:00:00`).getDay() + 6) % 7];
      extra.push({
        soort: "voorraad",
        tekst: `Gebruikt ook de ${product} van ${wd}`,
        gewicht: punten,
      });
    }
  }

  // Porties en kost.
  const personen = personenVan(dag);
  const kost = kostVoor(k, personen, ctx.prijsBron);
  const bekend = bekendeKost(kost);
  if (doelPerMaaltijd !== null) {
    if (bekend === null) score -= 1;
    else if (bekend > doelPerMaaltijd)
      score -= Math.min(10, ((bekend - doelPerMaaltijd) / doelPerMaaltijd) * 6);
    else if (bekend <= doelPerMaaltijd * 0.8) {
      score += 2;
      extra.push({ soort: "eigen", tekst: `Past in je budget (≈ ${euro(bekend)})`, gewicht: 2 });
    }
  }

  // Feestelijk.
  if (dag.chips?.includes("feestelijk")) {
    const tekst = normaliseerTekst([k.title, ...k.tags].join(" "));
    if (FEEST.some((w) => tekst.includes(w))) {
      score += 6;
      extra.push({
        soort: "feest",
        tekst: `Iets feestelijks voor ${WEEKDAG[c.weekdag]}`,
        gewicht: 6,
      });
    } else if (k.minuten >= 45) score += 1;
  }

  // Ervaring: een beginner liever iets eenvoudigs.
  if (ctx.kookervaring === "beginner" && k.moeilijkheid === "gemiddeld") score -= 2;
  if (ctx.kookervaring === "beginner" && k.moeilijkheid === "makkelijk")
    extra.push({ soort: "eigen", tekst: "Eenvoudig om te maken", gewicht: 1 });

  // Tijd binnen de grens van die dag zeggen (de reden "Klaar in … min" komt uit beoordeel).
  if (ctx.seed !== undefined) score += ruis(ctx.seed, k.id, dag.datum);

  const redenen = [...a.redenen, ...extra].sort((x, y) => y.gewicht - x.gewicht);
  // Dezelfde soort reden niet twee keer (bv. twee keer voorraad).
  const uniek: Reden[] = [];
  for (const r of redenen) if (!uniek.some((u) => u.tekst === r.tekst)) uniek.push(r);
  return {
    ...a,
    score,
    redenen: uniek.slice(0, 3),
    kandidaat: k,
    personen,
    kost,
    minuten: k.minuten,
  };
}

function metReden(a: Gescoord): Gescoord {
  return a.redenen.length
    ? a
    : { ...a, redenen: [{ soort: "eigen", tekst: "Uit je eigen recepten", gewicht: 0 }] };
}

/** Alle toegelaten gerechten voor één dag, beste eerst. */
export function rangschikDag(
  ctx: PlanContext,
  dag: PlanDag,
  gekozen: readonly Gekozen[] = [],
  doelPerMaaltijd: number | null = null,
): { lijst: Gescoord[]; krapste: Filter | null } {
  const { over, krapste } = filterVoorDag(ctx, dag, gekozen);
  const lijst = over
    .map((k) => metReden(scoor(k, dag, ctx, gekozen, doelPerMaaltijd)))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return { lijst, krapste };
}

/**
 * Een gerecht dat al vastligt (bv. al gepland) als keuze: porties, kost en redenen, zonder de
 * filters (die bepalen alleen wat Foodlo zélf voorstelt).
 */
export function keuzeVoor(ctx: PlanContext, k: PlanKandidaat, dag: PlanDag): DagKeuze {
  return metReden(scoor(k, dag, ctx, [], null));
}

/** Een menu uit vaste keuzes (bv. je huidige week), met totalen. */
export function menuUit(
  dagen: readonly { dag: PlanDag; keuze: DagKeuze }[],
  budget: number | null | undefined,
): MenuVoorstel {
  const uit: DagUitkomst[] = dagen.map((d) => ({
    datum: d.dag.datum,
    moment: d.dag.moment,
    status: "gekozen",
    keuze: d.keuze,
  }));
  return { dagen: uit, ...totalen(uit, budget) };
}

// ---------------------------------------------------------------- het menu

function telBareDagen(dagen: readonly PlanDag[]) {
  return dagen.filter((d) => !d.chips?.includes("niet-thuis") && !d.chips?.includes("restjes"))
    .length;
}

function doelVoor(ctx: PlanContext): number | null {
  if (!ctx.budget || ctx.budget <= 0) return null;
  const n = telBareDagen(ctx.dagen);
  if (!n) return null;
  // Budget per 7 dagen; bij één maaltijd per dag is dat budget / 7 per maaltijd. Meer momenten
  // per dag (ontbijt, lunch) delen hetzelfde budget.
  const perDag = new Map<string, number>();
  for (const d of ctx.dagen) perDag.set(d.datum, (perDag.get(d.datum) ?? 0) + 1);
  const gemiddeldPerDag = n / Math.max(1, perDag.size);
  return ctx.budget / 7 / Math.max(1, gemiddeldPerDag);
}

/** Totale kost en budgetoordeel van een menu (opnieuw te berekenen na elke wissel). */
export function totalen(
  dagen: readonly DagUitkomst[],
  budget: number | null | undefined,
): Pick<MenuVoorstel, "kost" | "budget"> {
  let totaal = 0;
  let geschat = 0;
  let nietGeschat = 0;
  for (const d of dagen) {
    if (!d.keuze) continue;
    const b = bekendeKost(d.keuze.kost);
    if (b === null) nietGeschat++;
    else {
      geschat++;
      totaal += b;
    }
  }
  totaal = Math.round(totaal * 100) / 100;
  if (!budget || budget <= 0) return { kost: { totaal, geschat, nietGeschat }, budget: null };
  // Meerdere weken: vergelijk met het budget voor die periode.
  const datums = dagen.map((d) => d.datum).sort();
  const periode =
    datums.length > 1
      ? Math.max(1, Math.ceil((dagenTussen(datums[0]!, datums.at(-1)!) + 1) / 7))
      : 1;
  const o = budgetOordeel(totaal, budget * periode);
  return {
    kost: { totaal, geschat, nietGeschat },
    budget: { bedrag: budget * periode, status: o.status, verschil: o.verschil },
  };
}

/**
 * Stelt het menu samen: per dag (en moment) één gerecht, in datumvolgorde. Wat al vastligt
 * (`vast`) telt mee voor variatie en overlap.
 */
export function stelMenuSamen(ctx: PlanContext): MenuVoorstel {
  const doel = doelVoor(ctx);
  const gekozen: Gekozen[] = (ctx.vast ?? [])
    .map((v) => {
      const k = ctx.kandidaten.find((x) => x.id === v.recipeId);
      return k ? { datum: v.datum, kandidaat: k } : null;
    })
    .filter((x): x is Gekozen => !!x);
  const volgorde = [...ctx.dagen].sort(
    (a, b) => a.datum.localeCompare(b.datum) || momentRang(a.moment) - momentRang(b.moment),
  );
  const uit = new Map<string, DagUitkomst>();
  for (const dag of volgorde) {
    const basis = { datum: dag.datum, moment: dag.moment };
    if (dag.chips?.includes("niet-thuis")) {
      uit.set(sleutelVan(dag), { ...basis, status: "niet-thuis" });
      continue;
    }
    if (dag.chips?.includes("restjes")) {
      uit.set(sleutelVan(dag), { ...basis, status: "restjes" });
      continue;
    }
    const { lijst, krapste } = rangschikDag(ctx, dag, gekozen, doel);
    const keuze = lijst[0];
    if (!keuze) {
      uit.set(sleutelVan(dag), { ...basis, status: "leeg", krapste: krapste ?? "herhaling" });
      continue;
    }
    gekozen.push({ datum: dag.datum, kandidaat: keuze.kandidaat });
    uit.set(sleutelVan(dag), { ...basis, status: "gekozen", keuze });
  }
  const dagen = ctx.dagen.map((d) => uit.get(sleutelVan(d))!);
  return { dagen, ...totalen(dagen, ctx.budget) };
}

const MOMENTEN = ["ontbijt", "middageten", "lunch", "tussendoor", "avondeten"];
function momentRang(m: string | undefined) {
  const i = MOMENTEN.indexOf(m ?? "avondeten");
  return i < 0 ? 9 : i;
}

// ---------------------------------------------------------------- alternatieven

export type AlternatiefSoort = "goedkoper" | "sneller" | "past-beter";

export const ALTERNATIEF_LABEL: Record<AlternatiefSoort, string> = {
  goedkoper: "Goedkoper",
  sneller: "Sneller",
  "past-beter": "Past beter",
};

/** Waarom er geen alternatief is (in gewone taal). */
export const GEEN_ALTERNATIEF: Record<AlternatiefSoort, string> = {
  goedkoper: "Geen goedkoper gerecht dat voor iedereen past.",
  sneller: "Geen sneller gerecht dat voor iedereen past.",
  "past-beter": "Dit gerecht past al het best.",
};

/**
 * Eén alternatief voor één dag, via dezelfde filters (dus dezelfde veiligheid) en dezelfde score.
 * De andere dagen van het menu tellen mee voor variatie. `getoond`: al bekeken voor deze dag.
 */
export function alternatief(
  ctx: PlanContext,
  menu: MenuVoorstel,
  index: number,
  soort: AlternatiefSoort,
  getoond: readonly string[] = [],
): DagKeuze | null {
  const huidig = menu.dagen[index];
  const dag = ctx.dagen[index];
  if (!huidig || !dag || huidig.status === "niet-thuis" || huidig.status === "restjes") return null;
  const gekozen: Gekozen[] = menu.dagen
    .filter((d, i) => i !== index && d.keuze)
    .map((d) => ({ datum: d.datum, kandidaat: d.keuze!.kandidaat }));
  const { lijst } = rangschikDag(ctx, dag, gekozen, doelVoor(ctx));
  const nu = huidig.keuze;
  const anders = lijst.filter((k) => k.id !== nu?.id && !getoond.includes(k.id));
  if (!nu) return anders[0] ?? null;
  if (soort === "goedkoper") {
    const prijs = bekendeKost(nu.kost);
    if (prijs === null) return null;
    return (
      anders.find((k) => {
        const p = bekendeKost(k.kost);
        return p !== null && p < prijs - 0.005;
      }) ?? null
    );
  }
  if (soort === "sneller") {
    if (nu.minuten <= 0) return null;
    return anders.find((k) => k.minuten > 0 && k.minuten < nu.minuten) ?? null;
  }
  return anders[0] ?? null;
}

/** Het menu met op één dag een ander gerecht (totalen opnieuw berekend). */
export function vervangDag(
  menu: MenuVoorstel,
  index: number,
  keuze: DagKeuze,
  budget: number | null | undefined,
): MenuVoorstel {
  const dagen = menu.dagen.map((d, i) =>
    i === index ? { ...d, status: "gekozen" as const, keuze, krapste: undefined } : d,
  );
  return { dagen, ...totalen(dagen, budget) };
}

/**
 * "Maak mijn week goedkoper": per dag het beste goedkopere gerecht (zelfde veiligheid). Alleen
 * dagen die echt goedkoper worden, veranderen. Geeft het nieuwe menu en de verschillen.
 */
export function maakGoedkoper(
  ctx: PlanContext,
  menu: MenuVoorstel,
): {
  menu: MenuVoorstel;
  wissels: { index: number; van: DagKeuze; naar: DagKeuze; besparing: number }[];
} {
  let nu = menu;
  const wissels: { index: number; van: DagKeuze; naar: DagKeuze; besparing: number }[] = [];
  menu.dagen.forEach((d, index) => {
    if (!d.keuze) return;
    const alt = alternatief(ctx, nu, index, "goedkoper");
    if (!alt) return;
    const besparing = (bekendeKost(d.keuze.kost) ?? 0) - (bekendeKost(alt.kost) ?? 0);
    if (besparing < 0.5) return;
    wissels.push({ index, van: d.keuze, naar: alt, besparing: Math.round(besparing * 100) / 100 });
    nu = vervangDag(nu, index, alt, ctx.budget);
  });
  return { menu: nu, wissels };
}

// ---------------------------------------------------------------- Vanavond (één dag)

/**
 * Vanavond / Waarom nu: de beste voorstellen voor één moment, elk met 1 à 2 redenen.
 * Zelfde engine; zonder weekgegevens doen variatie, kost en apparatuur niets.
 */
export function beveelAan(
  i: Omit<Invoer, "kandidaten"> & {
    kandidaten: readonly PlanKandidaat[];
    apparatuur?: readonly Apparaat[] | null | undefined;
  },
): Aanbeveling[] {
  const ctx: PlanContext = {
    dagen: [],
    kandidaten: i.kandidaten,
    allergieen: i.allergieen,
    dieet: i.voorkeur.dieet,
    vermijd: i.voorkeur.vermijd,
    nietNu: i.nietNu,
    apparatuur: i.apparatuur,
    voorraad: i.voorraad,
    oudInHuis: i.oudInHuis,
    onlangsGekocht: i.onlangsGekocht,
    geschiedenis: i.geschiedenis,
    sterren: i.sterren,
    favorieten: i.favorieten,
  };
  const dag: PlanDag = {
    datum: i.context.datum,
    context: i.context,
    maxMinuten: i.voorkeur.maxMinuten,
    soort: i.voorkeur.soort,
  };
  // Vanavond kent de tijd als zachte regel (te lang = lager), niet als filter.
  const { lijst } = rangschikDag({ ...ctx, versoepel: ["tijd"] }, dag);
  return lijst.slice(0, i.max ?? 3).map((a) => ({
    id: a.id,
    title: a.title,
    score: a.score,
    redenen: a.redenen.slice(0, 2),
    aanwezig: a.aanwezig,
    ontbreekt: a.ontbreekt,
  }));
}
