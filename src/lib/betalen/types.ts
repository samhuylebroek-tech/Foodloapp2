/**
 * Betaalproviderabstractie (COMMERCIAL_ROADMAP §1 en §4). Geen enkele provider is hard gekoppeld:
 * de app praat met `BetaalProvider`. Vandaag bestaat alleen `TestBetaalProvider` (lokaal, geen
 * netwerk, geen geld). Een echte provider (hosted checkout, PCI-conform, nooit kaartgegevens bij
 * Foodlo) komt pas na gate G5: juridische, btw- en veiligheidsreview en `BETAALPROVIDER_GEKOPPELD`.
 */
import { PRIJZEN } from "./prijzen";
import { NIVEAUS } from "./rechten";

export type AbonnementStatus = "geen" | "proef" | "actief" | "opgezegd" | "betaling_mislukt";

export type PlanId = "premium_maand" | "premium_jaar" | "partner_basis" | "partner_plus";

export type Plan = {
  id: PlanId;
  naam: string;
  /** Voorstel, nog niet te koop. In eurocent, btw inbegrepen. */
  prijsCent: number;
  interval: "maand" | "jaar";
  proefDagen: number;
  voor: "consument" | "partner";
  rechten: string[];
};

/**
 * Prijzen komen uit `prijzen.ts`, rechten uit de centrale lijst `rechten.ts` (NIVEAUS). Hier staat
 * alleen welk plan bij welk niveau hoort.
 */
export const PLANNEN: Record<PlanId, Plan> = {
  premium_maand: {
    id: "premium_maand",
    naam: "Foodlo Premium",
    prijsCent: PRIJZEN.premium.maandCent,
    interval: "maand",
    proefDagen: PRIJZEN.premium.proefDagen,
    voor: "consument",
    rechten: [...NIVEAUS.premium.rechten],
  },
  premium_jaar: {
    id: "premium_jaar",
    naam: "Foodlo Premium (jaar)",
    prijsCent: PRIJZEN.premium.jaarCent,
    interval: "jaar",
    proefDagen: PRIJZEN.premium.proefDagen,
    voor: "consument",
    rechten: [...NIVEAUS.premium.rechten],
  },
  partner_basis: {
    id: "partner_basis",
    naam: "Partner Basis",
    prijsCent: PRIJZEN.partner.basisMaandCent,
    interval: "maand",
    proefDagen: 0,
    voor: "partner",
    rechten: [...NIVEAUS.partner_basis.rechten],
  },
  partner_plus: {
    id: "partner_plus",
    naam: "Partner Plus",
    prijsCent: PRIJZEN.partner.plusMaandCent,
    interval: "maand",
    proefDagen: 0,
    voor: "partner",
    rechten: [...NIVEAUS.partner_plus.rechten],
  },
};

/** Genormaliseerde gebeurtenis van een provider (webhook), los van de providernaam. */
export type BetaalEventSoort =
  | "checkout_voltooid"
  | "proef_gestart"
  | "betaling_gelukt"
  | "betaling_mislukt"
  | "opgezegd"
  | "periode_afgelopen"
  /** Fase 6: terugbetaling binnen de herroepingstermijn; Premium stopt meteen. */
  | "terugbetaald";

export type BetaalEvent = {
  /** Uniek per provider-gebeurtenis; dubbel ontvangen = één keer verwerken. */
  id: string;
  soort: BetaalEventSoort;
  abonnementRef: string;
  plan: PlanId;
  /** ISO-tijd. */
  tijd: string;
  bedragCent?: number;
};

export type CheckoutResultaat = {
  sessieId: string;
  abonnementRef: string;
  /** Bij een echte provider: de URL van de gehoste betaalpagina. Bij de test: een lokaal pad. */
  url: string;
  modus: "test" | "live";
};

/** Controleert de handtekening van een webhook (elke provider heeft zijn eigen schema). */
export interface WebhookVerifier {
  verifieer(ruweBody: string, handtekening: string | null | undefined): boolean;
}

export type TerugbetalingResultaat = {
  ref: string;
  bedragCent: number;
  /** Test: er werd niets teruggestort. Live: de provider bevestigt via een webhook. */
  status: "test_terugbetaald" | "aangevraagd";
  modus: "test" | "live";
};

export type UitbetalingResultaat = {
  ref: string;
  bedragCent: number;
  /** Test: zou uitbetaald worden; er gaat geen geld naar de maker. */
  status: "zou_uitbetaald_worden" | "aangevraagd";
  modus: "test" | "live";
};

/**
 * Wat elke betaalprovider moet kunnen (fase 6). Eisen aan een echte provider (PCI via gehoste
 * checkout, btw/OSS, marketplace-uitbetalingen met KYC, chargebacks): docs/foodlo/BETAALPROVIDER-EISEN.md.
 */
export interface BetaalProvider {
  readonly naam: string;
  readonly modus: "test" | "live";
  /** Gehoste checkout: kaartgegevens komen nooit bij Foodlo. */
  startCheckout(i: { plan: PlanId; klantRef: string }): Promise<CheckoutResultaat>;
  haalStatus(abonnementRef: string): Promise<AbonnementStatus>;
  annuleer(abonnementRef: string): Promise<BetaalEvent>;
  /** Weigert (gooit) bij een ongeldige handtekening; geeft anders het genormaliseerde event. */
  verwerkWebhook(ruweBody: string, handtekening: string | null | undefined): Promise<BetaalEvent>;
  /** Terugbetaling van (een deel van) een betaling. Weigert een bedrag ≤ 0. */
  terugbetaal(i: {
    abonnementRef: string;
    bedragCent: number;
    reden: string;
  }): Promise<TerugbetalingResultaat>;
  /** Uitbetaling aan een maker (marketplace). Vereist bij een echte provider een KYC-check. */
  startUitbetaling(i: {
    ontvangerRef: string;
    bedragCent: number;
    periode: string;
  }): Promise<UitbetalingResultaat>;
}

export { euro } from "./prijzen";
