/**
 * Bouwt een lokale PostgreSQL (PGlite, PostgreSQL in WebAssembly) op uit de migraties in de repo.
 * Volgorde: supabase/migrations (op tijdstempel), dan drizzle/migrations (op nummer). Dezelfde
 * aanname als in SECURITY-AUDIT.md; de echte volgorde in productie is onbekend (BUG-011).
 *
 * PGlite staat bewust NIET in package.json: installeer het buiten de repo en geef de map mee:
 *   npm install --prefix <map> @electric-sql/pglite@0.5.12
 *   PGLITE_DIR=<map> node tests/rls/rls-recepten.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HIER, "../..");

export async function laadPGlite() {
  const map = process.env["PGLITE_DIR"];
  if (!map) throw new Error("Zet PGLITE_DIR (map waar @electric-sql/pglite geïnstalleerd is).");
  const require = createRequire(path.join(path.resolve(map), "package.json"));
  const ingang = require.resolve("@electric-sql/pglite");
  const { PGlite } = await import(pathToFileURL(ingang).href);
  const crypto = await import(
    pathToFileURL(require.resolve("@electric-sql/pglite/contrib/pgcrypto")).href
  );
  return { PGlite, pgcrypto: crypto.pgcrypto };
}

export function migratieBestanden() {
  const sup = readdirSync(path.join(REPO, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(REPO, "supabase/migrations", f));
  const dri = readdirSync(path.join(REPO, "drizzle/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(REPO, "drizzle/migrations", f));
  return [...sup, ...dri];
}

/** Alleen wat PGlite niet kent: de extensies pg_cron/pg_net (cron en netwerk, geen rol in RLS). */
export function voorbewerk(sql) {
  return sql.replace(
    /create extension if not exists (pg_net|pg_cron)[^;]*;/gi,
    "-- (extensie overgeslagen in RLS-test)",
  );
}

/**
 * @param {{ extraNaMigraties?: string, stil?: boolean }} opties
 * @returns {Promise<{ db: any, fouten: { bestand: string, fout: string }[] }>}
 */
export async function bouwDatabank(opties = {}) {
  const { PGlite, pgcrypto } = await laadPGlite();
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(readFileSync(path.join(HIER, "supabase-nabootsing.sql"), "utf8"));
  const fouten = [];
  for (const bestand of migratieBestanden()) {
    const sql = voorbewerk(readFileSync(bestand, "utf8"));
    try {
      await db.exec(sql);
    } catch (e) {
      fouten.push({
        bestand: path.relative(REPO, bestand),
        fout: String(e?.message ?? e).split("\n")[0],
      });
    }
  }
  if (opties.extraNaMigraties) await db.exec(opties.extraNaMigraties);
  return { db, fouten };
}

/** Voert `fn` uit als een ingelogde gebruiker (rol authenticated, auth.uid() = sub), zoals PostgREST. */
export async function als(db, sub, fn) {
  return db.transaction(async (tx) => {
    if (sub) {
      await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [sub]);
      await tx.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
      await tx.exec("SET LOCAL ROLE authenticated");
    } else {
      await tx.exec("SET LOCAL ROLE anon");
    }
    return fn(tx);
  });
}
