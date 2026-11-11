/**
 * Test van het voorstel 0003_bewaartermijnen (BUG-109) op een echte PostgreSQL (PGlite) uit alle
 * migraties. Per tabel een oude en een recente rij: alleen de oude moet verdwijnen (of zijn
 * user_id kwijt zijn). Gewone gebruikers mogen de opruiming niet starten. Daarna heen+terug.
 *
 *   PGLITE_DIR=<map> node tests/rls/bewaartermijnen.mjs
 * Exitcode 0 = alles zoals verwacht.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const UP = readFileSync(path.join(MAP, "0003_bewaartermijnen.up.sql"), "utf8");
const DOWN = readFileSync(path.join(MAP, "0003_bewaartermijnen.down.sql"), "utf8");
const U = "c3000000-0000-4000-8000-0000000000c3";

const { db, fouten } = await bouwDatabank({ extraNaMigraties: UP });
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${U}','u@voorbeeld.test');
  INSERT INTO public.usage_events (user_id, event, created_at) VALUES
    ('${U}','oud', now() - interval '14 months'), ('${U}','nieuw', now() - interval '1 month');
  INSERT INTO public.user_sessions (user_id, started_at, last_seen_at) VALUES
    ('${U}', now() - interval '14 months', now() - interval '14 months'), ('${U}', now(), now());
  INSERT INTO public.app_errors (user_id, bericht, created_at) VALUES
    ('${U}','oud', now() - interval '7 months'), ('${U}','nieuw', now());
  INSERT INTO public.notification_log (user_id, soort, status, dedupe_key, created_at) VALUES
    ('${U}','weekly','sent','oud', now() - interval '7 months'), ('${U}','weekly','sent','nieuw', now());
  INSERT INTO public.daily_user_stats (user_id, dag) VALUES
    ('${U}', (now() - interval '26 months')::date), ('${U}', current_date);
  INSERT INTO public.ai_usage (user_id, feature, kost_eur, created_at) VALUES
    ('${U}','import',0.01, now() - interval '14 months'), ('${U}','import',0.02, now());
`);

const n = async (sql) => (await db.query(sql)).rows[0].n;
const resultaten = [];
const check = (naam, gemeten, verwacht) =>
  resultaten.push({ naam, gemeten, verwacht, ok: gemeten === verwacht });

const gebruiker = await als(db, U, (t) =>
  t.query("SELECT * FROM public.ruim_telemetrie_op()"),
).then(
  () => "uitgevoerd",
  () => "geweigerd",
);
check("gewone gebruiker start opruiming", gebruiker, "geweigerd");

const verslag = (await db.query("SELECT * FROM public.ruim_telemetrie_op()")).rows;
check(
  "usage_events: alleen recente over",
  await n(`SELECT count(*)::int n FROM public.usage_events`),
  1,
);
check(
  "user_sessions: alleen recente over",
  await n(`SELECT count(*)::int n FROM public.user_sessions`),
  1,
);
check(
  "app_errors: alleen recente over",
  await n(`SELECT count(*)::int n FROM public.app_errors`),
  1,
);
check(
  "notification_log: alleen recente over",
  await n(`SELECT count(*)::int n FROM public.notification_log`),
  1,
);
check(
  "daily_user_stats: alleen recente over",
  await n(`SELECT count(*)::int n FROM public.daily_user_stats`),
  1,
);
check(
  "ai_usage: rijen blijven (kosten kloppen)",
  await n(`SELECT count(*)::int n FROM public.ai_usage`),
  2,
);
check(
  "ai_usage: oude rij zonder persoon",
  await n(`SELECT count(*)::int n FROM public.ai_usage WHERE user_id IS NULL`),
  1,
);
check(
  "ai_usage: totaal kost ongewijzigd",
  await n(`SELECT round(sum(kost_eur)::numeric, 2)::text n FROM public.ai_usage`),
  "0.03",
);

await db.exec(DOWN);
const weg = await n(`SELECT count(*)::int n FROM pg_proc WHERE proname = 'ruim_telemetrie_op'`);
check("terugdraaien: functie verwijderd", weg, 0);

console.log("\nBewaartermijnen (voorstel 0003) — verslag van de opruiming:");
for (const r of verslag) console.log(`  ${r.tabel}: ${r.aantal}`);
console.log("");
for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
