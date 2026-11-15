/**
 * TestBetaalProvider: simuleert alles lokaal (geen netwerk, geen geld, geen kaartgegevens).
 * Elke gebeurtenis gaat langs dezelfde webhookweg als bij een echte provider: body + handtekening
 * → `verwerkWebhook` → genormaliseerd `BetaalEvent`.
 */
import { testHandtekening, TestWebhookVerifier } from "./handtekening";
import { verwerkEvent, type AbonnementStaat } from "./statusmachine";
import {
  PLANNEN,
  type AbonnementStatus,
  type BetaalEvent,
  type BetaalEventSoort,
  type BetaalProvider,
  type CheckoutResultaat,
  type PlanId,
} from "./types";

let teller = 0;
function nieuwId(prefix: string) {
  teller += 1;
  return `${prefix}_${Date.now().toString(36)}_${teller.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class TestBetaalProvider implements BetaalProvider {
  readonly naam = "test";
  readonly modus = "test" as const;
  private readonly verifier = new TestWebhookVerifier();
  private readonly staten = new Map<string, AbonnementStaat & { plan: PlanId }>();

  constructor(private readonly klok: () => Date = () => new Date()) {}

  /** Maakt een ondertekende webhook zoals een provider die zou sturen. */
  maakWebhook(event: BetaalEvent): { body: string; handtekening: string } {
    const body = JSON.stringify(event);
    return { body, handtekening: testHandtekening(body) };
  }

  event(soort: BetaalEventSoort, abonnementRef: string, plan: PlanId): BetaalEvent {
    return {
      id: nieuwId("evt_test"),
      soort,
      abonnementRef,
      plan,
      tijd: this.klok().toISOString(),
      bedragCent: soort === "betaling_gelukt" ? PLANNEN[plan].prijsCent : 0,
    };
  }

  async startCheckout(i: { plan: PlanId; klantRef: string }): Promise<CheckoutResultaat> {
    if (!PLANNEN[i.plan]) throw new Error("Onbekend plan.");
    const abonnementRef = nieuwId("sub_test");
    this.staten.set(abonnementRef, { status: "geen", verwerkt: [], plan: i.plan });
    return {
      sessieId: nieuwId("cs_test"),
      abonnementRef,
      url: `/abonnement?testcheckout=${encodeURIComponent(abonnementRef)}`,
      modus: "test",
    };
  }

  async haalStatus(abonnementRef: string): Promise<AbonnementStatus> {
    return this.staten.get(abonnementRef)?.status ?? "geen";
  }

  async annuleer(abonnementRef: string): Promise<BetaalEvent> {
    const plan = this.staten.get(abonnementRef)?.plan ?? "premium_maand";
    const { body, handtekening } = this.maakWebhook(this.event("opgezegd", abonnementRef, plan));
    return this.verwerkWebhook(body, handtekening);
  }

  async verwerkWebhook(ruweBody: string, handtekening: string | null | undefined) {
    if (!this.verifier.verifieer(ruweBody, handtekening)) {
      throw new Error("Ongeldige handtekening: webhook geweigerd.");
    }
    const event = JSON.parse(ruweBody) as BetaalEvent;
    const staat = this.staten.get(event.abonnementRef) ?? {
      status: "geen" as const,
      verwerkt: [],
      plan: event.plan,
    };
    const { staat: nieuw } = verwerkEvent(staat, event);
    this.staten.set(event.abonnementRef, { ...nieuw, plan: staat.plan });
    return event;
  }
}
