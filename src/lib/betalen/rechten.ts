/**
 * Fase 6 — de ENIGE lijst van rechten (entitlements) en wat elk niveau ontgrendelt.
 * Schermen, serverfuncties en AI-limieten lezen deze lijst; nergens anders wordt beslist wat
 * betalend is. Controle gebeurt twee keer: op de server (`vereisRecht` met de rechten uit de
 * databank, die alleen de server schrijft) én in de UI (`PremiumSlot` toont een nette uitleg).
 *
 * Grondregel (voorstel aan de eigenaar, zie docs/foodlo/COMMERCIAL_ROADMAP.md §Indeling):
 * wat vandaag gratis is, blijft gratis. Veiligheid (allergieën, dieet), boodschappenlijst,
 * planning, recepten, voorraad, gezin, kookstand en je gegevens exporteren staan NOOIT achter een
 * betaalmuur. Premium voegt alleen extra's toe. AI-limieten zijn voor iedereen gelijk, zodat de
 * AI-kosten voorspelbaar blijven (kostrem).
 *
 * Bewust geen imports uit ./types (die leest NIVEAUS hier): zo is er geen kringverwijzing.
 */
import { heeftRecht, type Entitlement, type Gebruiker } from "./entitlements";

export type Niveau = "gratis" | "premium" | "maker" | "partner_basis" | "partner_plus";

export type RechtInfo = {
  titel: string;
  /** Eén zin in gewone taal: wat je ermee kan. */
  uitleg: string;
  niveau: Exclude<Niveau, "gratis">;
};

/** Alle betalende rechten. Een recht dat hier niet staat, bestaat niet. */
export const RECHTEN = {
  "premium.weekmenu_extra": {
    titel: "Extra weekmenu-sjablonen",
    uitleg: "Kant-en-klare weken (snel, veggie, budget) om je weekmenu mee te starten.",
    niveau: "premium",
  },
  "premium.seizoenskalender": {
    titel: "Seizoenskalender",
    uitleg: "Wat deze maand in België op zijn best is, met ideeën om ermee te koken.",
    niveau: "premium",
  },
  "partner.producten": {
    titel: "Producten koppelen",
    uitleg: "Je producten koppelen aan ingrediënten in recepten.",
    niveau: "partner_basis",
  },
  "partner.campagnes": {
    titel: "Campagnes",
    uitleg: "Gesponsorde recepten en campagnes (altijd gemarkeerd als gesponsord).",
    niveau: "partner_plus",
  },
  "partner.rapportage_export": {
    titel: "Rapportage exporteren",
    uitleg: "Dagtotalen van je campagnes als bestand (nooit gegevens per persoon).",
    niveau: "partner_plus",
  },
} as const satisfies Record<string, RechtInfo>;

export type BekendRecht = keyof typeof RECHTEN;

/** Kernfuncties: nooit betalend. Een test bewaakt dat geen recht hier ooit een betaalmuur krijgt. */
export const KERN_GRATIS = [
  "Allergie- en dieetcontrole",
  "Boodschappenlijst",
  "Weekmenu plannen",
  "Recepten bewaren, importeren en koken",
  "Voorraad",
  "Gezin en delen",
  "Kookstand",
  "Je gegevens bekijken en exporteren",
] as const;

/** Woorden die in een betalend recht nooit mogen voorkomen (veiligheid, lijst, planning…). */
export const KERN_SLEUTELWOORDEN = [
  "allergie",
  "dieet",
  "veiligheid",
  "lijst",
  "boodschap",
  "planning",
  "planner",
  "voorraad",
  "gezin",
  "export",
  "kookstand",
] as const;

export const NIVEAUS: Record<
  Niveau,
  { naam: string; uitleg: string; rechten: readonly BekendRecht[] }
