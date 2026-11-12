import type { Recipe } from "@/lib/types";

/** Vlees, vis of vegetarisch — of "laat Foodlo kiezen" (null). */
export type Soortkeuze = "vlees" | "vis" | "vega" | null;

export type DagRegel = {
  datum: string;
  moment: string;
  maxMinuten: number; // 0 = maakt niet uit
  soort: Soortkeuze;
  over: boolean;
};

export type Voorstel = {
  datum: string;
  moment: string;
  recept: Recipe | null;
  titel: string;
  /** Nieuw idee van buiten je eigen recepten. */
  extern: boolean;
  /** Er staat al iets ingepland op dat moment. */
  bezet: boolean;
  aan: boolean;
};

export type Weekdoelen = { vlees: number; vis: number; vega: number };

const VIS = [
  "vis", "zalm", "kabeljauw", "tonijn", "garnaal", "garnalen", "scampi", "mossel", "mosselen",
  "inktvis", "schol", "tong", "forel", "haring", "makreel", "sardine", "ansjovis", "zeewolf",
  "pangasius", "tilapia", "krab", "kreeft", "victoriabaars", "heilbot", "coquille",
];

/** BUG-128: ook het label "vlees" en Belgische vleesgerechten. */
const VLEES_EXTRA = [
  "vlees",
  "stoofvlees",
  "stoverij",
  "carbonade",
  "vol-au-vent",
  "frikandel",
  "boulet",
  "gyros",
];

const VLEES = [
  "kip", "rund", "rundvlees", "gehakt", "varken", "varkens", "spek", "ham", "worst", "chorizo",
  "salami", "lam", "kalkoen", "eend", "kalfs", "biefstuk", "steak", "ribbetjes", "bacon",
  "braadworst", "shoarma", "kebab", "kipfilet", "vleesbrood", "burger", "balletjes", "konijn",
  "hesp", "pancetta", "prosciutto",
  ...VLEES_EXTRA,
];
/** Wat wél "vlees" zegt, maar het niet is. */
const GEEN_VLEES =
  /vleesvervang\w*|vleesloos|zonder vlees|vegetarisch gehakt|vegagehakt|veggie gehakt/g;

const VEGA_WOORDEN = ["vegetarisch", "vega", "veganistisch", "vegan", "plantaardig", "meatless"];

function tekstVan(r: Recipe, ingredienten: string[]) {
  return [r.title, r.description, ...(r.tags ?? []), ...ingredienten].join(" ").toLowerCase();
}

function bevat(tekst: string, woorden: string[]) {
  return woorden.some((w) => new RegExp(`(^|[^a-z])${w}`, "i").test(tekst));
}

/** Wat voor soort maaltijd is dit? Puur op woorden, geen AI. */
export function soortVan(r: Recipe, ingredienten: string[] = []): "vlees" | "vis" | "vega" {
  const tekst = tekstVan(r, ingredienten).replace(GEEN_VLEES, " ");
  if (bevat(tekst, VIS)) return "vis";
  if (bevat(tekst, VLEES)) return "vlees";
  if (bevat(tekst, VEGA_WOORDEN)) return "vega";
  return "vega";
}

