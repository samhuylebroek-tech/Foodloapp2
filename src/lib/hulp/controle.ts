/**
 * AI Content Manager, kern: vergelijkt de hulpinhoud met de werkelijke app.
 * - Verwijst een artikel naar een functie die niet (meer) in het register staat? → verouderd.
 * - Citeert een artikel een knop die niet (meer) in de code staat? → verouderd.
 * - Heeft een functie uit het register nog geen artikel? → "zonder uitleg".
 * - Bestaat een routebestand uit het register niet meer? → register verouderd.
 * Puur (zonder bestandstoegang), zodat het in tests en later in het Control Center bruikbaar is.
 */
import type { Functie } from "@/lib/functies";
import { geciteerdeLabels, type Artikel } from "./artikels";
import { kernwoorden } from "./zoeken";

export type ArtikelStand = {
  slug: string;
  titel: string;
  status: Artikel["status"];
  bron: Artikel["bron"];
  verouderd: string[];
};

export type InhoudRapport = {
  artikels: ArtikelStand[];
  functiesZonderUitleg: string[];
  registerFouten: string[];
};

export function controleerInhoud(opties: {
  artikels: Artikel[];
  functies: Functie[];
  /** Komt deze tekst letterlijk voor in de broncode van de app? */
  inCode: (tekst: string) => boolean;
  bestandBestaat: (pad: string) => boolean;
}): InhoudRapport {
  const { artikels, functies, inCode, bestandBestaat } = opties;
  const sleutels = new Set(functies.map((f) => f.sleutel));
  const registerFouten: string[] = [];
  for (const f of functies) {
    for (const b of f.bestanden)
      if (!bestandBestaat(b)) registerFouten.push(`${f.sleutel}: bestand ${b} bestaat niet`);
    for (const l of f.labels)
      if (!inCode(l)) registerFouten.push(`${f.sleutel}: label "${l}" staat niet meer in de app`);
  }
  const standen = artikels.map((a): ArtikelStand => {
    const verouderd: string[] = [];
    for (const s of a.functies) if (!sleutels.has(s)) verouderd.push(`functie ${s} bestaat niet`);
    for (const l of geciteerdeLabels(a))
      if (!inCode(l)) verouderd.push(`knop of tekst "${l}" staat niet in de app`);
    if (a.status === "goedgekeurd" && !a.nagelezen) verouderd.push("goedgekeurd zonder nalezer");
    return { slug: a.slug, titel: a.titel, status: a.status, bron: a.bron, verouderd };
  });
  const gedekt = new Set(artikels.flatMap((a) => a.functies));
  return {
    artikels: standen,
    functiesZonderUitleg: functies.filter((f) => !gedekt.has(f.sleutel)).map((f) => f.sleutel),
    registerFouten,
  };
}

/**
 * Veelgestelde vragen groeperen: vragen of feedbackberichten bij het artikel dat het best past.
 * Wat nergens past, komt in "zonder artikel": dat is een signaal voor nieuwe uitleg.
 */
export function groepeerVragen(
  vragen: string[],
  artikels: Artikel[],
  zoek: (v: string, a: Artikel[]) => { artikel: Artikel; score: number }[],
): { slug: string | null; titel: string; vragen: string[] }[] {
  const groepen = new Map<string | null, { titel: string; vragen: string[] }>();
  for (const v of vragen) {
    if (!kernwoorden(v).length) continue;
    const beste = zoek(v, artikels)[0];
    const sleutel = beste && beste.score >= 6 ? beste.artikel.slug : null;
    const titel = sleutel ? beste!.artikel.titel : "Zonder artikel";
    const g = groepen.get(sleutel) ?? { titel, vragen: [] };
    g.vragen.push(v);
    groepen.set(sleutel, g);
  }
  return [...groepen.entries()]
    .map(([slug, g]) => ({ slug, ...g }))
    .sort((a, b) => b.vragen.length - a.vragen.length);
}
