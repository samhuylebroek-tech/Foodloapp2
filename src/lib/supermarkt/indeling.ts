/**
 * Fase 7 — Afdelingsvolgorde per winkelketen: een gangbare wandeling door de winkel.
 *
 * Dit zijn VERZONNEN voorbeeldindelingen (geen plattegrond van een echte winkel, geen gegevens
 * van de keten). De app zegt dat er altijd bij. Je eigen volgorde (Volgorde van je winkel) blijft
 * altijd de baas: Foodlo stelt een indeling alleen voor, en zet ze pas na "Doe maar".
 */
import { CATEGORIE_VOLGORDE, type CategorieId } from "@/lib/categorie";
import { normaliseerVolgorde } from "@/lib/winkelvolgorde";

/** Volgorde zonder "Al in huis?" en "Overige": die blijven waar de gebruiker ze had. */
type Wandeling = Exclude<CategorieId, "voorraadkast" | "overige">[];

const WANDELING: Record<string, Wandeling> = {
  // Supermarkt met groenten aan de ingang en de koeling achteraan.
  Colruyt: [
    "groenten-fruit",
    "brood-bakkerij",
    "vlees-vis",
    "zuivel-eieren",
    "dranken",
    "diepvries",
    "non-food",
  ],
  Delhaize: [
    "groenten-fruit",
    "brood-bakkerij",
    "vlees-vis",
    "zuivel-eieren",
    "non-food",
    "dranken",
    "diepvries",
  ],
  "Albert Heijn": [
    "groenten-fruit",
    "brood-bakkerij",
    "zuivel-eieren",
    "vlees-vis",
    "dranken",
    "non-food",
    "diepvries",
  ],
  // Kleinere winkel: brood bij de ingang, diepvries bij de kassa.
  Aldi: [
    "brood-bakkerij",
    "groenten-fruit",
    "zuivel-eieren",
    "vlees-vis",
    "dranken",
    "non-food",
    "diepvries",
  ],
  Lidl: [
    "brood-bakkerij",
    "groenten-fruit",
    "vlees-vis",
    "zuivel-eieren",
    "non-food",
    "dranken",
    "diepvries",
  ],
};

/** Ketens waarvoor Foodlo een voorbeeldindeling heeft. */
export const WINKELS_MET_INDELING = Object.keys(WANDELING);

/** Leest een winkelnaam ruim ("colruyt", "Colruyt Gent") naar de keten, of null. */
export function ketenVan(winkel: string | null | undefined): string | null {
  const w = (winkel ?? "").trim().toLowerCase();
  if (!w) return null;
  return WINKELS_MET_INDELING.find((k) => w.includes(k.toLowerCase())) ?? null;
}

/**
 * De voorgestelde volgorde voor deze winkel, gebouwd op de huidige: "Al in huis?" en "Overige"
 * blijven op hun plek (die horen bij jou, niet bij de winkel). Onbekende winkel: null.
 */
export function volgordeVoorWinkel(
  winkel: string | null | undefined,
  huidig: readonly CategorieId[] = CATEGORIE_VOLGORDE,
): CategorieId[] | null {
  const keten = ketenVan(winkel);
  if (!keten) return null;
  const wandeling = [...WANDELING[keten]!] as CategorieId[];
  const vast = normaliseerVolgorde([...huidig]);
  // Vaste plekken van "voorraadkast" en "overige" in de huidige volgorde behouden.
  const uit: CategorieId[] = [];
  let i = 0;
  for (const c of vast) {
    if (c === "voorraadkast" || c === "overige") uit.push(c);
    else uit.push(wandeling[i++]!);
  }
  return normaliseerVolgorde(uit);
}

export function zelfdeVolgorde(a: readonly CategorieId[], b: readonly CategorieId[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}
