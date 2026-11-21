/**
 * Test van voorstel 0024 (AI-gebruik per dag, anoniem totaal, testmandjes) op PGlite
 * uit alle migraties. A en B zijn gewone gebruikers; B heeft een eigen lijst.
 *
 *   PGLITE_DIR=<map> node tests/rls/ai-gebruik-mandjes.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const A = "a9240000-0000-4000-8000-00000000000a";
const B = "b9240000-0000-4000-8000-00000000000b";
const LA = "a9240000-0000-4000-8000-0000000000a1";
const LB = "b9240000-0000-4000-8000-0000000000b1";

const { db, fouten } = await bouwDatabank({
  extraNaMigraties: lees("0024_ai_gebruik_mandjes.up.sql"),
});
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.shopping_lists (id, user_id, name) VALUES ('${LA}','${A}','Lijst A'),('${LB}','${B}','Lijst B');
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
const doe = (wie, sql) => lukt(als(db, wie, (t) => t.exec(sql)));
const veranderd = async (wie, sql) =>
  als(db, wie, async (t) => (await t.query(sql)).affectedRows ?? 0);
const mandje = (lijst, extra = {}) => {
  const v = {
    provider: "'test'",
    test: "true",
    referentie: "'TEST-123456'",
    regels: `'[{"product":"Melk (test)","aantal":1,"prijs_cent":109}]'`,
    ...extra,
  };
  return `INSERT INTO public.winkel_mandjes (list_id, provider, test, referentie, regels, totaal_cent)
    VALUES (${lijst ? `'${lijst}'` : "NULL"}, ${v.provider}, ${v.test}, ${v.referentie}, ${v.regels}, 109)`;
};

// ---- AI-gebruik
for (let i = 0; i < 3; i++)
  await als(db, A, (t) => t.exec(`SELECT public.ai_gebruik_tel('kookhulp.vervang')`));
await als(db, A, (t) => t.exec(`SELECT public.ai_gebruik_tel('kookhulp.vervang', true)`));
await als(db, B, (t) => t.exec(`SELECT public.ai_gebruik_tel('weekassistent')`));
check(
  "A ziet het eigen dagtotaal (3, 1 uit cache)",
  await tel(
    A,
    `SELECT (aantal || '/' || uit_cache) n FROM public.ai_gebruik_dag WHERE soort = 'kookhulp.vervang'`,
  ),
  "3/1",
);
check("A ziet B niet", await tel(A, `SELECT count(*)::int n FROM public.ai_gebruik_dag`), 1);
check(
  "onbekende soort geweigerd",
  await doe(A, `SELECT public.ai_gebruik_tel('iets.anders')`),
  "geweigerd",
);
check(
  "anoniem telt niet",
  await doe(null, `SELECT public.ai_gebruik_tel('kookhulp.vraag')`),
  "geweigerd",
);
check(
  "A schrijft niet zelf in de tellers",
  await doe(A, `UPDATE public.ai_gebruik_dag SET aantal = 0`),
  "geweigerd",
);
check(
  "A voegt geen rij toe op naam van B",
  await doe(
    A,
    `INSERT INTO public.ai_gebruik_dag (user_id, dag, soort, aantal) VALUES ('${B}', current_date, 'kookhulp.vraag', 1)`,
  ),
  "geweigerd",
);
check(
  "gewone gebruiker leest het totaal niet",
  await doe(A, `SELECT * FROM public.ai_gebruik_totaal`),
  "geweigerd",
);
check(
  "totaal heeft geen user_id-kolom",
  (
    await db.query(
      `SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'ai_gebruik_totaal' AND column_name = 'user_id'`,
    )
  ).rows[0].n,
  0,
);
check(
  "totaal over iedereen samen (server)",
  (await db.query(`SELECT sum(aantal)::int n FROM public.ai_gebruik_totaal`)).rows[0].n,
  4,
);
// Dagplafond: 500 per soort, daarna telt ook het totaal niet verder.
await db.exec(
  `UPDATE public.ai_gebruik_dag SET aantal = 500 WHERE user_id = '${A}' AND soort = 'kookhulp.vervang'`,
);
await als(db, A, (t) => t.exec(`SELECT public.ai_gebruik_tel('kookhulp.vervang')`));
check(
  "plafond 500: niet verder, totaal ook niet",
  (
    await db.query(
      `SELECT (d.aantal || '/' || t.aantal) n FROM public.ai_gebruik_dag d, public.ai_gebruik_totaal t WHERE d.user_id = '${A}' AND d.soort = 'kookhulp.vervang' AND t.soort = 'kookhulp.vervang'`,
    )
  ).rows[0].n,
  "500/3",
);

// ---- testmandjes
check("A maakt een testmandje voor de eigen lijst", await doe(A, mandje(LA)), "gelukt");
check("A koppelt geen mandje aan de lijst van B", await doe(A, mandje(LB)), "geweigerd");
check(
  "geen echte winkel (provider moet 'test' zijn)",
  await doe(A, mandje(LA, { provider: "'colruyt'" })),
  "geweigerd",
);
check("testmodus verplicht", await doe(A, mandje(LA, { test: "false" })), "geweigerd");
check("leeg mandje geweigerd", await doe(A, mandje(LA, { regels: "'[]'" })), "geweigerd");
check(
  "B ziet het mandje van A niet",
  await tel(B, `SELECT count(*)::int n FROM public.winkel_mandjes`),
  0,
);
check(
  "A wijzigt een mandje niet",
  await doe(A, `UPDATE public.winkel_mandjes SET totaal_cent = 0`),
  "geweigerd",
);
check("B wist het mandje van A niet", await veranderd(B, `DELETE FROM public.winkel_mandjes`), 0);
check(
  "lijst weg = mandje blijft zonder lijst",
  (await db.exec(`DELETE FROM public.shopping_lists WHERE id = '${LA}'`),
  (await db.query(`SELECT count(*)::int n FROM public.winkel_mandjes WHERE list_id IS NULL`))
    .rows[0].n),
  1,
);
check(
  "anoniem leest geen mandjes",
  await doe(null, `SELECT * FROM public.winkel_mandjes`),
  "geweigerd",
);

// ---- opruimen en account weg
check("gewone gebruiker ruimt niet op", await doe(A, `SELECT public.ruim_ai_op()`), "geweigerd");
await db.exec(`SELECT public.ruim_ai_op()`);
check(
  "opruimen: recent gebruik en mandjes blijven",
  (
    await db.query(
      `SELECT ((SELECT count(*) FROM public.ai_gebruik_dag) + (SELECT count(*) FROM public.winkel_mandjes))::int n`,
    )
  ).rows[0].n,
  3,
);
await db.exec(`DELETE FROM auth.users WHERE id = '${A}'`);
check(
  "account weg = gebruik en mandjes weg; totaal blijft",
  (
    await db.query(
      `SELECT ((SELECT count(*) FROM public.ai_gebruik_dag WHERE user_id = '${A}') + (SELECT count(*) FROM public.winkel_mandjes))::int || '/' || (SELECT count(*) FROM public.ai_gebruik_totaal)::int n`,
    )
  ).rows[0].n,
  "0/2",
);

await db.exec(lees("0024_ai_gebruik_mandjes.down.sql"));
check(
  "terugdraaien: tabellen en functie weg",
  (
    await db.query(
      `SELECT (to_regclass('public.ai_gebruik_dag') IS NULL AND to_regclass('public.winkel_mandjes') IS NULL AND to_regprocedure('public.ai_gebruik_tel(text, boolean)') IS NULL)::text n`,
    )
  ).rows[0].n,
  "true",
);
check(
  "terugdraaien: lijsten blijven",
  (await db.query(`SELECT (to_regclass('public.shopping_lists') IS NOT NULL)::text n`)).rows[0].n,
  "true",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
