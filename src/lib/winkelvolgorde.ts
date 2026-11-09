/**
 * B4 — winkelvolgorde: de afdelingen in de volgorde van jóuw winkel.
 * Voorlopig per toestel (localStorage); per account of per winkel vraagt een databankveld (G1).
 */
import { CATEGORIE_VOLGORDE, type CategorieId } from "@/lib/categorie";

const SLEUTEL = "foodlo-winkelvolgorde";

/** Een bewaarde volgorde opschonen: onbekende weg, ontbrekende achteraan in standaardvolgorde. */
export function normaliseerVolgorde(ruw: unknown): CategorieId[] {
  const geldig = new Set<string>(CATEGORIE_VOLGORDE);
  const lijst = Array.isArray(ruw)
    ? ruw.filter((x): x is CategorieId => typeof x === "string" && geldig.has(x))
    : [];
  const uniek = [...new Set(lijst)];
  return [...uniek, ...CATEGORIE_VOLGORDE.filter((c) => !uniek.includes(c))];
}

export function leesVolgorde(): CategorieId[] {
  try {
    return normaliseerVolgorde(JSON.parse(localStorage.getItem(SLEUTEL) ?? "null"));
  } catch {
    return [...CATEGORIE_VOLGORDE];
  }
}

export function bewaarVolgorde(volgorde: CategorieId[]) {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(normaliseerVolgorde(volgorde)));
  } catch {
    // privévenster: alleen voor deze sessie
  }
}

/** Eén plek op of neer; geeft een nieuwe lijst terug. */
export function verschuif(
  volgorde: CategorieId[],
  id: CategorieId,
  richting: -1 | 1,
): CategorieId[] {
  const i = volgorde.indexOf(id);
  const j = i + richting;
  if (i < 0 || j < 0 || j >= volgorde.length) return volgorde;
  const nieuw = [...volgorde];
  [nieuw[i], nieuw[j]] = [nieuw[j]!, nieuw[i]!];
  return nieuw;
}

export function isStandaard(volgorde: CategorieId[]) {
  return volgorde.every((c, i) => c === CATEGORIE_VOLGORDE[i]);
}
