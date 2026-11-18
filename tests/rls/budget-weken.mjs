/**
 * Test van voorstel 0014 (budget_weken) op PGlite uit alle migraties.
 * A en C zitten in hetzelfde gezin; B is een buitenstaander.
 *
 *   PGLITE_DIR=<map> node tests/rls/budget-weken.mjs
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
const G = "f8000000-0000-4000-8000-0000000000f0";

const { db, fouten } = await bouwDatabank({ extraNaMigraties: lees("0014_budget_weken.up.sql") });
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test'),('${C}','c@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B'),('${C}','C') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G}', '${A}', 'Testgezin');
  INSERT INTO public.group_members (group_id, user_id, rol, status) VALUES ('${G}','${C}','lid','actief') ON CONFLICT DO NOTHING;
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
const zet = (wie, waarden) =>
  lukt(
    als(db, wie, (t) =>
      t.query(
        `INSERT INTO public.budget_weken (week, budget, geschat, niet_geschat, maaltijden) VALUES ${waarden}`,
      ),
    ),
  );

check(
  "A bewaart twee weken",
  await zet(A, `('2026-11-09',120,104.5,1,6),('2026-11-16',120,131.2,0,7)`),
  "gelukt",
);
check(
  "tweede rij voor dezelfde week geweigerd",
  await zet(A, `('2026-11-16',120,99,0,7)`),
  "geweigerd",
);
check(
  "upsert op (user_id, week) werkt",
  await lukt(
    als(db, A, (t) =>
      t.query(
        `INSERT INTO public.budget_weken (week, budget, geschat) VALUES ('2026-11-16',120,118)
         ON CONFLICT (user_id, week) DO UPDATE SET geschat = excluded.geschat`,
      ),
    ),
  ),
  "gelukt",
);
check("geen maandag geweigerd", await zet(A, `('2026-11-18',120,50,0,3)`), "geweigerd");
check("negatieve kost geweigerd", await zet(A, `('2026-11-23',120,-1,0,3)`), "geweigerd");
check("budget boven 5000 geweigerd", await zet(A, `('2026-11-23',6000,10,0,3)`), "geweigerd");
check(
  "A schrijft niet op naam van B",
  await lukt(
    als(db, A, (t) =>
      t.query(
        `INSERT INTO public.budget_weken (user_id, week, geschat) VALUES ('${B}','2026-11-16',1)`,
      ),
    ),
  ),
  "geweigerd",
);
check("A leest de eigen weken", await tel(A, `SELECT count(*)::int n FROM public.budget_weken`), 2);
check(
  "gezinslid C leest A's budget niet",
  await tel(C, `SELECT count(*)::int n FROM public.budget_weken`),
  0,
);
check(
  "buitenstaander B leest niets",
  await tel(B, `SELECT count(*)::int n FROM public.budget_weken`),
  0,
);
check(
  "C wijzigt A's rijen niet",
  await veranderd(C, `UPDATE public.budget_weken SET geschat = 1`),
  0,
);
check("B wist A's rijen niet", await veranderd(B, `DELETE FROM public.budget_weken`), 0);
check(
  "anoniem leest niets",
  await lukt(als(db, null, (t) => t.query(`SELECT * FROM public.budget_weken`))),
  "geweigerd",
);
check(
  "account weg = geschiedenis weg",
  (await db.exec(`DELETE FROM auth.users WHERE id = '${A}'`),
  String((await db.query(`SELECT count(*)::int n FROM public.budget_weken`)).rows[0].n)),
  "0",
);

await db.exec(lees("0014_budget_weken.down.sql"));
check(
  "terugdraaien: tabel weg",
  (await db.query(`SELECT (to_regclass('public.budget_weken') IS NULL)::text n`)).rows[0].n,
  "true",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