> = {
  gratis: {
    naam: "Gratis",
    uitleg: "Alles om te plannen, te winkelen en veilig te koken.",
    rechten: [],
  },
  premium: {
    naam: "Premium",
    uitleg: "Extra's bovenop alles wat gratis blijft.",
    rechten: ["premium.weekmenu_extra", "premium.seizoenskalender"],
  },
  maker: {
    naam: "Abonnement op een maker",
    uitleg: "Exclusieve recepten en collecties van die ene maker (recht maker:<id>).",
    rechten: [],
  },
  partner_basis: {
    naam: "Partner Basis",
    uitleg: "Organisatieprofiel en producten koppelen.",
    rechten: ["partner.producten"],
  },
  partner_plus: {
    naam: "Partner Plus",
    uitleg: "Ook campagnes en rapportage.",
    rechten: ["partner.producten", "partner.campagnes", "partner.rapportage_export"],
  },
};

/** AI-limieten per niveau: bewust gelijk (kostenbeheersing). Gelezen door de kookassistent. */
export const AI_LIMIETEN: Record<"gratis" | "premium", { assistentPerDag: number }> = {
  gratis: { assistentPerDag: 20 },
  premium: { assistentPerDag: 20 },
};

const MAKER_RECHT = /^maker:[0-9a-f-]{36}$/;

export function isBekendRecht(recht: string): recht is BekendRecht {
  return Object.prototype.hasOwnProperty.call(RECHTEN, recht);
}

/** Titel en uitleg voor elk recht, ook `maker:<id>`. Onbekend → `null`. */
export function beschrijfRecht(recht: string): RechtInfo | null {
  if (isBekendRecht(recht)) return RECHTEN[recht];
  if (MAKER_RECHT.test(recht))
    return {
      titel: "Exclusief van deze maker",
      uitleg: "Recepten en collecties die deze maker alleen met abonnees deelt.",
      niveau: "maker",
    };
  return null;
}

/** Welk niveau vraagt dit recht? Voor de juiste uitleg ("Dit hoort bij Premium"). */
export function niveauVan(recht: string): Niveau | null {
  return beschrijfRecht(recht)?.niveau ?? null;
}

export const NIVEAU_NAAM: Record<Niveau, string> = {
  gratis: "Gratis",
  premium: "Premium",
  maker: "een makerabonnement",
  partner_basis: "Partner Basis",
  partner_plus: "Partner Plus",
};

/** Daglimiet van de kookassistent voor deze gebruiker (uit AI_LIMIETEN). */
export function aiDaglimiet(entitlements: readonly Entitlement[], nu: Date = new Date()): number {
  const premium = NIVEAUS.premium.rechten.some((r) => heeftRecht({ id: "x", entitlements }, r, nu));
  return AI_LIMIETEN[premium ? "premium" : "gratis"].assistentPerDag;
}

/** Vaste foutcode: de UI herkent ze en toont de vriendelijke uitleg i.p.v. een foutmelding. */
export const GEEN_RECHT = "GEEN_RECHT";

export function geenRechtBoodschap(recht: string): string {
  const info = beschrijfRecht(recht);
  const niveau = info ? NIVEAU_NAAM[info.niveau] : "een abonnement";
  return `${GEEN_RECHT}: Dit hoort bij ${niveau}. ${info ? info.uitleg : ""} Alles wat je gratis gebruikt, blijft gratis.`.trim();
}

export function isGeenRechtFout(e: unknown): boolean {
  const t = e instanceof Error ? e.message : String(e ?? "");
  return t.includes(GEEN_RECHT);
}

/**
 * Servercontrole: gooit een fout met `GEEN_RECHT` als de gebruiker het recht niet (meer) heeft.
 * Onbekende rechten worden altijd geweigerd (geen tikfout die per ongeluk iets openzet).
 */
export function vereisRecht(gebruiker: Gebruiker, recht: string, nu: Date = new Date()): void {
  if (!beschrijfRecht(recht) || !heeftRecht(gebruiker, recht, nu)) {
    throw new Error(geenRechtBoodschap(recht));
  }
}
