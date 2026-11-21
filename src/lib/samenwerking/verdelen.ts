/**
 * P5 — De lijst verdelen: wie haalt wat ("Jan haalt de bakker") en in welke winkel.
 *
 * - Toewijzen aan een gezinslid kan alleen op de gezinslijst (anderen zien je eigen lijst niet).
 *   Een winkel kiezen kan op elke lijst.
 * - "Mijn deel": wat aan jou is toegewezen.
 * - Rollen (bestaande regels): wie de gezinslijst alleen mag bekijken (geen `shopping_edit`)
 *   of een kind is in het huishouden, mag afvinken maar niet verwijderen of verdelen.
 *
 * Opslag: `lijst_toewijzingen` (voorstel 0017) of, zolang die tabel niet bestaat, op dit toestel.
 * Puur en getest in verdelen.test.ts.
 */
import { wieTekst } from "@/lib/samenwerking/conflict";

export type Toewijzing = {
  item_id: string;
  /** Account van het gezinslid dat het haalt, of null. */
  toegewezen_aan: string | null;
  /** Vrije winkelnaam ("Colruyt", "de bakker"), of null. */
  winkel: string | null;
};

export const WINKELS = [
  "Colruyt",
  "Delhaize",
  "Albert Heijn",
  "Aldi",
  "Lidl",
  "Bakker",
  "Slager",
  "Markt",
];

/** Korte, veilige winkelnaam: hooguit 30 tekens, geen lege tekst. */
export function schoneWinkel(w: string | null | undefined): string | null {
  const s = (w ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
  return s ? s : null;
}

export function toewijzingVan(
  itemId: string,
  lijst: readonly Toewijzing[],
): Toewijzing | undefined {
  return lijst.find((t) => t.item_id === itemId);
}

/** Alleen wat aan mij is toegewezen. */
export function mijnDeel<T extends { id: string }>(
  items: readonly T[],
  lijst: readonly Toewijzing[],
  userId: string | null | undefined,
): T[] {
  if (!userId) return [];
  const mijn = new Set(lijst.filter((t) => t.toegewezen_aan === userId).map((t) => t.item_id));
  return items.filter((i) => mijn.has(i.id));
}

/** "Jan haalt dit" / "Jij haalt dit" / "Colruyt" / "Jan · Colruyt" / null. */
export function wieHaaltTekst(
  t: Toewijzing | undefined,
  namen: Readonly<Record<string, string>>,
  userId: string | null | undefined,
): string | null {
  if (!t) return null;
  const wie = t.toegewezen_aan
    ? t.toegewezen_aan === userId
      ? "Jij haalt dit"
      : `${wieTekst(namen[t.toegewezen_aan])} haalt dit`
    : null;
  const winkel = schoneWinkel(t.winkel);
  if (wie && winkel) return `${wie} · ${winkel}`;
  return wie ?? winkel;
}

/** Per winkel groeperen (winkelmodus); zonder winkel onder "Overal". */
export function perWinkel<T extends { id: string }>(
  items: readonly T[],
  lijst: readonly Toewijzing[],
): { winkel: string; items: T[] }[] {
  const groepen = new Map<string, T[]>();
  for (const i of items) {
    const w = schoneWinkel(toewijzingVan(i.id, lijst)?.winkel) ?? "Overal";
    groepen.set(w, [...(groepen.get(w) ?? []), i]);
  }
  return [...groepen.entries()]
    .sort(([a], [b]) => (a === "Overal" ? 1 : b === "Overal" ? -1 : a.localeCompare(b, "nl")))
    .map(([winkel, items]) => ({ winkel, items }));
}

/** Toewijzing bijwerken in een lijst (puur). Leeg (niemand, geen winkel) = weg. */
export function zetToewijzing(lijst: readonly Toewijzing[], nieuw: Toewijzing): Toewijzing[] {
  const zonder = lijst.filter((t) => t.item_id !== nieuw.item_id);
  const winkel = schoneWinkel(nieuw.winkel);
  if (!nieuw.toegewezen_aan && !winkel) return zonder;
  return [...zonder, { ...nieuw, winkel }];
}

// ------------------------------------------------------------------ rollen

export type LijstRechten = {
  afvinken: boolean;
  bewerken: boolean;
  verwijderen: boolean;
  /** Aan een gezinslid toewijzen of een winkel kiezen. */
  verdelen: boolean;
};

/**
 * Wat mag deze gebruiker op deze lijst?
 * - eigen lijst (geen gezin): alles;
 * - gezinslijst: actief lid met `shopping_edit` = alles; alleen `shopping_view` = kijker;
 * - een kind in het huishouden (huishouden_leden.rol = 'kind') is altijd kijker;
 * - kijker: afvinken mag (samen winkelen), verwijderen/bewerken/verdelen niet.
 * Zonder lidmaatschap: niets (de databankregels laten zo'n lijst niet eens zien).
 */
export function lijstRechten(o: {
  gezinslijst: boolean;
  eigenaarVanLijst: boolean;
  lid?: { status: string; shopping_edit: boolean; shopping_view: boolean } | null;
  huishoudRol?: "volwassene" | "kind" | null;
}): LijstRechten {
  const alles = { afvinken: true, bewerken: true, verwijderen: true, verdelen: true };
  const kijker = { afvinken: true, bewerken: false, verwijderen: false, verdelen: false };
  const niets = { afvinken: false, bewerken: false, verwijderen: false, verdelen: false };
  if (!o.gezinslijst) return o.eigenaarVanLijst ? alles : niets;
  if (o.huishoudRol === "kind") return kijker;
  if (o.eigenaarVanLijst) return alles;
  if (!o.lid || o.lid.status !== "actief") return niets;
  if (o.lid.shopping_edit) return alles;
  if (o.lid.shopping_view) return kijker;
  return niets;
}

// ------------------------------------------------------------------ toestel (terugval)

const sleutel = (listId: string) => `foodlo:lijst-verdeling:${listId}`;

export function leesToestelVerdeling(listId: string): Toewijzing[] {
  try {
    const ruw = window.localStorage.getItem(sleutel(listId));
    const l = ruw ? (JSON.parse(ruw) as unknown) : [];
    return Array.isArray(l)
      ? (l as Toewijzing[]).filter((t) => t && typeof t.item_id === "string").slice(0, 500)
      : [];
  } catch {
    return [];
  }
}

export function bewaarToestelVerdeling(listId: string, lijst: readonly Toewijzing[]) {
  try {
    window.localStorage.setItem(sleutel(listId), JSON.stringify(lijst));
  } catch {
    // Opslag geblokkeerd: geldt tot je de pagina sluit.
  }
}
