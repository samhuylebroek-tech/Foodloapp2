/**
 * Statusmachine van een abonnement: pure functie, idempotent op event-id. Een onbekende of
 * onmogelijke overgang verandert niets (en zegt waarom), zodat een verdwaalde of dubbele webhook
 * nooit een abonnement kapotmaakt.
 */
import type { AbonnementStatus, BetaalEvent, BetaalEventSoort } from "./types";

const OVERGANGEN: Record<AbonnementStatus, Partial<Record<BetaalEventSoort, AbonnementStatus>>> = {
  geen: { checkout_voltooid: "actief", proef_gestart: "proef" },
  proef: {
    betaling_gelukt: "actief",
    betaling_mislukt: "betaling_mislukt",
    opgezegd: "opgezegd",
  },
  actief: {
    betaling_gelukt: "actief",
    betaling_mislukt: "betaling_mislukt",
    opgezegd: "opgezegd",
  },
  betaling_mislukt: {
    betaling_gelukt: "actief",
    opgezegd: "opgezegd",
    periode_afgelopen: "geen",
  },
  opgezegd: {
    periode_afgelopen: "geen",
    checkout_voltooid: "actief",
  },
};

export type AbonnementStaat = {
  status: AbonnementStatus;
  /** Verwerkte event-id's (idempotentie). In de databank: unieke index op betaal_events.event_id. */
  verwerkt: readonly string[];
};

export type Uitkomst = {
  staat: AbonnementStaat;
  veranderd: boolean;
  /** Waarom er niets veranderde. */
  reden?: "dubbel" | "ongeldige_overgang";
};

export function volgendeStatus(
  huidig: AbonnementStatus,
  soort: BetaalEventSoort,
): AbonnementStatus | null {
  return OVERGANGEN[huidig][soort] ?? null;
}

export function verwerkEvent(staat: AbonnementStaat, event: BetaalEvent): Uitkomst {
  if (staat.verwerkt.includes(event.id)) return { staat, veranderd: false, reden: "dubbel" };
  const volgende = volgendeStatus(staat.status, event.soort);
  const verwerkt = [...staat.verwerkt, event.id];
  if (!volgende) {
    return { staat: { ...staat, verwerkt }, veranderd: false, reden: "ongeldige_overgang" };
  }
  return { staat: { status: volgende, verwerkt }, veranderd: volgende !== staat.status };
}

/** Geeft deze status (nu) toegang tot de premiumfuncties? */
export function geeftToegang(status: AbonnementStatus): boolean {
  // Opgezegd: toegang tot het einde van de betaalde periode (gecontroleerd via geldig_tot).
  return status === "actief" || status === "proef" || status === "opgezegd";
}

export const STATUS_UITLEG: Record<AbonnementStatus, { titel: string; uitleg: string }> = {
  geen: {
    titel: "Gratis",
    uitleg: "Je gebruikt Foodlo gratis. Alle gewone functies blijven gratis.",
  },
  proef: {
    titel: "Proefperiode",
    uitleg: "Je probeert Premium gratis uit. Zeg je niet op, dan loopt het daarna door.",
  },
  actief: {
    titel: "Actief",
    uitleg: "Premium staat aan. Je kunt op elk moment opzeggen.",
  },
  opgezegd: {
    titel: "Opgezegd",
    uitleg: "Je hebt opgezegd. Premium blijft werken tot het einde van de periode die je al had.",
  },
  betaling_mislukt: {
    titel: "Betaling mislukt",
    uitleg:
      "De laatste betaling lukte niet. Premium werkt nog even; pas je betaalgegevens aan om het te houden.",
  },
};
