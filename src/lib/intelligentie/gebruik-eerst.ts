/**
 * "Gebruik eerst" (usecase 6, minder verspilling): verse producten die al een tijdje in huis zijn.
 *
 * Foodlo kent de houdbaarheidsdatum niet (dat komt pas met voorstel 0007). Het kijkt alleen naar
 * wanneer je het product voor het laatst kocht of toevoegde, en naar de soort product. Daarom
 * altijd "al X dagen in huis", nooit "vervalt" of "bedorven".
 * Draait op het toestel; geen nieuwe gegevens, geen externe dienst.
 */
import { categorieVan } from "@/lib/categorie";
import { isBasis } from "@/lib/voorraad-match";
import { normaliseerTekst } from "@/lib/zoeken";

const DAG = 86400000;

/** Na hoeveel dagen een vers product "al even in huis" is, per afdeling. */
const DREMPEL: Partial<Record<string, number>> = {
  "vlees-vis": 2,
  "brood-bakkerij": 3,
  "groenten-fruit": 4,
  "zuivel-eieren": 6,
};
/** Vers, maar gaat lang mee: pas na twee weken. */
const LANG_HOUDBAAR = [
  "ui",
  "uien",
  "sjalot",
  "knoflook",
  "look",
  "aardappel",
  "pompoen",
  "citroen",
  "limoen",
  "appel",
  "sinaasappel",
  "wortel",
  "kool",
  "rode biet",
  "gember",
  "ei",
  "eieren",
  "harde kaas",
  "parmezaan",
];

export type VoorraadDatum = {
  naam: string;
  /** Laatst gekocht of toegevoegd (ISO); valt terug op created_at. */
  updated_at?: string | null;
  created_at?: string | null;
};

export type OudInHuis = { naam: string; dagen: number };

function drempelVoor(naam: string): number | null {
  if (isBasis(naam)) return null;
  const n = normaliseerTekst(naam);
  const basis = DREMPEL[categorieVan(naam, {})];
  if (!basis) return null;
  const lang = LANG_HOUDBAAR.some((w) =>
    new RegExp(`(^|\\s)${normaliseerTekst(w)}(\\s|$)`).test(n),
  );
  return lang ? 14 : basis;
}

/** Verse producten die al lang(er) in huis zijn, de oudste (ten opzichte van de drempel) eerst. */
export function gebruikEerst(
  voorraad: readonly VoorraadDatum[],
  nu = Date.now(),
  max = 3,
): OudInHuis[] {
  const uit: (OudInHuis & { verhouding: number })[] = [];
  for (const v of voorraad) {
    const datum = Date.parse(v.updated_at ?? v.created_at ?? "");
    if (!Number.isFinite(datum)) continue;
    const drempel = drempelVoor(v.naam);
    if (!drempel) continue;
    const dagen = Math.floor((nu - datum) / DAG);
    // Ouder dan 60 dagen: waarschijnlijk vergeten bij te werken; niet als "gebruik eerst" tonen.
    if (dagen < drempel || dagen > 60) continue;
    uit.push({ naam: v.naam, dagen, verhouding: dagen / drempel });
  }
  return uit
    .sort((a, b) => b.verhouding - a.verhouding || a.naam.localeCompare(b.naam))
    .slice(0, max)
    .map(({ naam, dagen }) => ({ naam, dagen }));
}

export function dagenTekst(dagen: number) {
  return dagen === 1 ? "al 1 dag in huis" : `al ${dagen} dagen in huis`;
}

/**
 * P3 "Gebruik eerst"-kaart op Vandaag: het best gerangschikte voorstel (uit de engine) dat een
 * product opmaakt dat al even in huis is. Null als geen enkel voorstel het gebruikt.
 */
export function voorstelDatOpmaakt<T extends { aanwezig: readonly string[] }>(
  voorstellen: readonly T[],
  oud: readonly OudInHuis[],
  past: (ingredient: string, product: string) => boolean,
): { voorstel: T; product: OudInHuis } | null {
  for (const v of voorstellen)
    for (const o of oud)
      if (v.aanwezig.some((n) => past(n, o.naam))) return { voorstel: v, product: o };
  return null;
}
