/**
 * Budgetgeschiedenis per week (P2): wat je weekmenu ongeveer kostte tegenover je budget.
 *
 * Opslag: op het account in `budget_weken` (voorstel 0014). Bestaat die tabel nog niet
 * (productie vóór de migratie), dan op dit toestel (laatste 12 weken). Alleen jij ziet dit.
 * De kost is altijd een schatting met Foodlo-richtprijzen (zie budget.ts).
 */
export type BudgetWeek = {
  /** Maandag van de week (YYYY-MM-DD). */
  week: string;
  budget: number | null;
  geschat: number;
  niet_geschat: number;
  maaltijden: number;
};

export const MAX_WEKEN = 12;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function getal(x: unknown): number | null {
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Ruwe rij (toestel of databank) → geldige week, of null. */
export function leesWeek(ruw: unknown): BudgetWeek | null {
  if (!ruw || typeof ruw !== "object") return null;
  const r = ruw as Record<string, unknown>;
  const week = typeof r["week"] === "string" ? r["week"].slice(0, 10) : "";
  const geschat = getal(r["geschat"]);
  if (!DATUM.test(week) || geschat === null || geschat < 0) return null;
  const budget = getal(r["budget"]);
  return {
    week,
    budget: budget !== null && budget > 0 ? budget : null,
    geschat: Math.round(geschat * 100) / 100,
    niet_geschat: Math.max(0, Math.round(getal(r["niet_geschat"]) ?? 0)),
    maaltijden: Math.max(0, Math.round(getal(r["maaltijden"]) ?? 0)),
  };
}

/** Week toevoegen of bijwerken; nieuwste eerst, hooguit MAX_WEKEN. */
export function zetWeek(lijst: readonly BudgetWeek[], w: BudgetWeek): BudgetWeek[] {
  return [w, ...lijst.filter((x) => x.week !== w.week)]
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, MAX_WEKEN);
}

/** Moet deze stand bewaard worden? Alleen als er iets veranderde (geen nutteloze schrijfacties). */
export function isAnders(oud: BudgetWeek | undefined, nieuw: BudgetWeek): boolean {
  if (!oud) return nieuw.maaltijden > 0;
  return (
    oud.geschat !== nieuw.geschat ||
    oud.budget !== nieuw.budget ||
    oud.niet_geschat !== nieuw.niet_geschat ||
    oud.maaltijden !== nieuw.maaltijden
  );
}

/** De weken vóór `huidige` (maandag), nieuwste eerst. */
export function vorigeWeken(lijst: readonly BudgetWeek[], huidige: string, max = 4): BudgetWeek[] {
  return lijst
    .filter((w) => w.week < huidige && w.maaltijden > 0)
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, max);
}

/** "week van 9 nov." */
export function weekLabel(maandag: string): string {
  const d = new Date(`${maandag}T12:00:00`);
  return `Week van ${d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}`;
}

/** "onder budget" / "€ 4,20 boven budget" / "" (zonder budget). */
export function oordeelWeek(w: BudgetWeek): "onder" | "boven" | null {
  if (!w.budget) return null;
  return w.geschat > w.budget ? "boven" : "onder";
}

// ---------------------------------------------------------------- toestel (terugval)

const sleutel = (userId: string) => `foodlo:budgetweken:${userId}`;

export function leesToestelWeken(userId: string | null | undefined): BudgetWeek[] {
  if (!userId) return [];
  try {
    const ruw = JSON.parse(window.localStorage.getItem(sleutel(userId)) ?? "[]") as unknown;
    return Array.isArray(ruw)
      ? ruw
          .map(leesWeek)
          .filter((x): x is BudgetWeek => !!x)
          .slice(0, MAX_WEKEN)
      : [];
  } catch {
    return [];
  }
}

export function bewaarToestelWeek(userId: string, w: BudgetWeek): BudgetWeek[] {
  const nieuw = zetWeek(leesToestelWeken(userId), w);
  try {
    window.localStorage.setItem(sleutel(userId), JSON.stringify(nieuw));
  } catch {
    /* privévenster: alleen voor nu */
  }
  return nieuw;
}
