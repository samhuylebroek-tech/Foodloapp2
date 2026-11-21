/**
 * Partnerportaal (MODULE_DESIGNS §10, COMMERCIAL_ROADMAP §1): pure regels zonder databank.
 *
 * Grondregels:
 * - commercieel is altijd gelabeld ("Gesponsord" / "In samenwerking met …");
 * - gesponsorde inhoud staat op één vaste plek in Ontdek en nooit tussen persoonlijke voorstellen;
 * - allergie- en dieetregels gelden ook voor gesponsorde recepten (zie `magGesponsordTonen`);
 * - partners zien alleen geaggregeerde cijfers (dagtotalen), nooit individuele gebruikers;
 * - het Foodlo-team keurt elke campagne goed voor ze getoond wordt.
 */
import { magVoorstellen } from "@/lib/veiligheid";
import type { Dieet } from "@/lib/kennismaking";

export type PartnerSoort = "merk" | "producent" | "retail" | "restaurant";
export type PartnerRol = "eigenaar" | "beheerder" | "analist" | "finance";
export type CampagneStatus = "concept" | "ingediend" | "goedgekeurd" | "actief" | "afgelopen";
export type Verificatie = "aangevraagd" | "geverifieerd" | "geweigerd";

export type Partner = {
  id: string;
  naam: string;
  soort: PartnerSoort;
  website: string | null;
  logo_url: string | null;
  verificatie_status: Verificatie;
  omschrijving?: string | null;
};

export type PartnerLid = {
  id: string;
  partner_id: string;
  user_id: string;
  rol: PartnerRol;
};

export type Campagne = {
  id: string;
  partner_id: string;
  naam: string;
  status: CampagneStatus;
  start: string | null;
  einde: string | null;
  doel: string | null;
  beoordeling_reden?: string | null;
  /** Voorstel 0022: testbudget in eurocent (niets wordt aangerekend). */
  testbudget_cent?: number | null;
};

export type GesponsordItem = {
  id: string;
  campagne_id: string;
  soort: "recept" | "product";
  recipe_id: string | null;
  product_naam: string | null;
  label_tekst: string;
};

export type PartnerProduct = {
  id: string;
  partner_id: string;
  naam: string;
  ingredient_koppeling: string;
  ean: string | null;
};

export type Dagtotaal = {
  campagne_id: string;
  dag: string;
  vertoningen: number;
  klikken: number;
};

export const PARTNER_SOORTEN: { waarde: PartnerSoort; label: string }[] = [
  { waarde: "merk", label: "Merk" },
  { waarde: "producent", label: "Producent" },
  { waarde: "retail", label: "Winkel of supermarkt" },
  { waarde: "restaurant", label: "Restaurant" },
];

export const ROL_LABEL: Record<PartnerRol, string> = {
  eigenaar: "Eigenaar",
  beheerder: "Beheerder",
  analist: "Analist",
  finance: "Financiën",
};

export const STATUS_LABEL: Record<CampagneStatus, string> = {
  concept: "Concept",
  ingediend: "Wacht op goedkeuring door Foodlo",
  goedgekeurd: "Goedgekeurd",
  actief: "Actief",
  afgelopen: "Afgelopen",
};

export type PartnerActie =
  | "profiel.bewerken"
  | "producten.bewerken"
  | "campagnes.bewerken"
  | "rapportage.zien"
  | "team.beheren"
  | "abonnement.beheren";

const RECHTEN: Record<PartnerRol, PartnerActie[]> = {
  eigenaar: [
    "profiel.bewerken",
    "producten.bewerken",
    "campagnes.bewerken",
    "rapportage.zien",
    "team.beheren",
    "abonnement.beheren",
  ],
  beheerder: ["profiel.bewerken", "producten.bewerken", "campagnes.bewerken", "rapportage.zien"],
  analist: ["rapportage.zien"],
  finance: ["rapportage.zien", "abonnement.beheren"],
};

/** Mag deze rol deze actie? Dezelfde matrix staat in RLS-voorstel 0011 (partner_mag). */
export function partnerMag(rol: PartnerRol | null | undefined, actie: PartnerActie): boolean {
  if (!rol) return false;
  return RECHTEN[rol].includes(actie);
}

/** Een campagne bewerken (en items koppelen) kan alleen zolang ze een concept is. */
export function campagneBewerkbaar(c: Pick<Campagne, "status">): boolean {
  return c.status === "concept";
}

/** Reden waarom indienen niet kan, of `null`. */
export function indienFout(
  c: Pick<Campagne, "status" | "naam" | "start" | "einde">,
  aantalItems: number,
): string | null {
  if (c.status !== "concept") return "Alleen een concept kan ingediend worden.";
  if (!c.naam.trim()) return "Geef de campagne een naam.";
  if (!c.start || !c.einde) return "Kies een begin- en einddatum.";
  if (c.einde < c.start) return "De einddatum ligt vóór de begindatum.";
  if (aantalItems < 1) return "Koppel eerst een recept of product aan de campagne.";
  return null;
}

