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

const ENTITEITEN: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "’",
  nbsp: " ",
  hellip: "…",
  eacute: "é",
  egrave: "è",
  euml: "ë",
  iuml: "ï",
  ouml: "ö",
  uuml: "ü",
  ccedil: "ç",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
};

/** Zet HTML-codes zoals &#39; of &amp; om naar gewone tekens. */
function decodeerEntiteiten(tekst: string): string {
  return tekst
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z][a-z0-9]{1,8});/gi, (hele, naam: string) => ENTITEITEN[naam.toLowerCase()] ?? hele);
}

/** Maakt één bereidingsstap netjes leesbaar. */
export function netteStap(tekst: string): string {
  let s = decodeerEntiteiten(tekst ?? "");
  for (const [van, naar] of MOJIBAKE) s = s.replace(van, naar);

  s = s
    // losgeslagen apostrof: "zo' n" -> "zo’n"
    .replace(/([a-zA-Zà-ÿ])['’]\s+([a-z])\b/g, "$1’$2")
    .replace(/\u00a0/g, " ")
    .replace(/^\s*(?:stap\s*\d+\s*[:.)-]?\s*|\d+\s*[.)]\s*|[-•*]\s*)/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    // Spatie na , ; : — maar niet tussen twee cijfers ("2,5 uur", "18:30").
    .replace(/([,;:])(?=\S)/g, (teken, _t, positie: number, geheel: string) =>
      /\d/.test(geheel[positie - 1] ?? "") && /\d/.test(geheel[positie + 1] ?? "") ? teken : `${teken} `,
    )
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
