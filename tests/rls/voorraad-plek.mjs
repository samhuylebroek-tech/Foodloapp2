/**
 * Test van voorstel 0020 (plek in de voorraad) op PGlite uit alle migraties.
 * A is eigenaar van de voorraad, B een buitenstaander.
 *
 *   PGLITE_DIR=<map> node tests/rls/voorraad-plek.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const A = "a9200000-0000-4000-8000-00000000000a";
const B = "b9200000-0000-4000-8000-00000000000b";
const P = "a9200000-0000-4000-8000-000000000001";

const { db, fouten } = await bouwDatabank({ extraNaMigraties: lees("0020_voorraad_plek.up.sql") });
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.pantry_items (id, user_id, naam) VALUES ('${P}', '${A}', 'melk');
`);

const resultaten = [];
const check = (naam, gemeten, verwacht) =>
  resultaten.push({ naam, gemeten, verwacht, ok: gemeten === verwacht });
const lukt = (p) =>
  p.then(
    () => "gelukt",
    () => "geweigerd",
  );
const veranderd = async (wie, sql) =>
  als(db, wie, async (t) => (await t.query(sql)).affectedRows ?? 0);
const doe = (wie, sql) => lukt(als(db, wie, (t) => t.exec(sql)));

check(
  "A zet de plek van de eigen melk op koelkast",
  await veranderd(A, `UPDATE public.pantry_items SET plek = 'koelkast' WHERE id = '${P}'`),
  1,
);
check(
  "onbekende plek geweigerd",
  await doe(A, `UPDATE public.pantry_items SET plek = 'garage' WHERE id = '${P}'`),
  "geweigerd",
);
check(
  "A maakt een product met plek",
  await doe(
    A,
    `INSERT INTO public.pantry_items (user_id, naam, plek) VALUES ('${A}', 'erwten', 'diepvries')`,
  ),
  "gelukt",
);
check(
  "B verandert de plek bij A niet",
  await veranderd(B, `UPDATE public.pantry_items SET plek = 'kast'`),
  0,
);
check(
  "leeg mag (Foodlo gokt)",
  await veranderd(A, `UPDATE public.pantry_items SET plek = NULL WHERE id = '${P}'`),
  1,
);
await db.exec(lees("0020_voorraad_plek.down.sql"));
check(
  "terugdraaien: kolom weg, voorraad blijft",
  (
    await db.query(
      `SELECT (count(*) = 2 AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pantry_items' AND column_name = 'plek'))::text n FROM public.pantry_items`,
    )
  ).rows[0].n,
  "true",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
