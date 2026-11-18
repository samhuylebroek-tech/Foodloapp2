/**
 * Budget — DE kostenbron voor eten in Foodlo (P2): geschatte kost per ingrediënt, per maaltijd,
 * per week en voor de boodschappenlijst. De planner-engine, de budgetkaart op Week, de lijst en
 * de winkelmodus rekenen allemaal hiermee, zodat overal hetzelfde getal staat.
 * (`kostrem.ts` gaat over iets anders: een rem op AI-kosten, niet over prijzen van eten.)
 *
 * Er is geen prijsbron (MODULE_DESIGNS §8, #21): dit is een **schatting** met vaste, ronde
 * richtprijzen van een gewone Belgische supermarkt (verzonnen gemiddelden, geen promoties, geen
 * echte winkelprijzen). De app zegt er altijd "schatting" bij. Wat Foodlo niet kent, telt niet mee
 * en wordt als "niet geschat" gemeld; zout, peper en water tellen als € 0.
 *
 * Een latere echte prijsbron (supermarktpartner) past achter `PrijsBron`.
 */
import { isBasis } from "@/lib/voorraad-match";
import { normaliseerTekst } from "@/lib/zoeken";

export type Prijs = {
  perKg?: number;
  perStuk?: number;
  /** kg per stuk, om stuks naar kilo te rekenen */ kgPerStuk?: number;
};

export interface PrijsBron {
  readonly naam: string;
  /** "schatting" (vaste tabel) of "testgegevens" (testpartner). Nooit doen alsof het echt is. */
  readonly soort: "schatting" | "testgegevens" | "echt";
  prijsVoor(ingredient: string): Prijs | null;
}

/** Richtprijzen in euro (afgerond). Langste trefwoord wint. */
const TABEL: [string[], Prijs][] = [
  [["aardappel", "patat"], { perKg: 1.3, kgPerStuk: 0.15 }],
  [["ui", "ajuin", "sjalot", "rode ui"], { perKg: 1.6, kgPerStuk: 0.12 }],
  [["look", "knoflook"], { perStuk: 0.12 }],
  [["wortel"], { perKg: 1.3, kgPerStuk: 0.1 }],
  [["tomaat", "tomaten"], { perKg: 3.2, kgPerStuk: 0.12 }],
  [["kerstomaat"], { perKg: 6 }],
  [["pompoen", "butternut"], { perKg: 2.2, kgPerStuk: 1.2 }],
  [["witloof", "chicon"], { perKg: 3.5, kgPerStuk: 0.13 }],
  [["courgette"], { perKg: 2.6, kgPerStuk: 0.3 }],
  [["paprika"], { perKg: 4.5, kgPerStuk: 0.18 }],
  [["komkommer"], { perStuk: 0.9 }],
  [["sla", "kropsla", "ijsbergsla"], { perStuk: 1.3 }],
  [["spinazie"], { perKg: 5.5 }],
  [["champignon"], { perKg: 5.5 }],
  [["prei"], { perKg: 2.8, kgPerStuk: 0.25 }],
  [["broccoli"], { perKg: 3.5, kgPerStuk: 0.45 }],
  [["bloemkool"], { perStuk: 2.6 }],
  [["selder", "bleekselder"], { perKg: 3, kgPerStuk: 0.06 }],
  [["gember"], { perKg: 9 }],
  [["appel"], { perKg: 2.6, kgPerStuk: 0.18 }],
  [["banaan"], { perKg: 2, kgPerStuk: 0.15 }],
  [["citroen", "limoen"], { perStuk: 0.5 }],
  [["frambo", "aardbei", "blauwe bes"], { perKg: 14 }],
  [["gehakt", "rundergehakt", "varkensgehakt"], { perKg: 10 }],
  [["rundvlees", "stoofvlees", "biefstuk"], { perKg: 18 }],
  [["kip", "kipfilet", "kippenfilet"], { perKg: 13, kgPerStuk: 0.15 }],
  [["hesp", "ham"], { perKg: 16, kgPerStuk: 0.025 }],
  [["spek", "spekjes", "lardons"], { perKg: 13 }],
  [["zalm", "zalmfilet"], { perKg: 26, kgPerStuk: 0.125 }],
  [["kabeljauw", "witvis"], { perKg: 24, kgPerStuk: 0.125 }],
  [["scampi", "garnaal"], { perKg: 26 }],
  [["melk"], { perKg: 1.15 }],
  [["kokosmelk"], { perKg: 5 }],
  [["havermelk", "sojamelk", "rijstmelk", "amandelmelk"], { perKg: 2.5 }],
  [["room", "kookroom", "slagroom"], { perKg: 5.5 }],
  [["boter"], { perKg: 10 }],
  [["kaas", "gemalen kaas", "geraspte kaas", "gruyere", "emmentaler"], { perKg: 13 }],
  [["parmezaan"], { perKg: 25 }],
  [["feta", "mozzarella", "geitenkaas"], { perKg: 12, kgPerStuk: 0.125 }],
  [["yoghurt", "platte kaas"], { perKg: 2.6 }],
  [["ei", "eieren"], { perStuk: 0.32 }],
  [["pasta", "spaghetti", "penne", "macaroni", "tagliatelle", "lasagne"], { perKg: 2.2 }],
  [["rijst"], { perKg: 2.6 }],
  [["bloem"], { perKg: 1.1 }],
  [["suiker"], { perKg: 1.3 }],
  [["havermout"], { perKg: 2.2 }],
  [["passata", "tomatensaus", "tomatenpuree"], { perKg: 2.2 }],
  [["bouillon", "groentebouillon"], { perKg: 1.5 }],
  [["olijfolie", "olie"], { perKg: 9 }],
  [["bier"], { perKg: 4 }],
  [["wijn"], { perKg: 7 }],
  [["chocolade"], { perKg: 13 }],
  [["olijven", "olijf"], { perKg: 12 }],
  [["linzen", "kikkererwten", "bonen"], { perKg: 3 }],
  [["peperkoek"], { perKg: 6 }],
  [["mosterd"], { perKg: 6 }],
  [["frieten", "friet"], { perKg: 2.5 }],
  [["brood", "stokbrood"], { perStuk: 2.2 }],
];

