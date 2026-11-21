/**
 * "Laat Foodlo kiezen" (weekvoorstel) via de ene planning-engine (P1, BUG-152-rest).
 *
 * Zelfde vorm en gedrag als het oude `kiesUitEigen`:
 * - per dag één gerecht uit je eigen (al veilig gefilterde) recepten;
 * - weekdoelen (x vlees, x vis, x vegetarisch): een dag zonder eigen wens vult het doel aan
 *   dat het verst achterloopt; een eigen wens per dag gaat voor;
 * - de kooktijd van de dag is een zachte regel (te lang = lager), geen filter;
 * - "over" = overslaan; wat al vastligt (`vast`) blijft; eerder getoond (`uitgesloten`) niet
 *   opnieuw; recent gemaakt = lager.
 * Nieuw via de engine: dezelfde harde filters als overal (veiligheid, moment: geen
 * ontbijtgerecht als avondeten, herhaling binnen 7 dagen) en dezelfde score (variatie,
 * overlap, seizoen, sterren …). Deterministisch, geen AI.
 */
import type { Dieet } from "@/lib/kennismaking";
import type { Recipe } from "@/lib/types";
import {
  minutenVan,
  soortVan,
  type DagRegel,
  type Soortkeuze,
  type Weekdoelen,
} from "@/lib/weekmenu-voorstel";
import { stelMenuSamen, type PlanKandidaat } from "./engine";

export function kiesViaEngine(opts: {
  recepten: Recipe[];
  ingredienten: Record<string, string[]>;
  regels: DagRegel[];
  doelen: Weekdoelen;
  vermijd: string;
  recentPerRecept?: Record<string, string>;
  vast?: Record<string, string>;
  uitgesloten?: Record<string, string[]>;
  /** Je eigen regels (dubbel met de voorfilter, bewust). */
  allergieen?: readonly string[];
  dieet?: Dieet | undefined;
}): { datum: string; moment: string; recept: Recipe | null }[] {
  const perId = new Map(opts.recepten.map((r) => [r.id, r]));
  const kandidaten: PlanKandidaat[] = opts.recepten.map((r) => ({
    id: r.id,
    title: r.title,
    minuten: minutenVan(r),
    category: r.category ?? null,
    tags: r.tags ?? [],
    ingredienten: opts.ingredienten[r.id] ?? [],
  }));
  const soort = new Map(
    opts.recepten.map((r) => [r.id, soortVan(r, opts.ingredienten[r.id] ?? [])]),
  );
  const nogNodig = { ...opts.doelen };
  const gekozen: { datum: string; recipeId: string }[] = [];
  for (const [sleutel, id] of Object.entries(opts.vast ?? {}))
    gekozen.push({ datum: sleutel.split("|")[0]!, recipeId: id });
  const uitkomst = new Map<string, Recipe | null>();
  // Dagen met een eigen wens eerst (moeilijkst in te vullen), daarna in datumvolgorde.
  const volgorde = [...opts.regels].sort(
    (a, b) => Number(!!b.soort) - Number(!!a.soort) || a.datum.localeCompare(b.datum),
  );
  for (const regel of volgorde) {
    const sleutel = `${regel.datum}|${regel.moment}`;
    if (regel.over) {
      uitkomst.set(sleutel, null);
      continue;
    }
    const vastId = opts.vast?.[sleutel];
    if (vastId) {
      uitkomst.set(sleutel, perId.get(vastId) ?? null);
      continue;
    }
    let gewenst: Soortkeuze = regel.soort;
    if (!gewenst) {
      const open = (["vis", "vlees", "vega"] as const).filter((s) => nogNodig[s] > 0);
      gewenst = open.length
        ? ([...open].sort((a, b) => nogNodig[b] - nogNodig[a])[0] ?? null)
        : null;
    }
    const menu = stelMenuSamen({
      dagen: [
        {
          datum: regel.datum,
          moment: regel.moment === "maaltijd" ? undefined : regel.moment,
          maxMinuten: regel.maxMinuten,
          soort: gewenst,
        },
      ],
      kandidaten,
      allergieen: opts.allergieen,
      dieet: opts.dieet,
      vermijd: opts.vermijd,
      // Kooktijd is hier een zachte regel, zoals vroeger.
      versoepel: ["tijd"],
      alGepland: new Set(gekozen.map((g) => g.recipeId)),
      vast: gekozen,
      uitgesloten: opts.uitgesloten,
      geschiedenis: {
        laatst: opts.recentPerRecept ?? {},
        komend: new Set(),
        minutenPerWeekdag: {},
      },
    });
    const id = menu.dagen[0]?.keuze?.id ?? null;
    const recept = id ? (perId.get(id) ?? null) : null;
    if (recept) {
      gekozen.push({ datum: regel.datum, recipeId: recept.id });
      const s = soort.get(recept.id)!;
      if (nogNodig[s] > 0) nogNodig[s] -= 1;
    }
    uitkomst.set(sleutel, recept);
  }
  return opts.regels.map((r) => ({
    datum: r.datum,
    moment: r.moment,
    recept: uitkomst.get(`${r.datum}|${r.moment}`) ?? null,
  }));
}
