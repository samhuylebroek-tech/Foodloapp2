/**
 * Eén veiligheidsregel voor allergieën en dieet, overal dezelfde (Vandaag, Week, Keuken, Ontdek).
 *
 * - Allergieën zijn een harde grens: een gerecht met een mogelijk allergeen wordt nooit voorgesteld.
 * - Ontbrekende ingrediënten = geen garantie: met gekozen allergieën wordt zo'n gerecht nooit
 *   automatisch voorgesteld, en bij openen zegt Foodlo dat het niet gecontroleerd kon worden.
 * - De titel telt mee ("Pindasaté"), zodat een vage ingrediëntregel geen gat laat.
 *
 * Alles draait op het toestel. Dit is hulp, geen garantie: het etiket blijft de bron.
 */
import { allergenenIn, type AllergeenTreffer } from "@/lib/allergenen";
import type { Dieet } from "@/lib/kennismaking";
import type { Recipe } from "@/lib/types";
import { soortVan } from "@/lib/weekmenu-voorstel";
import { normaliseerTekst } from "@/lib/zoeken";

export type Gerecht = { title: string; tags?: string[]; ingredienten: string[] };

export type AllergieOordeel =
  | { status: "geen-allergieen" }
  | { status: "ok" }
  | { status: "allergeen"; treffers: AllergeenTreffer[] }
  | { status: "onbekend" };

/** Dierlijke producten die niet in een veganistisch gerecht horen (naast vlees, vis, melk, ei). */
const NIET_VEGAN = ["honing", "gelatine", "ansjovis", "vissaus", "oestersaus", "lardon"];
/** Ook niet vegetarisch, al herkent de soortregel ze niet altijd als vlees of vis. */
const NIET_VEGETARISCH = ["gelatine", "ansjovis", "vissaus", "oestersaus", "lardon", "spekjes"];

function namen(g: Gerecht) {
  return g.ingredienten.map((n) => n.trim()).filter(Boolean);
}

function heeft(tekst: string, woorden: string[]) {
  return woorden.some((w) => new RegExp(`(^|[^a-z])${normaliseerTekst(w)}`).test(tekst));
}

export function allergieOordeel(g: Gerecht, allergieen: readonly string[]): AllergieOordeel {
  if (!allergieen.length) return { status: "geen-allergieen" };
  const ingr = namen(g);
  const treffers = allergenenIn([...ingr, g.title], [...allergieen]).map((t) => {
    // De titel alleen tonen als hij de enige aanwijzing is.
    const zonderTitel = t.ingredienten.filter((n) => n !== g.title);
    return zonderTitel.length ? { ...t, ingredienten: zonderTitel } : t;
  });
  if (treffers.length) return { status: "allergeen", treffers };
  if (!ingr.length) return { status: "onbekend" };
  return { status: "ok" };
}

function beperkendDieet(dieet: Dieet | undefined | null) {
  return dieet === "vegetarisch" || dieet === "veganistisch" || dieet === "pescotarisch";
}

const VEGA_LABEL = ["vegetarisch", "vega", "veganistisch", "vegan", "plantaardig"];
const VEGAN_LABEL = ["veganistisch", "vegan", "plantaardig"];

/**
 * Past dit gerecht bij het gekozen dieet? "alles" en "weinig vlees" sluiten niets uit.
 * Zonder ingrediënten kan Foodlo het niet weten: dan alleen als het gerecht zelf zegt dat het past
 * (label of titel "vegetarisch", "vegan"…).
 */
export function pastBijDieet(g: Gerecht, dieet: Dieet | undefined | null): boolean {
  if (!beperkendDieet(dieet)) return true;
  if (!namen(g).length) {
    const tekst = normaliseerTekst([g.title, ...(g.tags ?? [])].join(" "));
    const label = dieet === "veganistisch" ? VEGAN_LABEL : VEGA_LABEL;
    if (dieet !== "pescotarisch" && !heeft(tekst, label)) return false;
    if (dieet === "pescotarisch" && !heeft(tekst, [...VEGA_LABEL, "vis"])) return false;
  }
  return dieetVolgensWoorden(g, dieet);
}

/** Alleen wat de woorden zeggen (titel, labels, ingrediënten); geen oordeel over wat ontbreekt. */
function dieetVolgensWoorden(g: Gerecht, dieet: Dieet | undefined | null): boolean {
  if (!beperkendDieet(dieet)) return true;
  const ingr = namen(g);
  const soort = soortVan(
    { title: g.title, description: "", tags: g.tags ?? [] } as unknown as Recipe,
    ingr,
  );
  if (soort === "vlees") return false;
  if (soort === "vis" && dieet !== "pescotarisch") return false;
  const tekst = normaliseerTekst([g.title, ...ingr].join(" "));
  if (dieet === "vegetarisch" && heeft(tekst, NIET_VEGETARISCH)) return false;
  if (dieet === "veganistisch") {
    if (heeft(tekst, NIET_VEGAN)) return false;
    if (allergenenIn([...ingr, g.title], ["melk", "eieren"]).length) return false;
  }
  return true;
}

/** Mag Foodlo dit gerecht uit zichzelf voorstellen? (allergie + dieet samen) */
export function magVoorstellen(
  g: Gerecht,
  wie: { allergieen?: readonly string[] | undefined; dieet?: Dieet | null | undefined },
): boolean {
  const a = allergieOordeel(g, wie.allergieen ?? []);
  if (a.status === "allergeen" || a.status === "onbekend") return false;
  return pastBijDieet(g, wie.dieet);
}

/**
 * Een AI-idee is alleen een titel (je allergieën en dieet gaan nooit naar de AI). Op het toestel
 * valt af wat al in de titel een gekozen allergeen of iets buiten je dieet noemt. Wat overblijft is
 * nog níét gecontroleerd: dat gebeurt pas als het recept met ingrediënten gemaakt is.
 */
export function ideeTitelToegelaten(
  titel: string,
  wie: { allergieen?: readonly string[] | undefined; dieet?: Dieet | null | undefined },
): boolean {
  if (allergenenIn([titel], [...(wie.allergieen ?? [])]).length) return false;
  return dieetVolgensWoorden({ title: titel, ingredienten: [] }, wie.dieet);
}
