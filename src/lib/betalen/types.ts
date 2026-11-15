/**
 * Betaalproviderabstractie (COMMERCIAL_ROADMAP §1 en §4). Geen enkele provider is hard gekoppeld:
 * de app praat met `BetaalProvider`. Vandaag bestaat alleen `TestBetaalProvider` (lokaal, geen
 * netwerk, geen geld). Een echte provider (hosted checkout, PCI-conform, nooit kaartgegevens bij
 * Foodlo) komt pas na gate G5: juridische, btw- en veiligheidsreview en `BETAALPROVIDER_GEKOPPELD`.
 */

export type AbonnementStatus = "geen" | "proef" | "actief" | "opgezegd" | "betaling_mislukt";

export type PlanId = "premium_maand" | "partner_basis" | "partner_plus";

export type Plan = {
  id: PlanId;
  naam: string;
  /** Voorstel, nog niet te koop. In eurocent, btw inbegrepen. */
  prijsCent: number;
  interval: "maand";
  proefDagen: number;
  voor: "consument" | "partner";
  rechten: string[];
};

export const PLANNEN: Record<PlanId, Plan> = {
  premium_maand: {
    id: "premium_maand",
    naam: "Foodlo Premium",
    prijsCent: 499,
    interval: "maand",
    proefDagen: 14,
    voor: "consument",
    rechten: ["premium.weekmenu_extra", "premium.seizoenskalender"],
  },
  partner_basis: {
    id: "partner_basis",
    naam: "Partner Basis",
    prijsCent: 0,
    interval: "maand",
    proefDagen: 0,
    voor: "partner",
    rechten: ["partner.producten"],
  },
  partner_plus: {
    id: "partner_plus",
    naam: "Partner Plus",
    prijsCent: 4900,
    interval: "maand",
    proefDagen: 0,
    voor: "partner",
    rechten: ["partner.producten", "partner.campagnes", "partner.rapportage_export"],
  },
};

/** Genormaliseerde gebeurtenis van een provider (webhook), los van de providernaam. */
export type BetaalEventSoort =
  | "checkout_voltooid"
  | "proef_gestart"
  | "betaling_gelukt"
  | "betaling_mislukt"
  | "opgezegd"
  | "periode_afgelopen";

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

export interface BetaalProvider {
  readonly naam: string;
  readonly modus: "test" | "live";
  startCheckout(i: { plan: PlanId; klantRef: string }): Promise<CheckoutResultaat>;
  haalStatus(abonnementRef: string): Promise<AbonnementStatus>;
  annuleer(abonnementRef: string): Promise<BetaalEvent>;
  /** Weigert (gooit) bij een ongeldige handtekening; geeft anders het genormaliseerde event. */
  verwerkWebhook(ruweBody: string, handtekening: string | null | undefined): Promise<BetaalEvent>;
}

/** "€ 4,99" (Belgische notatie). */
export function euro(cent: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(cent / 100);
}
