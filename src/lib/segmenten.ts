/** Segmentnamen — bruikbaar in de app én op de server. */
export const SEGMENTEN = [
  "nieuw",
  "zeer_actief",
  "actief",
  "licht_actief",
  "inactief",
  "churnrisico",
  "hoge_ai",
  "lage_ai",
  "hoge_kost",
  "lage_kost",
  "gratis",
  "betalend",
] as const;

export type Segment = (typeof SEGMENTEN)[number];

export const SEGMENT_LABEL: Record<Segment, string> = {
  nieuw: "Nieuwe gebruiker",
  zeer_actief: "Zeer actief",
  actief: "Actief",
  licht_actief: "Licht actief",
  inactief: "Inactief",
  churnrisico: "Risico op afhaken",
  hoge_ai: "Hoge AI-gebruiker",
  lage_ai: "Lage AI-gebruiker",
  hoge_kost: "Hoge kost",
  lage_kost: "Lage kost",
  gratis: "Gratis gebruiker",
  betalend: "Betalende gebruiker",
};
