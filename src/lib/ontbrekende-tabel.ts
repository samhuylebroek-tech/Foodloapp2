/**
 * Herkent "tabel bestaat niet" van Postgres (42P01) en PostgREST (PGRST205). Los van de client,
 * zodat ook servercode (bv. de AVG-export) het kan gebruiken zonder de browserclient te laden.
 */
type MogelijkeFout = { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };

/** Waar als de fout betekent dat de tabel (of view) niet bestaat. */
export function isOntbrekendeTabel(fout: unknown): boolean {
  if (!fout || typeof fout !== "object") return false;
  const f = fout as MogelijkeFout;
  const code = typeof f.code === "string" ? f.code : "";
  if (code === "42P01" || code === "PGRST205") return true;
  const tekst = [f.message, f.details, f.hint]
    .filter((x): x is string => typeof x === "string")
    .join(" ");
  return (
    /relation ["']?[\w.]+["']? does not exist/i.test(tekst) ||
    /could not find the table/i.test(tekst)
  );
}
