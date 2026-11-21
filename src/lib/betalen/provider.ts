/**
 * Fase 6 — welke betaalprovider gebruikt de server? Vandaag uitsluitend de TestBetaalProvider.
 * Een echte provider kan hier pas bij na gate G5 (juridische, btw- en veiligheidsreview) en met
 * `BETAALPROVIDER_GEKOPPELD = true`; zolang dat niet zo is, weigert `kiesBetaalProvider` alles
 * behalve de testmodus. Er is bewust geen keuze gemaakt (zie docs/foodlo/BETAALPROVIDER-EISEN.md).
 */
import { testBetalingGeweigerd } from "@/lib/betaalpoort";
import { TestBetaalProvider } from "./test-provider";
import type { BetaalProvider } from "./types";

export function kiesBetaalProvider(
  modus: "test" | "live" = "test",
  providerGekoppeld?: boolean,
): BetaalProvider {
  const fout = testBetalingGeweigerd(modus, providerGekoppeld);
  if (fout) throw new Error(fout);
  return new TestBetaalProvider();
}
