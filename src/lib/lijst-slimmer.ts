/**
 * Fase 7 — Boodschappen-agent: "Maak mijn lijst slimmer".
 *
 * Alleen vaste regels, geen AI (gratis, werkt altijd en zonder netwerk). De uitkomst is een
 * VOORSTEL met verschillen; er verandert niets tot je "Doe maar" zegt, en alles kan in één keer
 * ongedaan gemaakt worden (`herstelStappen`).
 *
 * Vier soorten verschillen:
 *  1. dubbels samenvoegen — via de ingrediënt-kern (synoniemen en eenheden: "ui" + "ajuin",
 *     "1 l melk" + "50 cl melk"). Wat niet zonder gokken op te tellen valt, blijft staan;
 *  2. afdelingsvolgorde voor de gekozen winkel (voorbeeldindeling, zie supermarkt/indeling.ts);
 *  3. goedkopere alternatieven — alleen met een gekende richtprijs voor beide producten (dezelfde
 *     kostenbron als overal: budget.ts) en alleen als het alternatief past bij je allergieën en
 *     dieet (de toets komt van buiten, `veilig`);
 *  4. vergeten basisproducten — enkel uit je eigen vaste producten en wat je vaak koopt; nooit
 *     verzonnen, nooit iets dat al op je lijst of in je voorraad staat.
 */
import { euro, kostVan, SCHATTING, type PrijsBron } from "@/lib/budget";
import type { CategorieId } from "@/lib/categorie";
import { CATEGORIE_LABEL } from "@/lib/categorie";
import { naarBasis, toonbaar, type Maat } from "@/lib/ingredient/eenheden";
import { voegMaatToe } from "@/lib/ingredient/optellen";
import { canoniekeNaam, zelfdeProduct } from "@/lib/product-herkenning";
import { toonBelgischeMaat } from "@/lib/ingredienten";
import { volgordeVoorWinkel, zelfdeVolgorde } from "@/lib/supermarkt/indeling";
import { zitInVoorraad } from "@/lib/voorraad-match";
import { normaliseerTekst } from "@/lib/zoeken";

export type LijstRij = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  checked: boolean;
  recipe_id?: string | null;
  note?: string | null;
};

export type Basis = { name: string; quantity: number | null; unit: string; reden: string };

export type SlimVerschil =
  | {
      soort: "samenvoegen";
      id: string;
      houd: LijstRij;
      weg: LijstRij[];
      quantity: number | null;
      unit: string;
      voor: string;
      na: string;
    }
  | {
      soort: "goedkoper";
      id: string;
      rij: LijstRij;
      naam: string;
      besparing: number;
      reden: string;
      voor: string;
      na: string;
    }
  | {
      soort: "basis";
      id: string;
      name: string;
      quantity: number | null;
      unit: string;
      reden: string;
      voor: string;
      na: string;
    }
  | {
      soort: "volgorde";
      id: string;
      winkel: string;
      van: CategorieId[];
      naar: CategorieId[];
      voor: string;
      na: string;
    };

export type SlimVoorstel = {
  verschillen: SlimVerschil[];
  /** Geschatte kost van wat nog te kopen is, nu en met alle verschillen. */
  kostNu: number;
  kostNa: number;
};

export type SlimInvoer = {
  items: readonly LijstRij[];
  /** Je eigen vaste producten en wat je vaak koopt (al gefilterd op echte geschiedenis). */
  basis?: readonly Basis[];
  /** Namen in je voorraad (als je die bijhoudt): niet als vergeten voorstellen. */
  voorraad?: readonly string[];
  /** Gekozen winkel voor de afdelingsvolgorde, of null. */
  winkel?: string | null;
  volgorde: readonly CategorieId[];
  /** Mag dit product voorgesteld worden voor jou (allergieën, dieet)? */
  veilig?: (naam: string) => boolean;
  /** Op een gezinslijst als kijker mag je niets weghalen: dan geen samenvoegen. */
  magVerwijderen?: boolean;
  prijsBron?: PrijsBron;
  /** Hooguit zoveel vergeten basisproducten. */
  maxBasis?: number;
};

