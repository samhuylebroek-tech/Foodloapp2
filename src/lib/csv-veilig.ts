/**
 * Eén CSV-cel, veilig voor spreadsheetprogramma's (BUG-092).
 * Een gebruikersnaam als `=HYPERLINK("https://…")` of `@SUM(…)` wordt in Excel/Numbers/Sheets
 * anders een formule zodra de eigenaar de export opent (CSV-injectie, OWASP).
 * Zulke cellen krijgen een apostrof vooraan; daarna gewone CSV-quoting.
 */
export function csvCel(v: unknown, scheiding: "," | ";" = ";"): string {
  let t = v == null ? "" : Array.isArray(v) ? v.join(" ") : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  const moetQuote = new RegExp(`["\\n\\r${scheiding}]`).test(t) || t.startsWith("'");
  return moetQuote ? `"${t.replace(/"/g, '""')}"` : t;
}

export function naarCsv(rijen: Record<string, unknown>[], scheiding: "," | ";" = ";"): string {
  if (!rijen.length) return "";
  const kolommen = Object.keys(rijen[0]!);
  return [
    kolommen.map((k) => csvCel(k, scheiding)).join(scheiding),
    ...rijen.map((r) => kolommen.map((k) => csvCel(r[k], scheiding)).join(scheiding)),
  ].join("\n");
}
