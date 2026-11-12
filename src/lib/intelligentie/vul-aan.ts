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
import { beveelAan, type Aanbeveling, type Kandidaat, type Voorkeur } from "./voorstel";

export type DagVoorstel = { datum: string; aanbeveling: Aanbeveling };

export type VulAanInvoer = {
  /** Lege dagen (YYYY-MM-DD), in volgorde. */
  dagen: string[];
  kandidaten: Kandidaat[];
  voorraad: string[];
  oudInHuis?: OudInHuis[];
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
  max?: number;
};

export function vulAan(i: VulAanInvoer): DagVoorstel[] {
  const gebruikt = new Set(i.alGepland ?? []);
  const uit: DagVoorstel[] = [];
  for (const datum of i.dagen.slice(0, i.max ?? 3)) {
    const context = bepaalContext(new Date(`${datum}T17:00:00`), i.weerVoor?.(datum) ?? null);
    const lijst = beveelAan({
      kandidaten: i.kandidaten.filter((k) => !gebruikt.has(k.id)),
      context,
      voorraad: i.voorraad,
      ...(i.oudInHuis ? { oudInHuis: i.oudInHuis } : {}),
      geschiedenis: i.geschiedenis,
      ...(i.sterren ? { sterren: i.sterren } : {}),
      ...(i.favorieten ? { favorieten: i.favorieten } : {}),
      voorkeur: i.voorkeurVoor(context.weekdag),
      ...(i.allergieen ? { allergieen: i.allergieen } : {}),
      ...(i.nietNu ? { nietNu: i.nietNu } : {}),
      max: 1,
    });
    const keuze = lijst[0];
    if (!keuze) continue;
    gebruikt.add(keuze.id);
    uit.push({ datum, aanbeveling: keuze });
  }
  return uit;
}
