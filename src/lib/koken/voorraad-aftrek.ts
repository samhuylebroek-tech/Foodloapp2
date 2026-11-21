/**
 * "Voorraad bijwerken?" na het koken (P3): een voorstel, nooit een stille aftrek.
 *
 * - Per voorraadproduct dat in het recept voorkomt één regel, met de gebruikte hoeveelheid
 *   (uit de porties, via de ingrediënt-kern) in de eenheid van je voorraad.
 * - Kan Foodlo het niet zeker rekenen (hoeveelheid onbekend, "1 pot" tegenover "200 g",
 *   gewicht tegenover volume), dan vraagt het: de regel staat uit en jij vult in, of kiest "Op".
 * - Pas `aftrekPlan` met de keuzes van de gebruiker geeft wat er écht verandert.
 * Pure functies: geen databank, makkelijk te testen.
 */
import { naarBasis, rekenOm, rond, schoonEenheid } from "@/lib/ingredient/eenheden";
import { zelfdeProduct } from "@/lib/product-herkenning";
import { isBasis, zitInVoorraad } from "@/lib/voorraad-match";

export type GebruiktIngredient = { name: string; quantity: number | null; unit: string | null };
export type VoorraadProduct = {
  id: string;
  naam: string;
  hoeveelheid: number | null;
  eenheid: string | null;
};

export type AftrekRegel = {
  /** Id van het voorraadproduct. */
  id: string;
  naam: string;
  /** De ingrediënten uit het recept die hierop passen ("ui", "rode ui"). */
  ingredienten: string[];
  /** Wat er nu in je voorraad staat (null = hoeveelheid niet bijgehouden). */
  huidig: number | null;
  eenheid: string;
  /** Voorgestelde gebruikte hoeveelheid in de eenheid van je voorraad; null = Foodlo weet het niet. */
  gebruikt: number | null;
  /** "zeker": Foodlo kon het rekenen; "vraag": jij beslist (staat standaard uit). */
  status: "zeker" | "vraag";
  /** Waarom Foodlo het vraagt, in gewone taal. */
  waarom: string | null;
  /** Standaard aangevinkt? */
  aan: boolean;
};

/** Toonbare hoeveelheid in Belgische notatie: 0,5 · 1,25 · 300. */
export function getalTekst(n: number): string {
  return String(rond(n)).replace(".", ",");
}

export function maatTekst(n: number | null, eenheid: string): string {
  if (n == null) return "onbekend";
  return `${getalTekst(n)}${eenheid ? ` ${eenheid}` : ""}`;
}

/**
 * Stelt per voorraadproduct voor hoeveel er gebruikt is. Basisproducten (zout, olie, …) en
 * ingrediënten die niet in je voorraad staan, komen er niet in.
 */
export function stelAftrekVoor(
  ingredienten: readonly GebruiktIngredient[],
  voorraad: readonly VoorraadProduct[],
  factor = 1,
): AftrekRegel[] {
  const per = new Map<string, AftrekRegel & { onzeker: boolean }>();
  const volgorde: string[] = [];
  for (const ing of ingredienten) {
    const naam = ing.name.trim();
    if (!naam || isBasis(naam)) continue;
    // Eerst exact hetzelfde product, dan een ruimere match.
    const kandidaten = voorraad.filter((v) => zitInVoorraad(naam, [v.naam]));
    if (!kandidaten.length) continue;
    const v =
      kandidaten.find((k) => zelfdeProduct(k.naam, naam)) ??
      kandidaten.find((k) => per.has(k.id)) ??
      kandidaten[0]!;
    const eenheid = schoonEenheid(v.eenheid);
    let regel = per.get(v.id);
    if (!regel) {
      regel = {
        id: v.id,
        naam: v.naam,
        ingredienten: [],
        huidig: v.hoeveelheid,
        eenheid: v.eenheid ?? "",
        gebruikt: 0,
        status: "zeker",
        waarom: null,
        aan: true,
        onzeker: false,
      };
      per.set(v.id, regel);
      volgorde.push(v.id);
    }
    regel.ingredienten.push(naam);
    if (regel.onzeker) continue;
    const reden = waaromOnzeker(ing, v, factor);
    if (reden) {
      regel.onzeker = true;
      regel.gebruikt = null;
      regel.status = "vraag";
      regel.waarom = reden;
      regel.aan = false;
      continue;
    }
    const omgezet = rekenOm(ing.quantity! * factor, ing.unit, eenheid, naam)!;
    regel.gebruikt = rond((regel.gebruikt ?? 0) + omgezet);
  }
  return volgorde.map((id) => {
    const { onzeker: _o, ...r } = per.get(id)!;
    return r;
  });
}

