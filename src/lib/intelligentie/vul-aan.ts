/**
 * "Vul aan met voorstellen" in Week (usecase 7): voor de lege dagen van de week één voorstel per
 * dag, uit je eigen recepten. Elke dag krijgt zijn eigen context (weekdag, je gewone kooktijd op
 * die dag, feestdag, seizoen) en je weekmenuvoorkeur voor die dag. Geen gerecht twee keer, niets
 * wat deze week al gepland staat. De harde regels (allergie, dieet, liever niet, Niet nu) gelden
 * via `beveelAan`. Puur en getest; draait op het toestel.
 *
 * Later (zie FOODLOAPP-INTELLIGENCE-ARCHITECTUUR §8): weersverwachting per dag (I-3), restjes
 * (usecase 18) en mee-eters (0005) worden extra invoer voor dezelfde functie.
 */
import { bepaalContext, type Weer } from "./context";
import type { Geschiedenis } from "./geschiedenis";
import type { OudInHuis } from "./gebruik-eerst";
import type { Aanbeveling, Kandidaat, Voorkeur } from "./voorstel";
import { stelMenuSamen, type PlanKandidaat } from "@/lib/planner/engine";
import type { Apparaat } from "@/lib/planner/apparatuur";

export type DagVoorstel = { datum: string; aanbeveling: Aanbeveling };

export type VulAanInvoer = {
  /** Lege dagen (YYYY-MM-DD), in volgorde. */
  dagen: string[];
  kandidaten: (Kandidaat | PlanKandidaat)[];
  voorraad: string[];
  oudInHuis?: OudInHuis[];
  onlangsGekocht?: string[];
  geschiedenis: Geschiedenis;
  sterren?: Record<string, number>;
  favorieten?: string[];
  /** Voorkeur voor een weekdag (0 = maandag). */
  voorkeurVoor: (weekdag: number) => Voorkeur;
  allergieen?: string[];
  nietNu?: string[];
  /** Recept-ids die deze week al gepland staan. */
  alGepland?: ReadonlySet<string>;
  /** Later (I-3): verwachting per dag. */
  weerVoor?: (datum: string) => Weer | null;
  /** Je keukenapparatuur (planprofiel); weggelaten = geen apparatuurfilter. */
  apparatuur?: readonly Apparaat[];
  /** Moment ("avondeten"): geen ontbijtgerecht als avondeten. */
  moment?: string;
  max?: number;
};

/**
 * Via de planning-engine (src/lib/planner/engine.ts): dezelfde filters en score als het
 * weekmenu. De tijd per weekdag blijft een zachte regel (zoals vroeger): een te lang gerecht
 * zakt, maar een dag blijft niet leeg omdat alles wat langer duurt.
 */
export function vulAan(i: VulAanInvoer): DagVoorstel[] {
  const dagen = i.dagen.slice(0, i.max ?? 3);
  const dieet = dagen.length ? i.voorkeurVoor(weekdagVan(dagen[0]!)).dieet : undefined;
  const menu = stelMenuSamen({
    dagen: dagen.map((datum) => {
      const v = i.voorkeurVoor(weekdagVan(datum));
      return {
        datum,
        moment: i.moment,
        maxMinuten: v.maxMinuten,
        soort: v.soort,
        context: bepaalContext(new Date(`${datum}T17:00:00`), i.weerVoor?.(datum) ?? null),
      };
    }),
    kandidaten: i.kandidaten,
    voorraad: i.voorraad,
    oudInHuis: i.oudInHuis,
    onlangsGekocht: i.onlangsGekocht,
    geschiedenis: i.geschiedenis,
    sterren: i.sterren,
    favorieten: i.favorieten,
    allergieen: i.allergieen,
    dieet,
    vermijd: dagen.length ? i.voorkeurVoor(weekdagVan(dagen[0]!)).vermijd : "",
    nietNu: i.nietNu,
    alGepland: i.alGepland,
    apparatuur: i.apparatuur,
    versoepel: ["tijd"],
  });
  return menu.dagen
    .filter((d) => d.keuze)
    .map((d) => ({
      datum: d.datum,
      aanbeveling: {
        id: d.keuze!.id,
        title: d.keuze!.title,
        score: d.keuze!.score,
        redenen: d.keuze!.redenen.slice(0, 2),
        aanwezig: d.keuze!.aanwezig,
        ontbreekt: d.keuze!.ontbreekt,
      },
    }));
}

function weekdagVan(datum: string) {
  return (new Date(`${datum}T12:00:00`).getDay() + 6) % 7;
}
