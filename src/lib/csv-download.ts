/** Bewaart een CSV-tekst als bestand in de browser. */
export function bewaarCsv(bestand: string, inhoud: string) {
  const blob = new Blob([`\ufeff${inhoud}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestand;
  a.click();
  URL.revokeObjectURL(url);
}
