/**
 * Koppelt ingrediënten aan kookstappen.
 *
 * Volledig lokaal: de naam van een ingrediënt wordt gezocht in de tekst van de
 * stappen (ongevoelig voor hoofdletters, accenten en meervoud). Handmatige
 * keuzes van de gebruiker gaan altijd voor op de automatische herkenning.
 */

export type StapIngredient = {
  name: string;
  quantity: number | null;
  unit: string;
};

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

function kernwoorden(naam: string): string[] {
  const woorden = normaliseer(naam)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWOORDEN.has(w))
    .map(stam);
  return woorden.length ? woorden : normaliseer(naam).split(" ").filter(Boolean).map(stam);
}

function stapWoorden(stap: string): Set<string> {
  return new Set(
    normaliseer(stap)
      .split(" ")
      .filter(Boolean)
      .map(stam),
  );
}

function komtVoor(naam: string, woorden: Set<string>): boolean {
  const kern = kernwoorden(naam);
  if (!kern.length) return false;
  return kern.some((k) => {
    if (k.length < 3) return false;
    if (woorden.has(k)) return true;
    // samengestelde namen: "bloem" in de stap hoort bij "patisseriebloem"
    for (const w of woorden) {
      if (w.length >= 4 && k.length >= 4 && (k.endsWith(w) || w.endsWith(k))) return true;
    }
    return false;
  });
}

/**
 * Geeft per stap de indexen van de ingrediënten die erbij horen.
 * Een ingrediënt verschijnt maar bij één stap: de eerste waarin het voorkomt.
 */
export function koppelStappen(
  stappen: string[],
  ingredienten: StapIngredient[],
  handmatig?: StapKoppeling | null,
): number[][] {
  const resultaat: number[][] = stappen.map(() => []);
  const woordenPerStap = stappen.map(stapWoorden);
  const gebruikt = new Set<number>();

  // 1. handmatige keuzes
  stappen.forEach((_, i) => {
    const keuze = handmatig?.[String(i)];
    if (!keuze) return;
    const namen = new Set(keuze.map((n) => normaliseer(n)));
    ingredienten.forEach((ing, idx) => {
      if (namen.has(normaliseer(ing.name))) {
        resultaat[i]!.push(idx);
        gebruikt.add(idx);
      }
    });
  });

  const handmatigeStappen = new Set(
    Object.keys(handmatig ?? {}).filter((k) => (handmatig?.[k]?.length ?? 0) >= 0),
  );

  // 2. automatische herkenning voor de rest
  ingredienten.forEach((ing, idx) => {
    if (gebruikt.has(idx)) return;
    for (let i = 0; i < stappen.length; i++) {
      if (handmatigeStappen.has(String(i))) continue; // stap staat onder eigen beheer
      if (komtVoor(ing.name, woordenPerStap[i]!)) {
        resultaat[i]!.push(idx);
        gebruikt.add(idx);
        return;
      }
    }
  });

  return resultaat;
}

/** Toont een hoeveelheid netjes, geschaald naar het aantal personen. */
export function toonHoeveelheid(ing: StapIngredient, factor: number): string {
  if (ing.quantity === null) return "";
  const waarde = Math.round(ing.quantity * factor * 100) / 100;
  return `${waarde} ${ing.unit}`.trim();
}