/** Loopt een goedgekeurde of actieve campagne vandaag? (`dag` als JJJJ-MM-DD.) */
export function campagneLoopt(c: Pick<Campagne, "status" | "start" | "einde">, dag: string) {
  if (c.status !== "goedgekeurd" && c.status !== "actief") return false;
  if (!c.start || !c.einde) return false;
  return c.start <= dag && dag <= c.einde;
}

/**
 * Kiest de ene gesponsorde plek voor Ontdek: het eerste item van een lopende campagne, in vaste
 * volgorde (oudste start eerst), dus geen verborgen sturing per persoon. Max 1.
 */
export function kiesGesponsordePlek<I extends Pick<GesponsordItem, "campagne_id">>(
  campagnes: readonly Pick<Campagne, "id" | "status" | "start" | "einde">[],
  items: readonly I[],
  dag: string,
): I | null {
  const lopend = campagnes
    .filter((c) => campagneLoopt(c, dag))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "") || a.id.localeCompare(b.id));
  for (const c of lopend) {
    const item = items.find((i) => i.campagne_id === c.id);
    if (item) return item;
  }
  return null;
}

/**
 * Ontdek-indeling: persoonlijke voorstellen en de gesponsorde plek blijven twee aparte lijsten.
 * Een gesponsord recept dat ook als voorstel zou verschijnen, gaat uit de voorstellen (geen
 * dubbel, en nooit ongelabeld). Het resultaat bevat nooit een gesponsord item in `voorstellen`.
 */
export function deelOntdekIn<V extends { id: string }>(
  voorstellen: readonly V[],
  gesponsord: { recipe_id: string | null } | null,
): { voorstellen: V[]; gesponsord: typeof gesponsord } {
  const weg = gesponsord?.recipe_id ?? null;
  return { voorstellen: voorstellen.filter((v) => v.id !== weg), gesponsord };
}

/**
 * Dezelfde harde regel als persoonlijke voorstellen: een gesponsord recept met een gekozen
 * allergeen, zonder te controleren ingrediënten (bij allergieën) of buiten het dieet wordt niet
 * getoond. Een betaalde plek koopt geen uitzondering op veiligheid.
 */
export function magGesponsordTonen(
  g: { title: string; tags: string[]; ingredienten: string[] },
  wie: { allergieen: readonly string[]; dieet?: Dieet | null | undefined },
): boolean {
  if (!wie.allergieen.length && !wie.dieet) return true;
  return magVoorstellen(g, wie);
}

/** Het label dat de consument ziet. Leeg of misleidend label → altijd "Gesponsord". */
export function gesponsordLabel(labelTekst: string | null | undefined, partnerNaam: string) {
  const t = (labelTekst ?? "").trim();
  const basis = /^(gesponsord|advertentie|reclame|in samenwerking met)/i.test(t) ? t : "Gesponsord";
  return { label: basis, partner: `In samenwerking met ${partnerNaam}` };
}

/** Alleen totalen: som per campagne en over alles, met klikratio in procent (1 decimaal). */
export function rapportTotalen(dagen: readonly Dagtotaal[]) {
  const per = new Map<string, { vertoningen: number; klikken: number }>();
  let vertoningen = 0;
  let klikken = 0;
  for (const d of dagen) {
    const v = Math.max(0, Math.round(d.vertoningen));
    const k = Math.max(0, Math.round(d.klikken));
    vertoningen += v;
    klikken += k;
    const p = per.get(d.campagne_id) ?? { vertoningen: 0, klikken: 0 };
    p.vertoningen += v;
    p.klikken += k;
    per.set(d.campagne_id, p);
  }
  const ratio = (k: number, v: number) => (v > 0 ? Math.round((k / v) * 1000) / 10 : 0);
  return {
    vertoningen,
    klikken,
    klikratio: ratio(klikken, vertoningen),
    perCampagne: [...per.entries()].map(([campagne_id, p]) => ({
      campagne_id,
      ...p,
      klikratio: ratio(p.klikken, p.vertoningen),
    })),
  };
}

/** Er moet altijd minstens één eigenaar overblijven. */
export function rolWijzigingFout(
  leden: readonly Pick<PartnerLid, "id" | "rol">[],
  lidId: string,
  nieuweRol: PartnerRol | null,
): string | null {
  const lid = leden.find((l) => l.id === lidId);
  if (!lid) return "Dit teamlid bestaat niet meer.";
  const eigenaars = leden.filter((l) => l.rol === "eigenaar").length;
  if (lid.rol === "eigenaar" && nieuweRol !== "eigenaar" && eigenaars <= 1) {
    return "Er moet minstens één eigenaar blijven.";
  }
  return null;
}

/** "2026-11-15" → "15 nov. 2026" (Belgische notatie). */
export function korteDatum(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
}

/** Website netjes: alleen https, anders `null`. */
export function veiligeWebsite(invoer: string): string | null {
  const t = invoer.trim();
  if (!t) return null;
  const met = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(met);
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
