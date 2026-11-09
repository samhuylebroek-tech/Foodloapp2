/**
 * De kringloop: plannen → lijst (min voorraad) → kopen → voorraad → koken → voorraad.
 * Pure functies, zonder databank: makkelijk te testen en te hergebruiken.
 *
 * Uitgangspunt: Foodlo rekent, de gebruiker hoeft niet na te denken over
 * hoeveelheden, dubbels of wat er al in huis is.
 */
import { categorieVan, type CategorieId } from "@/lib/categorie";
import { canoniekeNaam, zelfdeProduct } from "@/lib/product-herkenning";
import { isBasis, zitInVoorraad } from "@/lib/voorraad-match";

// ---------------------------------------------------------------- eenheden

/** Een hoeveelheid in een vergelijkbare basis: gram, milliliter of stuks. */
type Maat = { familie: string; waarde: number };

const MASSA: Record<string, number> = { g: 1, gr: 1, gram: 1, kg: 1000, kilo: 1000 };
const VOLUME: Record<string, number> = {
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  liter: 1000,
  el: 15,
  eetlepel: 15,
  eetlepels: 15,
  tl: 5,
  theelepel: 5,
  theelepels: 5,
};
const STUKS = new Set(["", "stuk", "stuks", "stuk(s)", "st", "x"]);

function eenheid(unit: string | null | undefined) {
  return (unit ?? "").trim().toLowerCase().replace(/\.$/, "");
}

/** Familie en basiswaarde; null als de hoeveelheid onbekend is. */
export function naarMaat(quantity: number | null, unit: string | null | undefined): Maat | null {
  if (quantity == null || !Number.isFinite(quantity)) return null;
  const u = eenheid(unit);
  if (u in MASSA) return { familie: "g", waarde: quantity * MASSA[u]! };
  if (u in VOLUME) return { familie: "ml", waarde: quantity * VOLUME[u]! };
  if (STUKS.has(u)) return { familie: "stuk", waarde: quantity };
  return { familie: u, waarde: quantity };
}

/** Familie van een eenheid, ook zonder hoeveelheid. */
function familieVan(unit: string | null | undefined) {
  return naarMaat(1, unit)?.familie ?? eenheid(unit);
}

/** Basiswaarde terug naar de eenheid van een bestaand item (bv. 970 ml → 0,97 l). */
export function inEenheid(waarde: number, unit: string | null | undefined): number {
  const u = eenheid(unit);
  const factor = MASSA[u] ?? VOLUME[u] ?? 1;
  return rond(waarde / factor);
}

/** Basisfamilie naar een toonbare eenheid voor nieuwe items. */
function basisEenheid(familie: string) {
  if (familie === "g") return "g";
  if (familie === "ml") return "ml";
  if (familie === "stuk") return "";
  return familie;
}

/** Telbare dingen koop je heel: 1,14 uien → 2 uien. Gewicht en volume blijven exact. */
function heel(familie: string, waarde: number) {
  return familie === "stuk" && waarde > 0 ? Math.ceil(waarde - 1e-9) : waarde;
}

