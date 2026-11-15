/**
 * Kookassistent — een recept aanpassen (aantal personen, vegetarisch, zonder een allergeen).
 *
 * Geeft altijd een **voorstel** met de verschillen; er wordt hier niets bewaard. De gebruiker kiest
 * daarna zelf "Bewaar als kopie" of "Pas dit recept aan" (met ongedaan maken). Vervangers komen uit
 * de vaste tabel en zijn getoetst aan iedereen die meeëet (`vervangingen.ts`).
 */
import { allergenenIn, ALLERGENEN, type AllergeenId } from "@/lib/allergenen";
import { pastBijDieet } from "@/lib/veiligheid";
import { normaliseerTekst } from "@/lib/zoeken";
import { regelVoor, toetsVervangers, type Eter } from "./vervangingen";

export type IngredientRegel = { id?: string; name: string; quantity: number | null; unit: string };

export type Opdracht =
  | { soort: "personen"; personen: number }
  | { soort: "vegetarisch" }
  | { soort: "zonder"; allergeen: AllergeenId };

export type Wijziging =
  | { soort: "hoeveelheid"; index: number; van: string; naar: string }
  | { soort: "vervangen"; index: number; van: string; naar: string; reden: string }
  | { soort: "weg"; index: number; van: string; reden: string };

export type AanpasVoorstel = {
  opdracht: Opdracht;
  /** Titel voor een kopie, bv. "Lasagne (vegetarisch)". */
  titelKopie: string;
  personen: number;
  tags: string[];
  ingredienten: IngredientRegel[];
  wijzigingen: Wijziging[];
  /** Eerlijke opmerkingen: stappen die nog iets oud noemen, niets gevonden, … */
  waarschuwingen: string[];
};

/** Netjes afronden voor de keuken: geen 133,3333 g. */
export function rondKeukenAf(x: number, eenheid = ""): number {
  if (x <= 0) return 0;
  // Liter en kilo: op 0,05 (0,375 l wordt 0,4 l, niet 0,5 l).
  if (x < 1 && /^(l|kg|liter|kilo)$/i.test(eenheid.trim()))
    return Math.max(0.05, Math.round(x * 20) / 20);
  if (x < 1) return Math.max(0.25, Math.round(x * 4) / 4); // kwarten (½ tl, ¼ ui)
  if (x < 10) return Math.round(x * 2) / 2;
  if (x < 100) return Math.round(x);
  return Math.round(x / 5) * 5;
}

export function toonMaat(i: Pick<IngredientRegel, "quantity" | "unit">): string {
  if (i.quantity === null || i.quantity === undefined) return i.unit || "";
  const getal = Number.isInteger(i.quantity)
    ? String(i.quantity)
    : i.quantity.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
  return `${getal}${i.unit ? ` ${i.unit}` : ""}`;
}

const regelTekst = (i: IngredientRegel) => {
  const maat = toonMaat(i);
  return maat ? `${maat} ${i.name}` : i.name;
};

function isVleesOfVis(naam: string): boolean {
  return !pastBijDieet({ title: naam, ingredienten: [naam] }, "vegetarisch");
}

const ALLERGEEN_NAAM = new Map(ALLERGENEN.map((a) => [a.id, a.naam.toLowerCase()]));

/** Stappen die een vervangen of weggelaten ingrediënt nog noemen ("Stap 2 noemt nog kip"). */
function stappenMetOudeNamen(stappen: readonly string[], namen: readonly string[]): string[] {
  const uit: string[] = [];
  for (const naam of namen) {
    const woord = normaliseerTekst(naam)
      .split(" ")
      .filter((w) => w.length >= 3)
      .at(-1);
    if (!woord) continue;
    const nummers = stappen
      .map((s, i) => (normaliseerTekst(s).includes(woord) ? i + 1 : 0))
      .filter(Boolean);
    if (nummers.length)
      uit.push(
        `${nummers.length === 1 ? "Stap" : "Stappen"} ${nummers.join(", ")} ${nummers.length === 1 ? "noemt" : "noemen"} nog “${woord}”. Lees die even na.`,
      );
  }
  return uit;
}

/**
 * Maak een voorstel. `eters` zijn de mensen aan tafel (jij en wie meeëet): elke vervanger moet
 * voor hen allemaal veilig zijn. Is er geen veilige vervanger, dan valt het ingrediënt weg en zegt
 * Foodlo dat eerlijk.
 */
