/**
 * Webhook-handtekeningen. Elke echte provider levert een eigen `WebhookVerifier` (HMAC met een
 * geheim dat alleen op de server staat). De testvariant gebruikt een vaste, publieke sleutel en
 * is daardoor bewust NIET veilig: alleen voor de testmodus.
 */
import type { WebhookVerifier } from "./types";

/** FNV-1a (32 bit) als hex: deterministisch, zonder netwerk of Node-crypto. Geen beveiliging. */
function fnv1a(tekst: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const TEST_SLEUTEL = "foodlo-testmodus";

export function testHandtekening(ruweBody: string, sleutel = TEST_SLEUTEL): string {
  return `test_${fnv1a(`${sleutel}.${ruweBody}`)}`;
}

export class TestWebhookVerifier implements WebhookVerifier {
  constructor(private readonly sleutel = TEST_SLEUTEL) {}
  verifieer(ruweBody: string, handtekening: string | null | undefined): boolean {
    if (!handtekening) return false;
    return handtekening === testHandtekening(ruweBody, this.sleutel);
  }
}
