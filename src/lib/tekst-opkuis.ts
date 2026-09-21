/**
 * Kleine, lokale opkuis van bereidingsteksten: rommel uit imports wegwerken,
 * spaties en leestekens normaliseren, hoofdletter vooraan en punt achteraan.
 * Verandert nooit woorden of hoeveelheden.
 */

const MOJIBAKE: Array<[RegExp, string]> = [
  [/Ã©/g, "é"],
  [/Ã¨/g, "è"],
  [/Ãª/g, "ê"],
  [/Ã«/g, "ë"],
  [/Ã¯/g, "ï"],
  [/Ã®/g, "î"],
  [/Ã¶/g, "ö"],
  [/Ã´/g, "ô"],
  [/Ã¼/g, "ü"],
  [/Ã»/g, "û"],
  [/Ã§/g, "ç"],
  [/Ã¡/g, "á"],
  [/Ã /g, "à"],
  [/â€™/g, "’"],
  [/â€œ|â€\u009d/g, '"'],
  [/â€“|â€”/g, "–"],
  [/Â°/g, "°"],
  [/Â/g, ""],
];

/** Maakt één bereidingsstap netjes leesbaar. */
export function netteStap(tekst: string): string {
  let s = tekst ?? "";
  for (const [van, naar] of MOJIBAKE) s = s.replace(van, naar);

  s = s
    .replace(/\u00a0/g, " ")
    .replace(/^\s*(?:stap\s*\d+\s*[:.)-]?\s*|\d+\s*[.)]\s*|[-•*]\s*)/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(?=\S)/g, "$1 ")
    .replace(/([.!?])(?=[A-Za-zÀ-ÿ])/g, "$1 ")
    .replace(/([.,!?;:]){2,}/g, "$1")
    .trim();

  if (!s) return "";
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?:]$/.test(s)) s += ".";
  return s;
}

/** Kuist een hele lijst stappen op en laat lege regels vallen. */
export function netteStappen(stappen: string[]): string[] {
  return stappen.map(netteStap).filter(Boolean);
}
