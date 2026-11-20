/**
 * Fase 7 — Weer en seizoen als zachte factor in de weekplanner (P1-engine), met één schakelaar.
 *
 * - Eén instelling: de suggestiesoort "weer" (Instellingen › Suggesties) én de bestaande
 *   weerschakelaar (Instellingen › Maaltijden) moeten aan staan. Beide zetten hetzelfde aan/uit.
 * - Geen weerbron (productie: er is nog geen weerdienst gekozen; of geen netwerk): netjes
 *   "geen weer beschikbaar" en Foodlo kijkt alleen naar het seizoen (dat zit altijd in de score).
 * - Nooit een betaalde weerdienst: in de demo komt het weer uit vaste testgegevens.
 * - Weer verandert alleen de volgorde (een paar punten), nooit wat veilig is.
 */
import type { Weer } from "@/lib/intelligentie/context";
import { WARME_DAG } from "@/lib/intelligentie/voorstel";
import { seizoen } from "@/lib/themas";

export type WeerFactor = {
  /** Wat de engine meekrijgt; null = weer telt niet mee. */
  weer: Weer | null;
  stand: "weer" | "geen-bron" | "uit";
  /** Eén zin voor de gebruiker. */
  tekst: string;
  test: boolean;
};

export function weerFactor(i: {
  aan: boolean;
  heeftBron: boolean;
  meting: (Weer & { test?: boolean }) | null;
  maand: number;
}): WeerFactor {
  const s = seizoen(i.maand).titel.toLowerCase();
  if (!i.aan)
    return {
      weer: null,
      stand: "uit",
      tekst: `Weer telt niet mee (uitgezet). Foodlo kijkt wel naar het seizoen: ${s}.`,
      test: false,
    };
  if (!i.heeftBron || !i.meting)
    return {
      weer: null,
      stand: "geen-bron",
      tekst: `Geen weer beschikbaar. Foodlo kijkt naar het seizoen: ${s}.`,
      test: false,
    };
  const t = Math.round(i.meting.temp);
  const wat =
    i.meting.temp >= WARME_DAG
      ? "lichte, frisse gerechten krijgen wat voorrang"
      : i.meting.temp <= 8
        ? "warme gerechten krijgen wat voorrang"
        : i.meting.regen
          ? "een warm comfortgerecht krijgt wat voorrang"
          : "het weer verandert niets aan je menu";
  return {
    weer: { temp: i.meting.temp, regen: i.meting.regen },
    stand: "weer",
    tekst: `Weer: ${t} °C${i.meting.regen ? ", regen" : ""}; ${wat}. Ook het seizoen telt mee: ${s}.`,
    test: !!i.meting.test,
  };
}
