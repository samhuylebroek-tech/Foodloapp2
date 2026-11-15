/**
 * Wie eet er mee? De assistent toetst elke vervanger aan jou én aan de gezinsleden waarvan je de
 * voorkeuren mag lezen. De reden (welke allergie) zie je alleen als het lid dat deelt, of als jij
 * het lid bent of het beheert (`magRedenZien`). Alles op het toestel, nooit naar een AI.
 */
import { magRedenZien, type HuishoudenLid, type LidVoeding } from "@/lib/gezin-veiligheid";
import type { Kennismaking } from "@/lib/kennismaking";
import { teVermijdenAllergenen } from "@/lib/persoonlijke-voeding";
import type { Eter } from "./vervangingen";

export function etersUit(
  kennis: Pick<Kennismaking, "allergieen" | "dieet">,
  leden: readonly HuishoudenLid[],
  voeding: ReadonlyMap<string, LidVoeding>,
  kijkerId: string | null | undefined,
): Eter[] {
  const ikLid = leden.find((l) => l.user_id && l.user_id === kijkerId);
  const mijnLidVoeding = ikLid ? voeding.get(ikLid.id) : undefined;
  const ik: Eter = {
    id: "ik",
    naam: "Jij",
    allergieen: [
      ...new Set([
        ...kennis.allergieen,
        ...(mijnLidVoeding ? teVermijdenAllergenen(mijnLidVoeding) : []),
      ]),
    ],
    dieet: kennis.dieet ?? mijnLidVoeding?.dieet ?? null,
    uitsluitingen: mijnLidVoeding?.uitsluitingen ?? [],
    ikZelf: true,
    redenZichtbaar: true,
  };
  const anderen: Eter[] = [];
  for (const lid of leden) {
    if (ikLid && lid.id === ikLid.id) continue;
    const v = voeding.get(lid.id);
    if (!v) continue; // niets te lezen: geen regels om te toetsen
    anderen.push({
      id: lid.id,
      naam: lid.naam,
      allergieen: teVermijdenAllergenen(v),
      dieet: v.dieet,
      uitsluitingen: v.uitsluitingen,
      redenZichtbaar: magRedenZien(lid, v, kijkerId),
    });
  }
  return [ik, ...anderen];
}
