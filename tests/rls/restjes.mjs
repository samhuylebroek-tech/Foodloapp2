/**
 * Test van voorstel 0019 (restjes op het account, gedeeld met het gezin) op PGlite uit alle
 * migraties. A en C zitten in hetzelfde gezin (C actief lid), D is uitgenodigd maar nog niet
 * actief, B is een buitenstaander met een eigen gezin.
 *
 *   PGLITE_DIR=<map> node tests/rls/restjes.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const A = "a9190000-0000-4000-8000-00000000000a";
const B = "b9190000-0000-4000-8000-00000000000b";
const C = "c9190000-0000-4000-8000-00000000000c";
const D = "d9190000-0000-4000-8000-00000000000d";
const G = "f9190000-0000-4000-8000-0000000000f0";
const GB = "f9190000-0000-4000-8000-0000000000f1";
const R = "a9190000-0000-4000-8000-000000000001";
const RB = "b9190000-0000-4000-8000-000000000001";
const X = "a9190000-0000-4000-8000-0000000000aa";

const { db, fouten } = await bouwDatabank({
  extraNaMigraties: [
    lees("0002a_basislijn_recepten_fotos.up.sql"),
    lees("0019_restjes.up.sql"),
  ].join("\n"),
});
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test'),('${C}','c@voorbeeld.test'),('${D}','d@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B'),('${C}','C'),('${D}','D') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G}', '${A}', 'Testgezin'), ('${GB}', '${B}', 'Ander gezin');
  INSERT INTO public.group_members (group_id, user_id, rol, status) VALUES
    ('${G}','${C}','lid','actief'), ('${G}','${D}','lid','uitgenodigd') ON CONFLICT DO NOTHING;
  INSERT INTO public.recipes (id, user_id, title) VALUES ('${R}','${A}','Stoofvlees'), ('${RB}','${B}','Van B');
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

check(
  "A bewaart een restje voor het gezin, met recept",
  await doe(
    A,
    `INSERT INTO public.restjes (id, group_id, titel, recipe_id, porties) VALUES ('${X}','${G}','Stoofvlees',  '${R}', 2)`,
  ),
  "gelukt",
);
check(
  "A bewaart een restje zonder gezin",
  await doe(A, `INSERT INTO public.restjes (titel, porties) VALUES ('Soep', 1)`),
  "gelukt",
);
check(
  "A schrijft niet op naam van C",
  await doe(A, `INSERT INTO public.restjes (user_id, titel, porties) VALUES ('${C}','X', 1)`),
  "geweigerd",
);
check(
  "B zet geen restje in het gezin van A",
  await doe(B, `INSERT INTO public.restjes (group_id, titel, porties) VALUES ('${G}','X', 1)`),
  "geweigerd",
);
check(
  "uitgenodigd (niet actief) D zet geen restje in het gezin",
  await doe(D, `INSERT INTO public.restjes (group_id, titel, porties) VALUES ('${G}','X', 1)`),
  "geweigerd",
);
check(
  "A koppelt geen recept van een buitenstaander",
  await doe(A, `INSERT INTO public.restjes (recipe_id, titel, porties) VALUES ('${RB}','X', 1)`),
  "geweigerd",
);
check(
  "0 porties geweigerd",
  await doe(A, `INSERT INTO public.restjes (titel, porties) VALUES ('X', 0)`),
  "geweigerd",
);
check(
  "lege naam geweigerd",
  await doe(A, `INSERT INTO public.restjes (titel, porties) VALUES ('  ', 1)`),
  "geweigerd",
);
check(
  "onbekende afloop geweigerd",
  await doe(
    A,
    `INSERT INTO public.restjes (titel, porties, status, afgesloten_op) VALUES ('X', 1, 'verkocht', now())`,
  ),
  "geweigerd",
);
check(
  "afgesloten zonder datum geweigerd",
  await doe(A, `INSERT INTO public.restjes (titel, porties, status) VALUES ('X', 1, 'opgegeten')`),
  "geweigerd",
);
check("A leest de eigen restjes", await tel(A, `SELECT count(*)::int n FROM public.restjes`), 2);
check(
  "gezinslid C leest het gezinsrestje (niet A's eigen)",
  await tel(C, `SELECT count(*)::int n FROM public.restjes`),
  1,
);
check("uitgenodigd D leest niets", await tel(D, `SELECT count(*)::int n FROM public.restjes`), 0);
check("ander gezin B leest niets", await tel(B, `SELECT count(*)::int n FROM public.restjes`), 0);
check(
  "C plant het gezinsrestje",
  await veranderd(C, `UPDATE public.restjes SET gepland_op = current_date WHERE id = '${X}'`),
  1,
);
check(
  "C markeert het als opgegeten",
  await veranderd(
    C,
    `UPDATE public.restjes SET status = 'opgegeten', afgesloten_op = now() WHERE id = '${X}'`,
  ),
  1,
);
check(
  "C verandert de porties van A's restje niet",
  await doe(C, `UPDATE public.restjes SET porties = 9 WHERE id = '${X}'`),
  "geweigerd",
);
check(
  "C haalt het restje niet uit het gezin",
  await doe(C, `UPDATE public.restjes SET group_id = NULL WHERE id = '${X}'`),
  "geweigerd",
);
check(
  "A draagt het restje niet over aan C",
  await doe(A, `UPDATE public.restjes SET user_id = '${C}' WHERE id = '${X}'`),
  "geweigerd",
);
check(
  "B wijzigt niets",
  await veranderd(B, `UPDATE public.restjes SET gepland_op = current_date`),
  0,
);
check(
  "D wijzigt niets",
  await veranderd(D, `UPDATE public.restjes SET gepland_op = current_date`),
  0,
);
check("C wist A's restje niet", await veranderd(C, `DELETE FROM public.restjes`), 0);
check("B wist niets", await veranderd(B, `DELETE FROM public.restjes`), 0);
check(
  "A zet het terug op bewaard (ongedaan maken)",
  await veranderd(
    A,
    `UPDATE public.restjes SET status = 'bewaard', afgesloten_op = NULL WHERE id = '${X}'`,
  ),
  1,
);
check("anoniem leest niets", await doe(null, `SELECT * FROM public.restjes`), "geweigerd");
check(
  "gewone gebruiker ruimt niet op",
  await doe(A, `SELECT public.ruim_restjes_op()`),
  "geweigerd",
);
check(
  "C is geen lid meer: leest niets meer",
  (await db.exec(`DELETE FROM public.group_members WHERE user_id = '${C}'`),
  await tel(C, `SELECT count(*)::int n FROM public.restjes`)),
  0,
);
check(
  "gezin weg = restje blijft, zonder gezin",
  (await db.exec(
    `DELETE FROM public.shopping_lists WHERE group_id = '${G}'; DELETE FROM public.groups WHERE id = '${G}'`,
  ),
  String(
    (
      await db.query(
        `SELECT count(*)::int n FROM public.restjes WHERE id = '${X}' AND group_id IS NULL`,
      )
    ).rows[0].n,
  )),
  "1",
);
check(
  "A wist het eigen restje",
  await veranderd(A, `DELETE FROM public.restjes WHERE id = '${X}'`),
  1,
);
check(
  "account weg = restjes weg",
  (await db.exec(`DELETE FROM auth.users WHERE id = '${A}'`),
  String((await db.query(`SELECT count(*)::int n FROM public.restjes`)).rows[0].n)),
  "0",
);

await db.exec(lees("0019_restjes.down.sql"));
check(
  "terugdraaien: tabel weg",
  (await db.query(`SELECT (to_regclass('public.restjes') IS NULL)::text n`)).rows[0].n,
  "true",
);
check(
  "terugdraaien: recepten blijven",
  (await db.query(`SELECT (to_regclass('public.recipes') IS NOT NULL)::text n`)).rows[0].n,
  "true",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
