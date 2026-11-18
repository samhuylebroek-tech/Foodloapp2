/**
 * Gangbare verpakkingen ("1 zak 500 g; je hebt 350 g nodig"). Richtwaarden van een gewone
 * Belgische supermarkt: géén winkelbelofte, de app zegt er altijd "gangbare verpakking" bij.
 * Onbekend product of niet om te rekenen = geen voorstel.
 */
import { canoniekeNaam } from "@/lib/product-herkenning";
import { inFamilie, naarBasis, toonbaar, type Maat } from "./eenheden";
import { toonBelgischeMaat } from "@/lib/ingredienten";

type Pak = { soort: string; quantity: number; unit: string };

const RUW: [string[], Pak[]][] = [
  [
    ["pasta", "spaghetti", "penne", "macaroni", "tagliatelle", "fusilli"],
    [
      { soort: "pak", quantity: 500, unit: "g" },
      { soort: "pak", quantity: 1, unit: "kg" },
    ],
  ],
  [
    ["rijst"],
    [
      { soort: "pak", quantity: 500, unit: "g" },
      { soort: "pak", quantity: 1, unit: "kg" },
    ],
  ],
  [["bloem", "suiker"], [{ soort: "pak", quantity: 1, unit: "kg" }]],
  [["melk"], [{ soort: "brik", quantity: 1, unit: "l" }]],
  [
    ["room"],
    [
      { soort: "brikje", quantity: 20, unit: "cl" },
      { soort: "brik", quantity: 50, unit: "cl" },
    ],
  ],
  [["boter"], [{ soort: "pakje", quantity: 250, unit: "g" }]],
  [
    ["gehakt"],
    [
      { soort: "schaal", quantity: 300, unit: "g" },
      { soort: "schaal", quantity: 500, unit: "g" },
    ],
  ],
  [["kaas", "gemalen kaas", "geraspte kaas"], [{ soort: "zak", quantity: 200, unit: "g" }]],
  [["passata"], [{ soort: "fles", quantity: 500, unit: "g" }]],
  [["ui"], [{ soort: "net", quantity: 1, unit: "kg" }]],
  [
    ["aardappel"],
    [
      { soort: "zak", quantity: 1, unit: "kg" },
      { soort: "zak", quantity: 2.5, unit: "kg" },
    ],
  ],
  [["wortel"], [{ soort: "zak", quantity: 1, unit: "kg" }]],
  [["spinazie"], [{ soort: "zak", quantity: 300, unit: "g" }]],
  [
    ["champignon"],
    [
      { soort: "bakje", quantity: 250, unit: "g" },
      { soort: "bakje", quantity: 500, unit: "g" },
    ],
  ],
  [
    ["ei"],
    [
      { soort: "doos", quantity: 6, unit: "" },
      { soort: "doos", quantity: 12, unit: "" },
    ],
  ],
  [["kokosmelk"], [{ soort: "blik", quantity: 400, unit: "ml" }]],
  [["havermout"], [{ soort: "pak", quantity: 500, unit: "g" }]],
  [
    ["yoghurt"],
    [
      { soort: "pot", quantity: 500, unit: "g" },
      { soort: "pot", quantity: 1, unit: "kg" },
    ],
  ],
  [["kerstomaat"], [{ soort: "bakje", quantity: 250, unit: "g" }]],
  [["spek"], [{ soort: "pakje", quantity: 200, unit: "g" }]],
  [
    ["feta", "mozzarella"],
    [
      { soort: "pakje", quantity: 200, unit: "g" },
      { soort: "bol", quantity: 125, unit: "g" },
    ],
  ],
  [["linzen", "kikkererwten"], [{ soort: "blik", quantity: 400, unit: "g" }]],
];

const TABEL = new Map<string, Pak[]>(
  RUW.flatMap(([namen, pakken]) => namen.map((n) => [canoniekeNaam(n), pakken] as const)),
);

export type Verpakking = {
  /** Hoeveel verpakkingen. */
  aantal: number;
  /** "zak 500 g" */
  pak: string;
  /** "1 zak 500 g" */
  kort: string;
  /** "1 zak 500 g; je hebt 350 g nodig" */
  tekst: string;
};

/** Gangbare verpakking voor een hoeveelheid, of null als Foodlo er geen kent. */
export function voorgesteldeVerpakking(
  naam: string,
  quantity: number | null,
  unit: string | null | undefined,
): Verpakking | null {
  const pakken = TABEL.get(canoniekeNaam(naam));
  const nodig = naarBasis(quantity, unit);
  if (!pakken || !nodig || nodig.waarde <= 0) return null;
  const opties = pakken
    .map((p) => ({ p, maat: naarBasis(p.quantity, p.unit)! }))
    .map(({ p, maat }) => ({ p, maat: omzet(maat, nodig.familie, naam) }))
    .filter((o): o is { p: Pak; maat: Maat } => o.maat !== null)
    .sort((a, b) => a.maat.waarde - b.maat.waarde);
  if (!opties.length) return null;
  // Kleinste verpakking die volstaat; anders zoveel van de grootste als nodig.
  const past = opties.find((o) => o.maat.waarde >= nodig.waarde - 1e-9);
  const keuze = past ?? opties[opties.length - 1]!;
  const aantal = past ? 1 : Math.ceil(nodig.waarde / keuze.maat.waarde - 1e-9);
  const pak = `${keuze.p.soort} ${toonPak(keuze.p)}`.trim();
  const kort =
    `${aantal} ${aantal > 1 ? meervoud(keuze.p.soort) : keuze.p.soort} ${toonPak(keuze.p)}`.trim();
  const t = toonbaar(nodig);
  const nodigTekst =
    nodig.familie === "stuk"
      ? `${String(t.quantity).replace(".", ",")} ${t.quantity === 1 ? "stuk" : "stuks"}`
      : toonBelgischeMaat(t.quantity, t.unit) || String(t.quantity);
  return { aantal, pak, kort, tekst: `${kort}; je hebt ${nodigTekst} nodig` };
}

function omzet(maat: Maat, familie: string, naam: string): Maat | null {
  return inFamilie(maat, familie, naam);
}

function toonPak(p: Pak): string {
  if (!p.unit) return `van ${p.quantity}`;
  return toonBelgischeMaat(p.quantity, p.unit);
}

function meervoud(soort: string): string {
  const m: Record<string, string> = {
    pak: "pakken",
    pakje: "pakjes",
    brik: "brikken",
    brikje: "brikjes",
    zak: "zakken",
    schaal: "schalen",
    fles: "flessen",
    net: "netten",
    bakje: "bakjes",
    doos: "dozen",
    blik: "blikken",
    pot: "potten",
    bol: "bollen",
  };
  return m[soort] ?? soort;
}
