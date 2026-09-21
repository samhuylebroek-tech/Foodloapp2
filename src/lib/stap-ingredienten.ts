/**
 * Koppelt ingrediënten aan kookstappen.
 *
 * Volledig lokaal: de naam van een ingrediënt wordt gezocht in de tekst van de
 * stappen (ongevoelig voor hoofdletters, accenten, meervoud en samenstellingen).
 * Handmatige keuzes van de gebruiker gaan altijd voor op de automatische herkenning.
 *
 * Belangrijk: als een ingrediënt in de staptekst genoemd wordt, moet het er ook
 * bij staan. Er is dus geen maximum per stap en geen minimumlengte meer, en een
 * ingrediënt mag bij meerdere stappen verschijnen (de tweede keer als "rest").
 */

export type StapIngredient = {
  name: string;
  quantity: number | null;
  unit: string;
};

/** Eén treffer bij een stap. `herhaling` = het ingrediënt kwam eerder al voor. */
export type Treffer = { idx: number; herhaling: boolean };

/** Handmatige koppeling: stapindex (als tekst) -> lijst ingrediëntnamen. */
export type StapKoppeling = Record<string, string[]>;

const STOPWOORDEN = new Set([
  "de", "het", "een", "van", "met", "en", "of", "in", "op", "te", "tot",
  "vers", "verse", "fijn", "fijne", "fijngesneden", "gesneden", "gehakt",
  "gemalen", "grof", "grove", "gedroogde", "gedroogd", "grote", "kleine",
  "klein", "groot", "extra", "beetje", "snuf", "naar", "smaak", "eventueel",
  "zwarte", "witte", "rode", "groene", "geraspte", "geraspt", "blikje", "blik",
  "voor", "erbij", "extra's", "stuk", "stuks", "halve", "hele", "topping",
]);

export function normaliseer(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Heel eenvoudige stam: haalt courante Nederlandse meervoudsuitgangen weg. */
export function stam(woord: string): string {
  let w = woord;
  for (const suffix of ["tjes", "jes", "eren", "en", "s"]) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  // dubbele medeklinker aan het eind (bollen -> bol)
  if (w.length > 3 && /([bdfgklmnprst])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}

/**
 * Vergelijkbare basisvorm: meervoud weg, dubbele medeklinker weg en lange
 * klinkers ingekort, zodat "tomaat"/"tomaten" en "ui"/"uien" samenvallen.
 */
export function basis(woord: string): string {
  let w = stam(woord);
  if (w.length > 2 && /(?:en|s)$/.test(woord) && w === woord) {
    w = woord.replace(/(?:en|s)$/, "");
  }
  w = w.replace(/aa/g, "a").replace(/ee/g, "e").replace(/oo/g, "o").replace(/uu/g, "u");
  if (w.length > 2 && /([bdfgklmnprst])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}

function kernwoorden(naam: string): string[] {
  const alle = normaliseer(naam).split(" ").filter(Boolean);
  const kern = alle.filter((w) => w.length >= 2 && !STOPWOORDEN.has(w)).map(basis);
  return kern.length ? kern : alle.map(basis);
}

type StapTekst = { basissen: Set<string>; lange: string[] };

function ontleedStap(stap: string): StapTekst {
  const basissen = new Set<string>();
  const lange: string[] = [];
  for (const w of normaliseer(stap).split(" ").filter(Boolean)) {
    basissen.add(w);
    basissen.add(stam(w));
    basissen.add(basis(w));
    if (w.length >= 6) lange.push(basis(w));
  }
  return { basissen, lange };
}

/**
 * Komt het ingrediënt voor in deze stap?
 * - korte namen ("ei", "ui"): enkel een woordtreffer, anders krijg je valse
 *   treffers in woorden als "uit";
 * - langere namen: ook in samenstellingen ("uienringen", "tomatensaus").
 */
function komtVoor(naam: string, stapTekst: StapTekst): boolean {
  const kern = kernwoorden(naam);
  if (!kern.length) return false;
  return kern.some((k) => {
    if (!k) return false;
    if (stapTekst.basissen.has(k)) return true;
    if (k.length >= 4 && stapTekst.lange.some((w) => w.includes(k))) return true;
    return false;
  });
}

/**
 * Geeft per stap de treffers: elke stap die een ingrediënt noemt, toont het ook.
 * De tweede en volgende vermelding krijgt `herhaling: true`.
 */
export function koppelStappen(
  stappen: string[],
  ingredienten: StapIngredient[],
  handmatig?: StapKoppeling | null,
): Treffer[][] {
  const resultaat: Treffer[][] = stappen.map(() => []);
  const tekstPerStap = stappen.map(ontleedStap);
  const alGezien = new Set<number>();

  const handmatigeStappen = new Set(Object.keys(handmatig ?? {}));

  stappen.forEach((_, i) => {
    const keuze = handmatig?.[String(i)];
    if (keuze) {
      // handmatige keuze bepaalt volledig wat er bij deze stap hoort
      const namen = new Set(keuze.map((n) => normaliseer(n)));
      ingredienten.forEach((ing, idx) => {
        if (!namen.has(normaliseer(ing.name))) return;
        resultaat[i]!.push({ idx, herhaling: alGezien.has(idx) });
        alGezien.add(idx);
      });
      return;
    }
    if (handmatigeStappen.has(String(i))) return;

    ingredienten.forEach((ing, idx) => {
      if (!komtVoor(ing.name, tekstPerStap[i]!)) return;
      resultaat[i]!.push({ idx, herhaling: alGezien.has(idx) });
      alGezien.add(idx);
    });
  });

  return resultaat;
}

/** Toont een hoeveelheid netjes, geschaald naar het aantal personen. */
export function toonHoeveelheid(ing: StapIngredient, factor: number): string {
  if (ing.quantity === null) return "";
  const waarde = Math.round(ing.quantity * factor * 100) / 100;
  return `${waarde} ${ing.unit}`.trim();
}