/** Goedkopere alternatieven: [trefwoorden in de naam, alternatief, waarom]. */
export const ALTERNATIEVEN: readonly [string[], string, string][] = [
  [["parmezaan", "parmigiano"], "Grana Padano", "Smaakt bijna hetzelfde, goedkoper per kilo"],
  [["spinazie"], "Diepvriesspinazie", "Even goed in een warm gerecht, bederft niet"],
  [["frambozen", "framboos"], "Diepvriesframbozen", "Goed voor dessert of ontbijt, bederft niet"],
  [["pijnboompitten"], "Zonnebloempitten", "Zelfde knapperigheid, veel goedkoper"],
  [["kerstomaten", "kerstomaatjes", "kerstomaat"], "Tomaten", "Voor saus of in de oven"],
  [["olijfolie"], "Zonnebloemolie", "Om in te bakken; olijfolie hou je voor de salade"],
];

const tekstVan = (r: { name: string; quantity: number | null; unit: string }) =>
  [toonBelgischeMaat(r.quantity, r.unit), r.name].filter(Boolean).join(" ").trim();

function heeftWoord(naam: string, woorden: readonly string[]): boolean {
  const t = ` ${normaliseerTekst(naam)} `;
  return woorden.some((w) => t.includes(` ${normaliseerTekst(w)} `));
}

/** Al een goedkoper product? ("Diepvriesspinazie" is geen "spinazie" om te vervangen.) */
function isAlAlternatief(naam: string) {
  return ALTERNATIEVEN.some(([, alt]) => normaliseerTekst(naam).includes(normaliseerTekst(alt)));
}

/** Dubbels: zelfde kern, alles op te tellen in één eenheid (of allemaal zonder hoeveelheid). */
function dubbels(open: readonly LijstRij[]): SlimVerschil[] {
  const groepen = new Map<string, LijstRij[]>();
  for (const r of open) {
    const k = canoniekeNaam(r.name);
    if (!k) continue;
    const g = groepen.get(k) ?? [];
    g.push(r);
    groepen.set(k, g);
  }
  const uit: SlimVerschil[] = [];
  for (const [kern, groep] of groepen) {
    if (groep.length < 2) continue;
    // Twee verschillende gerechten: elk blijft herkenbaar bij zijn gerecht.
    const gerechten = new Set(groep.map((r) => r.recipe_id).filter(Boolean));
    if (gerechten.size > 1) continue;
    const maten: Maat[] = [];
    let zonder = 0;
    for (const r of groep) {
      const m = naarBasis(r.quantity, r.unit);
      if (!m) zonder += 1;
      else voegMaatToe(maten, m, r.name);
    }
    if (maten.length > 1) continue; // niet zonder gokken op te tellen
    if (maten.length === 1 && zonder > 0) continue; // "melk" + "1 l melk": niet raden
    const houd = groep.find((r) => r.recipe_id) ?? groep[0]!;
    const weg = groep.filter((r) => r !== houd);
    const samen = maten[0] ? toonbaar(maten[0]) : { quantity: null, unit: houd.unit };
    uit.push({
      soort: "samenvoegen",
      id: `samen:${kern}`,
      houd,
      weg,
      quantity: samen.quantity,
      unit: samen.unit,
      voor: groep.map(tekstVan).join(" + "),
      na: tekstVan({ name: houd.name, quantity: samen.quantity, unit: samen.unit }),
    });
  }
  return uit;
}

function goedkoper(
  open: readonly LijstRij[],
  veilig: (naam: string) => boolean,
  bron: PrijsBron,
  alGeraakt: ReadonlySet<string>,
): SlimVerschil[] {
  const uit: SlimVerschil[] = [];
  for (const r of open) {
    if (alGeraakt.has(r.id) || isAlAlternatief(r.name)) continue;
    const alt = ALTERNATIEVEN.find(([woorden]) => heeftWoord(r.name, woorden));
    if (!alt) continue;
    const [, naam, reden] = alt;
    if (!veilig(naam)) continue;
    const oud = kostVan({ name: r.name, quantity: r.quantity, unit: r.unit }, 1, bron);
    const nieuw = kostVan({ name: naam, quantity: r.quantity, unit: r.unit }, 1, bron);
    if (oud === null || nieuw === null || nieuw >= oud) continue;
    const besparing = Math.round((oud - nieuw) * 100) / 100;
    if (besparing < 0.2) continue;
    uit.push({
      soort: "goedkoper",
      id: `goedkoper:${r.id}`,
      rij: r,
      naam,
      besparing,
      reden,
      voor: tekstVan(r),
      na: tekstVan({ name: naam, quantity: r.quantity, unit: r.unit }),
    });
  }
  return uit.sort((a, b) =>
    a.soort === "goedkoper" && b.soort === "goedkoper" ? b.besparing - a.besparing : 0,
  );
}