function rond(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------- types

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
export type LijstItem = {
  id?: string;
  name: string;
  checked: boolean;
  quantity?: number | null;
  unit?: string | null;
  recipe_id?: string | null;
};
export type VoorraadRij = {
  id: string;
  naam: string;
  hoeveelheid: number | null;
  eenheid: string | null;
};

export type Regel = {
  sleutel: string;
  naam: string;
  /** Wat nog gekocht moet worden (na aftrek van voorraad en lijst), in `unit`. */
  quantity: number | null;
  unit: string;
  /** Wat de gerechten samen nodig hebben, ter info. */
  nodig: number | null;
  /** Deels in huis? Dan tonen we "je hebt 200 g". */
  inHuisDeels: string | null;
  /** Staat al een deel op de lijst? Dan tellen we daar bij op. */
  opLijstDeels: string | null;
  categorie: CategorieId;
  voor: { titel: string; dag: string }[];
  recipe_id: string | null;
};

export type Aanvulling = {
  /** Nog te kopen (standaard mee). */
  kopen: Regel[];
  /** Volledig in de voorraad. */
  inHuis: Regel[];
  /** Volledig gedekt door wat al op de lijst staat. */
  opLijst: Regel[];
  /** Op de lijst voor een gerecht dat niet meer gepland is. */
  nietMeerNodig: { id: string; naam: string }[];
  /** Geplande maaltijden zonder recept: daar kunnen we niets voor berekenen. */
  zonderRecept: string[];
  aantalGerechten: number;
};

// ---------------------------------------------------------------- S1 aanvullen

type Behoefte = {
  naam: string;
  familie: string;
  /** Oorspronkelijke eenheden: is er maar één ("tl"), dan tonen we die in plaats van "5 ml". */
  eenheden: Set<string>;
  waarde: number | null;
  voor: { titel: string; dag: string }[];
  recipe_id: string;
};

/** Voorraad mag ook als lijst namen binnenkomen (oudere aanroepen). */
function voorraadRijen(v: (VoorraadRij | string)[]): VoorraadRij[] {
  return v.map((x, i) =>
    typeof x === "string" ? { id: `v${i}`, naam: x, hoeveelheid: null, eenheid: "" } : x,
  );
}

/** Sleutel van een product: zelfde naam (canoniek) én vergelijkbare eenheid. */
function productSleutel(naam: string, unit: string | null | undefined, familie?: string) {
  return `${canoniekeNaam(naam)}|${familie ?? familieVan(unit)}`;
}

/**
 * Wat hebben de geplande maaltijden samen nodig, per product (geschaald naar personen,
 * eenheden omgerekend, basis zoals zout nooit)?
 */
function behoeftenVan(
  plan: PlanMaaltijd[],
  receptenLijst: ReceptKort[],
  ingredienten: ReceptIngredient[],
): { behoeften: Map<string, Behoefte>; aantalGerechten: number } {
  const recepten = new Map(receptenLijst.map((r) => [r.id, r]));
  const behoeften = new Map<string, Behoefte>();
  let aantalGerechten = 0;
  for (const p of plan) {
    if (!p.recipe_id) continue;
    const recept = recepten.get(p.recipe_id);
    if (!recept) continue;
    aantalGerechten++;
    const factor =
      p.personen && recept.servings && recept.servings > 0 ? p.personen / recept.servings : 1;
    for (const ing of ingredienten) {
      if (ing.recipe_id !== p.recipe_id) continue;
      const naam = ing.name.trim();
      if (!naam || isBasis(naam)) continue;
      const maat = naarMaat(ing.quantity == null ? null : ing.quantity * factor, ing.unit);
      const familie = maat?.familie ?? familieVan(ing.unit);
      const sleutel = productSleutel(naam, ing.unit, familie);
      const voor = { titel: recept.title, dag: p.plan_date };
      const al = behoeften.get(sleutel);
      if (al) {
        al.eenheden.add((ing.unit ?? "").trim());
        al.waarde = al.waarde == null || maat == null ? null : al.waarde + maat.waarde;
        if (!al.voor.some((v) => v.titel === voor.titel && v.dag === voor.dag)) al.voor.push(voor);
        continue;
      }
      behoeften.set(sleutel, {
        naam,
        familie,
        eenheden: new Set([(ing.unit ?? "").trim()]),
        waarde: maat?.waarde ?? null,
        voor: [voor],
        recipe_id: p.recipe_id,
      });
    }
  }
  return { behoeften, aantalGerechten };
}

/**
 * Wat moet er nog gekocht worden voor de komende maaltijden?
 * - alleen maaltijden vanaf `vanaf` (vandaag);
 * - geschaald naar het aantal personen per maaltijd;
 * - zelfde product samengeteld over gerechten (g/kg, ml/cl/l/el/tl, stuks);
 * - gedeeltelijke voorraad of een gedeeltelijk al op de lijst gezette
 *   hoeveelheid wordt afgetrokken; alleen het tekort blijft over;
 * - basis (zout, peper, water) nooit.
 */
export function berekenAanvulling(opts: {
  plan: PlanMaaltijd[];
  recepten: ReceptKort[];
  ingredienten: ReceptIngredient[];
  voorraad: (VoorraadRij | string)[];
  lijst: LijstItem[];
  vanaf: string;
  /** Recepten die ook later nog gepland zijn (buiten het venster): hun regels zijn niet "niet meer nodig". */
  nogGepland?: Set<string>;
}): Aanvulling {
  const komend = opts.plan.filter((p) => p.plan_date >= opts.vanaf);
  const zonderRecept = komend
    .filter((p) => !p.recipe_id && !p.soort && p.custom_title)
    .map((p) => p.custom_title as string);
  const geplandeRecepten = new Set(komend.map((p) => p.recipe_id).filter(Boolean));
  for (const id of opts.nogGepland ?? []) geplandeRecepten.add(id);
  const voorraad = voorraadRijen(opts.voorraad);
  const { behoeften, aantalGerechten } = behoeftenVan(komend, opts.recepten, opts.ingredienten);

  const openLijst = opts.lijst.filter((i) => !i.checked);
  const uit: Aanvulling = {
    kopen: [],
    inHuis: [],
    opLijst: [],
    nietMeerNodig: openLijst
      .filter((i) => i.id && i.recipe_id && !geplandeRecepten.has(i.recipe_id))
      .map((i) => ({ id: i.id as string, naam: i.name })),
    zonderRecept,
    aantalGerechten,
  };

  const gesorteerd = [...behoeften.entries()].sort((a, b) =>
    a[1].naam.localeCompare(b[1].naam, "nl"),
  );
  for (const [sleutel, b] of gesorteerd) {
    // Hoeveel staat er al (open) op de lijst, en hoeveel zit er in huis?
    const opLijst = dekking(
      openLijst.filter((i) => zelfdeProduct(i.name, b.naam)),
      (i) => naarMaat(i.quantity ?? null, i.unit),
      b.familie,
    );
    const inHuis = dekking(
      voorraad.filter((v) => zitInVoorraad(b.naam, [v.naam])),
      (v) => naarMaat(v.hoeveelheid, v.eenheid),
      b.familie,
    );
    // Toon in de eenheid van het recept als alle gerechten dezelfde gebruiken (1 tl, 2 el).
    const unit = b.eenheden.size === 1 ? [...b.eenheden][0]! : basisEenheid(b.familie);
    const toon = (waarde: number) => inEenheid(waarde, unit);
    const regel: Regel = {
      sleutel,
      naam: b.naam,
      quantity: null,
      unit,
      nodig: b.waarde == null ? null : toon(b.waarde),
      inHuisDeels: null,
      opLijstDeels: null,
      categorie: categorieVan(b.naam, {}),
      voor: b.voor,
      recipe_id: b.recipe_id,
    };

    // Onbekende hoeveelheid ergens: aanwezig = genoeg (niet gokken, niet dubbel kopen).
    if (opLijst.aanwezig && (b.waarde == null || opLijst.onbekend)) {
      uit.opLijst.push(regel);
      continue;
    }
    if (inHuis.aanwezig && (b.waarde == null || inHuis.onbekend)) {
      uit.inHuis.push(regel);
      continue;
    }
    if (b.waarde == null) {
      uit.kopen.push(regel);
      continue;
    }
    const tekort = heel(b.familie, rond(b.waarde - opLijst.waarde - inHuis.waarde));
    if (tekort <= 0) {
      (opLijst.waarde >= b.waarde || !inHuis.aanwezig ? uit.opLijst : uit.inHuis).push(regel);
      continue;
    }
    regel.quantity = toon(tekort);
    if (inHuis.waarde > 0) regel.inHuisDeels = `${toon(inHuis.waarde)} ${unit}`.trim();
    if (opLijst.waarde > 0) regel.opLijstDeels = `${toon(opLijst.waarde)} ${unit}`.trim();
    uit.kopen.push(regel);
  }
  return uit;
}

/** Hoeveel van een product is er al (in dezelfde familie), en is er iets zonder hoeveelheid? */
function dekking<T>(rijen: T[], maat: (r: T) => Maat | null, familie: string) {
  let waarde = 0;
  let onbekend = false;
  for (const r of rijen) {
    const m = maat(r);
    if (!m) onbekend = true;
    else if (m.familie === familie) waarde += m.waarde;
    else onbekend = true; // andere eenheid ("1 bussel" vs "2 teentjes"): niet omrekenbaar
  }
  return { aanwezig: rijen.length > 0, waarde, onbekend };
}

/** Lijstregels voor het aanvullen: nieuw item of bijtellen bij een open item. */
export function lijstWijzigingen(
  regels: Regel[],
  openLijst: (LijstItem & { id: string })[],
): {
  bijtellen: { id: string; quantity: number; oud: number | null }[];
  nieuw: Regel[];
} {
  const bijtellen: { id: string; quantity: number; oud: number | null }[] = [];
  const nieuw: Regel[] = [];
  for (const r of regels) {
    const bestaand =
      r.quantity == null
        ? undefined
        : openLijst.find(
            (i) =>
              !i.checked &&
              zelfdeProduct(i.name, r.naam) &&
              naarMaat(i.quantity ?? null, i.unit)?.familie === familieVan(r.unit),
          );
    if (bestaand && r.quantity != null) {
      const huidig = naarMaat(bestaand.quantity ?? null, bestaand.unit)!.waarde;
      const extra = naarMaat(r.quantity, r.unit)?.waarde ?? 0;
      bijtellen.push({
        id: bestaand.id,
        quantity: inEenheid(huidig + extra, bestaand.unit),
        oud: bestaand.quantity ?? null,
      });
    } else nieuw.push(r);
  }
  return { bijtellen, nieuw };
}

// ---------------------------------------------------------------- WP4 menu gewijzigd → lijst

export type LijstRegel = LijstItem & { id: string };

export type Bijsturing = {
  /** Nieuwe Foodlo-regels. */
  nieuw: { naam: string; quantity: number | null; unit: string; recipe_id: string }[];
  /** Bestaande regels met een andere hoeveelheid (of gekoppeld aan een ander gepland gerecht). */
  bijwerken: {
    id: string;
    naam: string;
    quantity: number | null;
    recipe_id: string | null;
    oud: { quantity: number | null; recipe_id: string | null };
  }[];
  /** Foodlo-regels die niet meer nodig zijn (volledige rij, om terug te kunnen zetten). */
  weg: LijstRegel[];
};

/**
 * Het weekmenu veranderde (gerecht erbij, weg, vervangen of verplaatst): stuur de lijst bij.
 *
 * Regels (zie masterplan WP4):
 * - alleen producten van de gerechten die erbij kwamen of weggingen worden bekeken;
 * - regels die de gebruiker zelf toevoegde (`recipe_id` leeg) worden nooit verlaagd of gewist;
 *   ze tellen wel mee als "staat al op je lijst";
 * - per product blijft er hooguit één Foodlo-regel over (dubbels samengevoegd, eenheden omgerekend);
 * - komt er een gerecht bij, dan klopt de Foodlo-regel daarna met wat de komende maaltijden
 *   nodig hebben, min voorraad en eigen regels;
 * - gaat er alleen iets weg, dan wordt er nooit iets bijgezet: een regel wordt hooguit kleiner.
 * Idempotent: twee keer uitvoeren op dezelfde stand geeft de tweede keer niets te doen.
 */
export function lijstBijsturen(opts: {
  /** Het weekmenu ná de wijziging (alle maaltijden in het venster). */
  plan: PlanMaaltijd[];
  recepten: ReceptKort[];
  /** Ingrediënten van de geplande én van de weggehaalde recepten. */
  ingredienten: ReceptIngredient[];
  voorraad: (VoorraadRij | string)[];
  lijst: LijstRegel[];
  vanaf: string;
  toegevoegd: string[];
  weggehaald: string[];
  /** Recepten die later (buiten het venster) nog gepland zijn. */
  nogGepland?: Set<string>;
}): Bijsturing {
  const uit: Bijsturing = { nieuw: [], bijwerken: [], weg: [] };
  const komend = opts.plan.filter((p) => p.plan_date >= opts.vanaf);
  const { behoeften } = behoeftenVan(komend, opts.recepten, opts.ingredienten);
  const voorraad = voorraadRijen(opts.voorraad);
  const erbij = new Set(opts.toegevoegd);
  const eruit = new Set(opts.weggehaald);

  // Welke producten zijn geraakt?
  const geraakt = new Map<string, { naam: string; familie: string; erbij: boolean }>();
  for (const ing of opts.ingredienten) {
    const isErbij = erbij.has(ing.recipe_id);
    if (!isErbij && !eruit.has(ing.recipe_id)) continue;
    const naam = ing.name.trim();
    if (!naam || isBasis(naam)) continue;
    const familie = familieVan(ing.unit);
    const sleutel = productSleutel(naam, ing.unit, familie);
    const al = geraakt.get(sleutel);
    if (al) al.erbij ||= isErbij;
    else geraakt.set(sleutel, { naam, familie, erbij: isErbij });
  }

  const behandeld = new Set<string>();
  const maatVan = (i: LijstItem) => naarMaat(i.quantity ?? null, i.unit);
  for (const [sleutel, p] of geraakt) {
    const b = behoeften.get(sleutel);
    const naam = b?.naam ?? p.naam;
    const open = opts.lijst.filter(
      (i) => !i.checked && !behandeld.has(i.id) && zelfdeProduct(i.name, naam),
    );
    const vanFoodlo = open.filter((i) => i.recipe_id && familieVan(i.unit) === p.familie);
    const eigen = open.filter((i) => !i.recipe_id);
    for (const i of vanFoodlo) behandeld.add(i.id);

    const eigenD = dekking(eigen, maatVan, p.familie);
    const inHuis = dekking(
      voorraad.filter((v) => zitInVoorraad(naam, [v.naam])),
      (v) => naarMaat(v.hoeveelheid, v.eenheid),
      p.familie,
    );
    // Doel voor de Foodlo-regel, als basiswaarde. null = nodig, hoeveelheid onbekend.
    let doel: number | null;
    if (!b) doel = 0;
    else if (eigenD.aanwezig && (b.waarde == null || eigenD.onbekend)) doel = 0;
    else if (inHuis.aanwezig && (b.waarde == null || inHuis.onbekend)) doel = 0;
    else if (b.waarde == null) doel = null;
    else doel = heel(p.familie, Math.max(0, rond(b.waarde - eigenD.waarde - inHuis.waarde)));

    const huidigOnbekend = vanFoodlo.some((i) => maatVan(i) == null);
    const huidig = vanFoodlo.reduce((som, i) => som + (maatVan(i)?.waarde ?? 0), 0);
    if (!p.erbij) {
      // Alleen weggehaald: nooit iets bijzetten, hooguit kleiner maken.
      if (doel == null) continue;
      if (huidigOnbekend) {
        if (doel > 0) continue;
      } else doel = Math.min(doel, huidig);
    }

    if (doel === 0) {
      uit.weg.push(...vanFoodlo);
      continue;
    }
    const [eerste, ...rest] = vanFoodlo;
    uit.weg.push(...rest);
    const receptNu = b?.recipe_id ?? eerste?.recipe_id ?? null;
    if (eerste) {
      const quantity = doel == null ? null : inEenheid(doel, eerste.unit);
      if (quantity !== (eerste.quantity ?? null) || receptNu !== (eerste.recipe_id ?? null))
        uit.bijwerken.push({
          id: eerste.id,
          naam: eerste.name,
          quantity,
          recipe_id: receptNu,
          oud: { quantity: eerste.quantity ?? null, recipe_id: eerste.recipe_id ?? null },
        });
      continue;
    }
    if (!b) continue;
    // Geen Foodlo-regel: tel bij een eigen regel met een gekende hoeveelheid op (één regel
    // per product), anders een nieuwe regel.
    const eigenMet = eigen.find((i) => maatVan(i)?.familie === p.familie && !behandeld.has(i.id));
    if (eigenMet && doel != null) {
      behandeld.add(eigenMet.id);
      uit.bijwerken.push({
        id: eigenMet.id,
        naam: eigenMet.name,
        quantity: inEenheid(maatVan(eigenMet)!.waarde + doel, eigenMet.unit),
        recipe_id: eigenMet.recipe_id ?? null,
        oud: { quantity: eigenMet.quantity ?? null, recipe_id: eigenMet.recipe_id ?? null },
      });
      continue;
    }
    const unit = b.eenheden.size === 1 ? [...b.eenheden][0]! : basisEenheid(p.familie);
    uit.nieuw.push({
      naam,
      quantity: doel == null ? null : inEenheid(doel, unit),
      unit,
      recipe_id: b.recipe_id,
    });
  }

  // Regels van een weggehaald gerecht die nergens meer bij horen (bv. recept intussen aangepast).
  const gepland = new Set([...komend.map((p) => p.recipe_id), ...(opts.nogGepland ?? [])]);
  for (const i of opts.lijst) {
    if (i.checked || behandeld.has(i.id) || !i.recipe_id || !eruit.has(i.recipe_id)) continue;
    if (gepland.has(i.recipe_id)) continue;
    if ([...behoeften.values()].some((b) => zelfdeProduct(i.name, b.naam))) continue;
    uit.weg.push(i);
  }
  return uit;
}

// ---------------------------------------------------------------- S2 kopen → voorraad

export type Gekocht = { name: string; quantity: number | null; unit: string | null };

/**
 * Gekochte boodschappen in de voorraad: bestaand product in dezelfde familie
 * (g/kg, ml/l, stuks) wordt opgeteld, anders een nieuwe regel. Basis telt niet.
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
    const m = naarMaat(g.quantity, g.unit);
    const familie = m?.familie ?? familieVan(g.unit);
    const bestaand = voorraad.find(
      (v) => zelfdeProduct(v.naam, naam) && familieVan(v.eenheid) === familie,
    );
    if (bestaand) {
      const nu = bijwerken.has(bestaand.id) ? bijwerken.get(bestaand.id)! : bestaand.hoeveelheid;
      const nuMaat = naarMaat(nu, bestaand.eenheid);
      bijwerken.set(
        bestaand.id,
        nuMaat == null || m == null
          ? (nu ?? g.quantity)
          : inEenheid(nuMaat.waarde + m.waarde, bestaand.eenheid),
      );
      continue;
    }
    const eenh = (g.unit ?? "").trim();
    const dubbel = nieuw.find(
      (n) => zelfdeProduct(n.naam, naam) && familieVan(n.eenheid) === familie,
    );
    if (dubbel) {
      const dm = naarMaat(dubbel.hoeveelheid, dubbel.eenheid);
      dubbel.hoeveelheid =
        dm == null || m == null
          ? (dubbel.hoeveelheid ?? g.quantity)
          : inEenheid(dm.waarde + m.waarde, dubbel.eenheid);
      continue;
    }
    nieuw.push({ naam, hoeveelheid: g.quantity, eenheid: eenh });
  }
  return {
    bijwerken: [...bijwerken.entries()].map(([id, hoeveelheid]) => ({ id, hoeveelheid })),
    nieuw,
  };
}

// ---------------------------------------------------------------- S3 koken → voorraad

/** Welke voorraadproducten komen in dit recept voor? */
export function gebruiktUitVoorraad(
  ingredienten: string[],
  voorraad: VoorraadRij[],
): VoorraadRij[] {
  const namen = ingredienten.map((n) => n.trim()).filter((n) => n && !isBasis(n));
  return voorraad.filter((v) => namen.some((n) => zitInVoorraad(n, [v.naam])));
}

/**
 * Wat er na het koken uit de voorraad gaat. Alleen wat we zeker kunnen rekenen:
 * - zelfde familie (500 g van 1 kg → 0,5 kg; 2 el van 1 l → 0,97 l);
 * - op of meer gebruikt dan er was → weg;
 * - onbekende of niet-omrekenbare hoeveelheid → we laten het staan.
 */
export function verbruik(
  ingredienten: { name: string; quantity: number | null; unit: string | null }[],
  voorraad: VoorraadRij[],
  factor = 1,
): {
  bijwerken: { id: string; naam: string; hoeveelheid: number; oud: number | null }[];
  op: VoorraadRij[];
} {
  const bijwerken = new Map<
    string,
    { id: string; naam: string; hoeveelheid: number; oud: number | null; eenheid: string | null }
  >();
  const op = new Map<string, VoorraadRij>();
  for (const ing of ingredienten) {
    const naam = ing.name.trim();
    if (!naam || isBasis(naam)) continue;
    const gebruikt = naarMaat(ing.quantity == null ? null : ing.quantity * factor, ing.unit);
    if (!gebruikt) continue;
    // Eerst exact hetzelfde product ("rundvlees (stoofvlees)"), dan een ruimere match ("rundvlees").
    const kandidaten = [...voorraad].sort(
      (x, y) => Number(zelfdeProduct(y.naam, naam)) - Number(zelfdeProduct(x.naam, naam)),
    );
    const v = kandidaten.find(
      (r) =>
        !op.has(r.id) &&
        zitInVoorraad(naam, [r.naam]) &&
        naarMaat(r.hoeveelheid, r.eenheid)?.familie === gebruikt.familie,
    );
    if (!v) continue;
    const huidig = bijwerken.get(v.id)?.hoeveelheid ?? v.hoeveelheid;
    const rest = naarMaat(huidig, v.eenheid)!.waarde - gebruikt.waarde;
    if (rest <= 0.0001) {
      bijwerken.delete(v.id);
      op.set(v.id, v);
    } else {
      bijwerken.set(v.id, {
        id: v.id,
        naam: v.naam,
        hoeveelheid: inEenheid(rest, v.eenheid),
        oud: v.hoeveelheid,
        eenheid: v.eenheid,
      });
    }
  }
  return {
    bijwerken: [...bijwerken.values()].map(({ eenheid: _e, ...rest }) => rest),
    op: [...op.values()],
  };
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
