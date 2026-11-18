/**
 * Test van voorstel 0015 (kookmomenten) op PGlite uit alle migraties, plus de bestaande rechten
 * op recipe_versions zoals de receptversies (P3) ze gebruiken.
 * A en C zitten in hetzelfde gezin; B is een buitenstaander.
 *
 *   PGLITE_DIR=<map> node tests/rls/kookmomenten.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const A = "a9150000-0000-4000-8000-00000000000a";
const B = "b9150000-0000-4000-8000-00000000000b";
const C = "c9150000-0000-4000-8000-00000000000c";
const G = "f9150000-0000-4000-8000-0000000000f0";
const R = "a9150000-0000-4000-8000-000000000001";
const RB = "b9150000-0000-4000-8000-000000000001";
const P = "a9150000-0000-4000-8000-000000000002";
const PB = "b9150000-0000-4000-8000-000000000002";

// 0002a (basislijn recepten): zonder die regel is elk recept leesbaar (BUG-105, productie niet).
const { db, fouten } = await bouwDatabank({
  extraNaMigraties: [
    lees("0002a_basislijn_recepten_fotos.up.sql"),
    lees("0015_kookmomenten.up.sql"),
  ].join("\n"),
});
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test'),('${C}','c@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B'),('${C}','C') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G}', '${A}', 'Testgezin');
  INSERT INTO public.group_members (group_id, user_id, rol, status) VALUES ('${G}','${C}','lid','actief') ON CONFLICT DO NOTHING;
  INSERT INTO public.recipes (id, user_id, title) VALUES ('${R}','${A}','Stoofvlees'), ('${RB}','${B}','Van B');
  INSERT INTO public.meal_plan (id, user_id, plan_date, recipe_id) VALUES
    ('${P}','${A}', current_date, '${R}'), ('${PB}','${B}', current_date, '${RB}');
`);

const resultaten = [];
const check = (naam, gemeten, verwacht) =>
  resultaten.push({ naam, gemeten, verwacht, ok: gemeten === verwacht });
const lukt = (p) =>
  p.then(
    () => "gelukt",
    () => "geweigerd",
  );
const tel = async (wie, sql) => als(db, wie, async (t) => (await t.query(sql)).rows[0].n);
const veranderd = async (wie, sql) =>
  als(db, wie, async (t) => (await t.query(sql)).affectedRows ?? 0);
const doe = (wie, sql) => lukt(als(db, wie, (t) => t.exec(sql)));

// ---------------------------------------------------------------- kookmomenten
check(
  "A bewaart 'gekookt' met notitie voor de eigen maaltijd",
  await doe(
    A,
    `INSERT INTO public.kookmomenten (recipe_id, meal_plan_id, porties, notitie) VALUES ('${R}','${P}',4,'Iets minder zout')`,
  ),
  "gelukt",
);
check(
  "tweede moment voor dezelfde maaltijd geweigerd",
  await doe(A, `INSERT INTO public.kookmomenten (meal_plan_id) VALUES ('${P}')`),
  "geweigerd",
);
check(
  "zonder maaltijd mag meer dan één keer",
  await doe(
    A,
    `INSERT INTO public.kookmomenten (recipe_id) VALUES ('${R}'); INSERT INTO public.kookmomenten (recipe_id) VALUES ('${R}')`,
  ),
  "gelukt",
);
check(
  "notitie langer dan 500 tekens geweigerd",
  await doe(A, `INSERT INTO public.kookmomenten (notitie) VALUES (repeat('x', 501))`),
  "geweigerd",
);
check(
  "lege notitie geweigerd (dan null)",
  await doe(A, `INSERT INTO public.kookmomenten (notitie) VALUES ('')`),
  "geweigerd",
);
check(
  "0 porties geweigerd",
  await doe(A, `INSERT INTO public.kookmomenten (porties) VALUES (0)`),
  "geweigerd",
);
check(
  "A schrijft niet op naam van B",
  await doe(A, `INSERT INTO public.kookmomenten (user_id) VALUES ('${B}')`),
  "geweigerd",
);
check(
  "A koppelt geen maaltijd van een buitenstaander",
  await doe(A, `INSERT INTO public.kookmomenten (meal_plan_id) VALUES ('${PB}')`),
  "geweigerd",
);
check(
  "B koppelt geen recept van A",
  await doe(B, `INSERT INTO public.kookmomenten (recipe_id) VALUES ('${R}')`),
  "geweigerd",
);
check(
  "A leest de eigen momenten",
  await tel(A, `SELECT count(*)::int n FROM public.kookmomenten`),
  3,
);
check(
  "gezinslid C leest A's notities niet",
  await tel(C, `SELECT count(*)::int n FROM public.kookmomenten`),
  0,
);
check("B leest niets", await tel(B, `SELECT count(*)::int n FROM public.kookmomenten`), 0);
check(
  "C wijzigt A's notitie niet",
  await veranderd(C, `UPDATE public.kookmomenten SET notitie = 'gehackt'`),
  0,
);
check("B wist niets van A", await veranderd(B, `DELETE FROM public.kookmomenten`), 0);
check(
  "A werkt het eigen moment bij",
  await veranderd(A, `UPDATE public.kookmomenten SET porties = 2 WHERE meal_plan_id = '${P}'`),
  1,
);
check(
  "A kan een moment niet aan B overdragen",
  await doe(A, `UPDATE public.kookmomenten SET user_id = '${B}' WHERE meal_plan_id = '${P}'`),
  "geweigerd",
);
check("anoniem leest niets", await doe(null, `SELECT * FROM public.kookmomenten`), "geweigerd");
check(
  "maaltijd weg = moment blijft zonder koppeling",
  (await db.exec(`DELETE FROM public.meal_plan WHERE id = '${P}'`),
  String(
    (
      await db.query(
        `SELECT count(*)::int n FROM public.kookmomenten WHERE meal_plan_id IS NULL AND notitie IS NOT NULL`,
      )
    ).rows[0].n,
  )),
  "1",
);

// ---------------------------------------------------------------- receptversies (bestaande tabel)
const snap = `'{"recept":{"title":"Stoofvlees"},"ingredienten":[],"reden":"assistent","wat":["zonder gluten"]}'::jsonb`;
check(
  "eigenaar bewaart een versie van het eigen recept",
  await doe(
    A,
    `INSERT INTO public.recipe_versions (recipe_id, gewijzigd_door, momentopname) VALUES ('${R}','${A}',${snap})`,
  ),
  "gelukt",
);
check(
  "eigenaar leest de versies",
  await tel(A, `SELECT count(*)::int n FROM public.recipe_versions WHERE recipe_id = '${R}'`),
  1,
);
check(
  "buitenstaander bewaart geen versie van A's recept",
  await doe(
    B,
    `INSERT INTO public.recipe_versions (recipe_id, momentopname) VALUES ('${R}',${snap})`,
  ),
  "geweigerd",
);
check(
  "buitenstaander leest A's versies niet",
  await tel(B, `SELECT count(*)::int n FROM public.recipe_versions`),
  0,
);
check(
  "buitenstaander wist A's versies niet",
  await veranderd(B, `DELETE FROM public.recipe_versions`),
  0,
);
check(
  "eigenaar wist een versie (ongedaan maken van terugzetten)",
  await veranderd(A, `DELETE FROM public.recipe_versions WHERE recipe_id = '${R}'`),
  1,
);

check(
  "account weg = momenten weg",
  (await db.exec(`DELETE FROM auth.users WHERE id = '${A}'`),
  String((await db.query(`SELECT count(*)::int n FROM public.kookmomenten`)).rows[0].n)),
  "0",
);

await db.exec(lees("0015_kookmomenten.down.sql"));
check(
  "terugdraaien: tabel weg",
  (await db.query(`SELECT (to_regclass('public.kookmomenten') IS NULL)::text n`)).rows[0].n,
  "true",
);
check(
  "terugdraaien: receptversies blijven",
  (await db.query(`SELECT (to_regclass('public.recipe_versions') IS NOT NULL)::text n`)).rows[0].n,
  "true",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
