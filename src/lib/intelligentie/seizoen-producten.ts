/**
 * Seizoenslijst per product (usecase 16): groenten en fruit die in België ongeveer in die maanden
 * van eigen bodem (volle grond) komen. Een vaste lijst, geen externe dienst en geen prijzen.
 * Ongeveer: het weer verschuift het seizoen soms een paar weken. Bewaarproducten en kweek in de
 * serre (bv. champignons, witloof buiten het seizoen) staan er bewust niet onder.
 */
import { normaliseerTekst } from "@/lib/zoeken";

/** Maanden 1–12. `woorden`: hoe het product in een ingrediëntregel kan heten. */
const LIJST: { naam: string; woorden: string[]; maanden: number[] }[] = [
  { naam: "witloof", woorden: ["witloof", "chicon"], maanden: [10, 11, 12, 1, 2, 3, 4] },
  { naam: "pompoen", woorden: ["pompoen", "butternut"], maanden: [9, 10, 11, 12] },
  { naam: "spruitjes", woorden: ["spruit"], maanden: [10, 11, 12, 1, 2] },
  { naam: "prei", woorden: ["prei"], maanden: [9, 10, 11, 12, 1, 2, 3, 4] },
  { naam: "knolselder", woorden: ["knolselder"], maanden: [10, 11, 12, 1, 2, 3] },
  { naam: "schorseneren", woorden: ["schorseneer", "schorseneren"], maanden: [11, 12, 1, 2, 3] },
  { naam: "rode kool", woorden: ["rode kool", "rodekool"], maanden: [9, 10, 11, 12, 1, 2, 3] },
  { naam: "savooikool", woorden: ["savooi"], maanden: [9, 10, 11, 12, 1, 2, 3] },
  { naam: "boerenkool", woorden: ["boerenkool"], maanden: [11, 12, 1, 2] },
  { naam: "pastinaak", woorden: ["pastinaak"], maanden: [10, 11, 12, 1, 2, 3] },
  { naam: "veldsla", woorden: ["veldsla"], maanden: [10, 11, 12, 1, 2, 3] },
  { naam: "asperges", woorden: ["asperge"], maanden: [4, 5, 6] },
  { naam: "rabarber", woorden: ["rabarber"], maanden: [4, 5, 6] },
  { naam: "spinazie", woorden: ["spinazie"], maanden: [4, 5, 6, 9, 10] },
  { naam: "radijsjes", woorden: ["radijs"], maanden: [4, 5, 6, 7, 8, 9] },
  { naam: "aardbeien", woorden: ["aardbei"], maanden: [5, 6, 7, 8] },
  { naam: "erwten", woorden: ["erwt", "erwten", "doperwt"], maanden: [6, 7, 8] },
  { naam: "tuinbonen", woorden: ["tuinbo"], maanden: [6, 7] },
  { naam: "boontjes", woorden: ["boontje", "sperzieboon", "princessenboon"], maanden: [7, 8, 9] },
  { naam: "courgette", woorden: ["courgette"], maanden: [6, 7, 8, 9] },
  { naam: "tomaten", woorden: ["tomaat", "tomaten", "kerstomaat"], maanden: [7, 8, 9] },
  { naam: "komkommer", woorden: ["komkommer"], maanden: [6, 7, 8, 9] },
  { naam: "sla", woorden: ["kropsla", "ijsbergsla", "sla"], maanden: [5, 6, 7, 8, 9] },
  { naam: "bloemkool", woorden: ["bloemkool"], maanden: [6, 7, 8, 9, 10, 11] },
  { naam: "broccoli", woorden: ["broccoli"], maanden: [6, 7, 8, 9, 10] },
  { naam: "venkel", woorden: ["venkel"], maanden: [6, 7, 8, 9, 10] },
  {
    naam: "rode biet",
    woorden: ["rode biet", "biet", "bieten", "rode bieten"],
    maanden: [7, 8, 9, 10, 11],
  },
  { naam: "appels", woorden: ["appel"], maanden: [8, 9, 10, 11, 12] },
  { naam: "peren", woorden: ["peer", "peren"], maanden: [8, 9, 10, 11, 12] },
  { naam: "pruimen", woorden: ["pruim"], maanden: [7, 8, 9] },
  { naam: "kersen", woorden: ["kers", "kersen"], maanden: [6, 7] },
  { naam: "frambozen", woorden: ["framboos", "frambozen"], maanden: [6, 7, 8, 9] },
  { naam: "blauwe bessen", woorden: ["blauwe bes", "bosbes"], maanden: [7, 8, 9] },
];

/** Uitzonderingen: woorden die een seizoensnaam bevatten maar iets anders zijn. */
const NIET = [
  "appelazijn",
  "appelsap",
  "appelstroop",
  "tomatenpuree",
  "tomatenpassata",
  "gedroogde",
  "diepvries",
  "blik",
];

/** Producten in het seizoen voor een maand (0 = januari, zoals Date.getMonth()). */
export function inSeizoen(maand0: number): string[] {
  const m = maand0 + 1;
  return LIJST.filter((p) => p.maanden.includes(m)).map((p) => p.naam);
}

/** Korte woorden (sla, kers, peer) alleen als heel woord: geen "slagroom" of "kerstomaat". */
function treft(tekst: string, woord: string) {
  const w = normaliseerTekst(woord);
  const einde = w.length <= 4 ? "([^a-z]|$)" : "";
  return new RegExp(`(^|[^a-z])${w}${einde}`).test(tekst);
}

/** Welke seizoensproducten zitten in deze ingrediënten of titel? (unieke namen, lijstvolgorde) */
export function seizoensProductenIn(teksten: readonly string[], maand0: number): string[] {
  const m = maand0 + 1;
  const genormaliseerd = teksten
    .map((t) => normaliseerTekst(t))
    .filter((t) => t && !NIET.some((n) => t.includes(n)));
  return LIJST.filter(
    (p) => p.maanden.includes(m) && genormaliseerd.some((t) => p.woorden.some((w) => treft(t, w))),
  ).map((p) => p.naam);
}
