// Klantenkaarten: alles lokaal en zonder AI.
// De kaartgegevens worden ook in de browser bewaard, zodat je ze
// zonder internet aan de kassa kan tonen.

export type Kaart = {
  id: string;
  user_id: string;
  store_slug: string | null;
  winkel_naam: string;
  kaartnaam: string;
  nummer: string;
  formaat: string;
  favoriet: boolean;
  gedeeld: boolean;
};

export type Winkel = {
  slug: string;
  naam: string;
  kleur: string;
  standaard_formaat: string;
};

export const FORMATEN = ["CODE128", "EAN13", "EAN8", "CODE39", "ITF", "QR"] as const;

const SLEUTEL = "foodlo-kaarten";
const WINKELS_SLEUTEL = "foodlo-winkels";

export function bewaarLokaal(kaarten: Kaart[]) {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(kaarten));
  } catch {
    /* opslag vol of geblokkeerd: niet erg */
  }
}

export function leesLokaal(): Kaart[] {
  try {
    const raw = localStorage.getItem(SLEUTEL);
    return raw ? (JSON.parse(raw) as Kaart[]) : [];
  } catch {
    return [];
  }
}

export function bewaarWinkels(winkels: Winkel[]) {
  try {
    localStorage.setItem(WINKELS_SLEUTEL, JSON.stringify(winkels));
  } catch {
    /* niet erg */
  }
}

export function leesWinkels(): Winkel[] {
  try {
    const raw = localStorage.getItem(WINKELS_SLEUTEL);
    return raw ? (JSON.parse(raw) as Winkel[]) : [];
  } catch {
    return [];
  }
}

// Het formaat dat de camera teruggaf omzetten naar wat wij tekenen.
export function formaatVanScan(formaat: string): string {
  const f = formaat.toLowerCase();
  if (f.includes("qr")) return "QR";
  if (f === "ean_13" || f === "ean13") return "EAN13";
  if (f === "ean_8" || f === "ean8") return "EAN8";
  if (f === "code_39" || f === "code39") return "CODE39";
  if (f === "itf" || f === "itf14") return "ITF";
  return "CODE128";
}

// Winkel raden op basis van de kaartcode. Volledig lokaal, kost niets.
export function raadWinkel(nummer: string, winkels: Winkel[]): Winkel | null {
  const schoon = nummer.replace(/\D/g, "");
  const prefixen: Record<string, string> = {
    carrefour: "5400141",
    delhaize: "5400111",
    colruyt: "5400101",
    "albert-heijn": "26",
    lidl: "2000",
    aldi: "4061",
  };
  for (const [slug, prefix] of Object.entries(prefixen)) {
    if (prefix.length > 3 && schoon.startsWith(prefix)) {
      const w = winkels.find((x) => x.slug === slug);
      if (w) return w;
    }
  }
  // Staat de winkelnaam in de gescande tekst (bv. bij QR-codes)?
  const tekst = nummer.toLowerCase();
  const opNaam = winkels.find((w) => w.slug !== "overig" && tekst.includes(w.slug.replace("-", " ")));
  return opNaam ?? null;
}

export function maskeer(nummer: string): string {
  if (nummer.length <= 4) return "••••";
  return `•••• ${nummer.slice(-4)}`;
}

export function groepeer(nummer: string): string {
  return nummer.replace(/(.{4})/g, "$1 ").trim();
}