function waaromOnzeker(ing: GebruiktIngredient, v: VoorraadProduct, factor: number): string | null {
  if (v.hoeveelheid == null || !Number.isFinite(v.hoeveelheid))
    return "Je voorraad heeft hier geen hoeveelheid. Is het op?";
  if (ing.quantity == null || !Number.isFinite(ing.quantity) || ing.quantity <= 0)
    return "Het recept zegt niet hoeveel. Hoeveel gebruikte je?";
  const omgezet = rekenOm(ing.quantity * factor, ing.unit, v.eenheid, ing.name);
  if (omgezet == null) {
    const recept = `${getalTekst(ing.quantity * factor)}${ing.unit ? ` ${ing.unit}` : ""}`;
    return `Het recept gebruikt ${recept}, je voorraad telt in ${eenheidNaam(v.eenheid)}. Hoeveel gebruikte je?`;
  }
  return null;
}

function eenheidNaam(e: string | null | undefined) {
  const u = schoonEenheid(e);
  if (!u || naarBasis(1, u)?.familie === "stuk") return "stuks";
  return u;
}

/** Wat de gebruiker koos per regel. */
export type AftrekKeuze = {
  aan: boolean;
  /** Gebruikte hoeveelheid in de eenheid van de voorraad; null = niet ingevuld. */
  gebruikt: number | null;
  /** "Helemaal op": het product gaat uit je voorraad. */
  op?: boolean;
};

export type AftrekPlan = {
  bijwerken: { id: string; naam: string; hoeveelheid: number; oud: number }[];
  op: { id: string; naam: string }[];
  /** Aangevinkt maar zonder hoeveelheid: niets gedaan (nooit gokken). */
  overgeslagen: string[];
};

/**
 * Wat er verandert met deze keuzes, gerekend vanaf de voorraad zoals ze nú is (vlak vóór het
 * schrijven opnieuw gelezen). Meer gebruikt dan er was → op.
 */
export function aftrekPlan(
  regels: readonly AftrekRegel[],
  keuzes: Readonly<Record<string, AftrekKeuze>>,
  nu: readonly VoorraadProduct[] = [],
): AftrekPlan {
  const plan: AftrekPlan = { bijwerken: [], op: [], overgeslagen: [] };
  for (const r of regels) {
    const k = keuzes[r.id] ?? { aan: r.aan, gebruikt: r.gebruikt };
    if (!k.aan) continue;
    const actueel = nu.find((v) => v.id === r.id);
    if (nu.length && !actueel) continue; // intussen al weg (ander toestel, gezinslid)
    const huidig = actueel ? actueel.hoeveelheid : r.huidig;
    if (k.op) {
      plan.op.push({ id: r.id, naam: r.naam });
      continue;
    }
    if (k.gebruikt == null || !Number.isFinite(k.gebruikt) || k.gebruikt <= 0 || huidig == null) {
      plan.overgeslagen.push(r.naam);
      continue;
    }
    const rest = rond(huidig - k.gebruikt);
    if (rest <= 0.0001) plan.op.push({ id: r.id, naam: r.naam });
    else plan.bijwerken.push({ id: r.id, naam: r.naam, hoeveelheid: rest, oud: huidig });
  }
  return plan;
}

/** "rundvlees op, ui minder" voor de melding. */
export function aftrekSamenvatting(plan: AftrekPlan): string[] {
  return [...plan.op.map((o) => `${o.naam} op`), ...plan.bijwerken.map((b) => `${b.naam} minder`)];
}