const tokens = (t: string) => normaliseerTekst(t).split(" ").filter(Boolean);
function treft(naam: string, woord: string): boolean {
  const w = normaliseerTekst(woord);
  if (w.includes(" ")) return ` ${naam} `.includes(` ${w} `);
  return tokens(naam).some(
    (t) => t === w || t === `${w}s` || t === `${w}en` || (w.length >= 4 && t.startsWith(w)),
  );
}

/** De vaste richtprijzentabel: altijd beschikbaar, altijd "schatting". */
export const SCHATTING: PrijsBron = {
  naam: "Foodlo-richtprijzen",
  soort: "schatting",
  prijsVoor(ingredient: string): Prijs | null {
    const naam = normaliseerTekst(ingredient);
    let beste: { prijs: Prijs; lengte: number } | null = null;
    for (const [woorden, prijs] of TABEL)
      for (const w of woorden)
        if (treft(naam, w) && (!beste || w.length > beste.lengte))
          beste = { prijs, lengte: w.length };
    return beste?.prijs ?? null;
  },
};

/** Hoeveelheid naar kilo (of liter ≈ kilo) of stuks. */
function inKgOfStuks(q: number, eenheid: string): { kg?: number; stuks?: number } {
  const e = normaliseerTekst(eenheid);
  if (e === "g" || e === "gram") return { kg: q / 1000 };
  if (e === "kg" || e === "kilo") return { kg: q };
  if (e === "ml") return { kg: q / 1000 };
  if (e === "cl") return { kg: q / 100 };
  if (e === "dl") return { kg: q / 10 };
  if (e === "l" || e === "liter") return { kg: q };
  if (e === "el" || e === "eetlepel") return { kg: q * 0.015 };
  if (e === "tl" || e === "theelepel") return { kg: q * 0.005 };
  return { stuks: q }; // "", stuk(s), teen(tjes), snee, blik…
}

export type IngredientKost = { naam: string; eur: number | null };

/** Kost van één ingrediëntregel; `null` = niet te schatten. Basisproducten (zout, water): € 0. */
export function kostVan(
  i: { name: string; quantity: number | null; unit: string },
  factor = 1,
  bron: PrijsBron = SCHATTING,
): number | null {
  if (isBasis(i.name)) return 0;
  const prijs = bron.prijsVoor(i.name);
  if (!prijs) return null;
  const q = (i.quantity ?? 0) * factor;
  if (!q || q <= 0) return null;
  const m = inKgOfStuks(q, i.unit);
  if (m.kg !== undefined) {
    if (prijs.perKg !== undefined) return m.kg * prijs.perKg;
    if (prijs.perStuk !== undefined && prijs.kgPerStuk)
      return (m.kg / prijs.kgPerStuk) * prijs.perStuk;
    return null;
  }
  const stuks = m.stuks ?? 0;
  if (prijs.perStuk !== undefined) return stuks * prijs.perStuk;
  if (prijs.perKg !== undefined && prijs.kgPerStuk) return stuks * prijs.kgPerStuk * prijs.perKg;
  return null;
}

export type GerechtKost = {
  totaal: number;
  /** Ingrediënten die niet geschat konden worden. */
  onbekend: string[];
  /** Geschatte ingrediënten / alle ingrediënten (zonder basisproducten). */
  dekking: number;
};

export function schatGerecht(
  ingredienten: readonly { name: string; quantity: number | null; unit: string }[],
  factor = 1,
  bron: PrijsBron = SCHATTING,
): GerechtKost {
  let totaal = 0;
  const onbekend: string[] = [];
  let telt = 0;
  for (const i of ingredienten) {
    if (isBasis(i.name)) continue;
    telt += 1;
    const k = kostVan(i, factor, bron);
    if (k === null) onbekend.push(i.name);
    else totaal += k;
  }
  return {
    totaal: Math.round(totaal * 100) / 100,
    onbekend,
    dekking: telt ? (telt - onbekend.length) / telt : 0,
  };
}