export function maakVoorstel(
  recept: {
    title: string;
    servings: number;
    tags: readonly string[];
    instructions: readonly string[];
  },
  ingredienten: readonly IngredientRegel[],
  opdracht: Opdracht,
  eters: readonly Eter[],
): AanpasVoorstel {
  const basisPersonen = recept.servings > 0 ? recept.servings : 1;
  const wijzigingen: Wijziging[] = [];
  const waarschuwingen: string[] = [];
  let nieuw: IngredientRegel[] = ingredienten.map((i) => ({ ...i }));
  let personen = basisPersonen;
  let tags = [...recept.tags];
  let titelKopie = recept.title;

  if (opdracht.soort === "personen") {
    personen = Math.max(1, Math.min(50, Math.round(opdracht.personen)));
    const factor = personen / basisPersonen;
    nieuw = nieuw.map((i, index) => {
      if (i.quantity === null || i.quantity === undefined || factor === 1) return i;
      const q = rondKeukenAf(i.quantity * factor, i.unit);
      if (q !== i.quantity)
        wijzigingen.push({
          soort: "hoeveelheid",
          index,
          van: regelTekst(i),
          naar: regelTekst({ ...i, quantity: q }),
        });
      return { ...i, quantity: q };
    });
    titelKopie = `${recept.title} (voor ${personen})`;
    if (factor === 1) waarschuwingen.push("Het recept is al voor dit aantal personen.");
  } else {
    const vervangen: string[] = [];
    const extraEter: Eter | null =
      opdracht.soort === "zonder"
        ? {
            id: "opdracht",
            naam: "dit recept",
            allergieen: [opdracht.allergeen],
            ikZelf: true,
            redenZichtbaar: true,
          }
        : {
            id: "opdracht",
            naam: "dit recept",
            allergieen: [],
            dieet: "vegetarisch",
            ikZelf: true,
            redenZichtbaar: true,
          };
    const toets = [...eters, extraEter];
    const raakt = (naam: string) =>
      opdracht.soort === "zonder"
        ? allergenenIn([naam], [opdracht.allergeen]).length > 0
        : isVleesOfVis(naam);
    const lijst: IngredientRegel[] = [];
    nieuw.forEach((i, index) => {
      if (!raakt(i.name)) {
        lijst.push(i);
        return;
      }
      const regel = regelVoor(i.name);
      const keuze = regel ? toetsVervangers(regel.vervangers, toets).geschikt[0] : undefined;
      vervangen.push(i.name);
      if (keuze) {
        const naar = { ...i, name: keuze.naam.toLowerCase() };
        wijzigingen.push({
          soort: "vervangen",
          index,
          van: regelTekst(i),
          naar: regelTekst(naar),
          reden: `${keuze.reden} (${keuze.verhouding})`,
        });
        lijst.push(naar);
      } else {
        wijzigingen.push({
          soort: "weg",
          index,
          van: regelTekst(i),
          reden: "Geen veilige vervanger in de vaste lijst. Laat weg of kies zelf iets.",
        });
      }
    });
    nieuw = lijst;
    if (opdracht.soort === "vegetarisch") {
      titelKopie = `${recept.title} (vegetarisch)`;
      tags = [
        ...new Set([
          ...tags.filter((t) => !["vlees", "vis"].includes(t.toLowerCase())),
          "vegetarisch",
        ]),
      ];
      if (!wijzigingen.length)
        waarschuwingen.push("Foodlo vond geen vlees of vis in de ingrediënten.");
    } else {
      const naam = ALLERGEEN_NAAM.get(opdracht.allergeen) ?? opdracht.allergeen;
      titelKopie = `${recept.title} (zonder ${naam})`;
      if (!wijzigingen.length) waarschuwingen.push(`Foodlo vond geen ${naam} in de ingrediënten.`);
    }
    const titelRaakt =
      opdracht.soort === "zonder"
        ? allergenenIn([recept.title], [opdracht.allergeen]).length > 0
        : isVleesOfVis(recept.title);
    if (titelRaakt) waarschuwingen.push("De titel noemt het nog. Pas die zelf aan als je wil.");
    waarschuwingen.push(...stappenMetOudeNamen(recept.instructions, vervangen));
    waarschuwingen.push("Foodlo kent niet elke samenstelling. Lees altijd het etiket.");
  }

  return {
    opdracht,
    titelKopie: titelKopie.slice(0, 160),
    personen,
    tags,
    ingredienten: nieuw,
    wijzigingen,
    waarschuwingen,
  };
}

/**
 * Wat moet er in de databank veranderen om het origineel aan te passen? Rijen met een id worden
 * bijgewerkt of verwijderd; zo blijven de ids (en de koppeling aan stappen) bewaard.
 */
export function rijWijzigingen(
  oud: readonly (IngredientRegel & { id: string })[],
  voorstel: AanpasVoorstel,
): { bijwerken: (IngredientRegel & { id: string })[]; verwijderen: string[] } {
  const verwijderen = new Set<number>(
    voorstel.wijzigingen.filter((w) => w.soort === "weg").map((w) => w.index),
  );
  const overblijvend = oud.filter((_, i) => !verwijderen.has(i));
  const bijwerken: (IngredientRegel & { id: string })[] = [];
  overblijvend.forEach((o, i) => {
    const n = voorstel.ingredienten[i];
    if (!n) return;
    if (n.name !== o.name || n.quantity !== o.quantity || n.unit !== o.unit)
      bijwerken.push({ id: o.id, name: n.name, quantity: n.quantity, unit: n.unit });
  });
  return { bijwerken, verwijderen: oud.filter((_, i) => verwijderen.has(i)).map((o) => o.id) };
}

/** Eén ingrediënt vervangen (vanuit "Vervangen"): zelfde voorstel, zelfde keuze kopie/origineel. */
export function vervangVoorstel(
  recept: {
    title: string;
    servings: number;
    tags: readonly string[];
    instructions: readonly string[];
  },
  ingredienten: readonly IngredientRegel[],
  index: number,
  vervanger: { naam: string; reden: string; verhouding: string },
): AanpasVoorstel {
  const oud = ingredienten[index];
  const nieuw = ingredienten.map((i) => ({ ...i }));
  const wijzigingen: Wijziging[] = [];
  if (oud) {
    const naar = { ...oud, name: vervanger.naam.toLowerCase() };
    nieuw[index] = naar;
    wijzigingen.push({
      soort: "vervangen",
      index,
      van: regelTekst(oud),
      naar: regelTekst(naar),
      reden: `${vervanger.reden} (${vervanger.verhouding})`,
    });
  }
  return {
    opdracht: { soort: "personen", personen: recept.servings },
    titelKopie: `${recept.title} (met ${vervanger.naam.toLowerCase()})`.slice(0, 160),
    personen: recept.servings > 0 ? recept.servings : 1,
    tags: [...recept.tags],
    ingredienten: nieuw,
    wijzigingen,
    waarschuwingen: [
      ...(oud ? stappenMetOudeNamen(recept.instructions, [oud.name]) : []),
      "Kijk de hoeveelheid na en lees altijd het etiket.",
    ],
  };
}
