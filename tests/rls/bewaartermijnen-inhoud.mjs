/**
 * Test van voorstel 0003b (bewaartermijnen voor inhoud en contact) op PGlite uit alle migraties.
 * Per regel een rij net buiten en net binnen de termijn: alleen de oude verdwijnt.
 *
 *   PGLITE_DIR=<map> node tests/rls/bewaartermijnen-inhoud.mjs
 * Exitcode 0 = alles zoals verwacht.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const UP = readFileSync(path.join(MAP, "0003b_bewaartermijnen_inhoud.up.sql"), "utf8");
const DOWN = readFileSync(path.join(MAP, "0003b_bewaartermijnen_inhoud.down.sql"), "utf8");
const U = "c3b00000-0000-4000-8000-0000000000c3";
const V = "c3b00000-0000-4000-8000-0000000000c4";

const { db, fouten } = await bouwDatabank({ extraNaMigraties: UP });
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${U}','u@voorbeeld.test'), ('${V}','v@voorbeeld.test');
  INSERT INTO public.recipes (id, user_id, title, deleted_at) VALUES
    ('a3b00000-0000-4000-8000-000000000001','${U}','oud weg', now() - interval '31 days'),
    ('a3b00000-0000-4000-8000-000000000002','${U}','net weg', now() - interval '29 days'),
    ('a3b00000-0000-4000-8000-000000000003','${U}','gewoon', NULL);
  INSERT INTO public.recipe_versions (recipe_id, momentopname, created_at)
    SELECT 'a3b00000-0000-4000-8000-000000000003', '{}'::jsonb, now() - (g || ' hours')::interval
    FROM generate_series(1, 25) g;
  INSERT INTO public.meal_plan (user_id, plan_date, custom_title) VALUES
    ('${U}', (current_date - interval '13 months')::date, 'oud'), ('${U}', current_date, 'nu');
  INSERT INTO public.shopping_history (user_id, name, gekocht_op) VALUES
    ('${U}','oud', now() - interval '25 months'), ('${U}','nieuw', now() - interval '1 month');
  INSERT INTO public.shares (owner_id, member_id, status, created_at) VALUES
    ('${U}','${V}','pending', now() - interval '31 days'), ('${V}','${U}','pending', now() - interval '2 days');
  INSERT INTO public.ai_cache (input_hash, feature, model, prompt_version, result, created_at) VALUES
    ('oud','import','m','1','{}', now() - interval '91 days'), ('nieuw','import','m','1','{}', now());
  INSERT INTO public.feedback (user_id, kind, message, status, created_at, updated_at) VALUES
    ('${U}','vraag','oud afgehandeld','opgelost', now() - interval '25 months', now() - interval '25 months'),
    ('${U}','vraag','oud maar open','nieuw', now() - interval '25 months', now() - interval '25 months'),
    ('${U}','vraag','recent afgehandeld','opgelost', now(), now());
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, actief, last_ok_at) VALUES
    ('${U}','https://push.voorbeeld.test/1','p','a', true, now() - interval '14 months'),
    ('${U}','https://push.voorbeeld.test/2','p','a', false, now()),
    ('${U}','https://push.voorbeeld.test/3','p','a', true, now());
`);

const n = async (sql) => (await db.query(sql)).rows[0].n;
const resultaten = [];
const check = (naam, gemeten, verwacht) =>
  resultaten.push({ naam, gemeten, verwacht, ok: gemeten === verwacht });

const gebruiker = await als(db, U, (t) => t.query("SELECT * FROM public.ruim_inhoud_op()")).then(
  () => "uitgevoerd",
  () => "geweigerd",
);
check("gewone gebruiker start opruiming", gebruiker, "geweigerd");

const verslag = (await db.query("SELECT * FROM public.ruim_inhoud_op()")).rows;
check(
  "prullenbak: > 30 dagen weg, < 30 dagen blijft, gewone recepten blijven",
  await n(`SELECT string_agg(title, ',' ORDER BY title) n FROM public.recipes`),
  "gewoon,net weg",
);
check(
  "receptversies: de laatste 20 blijven",
  await n(`SELECT count(*)::int n FROM public.recipe_versions`),
  20,
);
check(
  "receptversies: de nieuwste is er nog",
  await n(
    `SELECT count(*)::int n FROM public.recipe_versions WHERE created_at > now() - interval '90 minutes'`,
  ),
  1,
);
check(
  "weekmenu: ouder dan 12 maanden weg",
  await n(`SELECT string_agg(custom_title, ',') n FROM public.meal_plan`),
  "nu",
);
check(
  "aankoophistoriek: > 24 maanden weg",
  await n(`SELECT string_agg(name, ',') n FROM public.shopping_history`),
  "nieuw",
);
check("open uitnodiging > 30 dagen weg", await n(`SELECT count(*)::int n FROM public.shares`), 1);
check(
  "AI-cache > 90 dagen weg",
  await n(`SELECT string_agg(input_hash, ',') n FROM public.ai_cache`),
  "nieuw",
);
check(
  "feedback: alleen oud én afgehandeld weg",
  await n(`SELECT string_agg(message, ',' ORDER BY message) n FROM public.feedback`),
  "oud maar open,recent afgehandeld",
);
check(
  "push: inactief of > 13 maanden zonder succes weg",
  await n(`SELECT string_agg(endpoint, ',') n FROM public.push_subscriptions`),
  "https://push.voorbeeld.test/3",
);

await db.exec(DOWN);
check(
  "terugdraaien: functie verwijderd",
  await n(`SELECT count(*)::int n FROM pg_proc WHERE proname = 'ruim_inhoud_op'`),
  0,
);

console.log("\nBewaartermijnen inhoud (voorstel 0003b) — verslag:");
for (const r of verslag) console.log(`  ${r.tabel}: ${r.aantal}`);
console.log("");
for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