function vergeten(
  open: readonly LijstRij[],
  basis: readonly Basis[],
  voorraad: readonly string[],
  veilig: (naam: string) => boolean,
  max: number,
): SlimVerschil[] {
  const gezien: string[] = [];
  const uit: SlimVerschil[] = [];
  for (const b of basis) {
    const naam = b.name.trim();
    if (!naam) continue;
    if (open.some((r) => zelfdeProduct(r.name, naam))) continue;
    if (gezien.some((g) => zelfdeProduct(g, naam))) continue;
    if (voorraad.length && zitInVoorraad(naam, [...voorraad])) continue;
    if (!veilig(naam)) continue;
    gezien.push(naam);
    uit.push({
      soort: "basis",
      id: `basis:${canoniekeNaam(naam) || normaliseerTekst(naam)}`,
      name: naam,
      quantity: b.quantity,
      unit: b.unit,
      reden: b.reden,
      voor: "Niet op je lijst",
      na: tekstVan(b),
    });
    if (uit.length >= max) break;
  }
  return uit;
}

function volgordeTekst(v: readonly CategorieId[]) {
  return v
    .filter((c) => c !== "voorraadkast" && c !== "overige")
    .slice(0, 4)
    .map((c) => CATEGORIE_LABEL[c])
    .join(" → ");
}

/** Het hele voorstel. Puur: dezelfde invoer geeft hetzelfde voorstel. */
export function maakLijstSlimmer(i: SlimInvoer): SlimVoorstel {
  const bron = i.prijsBron ?? SCHATTING;
  const veilig = i.veilig ?? (() => true);
  const open = i.items.filter((r) => !r.checked);
  const verschillen: SlimVerschil[] = [];
  const samen = i.magVerwijderen === false ? [] : dubbels(open);
  verschillen.push(...samen);
  const geraakt = new Set(
    samen.flatMap((v) => (v.soort === "samenvoegen" ? [v.houd.id, ...v.weg.map((w) => w.id)] : [])),
  );
  verschillen.push(...goedkoper(open, veilig, bron, geraakt));
  verschillen.push(...vergeten(open, i.basis ?? [], i.voorraad ?? [], veilig, i.maxBasis ?? 5));
  const naar = volgordeVoorWinkel(i.winkel, i.volgorde);
  if (naar && i.winkel && !zelfdeVolgorde(naar, i.volgorde)) {
    verschillen.push({
      soort: "volgorde",
      id: "volgorde",
      winkel: i.winkel,
      van: [...i.volgorde],
      naar,
      voor: volgordeTekst(i.volgorde),
      na: volgordeTekst(naar),
    });
  }
  const kostNu = kostVanLijst(open, bron);
  const kostNa = kostVanLijst(pasToeOpRijen(open, verschillen), bron);
  return { verschillen, kostNu, kostNa };
}

function kostVanLijst(rijen: readonly LijstRij[], bron: PrijsBron) {
  let t = 0;
  for (const r of rijen)
    t += kostVan({ name: r.name, quantity: r.quantity, unit: r.unit }, 1, bron) ?? 0;
  return Math.round(t * 100) / 100;
}

/** Geschatte kost van wat nog te kopen is, met alleen deze gekozen verschillen. */
export function kostMetKeuze(
  items: readonly LijstRij[],
  gekozen: readonly SlimVerschil[],
  bron: PrijsBron = SCHATTING,
) {
  return kostVanLijst(
    pasToeOpRijen(
      items.filter((r) => !r.checked),
      gekozen,
    ),
    bron,
  );
}

/** De lijst zoals ze zou worden (voor de kost "na"). Basisproducten zonder prijs tellen niet. */
export function pasToeOpRijen(rijen: readonly LijstRij[], gekozen: readonly SlimVerschil[]) {
  let uit = rijen.map((r) => ({ ...r }));
  for (const v of gekozen) {
    if (v.soort === "samenvoegen") {
      const weg = new Set(v.weg.map((w) => w.id));
      uit = uit
        .filter((r) => !weg.has(r.id))
        .map((r) => (r.id === v.houd.id ? { ...r, quantity: v.quantity, unit: v.unit } : r));
    } else if (v.soort === "goedkoper") {
      uit = uit.map((r) => (r.id === v.rij.id ? { ...r, name: v.naam } : r));
    } else if (v.soort === "basis") {
      uit.push({
        id: v.id,
        name: v.name,
        quantity: v.quantity,
        unit: v.unit,
        checked: false,
      });
    }
  }
  return uit;
}

