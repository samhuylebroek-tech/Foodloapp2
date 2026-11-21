/**
 * Test van voorstel 0016 (suggestie_instellingen) op PGlite uit alle migraties.
 * A en C zitten in hetzelfde gezin; B is een buitenstaander.
 *
 *   PGLITE_DIR=<map> node tests/rls/suggesties.mjs
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

const { db, fouten } = await bouwDatabank({
  extraNaMigraties: lees("0016_suggestie_instellingen.up.sql"),
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

check(
  "A bewaart eigen keuzes (weer uit, één kaart verborgen)",
  await lukt(
    als(db, A, (t) =>
      t.query(
        `INSERT INTO public.suggestie_instellingen (uit, verborgen) VALUES ('{weer}','{restjes:r1}')`,
      ),
    ),
  ),
  "gelukt",
);
check(
  "A maakt geen rij op naam van B",
  await lukt(
    als(db, A, (t) =>
      t.query(`INSERT INTO public.suggestie_instellingen (user_id) VALUES ('${B}')`),
    ),
  ),
  "geweigerd",
);
check(
  "tweede rij voor A kan niet (één rij per gebruiker)",
  await lukt(
    als(db, A, (t) => t.query(`INSERT INTO public.suggestie_instellingen DEFAULT VALUES`)),
  ),
  "geweigerd",
);
check(
  "onbekende soort geweigerd",
  await lukt(
    als(db, B, (t) =>
      t.query(`INSERT INTO public.suggestie_instellingen (uit) VALUES ('{raket}')`),
    ),
  ),
  "geweigerd",
);
check(
  "meer dan 100 verborgen kaarten geweigerd",
  await lukt(
    als(db, B, (t) =>
      t.query(
        `INSERT INTO public.suggestie_instellingen (verborgen)
         SELECT array_agg('k' || g) FROM generate_series(1, 101) g`,
      ),
    ),
  ),
  "geweigerd",
);
check(
  "B bewaart eigen keuzes",
  await lukt(
    als(db, B, (t) =>
      t.query(`INSERT INTO public.suggestie_instellingen (uit) VALUES ('{seizoen}')`),
    ),
  ),
  "gelukt",
);
check(
  "gezinslid C leest de keuzes van A niet",
  await tel(C, `SELECT count(*)::int n FROM public.suggestie_instellingen`),
  0,
);
check(
  "B ziet alleen de eigen rij",
  await tel(B, `SELECT count(*)::int n FROM public.suggestie_instellingen`),
  1,
);
check(
  "C wijzigt de keuzes van A niet",
  await veranderd(C, `UPDATE public.suggestie_instellingen SET uit = '{}'`),
  0,
);
check(
  "B wist de rij van A niet",
  await veranderd(B, `DELETE FROM public.suggestie_instellingen WHERE user_id = '${A}'`),
  0,
);
check(
  "A zet weer aan (upsert-weg: bijwerken)",
  await veranderd(A, `UPDATE public.suggestie_instellingen SET uit = '{}', bijgewerkt_op = now()`),
  1,
);
check(
  "A kan de rij niet aan B geven",
  await lukt(
    als(db, A, (t) => t.query(`UPDATE public.suggestie_instellingen SET user_id = '${B}'`)),
  ),
  "geweigerd",
);
check(
  "anoniem leest niets",
  await lukt(als(db, null, (t) => t.query(`SELECT * FROM public.suggestie_instellingen`))),
  "geweigerd",
);
check(
  "account weg = keuzes weg",
  (await db.exec(`DELETE FROM auth.users WHERE id = '${A}'`),
  String(
    (
      await db.query(
        `SELECT count(*)::int n FROM public.suggestie_instellingen WHERE user_id = '${A}'`,
      )
    ).rows[0].n,
  )),
  "0",
);

await db.exec(lees("0016_suggestie_instellingen.down.sql"));
check(
  "terugdraaien: tabel weg",
  (await db.query(`SELECT (to_regclass('public.suggestie_instellingen') IS NULL)::text n`)).rows[0]
    .n,
  "true",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
