/**
 * P5 — Gelijktijdige wijzigingen: nooit stil overschrijven.
 *
 * Optimistische controle zonder schemawijziging: de app onthoudt hoe een maaltijd of
 * lijst-item eruitzag toen je het opende (een "vingerafdruk" van de inhoud). Vlak vóór het
 * schrijven wordt de rij opnieuw gelezen; is de vingerafdruk anders, dan veranderde iemand
 * anders (gezinslid, tweede toestel) intussen hetzelfde. Dan volgt een keuze:
 * "Houd die van Jan" / "Zet de mijne" / "Bekijk allebei". Niets gaat verloren: "Zet de mijne"
 * onthoudt de versie van Jan, zodat één "Ongedaan maken" die terugzet.
 *
 * Alles hier is puur (geen databank) en getest in conflict.test.ts.
 */

/** De velden van een geplande maaltijd die tellen voor een conflict. */
export type PlanVersie = {
  id: string;
  plan_date: string;
  meal_type: string;
  recipe_id: string | null;
  custom_title: string | null;
  personen?: number | null;
  soort?: string | null;
};

/** De velden van een lijst-item die tellen (afvinken telt niet: dat botst nooit). */
export type ItemVersie = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note?: string | null;
};

/** Vaste, korte tekst van de inhoud. Zelfde inhoud = zelfde vingerafdruk. */
export function planVingerafdruk(r: PlanVersie): string {
  return JSON.stringify([
    r.plan_date,
    r.meal_type,
    r.recipe_id ?? null,
    r.custom_title ?? null,
    r.personen ?? null,
    r.soort ?? null,
  ]);
}

export function itemVingerafdruk(r: ItemVersie): string {
  return JSON.stringify([
    r.name.trim().toLowerCase(),
    r.quantity ?? null,
    (r.unit ?? "").trim(),
    (r.note ?? "").trim() || null,
  ]);
}

export type Controle =
  | { soort: "door" }
  | { soort: "conflict" }
  /** De rij bestaat niet meer (iemand haalde ze weg). */
  | { soort: "weg" };

/**
 * Zelfde versie → doorgaan; andere → conflict; rij weg → "weg".
 * Zonder verwachte versie (oude oproepen, eigen nieuw item) wordt er niet gecontroleerd.
 */
export function controleer(verwacht: string | undefined | null, huidig: string | null): Controle {
  if (huidig === null) return verwacht ? { soort: "weg" } : { soort: "door" };
  if (!verwacht || verwacht === huidig) return { soort: "door" };
  return { soort: "conflict" };
}

/** Wat er nu in de databank staat (de versie van de ander). */
export class MenuConflict extends Error {
  readonly huidig: (PlanVersie & Record<string, unknown>) | null;
  constructor(huidig: (PlanVersie & Record<string, unknown>) | null) {
    super(
      huidig ? "Iemand anders veranderde deze maaltijd net" : "Deze maaltijd is net weggehaald",
    );
    this.name = "MenuConflict";
    this.huidig = huidig;
  }
}

export class ItemConflict extends Error {
  readonly huidig: (ItemVersie & Record<string, unknown>) | null;
  constructor(huidig: (ItemVersie & Record<string, unknown>) | null) {
    super(huidig ? "Iemand anders veranderde dit product net" : "Dit product is net weggehaald");
    this.name = "ItemConflict";
    this.huidig = huidig;
  }
}

const DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

/** "2026-11-18" → "woensdag". */
export function dagNaam(datum: string): string {
  const d = new Date(`${datum}T12:00:00`);
  return Number.isNaN(d.getTime()) ? datum : DAGEN[d.getDay()]!;
}

/** Wie veranderde het? Een voornaam, of "Iemand anders" als we het niet weten. */
export function wieTekst(naam: string | null | undefined): string {
  const n = (naam ?? "").trim().split(/\s+/)[0];
  return n ? n : "Iemand anders";
}

/** "Jan veranderde woensdag net in Lasagne" / "Jan haalde woensdag net uit het menu". */
export function conflictTekst(o: {
  wie: string | null | undefined;
  datum: string;
  titel: string | null;
}): string {
  const wie = wieTekst(o.wie);
  const dag = dagNaam(o.datum);
  return o.titel
    ? `${wie} veranderde ${dag} net in ${o.titel}`
    : `${wie} haalde ${dag} net uit het menu`;
}

/** "Jan veranderde melk net in 2 l melk" / "Jan haalde melk net van de lijst". */
export function itemConflictTekst(o: {
  wie: string | null | undefined;
  mijnNaam: string;
  huidig: ItemVersie | null;
}): string {
  const wie = wieTekst(o.wie);
  if (!o.huidig) return `${wie} haalde ${o.mijnNaam} net van de lijst`;
  return `${wie} veranderde ${o.mijnNaam} net in ${itemRegel(o.huidig)}`;
}

/** "2 l melk", "melk" (zonder hoeveelheid). Belgische komma. */
export function itemRegel(i: Pick<ItemVersie, "name" | "quantity" | "unit">): string {
  const q = i.quantity == null ? "" : String(i.quantity).replace(".", ",");
  return [q, (i.unit ?? "").trim(), i.name.trim()].filter(Boolean).join(" ");
}

/**
 * "Bekijk allebei" voor een lijst-item: samenvoegen zonder iets te verliezen.
 * - zelfde product en eenheid → de grootste hoeveelheid, beide notities;
 * - ander product of andere eenheid → geen samenvoeging (null): dan worden het twee items.
 */
export function voegItemsSamen(
  mijn: Omit<ItemVersie, "id">,
  hun: ItemVersie,
): Omit<ItemVersie, "id"> | null {
  const zelfdeNaam = mijn.name.trim().toLowerCase() === hun.name.trim().toLowerCase();
  const zelfdeEenheid = (mijn.unit ?? "").trim() === (hun.unit ?? "").trim();
  if (!zelfdeNaam || !zelfdeEenheid) return null;
  const q =
    mijn.quantity == null
      ? hun.quantity
      : hun.quantity == null
        ? mijn.quantity
        : Math.max(mijn.quantity, hun.quantity);
  const notities = [...new Set([mijn.note, hun.note].map((n) => (n ?? "").trim()).filter(Boolean))];
  return {
    name: hun.name,
    quantity: q,
    unit: hun.unit,
    note: notities.length ? notities.join(" · ").slice(0, 100) : null,
  };
}
