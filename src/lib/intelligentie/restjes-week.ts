/**
 * Restjes in Week (usecase 18 + 7): beschikbare restjes krijgen voorrang op nieuwe recepten.
 * Het oudste restje gaat naar de eerste lege dag waarop het nog goed is (hooguit 3 dagen na het
 * koken), één restje per dag. De overige lege dagen krijgen gewone voorstellen (`vulAan`).
 * Alleen geregistreerde restjes: zonder registratie veronderstelt Foodlo er geen.
 */
import { RESTJE_VOORSTEL_DAGEN, dagenOud, type Restje } from "./restjes";

export type RestjeVoorDag = { datum: string; restje: Restje };

export function restjesVoorWeek(
  restjes: readonly Restje[],
  legeDagen: readonly string[],
): RestjeVoorDag[] {
  const vrij = [...legeDagen].sort();
  const uit: RestjeVoorDag[] = [];
  // Oudste eerst: wat het eerst weg moet, krijgt de eerste dag.
  for (const r of [...restjes].filter((x) => !x.gepland).sort((a, b) => a.gekookt - b.gekookt)) {
    const i = vrij.findIndex((d) => {
      const oud = dagenOud(r, Date.parse(`${d}T12:00:00`));
      return oud >= 0 && oud <= RESTJE_VOORSTEL_DAGEN;
    });
    if (i < 0) continue;
    uit.push({ datum: vrij[i]!, restje: r });
    vrij.splice(i, 1);
  }
  return uit.sort((a, b) => a.datum.localeCompare(b.datum));
}
