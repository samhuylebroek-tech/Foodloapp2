/**
 * Tijden voor een keuzelijst, per kwartier van 05:00 tot 23:45, altijd in 24-uursnotatie ("18:30").
 * Een bewaarde tijd die niet op een kwartier valt (bv. "18:35" uit een oudere versie) blijft in de
 * lijst staan, op zijn plaats, zodat de keuze van de gebruiker nooit stil verandert.
 */
export function tijdKeuzes(huidig?: string | null): string[] {
  const tijden: string[] = [];
  for (let uur = 5; uur <= 23; uur++) {
    for (let min = 0; min < 60; min += 15) {
      tijden.push(`${String(uur).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
  }
  if (huidig && /^\d{2}:\d{2}$/.test(huidig) && !tijden.includes(huidig)) {
    tijden.push(huidig);
    tijden.sort();
  }
  return tijden;
}