// ---------------------------------------------------------------- uitvoeren en terugdraaien

export type SlimStappen = {
  /** Rijen bijwerken: id + nieuwe velden. */
  bijwerken: { id: string; velden: Partial<Pick<LijstRij, "name" | "quantity" | "unit">> }[];
  /** Rijen weghalen (volledige rij bewaard voor ongedaan maken). */
  weghalen: LijstRij[];
  /** Nieuwe rijen. */
  toevoegen: { name: string; quantity: number | null; unit: string }[];
  /** Nieuwe winkelvolgorde, of null. */
  volgorde: CategorieId[] | null;
};

/** Wat er in de databank moet gebeuren voor deze gekozen verschillen. */
export function stappenVoor(gekozen: readonly SlimVerschil[]): SlimStappen {
  const s: SlimStappen = { bijwerken: [], weghalen: [], toevoegen: [], volgorde: null };
  for (const v of gekozen) {
    if (v.soort === "samenvoegen") {
      s.bijwerken.push({ id: v.houd.id, velden: { quantity: v.quantity, unit: v.unit } });
      s.weghalen.push(...v.weg);
    } else if (v.soort === "goedkoper") {
      s.bijwerken.push({ id: v.rij.id, velden: { name: v.naam } });
    } else if (v.soort === "basis") {
      s.toevoegen.push({ name: v.name, quantity: v.quantity, unit: v.unit });
    } else {
      s.volgorde = v.naar;
    }
  }
  return s;
}

export type SlimHerstel = {
  /** Oude waarden terugzetten op de bijgewerkte rijen. */
  terugzetten: { id: string; velden: Pick<LijstRij, "name" | "quantity" | "unit"> }[];
  /** Weggehaalde rijen opnieuw toevoegen (zelfde naam, hoeveelheid, gerecht, notitie). */
  opnieuw: LijstRij[];
  /** Namen van de toegevoegde rijen (die gaan weer weg). */
  toegevoegd: string[];
  volgorde: CategorieId[] | null;
};

/** Eén keer ongedaan maken: precies terug naar hoe het was. */
export function herstelStappen(
  gekozen: readonly SlimVerschil[],
  vorigeVolgorde: readonly CategorieId[],
): SlimHerstel {
  const s = stappenVoor(gekozen);
  const oud = new Map<string, LijstRij>();
  for (const v of gekozen) {
    if (v.soort === "samenvoegen") oud.set(v.houd.id, v.houd);
    if (v.soort === "goedkoper") oud.set(v.rij.id, v.rij);
  }
  return {
    terugzetten: s.bijwerken.map((b) => {
      const r = oud.get(b.id)!;
      return { id: b.id, velden: { name: r.name, quantity: r.quantity, unit: r.unit } };
    }),
    opnieuw: s.weghalen,
    toegevoegd: s.toevoegen.map((t) => t.name),
    volgorde: s.volgorde ? [...vorigeVolgorde] : null,
  };
}

/** Korte samenvatting na "Doe maar". */
export function samenvatting(gekozen: readonly SlimVerschil[]): string {
  const tel = (s: SlimVerschil["soort"]) => gekozen.filter((v) => v.soort === s).length;
  const delen: string[] = [];
  const n = tel("samenvoegen");
  if (n) delen.push(`${n} ${n === 1 ? "dubbel" : "dubbels"} samengevoegd`);
  const g = tel("goedkoper");
  if (g) delen.push(`${g} goedkoper`);
  const b = tel("basis");
  if (b) delen.push(`${b} vergeten ${b === 1 ? "product" : "producten"} erbij`);
  if (tel("volgorde")) delen.push("volgorde van je winkel aangepast");
  return delen.length ? `${delen.join(", ")}.` : "Niets veranderd.";
}

/** "Met deze keuzes: ≈ € 3,10 goedkoper (richtprijzen)". */
export function kostZin(nu: number, na: number): string {
  const verschil = Math.round((nu - na) * 100) / 100;
  if (verschil > 0) return `≈ ${euro(verschil)} goedkoper (richtprijzen, geen winkelprijzen)`;
  if (verschil < 0)
    return `≈ ${euro(-verschil)} meer, door de vergeten producten (richtprijzen, geen winkelprijzen)`;
  return "Zelfde geschatte kost (richtprijzen, geen winkelprijzen)";
}
