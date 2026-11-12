/**
 * Foodloapp Intelligence — Cooking History Engine (I-1). Wat deed deze persoon?
 * Alleen samenvattingen uit het eigen weekmenu; niets wordt bewaard of verstuurd.
 * "Druk op woensdag" komt hier uit de eigen gewoonte, nooit uit een stereotype.
 */
export type PlanRij = { recipe_id: string | null; plan_date: string };

export type Geschiedenis = {
  /** Laatste datum in het verleden (of vandaag) waarop een recept gepland stond. */
  laatst: Record<string, string>;
  /** Recepten die de komende 7 dagen al gepland staan. */
  komend: Set<string>;
  /** Gewone kooktijd per weekdag (0 = maandag), alleen bij minstens MIN_PER_DAG keer. */
  minutenPerWeekdag: Record<number, number>;
};

export const MIN_PER_DAG = 3;
const DAG = 86400000;
const tijdstip = (datum: string) => new Date(`${datum}T12:00:00`).getTime();

export function dagenTussen(van: string, tot: string): number {
  return Math.round((tijdstip(tot) - tijdstip(van)) / DAG);
}

function mediaan(getallen: number[]): number {
  const s = [...getallen].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

export function vatSamen(
  plan: PlanRij[],
  minutenVan: Record<string, number>,
  vandaag: string,
): Geschiedenis {
  const laatst: Record<string, string> = {};
  const komend = new Set<string>();
  const perDag: Record<number, number[]> = {};
  for (const p of plan) {
    if (!p.recipe_id) continue;
    const verschil = dagenTussen(vandaag, p.plan_date);
    if (verschil > 0) {
      if (verschil <= 7) komend.add(p.recipe_id);
      continue;
    }
    if (!laatst[p.recipe_id] || p.plan_date > laatst[p.recipe_id]!)
      laatst[p.recipe_id] = p.plan_date;
    const min = minutenVan[p.recipe_id] ?? 0;
    if (min > 0) {
      const wd = (new Date(`${p.plan_date}T12:00:00`).getDay() + 6) % 7;
      (perDag[wd] ??= []).push(min);
    }
  }
  const minutenPerWeekdag: Record<number, number> = {};
  for (const [wd, lijst] of Object.entries(perDag))
    if (lijst.length >= MIN_PER_DAG) minutenPerWeekdag[Number(wd)] = mediaan(lijst);
  return { laatst, komend, minutenPerWeekdag };
}
