/**
 * De kringloop: plannen → lijst (min voorraad) → kopen → voorraad → koken → voorraad.
 * Pure functies, zonder databank: makkelijk te testen en te hergebruiken.
 */
import { canoniekeNaam, zelfdeProduct } from "@/lib/product-herkenning";
import { isBasis, zitInVoorraad } from "@/lib/voorraad-match";

export type PlanMaaltijd = {
  plan_date: string;
  recipe_id: string | null;
  personen: number | null;
  custom_title?: string | null;
  soort?: string | null;
};
export type ReceptKort = { id: string; title: string; servings: number | null };
export type ReceptIngredient = {
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
};
export type LijstItem = { name: string; checked: boolean };

export type Regel = {
  sleutel: string;
  naam: string;
  quantity: number | null;
  unit: string;
  /** Voor welke gerechten (titel + dag), om te tonen "voor Stoofvlees, wo". */
  voor: { titel: string; dag: string }[];
  recipe_id: string | null;
};

export type Aanvulling = {
  /** Nog te kopen (standaard aangevinkt). */
  kopen: Regel[];
  /** Lijkt al in de voorraad te zitten (standaard niet aangevinkt). */
  inHuis: Regel[];
  /** Staat al (niet afgevinkt) op de boodschappenlijst. */
  opLijst: Regel[];
  /** Geplande maaltijden zonder recept: daar kunnen we niets voor berekenen. */
  zonderRecept: string[];
  /** Aantal geplande gerechten (met recept) dat meetelt. */
  aantalGerechten: number;
};

function rond(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Wat moet er gekocht worden voor de komende maaltijden?
 * - alleen maaltijden vanaf `vanaf` (vandaag), voorbije dagen tellen niet;
 * - hoeveelheden geschaald naar het aantal personen van die maaltijd;
 * - zelfde product + zelfde eenheid samengeteld;
 * - basis (zout, peper, water) nooit;
 * - verdeeld over kopen / al in huis / al op de lijst.
 */
export function berekenAanvulling(opts: {
  plan: PlanMaaltijd[];
  recepten: ReceptKort[];
  ingredienten: ReceptIngredient[];
  voorraad: string[];
  lijst: LijstItem[];
  vanaf: string;
}): Aanvulling {
  const recepten = new Map(opts.recepten.map((r) => [r.id, r]));
  const komend = opts.plan.filter((p) => p.plan_date >= opts.vanaf);
  const zonderRecept = komend
    .filter((p) => !p.recipe_id && !p.soort && p.custom_title)
    .map((p) => p.custom_title as string);

  const regels = new Map<string, Regel>();
  let aantalGerechten = 0;
  for (const p of komend) {
    if (!p.recipe_id) continue;
    const recept = recepten.get(p.recipe_id);
    if (!recept) continue;
    aantalGerechten++;
    const factor =
      p.personen && recept.servings && recept.servings > 0 ? p.personen / recept.servings : 1;
    for (const ing of opts.ingredienten) {
      if (ing.recipe_id !== p.recipe_id) continue;
      const naam = ing.name.trim();
      if (!naam || isBasis(naam)) continue;
      const unit = (ing.unit ?? "").trim();
      const sleutel = `${canoniekeNaam(naam)}|${unit.toLowerCase()}`;
      const hoeveel = ing.quantity == null ? null : rond(ing.quantity * factor);
      const al = regels.get(sleutel);
      const voor = { titel: recept.title, dag: p.plan_date };
      if (al) {
        al.quantity = al.quantity == null || hoeveel == null ? null : rond(al.quantity + hoeveel);
        if (!al.voor.some((v) => v.titel === voor.titel && v.dag === voor.dag)) al.voor.push(voor);
        continue;
      }
      regels.set(sleutel, {
        sleutel,
        naam,
        quantity: hoeveel,
        unit,
        voor: [voor],
        recipe_id: p.recipe_id,
      });
    }
  }

  const open = opts.lijst.filter((i) => !i.checked).map((i) => i.name);
  const uit: Aanvulling = { kopen: [], inHuis: [], opLijst: [], zonderRecept, aantalGerechten };
  for (const r of [...regels.values()].sort((a, b) => a.naam.localeCompare(b.naam, "nl"))) {
    if (open.some((n) => zelfdeProduct(n, r.naam))) uit.opLijst.push(r);
    else if (zitInVoorraad(r.naam, opts.voorraad)) uit.inHuis.push(r);
    else uit.kopen.push(r);
  }
  return uit;
}

export type VoorraadRij = {
  id: string;
  naam: string;
  hoeveelheid: number | null;
  eenheid: string | null;
};
export type Gekocht = { name: string; quantity: number | null; unit: string | null };

/**
 * Gekochte boodschappen in de voorraad zetten: bestaand product met dezelfde
 * eenheid wordt opgeteld, anders komt er een nieuwe regel bij. Basis telt niet.
 */
export function voorraadNaKoop(
  gekocht: Gekocht[],
  voorraad: VoorraadRij[],
): {
  bijwerken: { id: string; hoeveelheid: number | null }[];
  nieuw: { naam: string; hoeveelheid: number | null; eenheid: string }[];
} {
  const bijwerken = new Map<string, number | null>();
  const nieuw: { naam: string; hoeveelheid: number | null; eenheid: string }[] = [];
  for (const g of gekocht) {
    const naam = g.name.trim();
    if (!naam || isBasis(naam)) continue;
    const eenheid = (g.unit ?? "").trim();
    const bestaand = voorraad.find(
      (v) => zelfdeProduct(v.naam, naam) && (v.eenheid ?? "").trim() === eenheid,
    );
    if (bestaand) {
      const nu = bijwerken.has(bestaand.id) ? bijwerken.get(bestaand.id)! : bestaand.hoeveelheid;
      bijwerken.set(
        bestaand.id,
        nu == null || g.quantity == null ? (nu ?? g.quantity) : rond(nu + g.quantity),
      );
      continue;
    }
    const dubbel = nieuw.find((n) => zelfdeProduct(n.naam, naam) && n.eenheid === eenheid);
    if (dubbel) {
      dubbel.hoeveelheid =
        dubbel.hoeveelheid == null || g.quantity == null
          ? (dubbel.hoeveelheid ?? g.quantity)
          : rond(dubbel.hoeveelheid + g.quantity);
      continue;
    }
    nieuw.push({ naam, hoeveelheid: g.quantity, eenheid });
  }
  return {
    bijwerken: [...bijwerken.entries()].map(([id, hoeveelheid]) => ({ id, hoeveelheid })),
    nieuw,
  };
}

/** Welke voorraadproducten heb je (waarschijnlijk) gebruikt voor dit recept? */
export function gebruiktUitVoorraad(
  ingredienten: string[],
  voorraad: VoorraadRij[],
): VoorraadRij[] {
  const namen = ingredienten.map((n) => n.trim()).filter((n) => n && !isBasis(n));
  return voorraad.filter((v) => namen.some((n) => zitInVoorraad(n, [v.naam])));
}

/** "wo" / "vandaag" / "morgen" voor naast een ingrediënt. */
export function korteDag(dag: string, vandaag: string): string {
  if (dag === vandaag) return "vandaag";
  const morgen = new Date(`${vandaag}T12:00:00`);
  morgen.setDate(morgen.getDate() + 1);
  if (dag === morgen.toLocaleDateString("sv-SE")) return "morgen";
  return new Date(`${dag}T12:00:00`)
    .toLocaleDateString("nl-BE", { weekday: "short" })
    .replace(".", "");
}