export function minutenVan(r: Recipe) {
  return (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
}

export function vermijdWoorden(tekst: string) {
  return tekst
    .toLowerCase()
    .split(/[,;\n]| en /)
    .map((w) => w.replace(/geen|liever niet|zonder/g, "").trim())
    .filter((w) => w.length > 2);
}

/** Alleen gerechten die je echt als maaltijd op tafel zet. */
const MAALTIJD_SOORTEN = ["hoofdgerecht", "soep", "salade", "ontbijt", "bijgerecht"];

function scoreVoor(
  r: Recipe,
  regel: DagRegel,
  info: { soort: "vlees" | "vis" | "vega"; minuten: number },
  gewenst: Soortkeuze,
  recentDatum: number | null,
) {
  let score = 10;
  if (gewenst && info.soort === gewenst) score += 12;
  else if (gewenst) score -= 14;
  const max = regel.maxMinuten;
  if (max > 0) {
    if (info.minuten > max) score -= 20;
    else score += 4;
  }
  if (recentDatum !== null) {
    const dagenGeleden = (Date.now() - recentDatum) / 86400000;
    if (dagenGeleden < 14) score -= 10 - Math.min(9, dagenGeleden / 2);
  }
  if (r.image_url) score += 2;
  if (r.category === "hoofdgerecht") score += 3;
  return score;
}

/**
 * Stelt per dag een gerecht voor uit je eigen recepten.
 * Deterministisch: geen AI, geen credits.
 */
export function kiesUitEigen(opts: {
  recepten: Recipe[];
  ingredienten: Record<string, string[]>;
  regels: DagRegel[];
  doelen: Weekdoelen;
  vermijd: string;
  recentPerRecept?: Record<string, string>; // recipe_id -> laatste plan_date
  vast?: Record<string, string>; // datum|moment -> recipe_id dat al gekozen is
  uitgesloten?: Record<string, string[]>; // datum|moment -> eerder getoonde recepten
}): { datum: string; moment: string; recept: Recipe | null }[] {
  const vermijdLijst = vermijdWoorden(opts.vermijd);
  const bruikbaar = opts.recepten.filter((r) => {
    if (r.category && !MAALTIJD_SOORTEN.includes(r.category)) return false;
    const tekst = tekstVan(r, opts.ingredienten[r.id] ?? []);
    return !vermijdLijst.some((w) => tekst.includes(w));
  });

  const info = new Map<string, { soort: "vlees" | "vis" | "vega"; minuten: number }>();
  bruikbaar.forEach((r) =>
    info.set(r.id, {
      soort: soortVan(r, opts.ingredienten[r.id] ?? []),
      minuten: minutenVan(r),
    }),
  );

  const nogNodig = { ...opts.doelen };
  const gebruikt = new Set<string>(Object.values(opts.vast ?? {}));
  // Dagen met een eigen wens eerst: die zijn het moeilijkst in te vullen.
  const volgorde = [...opts.regels].sort((a, b) => Number(!!b.soort) - Number(!!a.soort));
  const uitkomst = new Map<string, Recipe | null>();

  for (const regel of volgorde) {
    const sleutel = `${regel.datum}|${regel.moment}`;
    if (regel.over) {
      uitkomst.set(sleutel, null);
      continue;
    }
    const vastId = opts.vast?.[sleutel];
    if (vastId) {
      uitkomst.set(sleutel, bruikbaar.find((r) => r.id === vastId) ?? null);
      continue;
    }
    let gewenst: Soortkeuze = regel.soort;
    if (!gewenst) {
      // Zonder eigen wens: vul het weekdoel aan dat het verst achterloopt.
      const open = (["vis", "vlees", "vega"] as const).filter((s) => nogNodig[s] > 0);
      gewenst = open.length ? (open.sort((a, b) => nogNodig[b] - nogNodig[a])[0] ?? null) : null;
    }
    const kandidaten = bruikbaar
      .filter(
        (r) =>
          !gebruikt.has(r.id) &&
          !(opts.uitgesloten?.[sleutel] ?? []).includes(r.id),
      )
      .map((r) => ({
        r,
        score: scoreVoor(
          r,
          regel,
          info.get(r.id)!,
          gewenst,
          opts.recentPerRecept?.[r.id]
            ? new Date(`${opts.recentPerRecept[r.id]}T12:00:00`).getTime()
            : null,
        ),
      }))
      .sort((a, b) => b.score - a.score);
    const beste = kandidaten[0]?.r ?? null;
    if (beste) {
      gebruikt.add(beste.id);
      const s = info.get(beste.id)!.soort;
      if (nogNodig[s] > 0) nogNodig[s] -= 1;
    }
    uitkomst.set(sleutel, beste);
  }

  return opts.regels.map((regel) => ({
    datum: regel.datum,
    moment: regel.moment,
    recept: uitkomst.get(`${regel.datum}|${regel.moment}`) ?? null,
  }));
}