export type PlanKost = {
  recipe_id: string | null;
  personen?: number | null;
  servings?: number | null;
};

type Regels = readonly { name: string; quantity: number | null; unit: string }[];

/**
 * Kost van één geplande maaltijd. Eén regel voor heel Foodlo:
 * - geschaald naar het aantal eters (`personen / servings`); onbekende `servings` = zoals geschreven;
 * - geen ingrediënten = `null` (niet te schatten).
 */
export function kostMaaltijd(
  regels: Regels | undefined | null,
  servings: number | null | undefined,
  personen: number | null | undefined,
  bron: PrijsBron = SCHATTING,
): GerechtKost | null {
  if (!regels?.length) return null;
  const factor = personen && personen > 0 && servings && servings > 0 ? personen / servings : 1;
  return schatGerecht(regels, factor, bron);
}

/**
 * Een kost telt alleen als de meeste ingrediënten geschat konden worden. Anders: "niet geschat"
 * (nooit doen alsof een onbekende prijs € 0 is).
 */
export function bekendeKost(kost: GerechtKost | null | undefined): number | null {
  if (!kost || kost.dekking < 0.5) return null;
  return kost.totaal;
}

/**
 * Som over de week. Maaltijden zonder recept of met te weinig gekende prijzen tellen als
 * "niet geschat" en tellen NIET mee in het totaal.
 */
export function schatWeek(
  plan: readonly PlanKost[],
  ingredientenPerRecept: Readonly<Record<string, Regels>>,
  bron: PrijsBron = SCHATTING,
): { totaal: number; maaltijden: number; nietGeschat: number } {
  let totaal = 0;
  let nietGeschat = 0;
  let maaltijden = 0;
  for (const p of plan) {
    maaltijden += 1;
    const ingr = p.recipe_id ? ingredientenPerRecept[p.recipe_id] : undefined;
    const k = bekendeKost(kostMaaltijd(ingr, p.servings, p.personen, bron));
    if (k === null) nietGeschat += 1;
    else totaal += k;
  }
  return { totaal: Math.round(totaal * 100) / 100, maaltijden, nietGeschat };
}

/**
 * Geschatte kost van wat nog op de lijst staat (niet afgevinkt). Producten zonder gekende
 * prijs of zonder hoeveelheid tellen niet mee en worden geteld als `zonderPrijs`.
 */
export function schatLijst(
  items: readonly {
    name: string;
    quantity: number | null;
    unit: string | null;
    checked?: boolean;
  }[],
  bron: PrijsBron = SCHATTING,
): { totaal: number; geschat: number; zonderPrijs: number } {
  let totaal = 0;
  let geschat = 0;
  let zonderPrijs = 0;
  for (const i of items) {
    if (i.checked || isBasis(i.name)) continue;
    const k = kostVan({ name: i.name, quantity: i.quantity, unit: i.unit ?? "" }, 1, bron);
    if (k === null) zonderPrijs += 1;
    else {
      totaal += k;
      geschat += 1;
    }
  }
  return { totaal: Math.round(totaal * 100) / 100, geschat, zonderPrijs };
}

export type BudgetStatus = "binnen" | "bijna" | "over";

export function budgetOordeel(
  kost: number,
  budget: number,
): { status: BudgetStatus; verschil: number; aandeel: number } {
  const aandeel = budget > 0 ? kost / budget : 0;
  const verschil = Math.round((budget - kost) * 100) / 100;
  if (budget > 0 && kost > budget) return { status: "over", verschil, aandeel };
  if (budget > 0 && aandeel >= 0.9) return { status: "bijna", verschil, aandeel };
  return { status: "binnen", verschil, aandeel };
}

/** Belgische notatie: "€ 4,50" (vaste spatie: het bedrag breekt nooit los van het teken). */
export function euro(bedrag: number): string {
  return `€\u00a0${bedrag.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Een ingetypt bedrag ("45", "45,50", "€ 45.5") → getal, of null als het niet klopt. */
export function leesBedrag(tekst: string): number | null {
  const schoon = tekst.replace(/[€\s]/g, "").replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(schoon)) return null;
  const n = Number(schoon);
  return n > 0 && n <= 5000 ? n : null;
}

// ---------- Weekbudget (per toestel) ----------
const sleutel = (userId: string) => `foodlo:weekbudget:${userId}`;
export const BUDGET_GEWIJZIGD = "foodlo:weekbudget-gewijzigd";

export function leesWeekbudget(userId: string | null | undefined): number | null {
  if (!userId) return null;
  try {
    const w = window.localStorage.getItem(sleutel(userId));
    return w ? leesBedrag(w) : null;
  } catch {
    return null;
  }
}

export function zetWeekbudget(userId: string, bedrag: number | null) {
  try {
    if (bedrag === null) window.localStorage.removeItem(sleutel(userId));
    else window.localStorage.setItem(sleutel(userId), String(bedrag));
  } catch {
    // opslag geblokkeerd
  }
  window.dispatchEvent(new Event(BUDGET_GEWIJZIGD));
}
