/**
 * Fase 4 — abonnement op een maker, uitsluitend in TESTMODUS (er wordt niets aangerekend).
 * Pure regels, getest in maker-abonnement.test.ts. De schrijfacties lopen via de server
 * (maker-abonnement.functions.ts), nooit rechtstreeks vanuit de browser.
 *
 * - Toegang tot exclusieve recepten en collecties loopt via `heeftRecht` met het recht
 *   `maker:<creator-id>` (afgeleid uit actieve abonnementen). In productie dwingt RLS (voorstel
 *   0021) dezelfde regel af in de databank.
 * - Opzeggen stopt de toegang meteen. Testterugbetaling: binnen 14 dagen alles (herroeping),
 *   daarna het ongebruikte deel van de maand. Echte regels volgen na juridische en fiscale review.
 * - Prijzen zijn inclusief btw; de btw staat erbij als tekst (België, 21 %, voorstel).
 */
import { heeftRecht, type Entitlement } from "./entitlements";
import { FEE_VOORSTEL, leesPrijs, verdeelOpbrengst } from "./fee";
import { euro } from "./types";

export const MAKER_PERIODE_DAGEN = 30;
export const HERROEPING_DAGEN = 14;
export const MAX_VOORDELEN = 5;

export type MakerPlan = {
  id?: string;
  creator_id: string;
  prijs_cent: number;
  voordelen: string[];
  actief: boolean;
  modus?: "test";
};

export type MakerAbonnementStatus = "actief" | "opgezegd";

export type MakerAbonnement = {
  id: string;
  fan_id: string;
  creator_id: string;
  status: MakerAbonnementStatus;
  modus: "test";
  prijs_cent: number;
  start_op: string;
  periode_einde: string;
  opgezegd_op: string | null;
};

export type MakerBetaling = {
  id: string;
  soort: "betaling" | "terugbetaling";
  bedrag_cent: number;
  btw_cent: number;
  test: true;
  created_at: string;
};

export function makerRecht(creatorId: string): string {
  return `maker:${creatorId}`;
}

/** Rechten uit de abonnementen van één fan: alleen actief én binnen de periode. */
export function rechtenUitMakerAbonnementen(
  abonnementen: readonly Pick<MakerAbonnement, "creator_id" | "status" | "periode_einde">[],
  nu: Date = new Date(),
): Entitlement[] {
  return abonnementen
    .filter((a) => a.status === "actief" && new Date(a.periode_einde).getTime() >= nu.getTime())
    .map((a) => ({ recht: makerRecht(a.creator_id), geldig_tot: a.periode_einde }));
}

/**
 * Mag deze gebruiker de inhoud van een exclusief recept of collectie van deze maker zien?
 * Niet-exclusief: altijd (de gewone zichtbaarheidsregels gelden). De maker zelf: altijd.
 */
export function magExclusiefZien(i: {
  exclusief: boolean | null | undefined;
  creatorId: string;
  isMaker: boolean;
  gebruiker: { id: string; entitlements: readonly Entitlement[] } | null;
  nu?: Date;
}): boolean {
  if (!i.exclusief || i.isMaker) return true;
  return heeftRecht(i.gebruiker, makerRecht(i.creatorId), i.nu);
}

/** Prijs en voordelen uit het formulier van de maker, of een uitleg in gewone taal. */
export function valideerMakerPlan(
  prijsInvoer: string,
  voordelenTekst: string,
): { prijs_cent: number; voordelen: string[] } | { fout: string } {
  const prijs = leesPrijs(prijsInvoer);
  if (!prijs) return { fout: "Geef een testprijs tussen € 1 en € 50 per maand, bv. 3,99." };
  const voordelen = [
    ...new Set(
      voordelenTekst
        .split(/\n/)
        .map((v) => v.replace(/^[-•*\s]+/, "").trim())
        .filter(Boolean),
    ),
  ];
  if (!voordelen.length) return { fout: "Schrijf minstens één voordeel voor je abonnees." };
  if (voordelen.length > MAX_VOORDELEN)
    return { fout: `Hoogstens ${MAX_VOORDELEN} voordelen, één per regel.` };
  if (voordelen.some((v) => v.length > 80))
    return { fout: "Houd elk voordeel kort: hoogstens 80 tekens." };
  return { prijs_cent: prijs, voordelen };
}

/** "€ 3,99 per maand" */
export function prijsTekst(cent: number): string {
  return `${euro(cent)} per maand`;
}

/** "Inclusief € 0,69 btw (21 %)" */
export function btwTekst(cent: number): string {
  const v = verdeelOpbrengst(cent);
  return `Inclusief ${euro(v.btwCent)} btw (${FEE_VOORSTEL.btwProcent} %)`;
}

function plusDagen(iso: string, dagen: number): string {
  return new Date(new Date(iso).getTime() + dagen * 86_400_000).toISOString();
}

/** Nieuw (of hernieuwd) testabonnement vanaf `nu`. */
export function nieuwePeriode(nu: Date = new Date()): { start_op: string; periode_einde: string } {
  const start = nu.toISOString();
  return { start_op: start, periode_einde: plusDagen(start, MAKER_PERIODE_DAGEN) };
}

/**
 * Wat gebeurt er bij opzeggen? Toegang stopt meteen. Testterugbetaling: binnen de
 * herroepingstermijn alles, daarna het ongebruikte deel (in hele dagen, afgerond op een cent).
 */
export function opzegBerekening(
  a: Pick<MakerAbonnement, "start_op" | "periode_einde" | "prijs_cent">,
  nu: Date = new Date(),
): { terugCent: number; uitleg: string } {
  const start = new Date(a.start_op).getTime();
  const einde = new Date(a.periode_einde).getTime();
  const t = nu.getTime();
  if (t >= einde)
    return { terugCent: 0, uitleg: "De maand is voorbij: er valt niets terug te betalen." };
  if (t - start <= HERROEPING_DAGEN * 86_400_000)
    return {
      terugCent: a.prijs_cent,
      uitleg: `Binnen ${HERROEPING_DAGEN} dagen na de start: je krijgt alles terug (${euro(a.prijs_cent)}, testmodus).`,
    };
  const dagenOver = Math.floor((einde - t) / 86_400_000);
  const terug = Math.round((a.prijs_cent * dagenOver) / MAKER_PERIODE_DAGEN);
  return {
    terugCent: terug,
    uitleg: terug
      ? `Je krijgt het ongebruikte deel terug: ${euro(terug)} voor ${dagenOver} ${dagenOver === 1 ? "dag" : "dagen"} (testmodus).`
      : "Er blijft minder dan een dag over: er valt niets terug te betalen.",
  };
}

/** Wat de maker ziet: aantal en een schatting van zijn deel. Nooit betaalgegevens. */
export function abonneesSamenvatting(
  aantalActief: number,
  plan: Pick<MakerPlan, "prijs_cent"> | null,
): { aantal: number; schattingMakerCent: number } {
  const per = plan ? verdeelOpbrengst(plan.prijs_cent).makerCent : 0;
  return { aantal: aantalActief, schattingMakerCent: per * Math.max(0, aantalActief) };
}

/** Voornaam voor de abonneelijst van de maker (privacy: nooit de volledige naam). */
export function voornaamVan(weergavenaam: string | null | undefined): string {
  const v = (weergavenaam ?? "").trim().split(/\s+/)[0] ?? "";
  return v ? v.slice(0, 30) : "Een fan";
}
