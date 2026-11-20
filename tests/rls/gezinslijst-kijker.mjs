/**
 * BUG-163 — Kijker op de gezinslijst (shopping_edit = false). Toont het lek op de huidige
 * migraties (drizzle 0024: elk gezinslid mag alles) en bewijst voorstel 0018 (NIET uitgevoerd):
 * een kijker mag alleen afvinken. Daarna terugdraaien: exact de huidige stand (lek terug).
 *
 * Gezin G1: A (eigenaar), C (lid, mag bewerken), K (lid, alleen bekijken). B: ander gezin.
 *
 *   PGLITE_DIR=<map> node tests/rls/gezinslijst-kijker.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const A = "a8000000-0000-4000-8000-00000000000a";
const B = "b8000000-0000-4000-8000-00000000000b";
const C = "c8000000-0000-4000-8000-00000000000c";
const K = "d8000000-0000-4000-8000-00000000000d";
const U = "d8000000-0000-4000-8000-00000000000e";
const G1 = "f8000000-0000-4000-8000-0000000000f1";
const G2 = "f8000000-0000-4000-8000-0000000000f2";
const EIGEN_K = "e8000000-0000-4000-8000-0000000000e1";
const EIGEN_A = "e8000000-0000-4000-8000-0000000000e2";

const { db, fouten } = await bouwDatabank();
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test'),('${C}','c@voorbeeld.test'),('${K}','k@voorbeeld.test'),('${U}','u@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B'),('${C}','C'),('${K}','K') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G1}', '${A}', 'Gezin een'), ('${G2}', '${B}', 'Gezin twee');
  INSERT INTO public.group_members (group_id, user_id, rol, status, shopping_view, shopping_edit) VALUES ('${G1}','${A}','eigenaar','actief', true, true) ON CONFLICT DO NOTHING;
  INSERT INTO public.group_members (group_id, user_id, rol, status, shopping_view, shopping_edit) VALUES ('${G2}','${B}','eigenaar','actief', true, true) ON CONFLICT DO NOTHING;
  INSERT INTO public.group_members (group_id, user_id, rol, status, shopping_view, shopping_edit) VALUES ('${G1}','${C}','lid','actief', true, true) ON CONFLICT DO NOTHING;
  INSERT INTO public.group_members (group_id, user_id, rol, status, shopping_view, shopping_edit) VALUES ('${G1}','${K}','lid','actief', true, false) ON CONFLICT DO NOTHING;
  INSERT INTO public.group_members (group_id, user_id, rol, status, shopping_view, shopping_edit) VALUES ('${G1}','${U}','lid','uitgenodigd', true, true) ON CONFLICT DO NOTHING;
  INSERT INTO public.shopping_lists (id, user_id, name) VALUES ('${EIGEN_K}', '${K}', 'Eigen van K');
`);
// De groups-trigger maakt per gezin een "Gezinslijst".
const GL1 = (await db.query(`SELECT id FROM public.shopping_lists WHERE group_id = '${G1}'`))
  .rows[0].id;
const GL2 = (await db.query(`SELECT id FROM public.shopping_lists WHERE group_id = '${G2}'`))
  .rows[0].id;

let n = 0;
/** Nieuw item (als superuser) en zijn id. */
async function item(lijst, eigenaar = A, naam = "brood") {
  const id = `e8000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  await db.exec(
    `INSERT INTO public.shopping_items (id, user_id, list_id, name, unit) VALUES ('${id}','${eigenaar}','${lijst}','${naam}','')`,
  );
  return id;
}

const resultaten = [];
const check = (naam, gemeten, verwacht) =>
  resultaten.push({ naam, gemeten, verwacht, ok: gemeten === verwacht });
/** Aantal geraakte rijen (0 = stil geweigerd door RLS), of "fout" (expliciet geweigerd). */
const raak = (wie, sql) =>
  als(db, wie, async (t) => String((await t.query(sql)).affectedRows ?? 0)).catch(() => "fout");
const voegToe = (wie, lijst) =>
  raak(
    wie,
    `INSERT INTO public.shopping_items (user_id, list_id, name, unit) VALUES ('${wie}','${lijst}','extra','')`,
  );

// ---------- 1. huidige migraties: het lek ----------
{
  const i = await item(GL1);
  check(
    "NU: kijker K wist een product van de gezinslijst (lek)",
    await raak(K, `DELETE FROM public.shopping_items WHERE id = '${i}'`),
    "1",
  );
  const j = await item(GL1);
  check(
    "NU: kijker K hernoemt een product (lek)",
    await raak(K, `UPDATE public.shopping_items SET name = 'iets anders' WHERE id = '${j}'`),
    "1",
  );
  check("NU: kijker K voegt toe (lek)", await voegToe(K, GL1), "1");
  // Vaststelling (niet in 0018): groep_recht kijkt naar de rechten van de EIGENAAR van het item,
  // niet naar die van de kijker. Daardoor kan K ook op de eigen lijst van A schrijven.
  await db.exec(
    `INSERT INTO public.shopping_lists (id, user_id, name) VALUES ('${EIGEN_A}', '${A}', 'Eigen van A')`,
  );
  const p = await item(EIGEN_A);
  check(
    "NU (vaststelling): kijker K wist op de EIGEN lijst van A",
    await raak(K, `DELETE FROM public.shopping_items WHERE id = '${p}'`),
    "1",
  );
}

// ---------- 2. met voorstel 0018 ----------
await db.exec(lees("0018_gezinslijst_kijker.up.sql"));
{
  const i = await item(GL1);
  check(
    "0018: kijker K wist niet",
    await raak(K, `DELETE FROM public.shopping_items WHERE id = '${i}'`),
    "0",
  );
  check(
    "0018: kijker K hernoemt niet",
    await raak(K, `UPDATE public.shopping_items SET name = 'iets anders' WHERE id = '${i}'`),
    "fout",
  );
  check(
    "0018: kijker K verandert de hoeveelheid niet",
    await raak(K, `UPDATE public.shopping_items SET quantity = 9 WHERE id = '${i}'`),
    "fout",
  );
  check("0018: kijker K voegt niet toe", await voegToe(K, GL1), "fout");
  check(
    "0018: kijker K mag afvinken",
    await raak(K, `UPDATE public.shopping_items SET checked = true WHERE id = '${i}'`),
    "1",
  );
  check(
    "0018: afvinken is echt bewaard",
    String(
      (await db.query(`SELECT checked FROM public.shopping_items WHERE id = '${i}'`)).rows[0]
        .checked,
    ),
    "true",
  );
  check(
    "0018: kijker K ziet de gezinslijst nog",
    await als(db, K, async (t) =>
      String(
        (
          await t.query(
            `SELECT count(*)::int n FROM public.shopping_items WHERE list_id = '${GL1}'`,
          )
        ).rows[0].n > 0,
      ),
    ),
    "true",
  );
  check(
    "0018: bewerker C hernoemt",
    await raak(C, `UPDATE public.shopping_items SET name = 'volkorenbrood' WHERE id = '${i}'`),
    "1",
  );
  check("0018: bewerker C voegt toe", await voegToe(C, GL1), "1");
  check(
    "0018: bewerker C wist",
    await raak(C, `DELETE FROM public.shopping_items WHERE id = '${i}'`),
    "1",
  );
  const j = await item(GL1, C);
  check(
    "0018: eigenaar A wist",
    await raak(A, `DELETE FROM public.shopping_items WHERE id = '${j}'`),
    "1",
  );
  check("0018: eigenaar A voegt toe", await voegToe(A, GL1), "1");
  const b = await item(GL2, B);
  check(
    "0018: buitenstaander B wist niets bij G1",
    await raak(B, `DELETE FROM public.shopping_items WHERE list_id = '${GL1}'`),
    "0",
  );
  check(
    "0018: K wist niets in een ander gezin",
    await raak(K, `DELETE FROM public.shopping_items WHERE id = '${b}'`),
    "0",
  );
  check(
    "0018: K vinkt niets af in een ander gezin",
    await raak(K, `UPDATE public.shopping_items SET checked = true WHERE id = '${b}'`),
    "0",
  );
  // Eigen lijst van K: ongewijzigd, alles mag.
  check("0018: K voegt toe aan de eigen lijst", await voegToe(K, EIGEN_K), "1");
  check(
    "0018: K wist op de eigen lijst",
    await raak(K, `DELETE FROM public.shopping_items WHERE list_id = '${EIGEN_K}'`),
    "1",
  );
  // Uitgenodigd (nog niet actief) = niets.
  const k = await item(GL1);
  check(
    "0018: uitgenodigde U vinkt niet af",
    await raak(U, `UPDATE public.shopping_items SET checked = true WHERE id = '${k}'`),
    "0",
  );
}

// ---------- 3. terugdraaien: exact de huidige stand ----------
await db.exec(lees("0018_gezinslijst_kijker.down.sql"));
{
  const i = await item(GL1);
  check(
    "TERUG: kijker K wist weer (zoals nu)",
    await raak(K, `DELETE FROM public.shopping_items WHERE id = '${i}'`),
    "1",
  );
  check(
    "TERUG: functies en trigger weg",
    (
      await db.query(`SELECT (to_regprocedure('public.gezinslijst_mag_bewerken(uuid)') IS NULL
        AND to_regprocedure('public.gezinslijst_alleen_afvinken()') IS NULL)::text n`)
    ).rows[0].n,
    "true",
  );
  check(
    "TERUG: de oude regel staat er weer",
    String(
      (
        await db.query(
          `SELECT count(*)::int n FROM pg_policies WHERE policyname = 'shopping_items_gezin_write'`,
        )
      ).rows[0].n,
    ),
    "1",
  );
}

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
