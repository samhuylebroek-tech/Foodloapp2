/**
 * Test van voorstel 0013 (planprofiel + recept_vereisten) op PGlite uit alle migraties.
 * A en C zitten in hetzelfde gezin; B is een buitenstaander.
 *
 *   PGLITE_DIR=<map> node tests/rls/planprofiel.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const A = "a7000000-0000-4000-8000-00000000000a";
const B = "b7000000-0000-4000-8000-00000000000b";
const C = "c7000000-0000-4000-8000-00000000000c";
const G = "f7000000-0000-4000-8000-0000000000f0";
const R = "e7000000-0000-4000-8000-000000000001";

const { db, fouten } = await bouwDatabank({ extraNaMigraties: lees("0013_planprofiel.up.sql") });
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test'),('${C}','c@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B'),('${C}','C') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G}', '${A}', 'Testgezin');
  INSERT INTO public.group_members (group_id, user_id, rol, status) VALUES ('${G}','${C}','lid','actief') ON CONFLICT DO NOTHING;
  INSERT INTO public.recipes (id, user_id, title) VALUES ('${R}','${A}','Frietjes uit de airfryer');
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

// --- planprofiel ---
check(
  "A bewaart een eigen profiel",
  await lukt(
    als(db, A, (t) =>
      t.query(
        `INSERT INTO public.planprofiel (apparatuur, kookervaring, voorraadniveau, basisvoorraad, weekbudget)
         VALUES ('{oven,kookplaat,airfryer}','beginner','basis','{bloem,rijst}',120)`,
      ),
    ),
  ),
  "gelukt",
);
check(
  "A maakt geen profiel op naam van B",
  await lukt(
    als(db, A, (t) => t.query(`INSERT INTO public.planprofiel (user_id) VALUES ('${B}')`)),
  ),
  "geweigerd",
);
check(
  "tweede profiel voor A kan niet (één rij per gebruiker)",
  await lukt(als(db, A, (t) => t.query(`INSERT INTO public.planprofiel DEFAULT VALUES`))),
  "geweigerd",
);
check(
  "onbekend toestel geweigerd",
  await lukt(
    als(db, B, (t) => t.query(`INSERT INTO public.planprofiel (apparatuur) VALUES ('{raket}')`)),
  ),
  "geweigerd",
);
check(
  "budget 0 of boven 5000 geweigerd",
  (await lukt(
    als(db, B, (t) => t.query(`INSERT INTO public.planprofiel (weekbudget) VALUES (0)`)),
  )) +
    "/" +
    (await lukt(
      als(db, B, (t) => t.query(`INSERT INTO public.planprofiel (weekbudget) VALUES (6000)`)),
    )),
  "geweigerd/geweigerd",
);
check(
  "kookervaring buiten de lijst geweigerd",
  await lukt(
    als(db, B, (t) => t.query(`INSERT INTO public.planprofiel (kookervaring) VALUES ('chef')`)),
  ),
  "geweigerd",
);
check(
  "gezinslid C leest het profiel (en budget) van A niet",
  await tel(C, `SELECT count(*)::int n FROM public.planprofiel`),
  0,
);
check(
  "buitenstaander B leest het profiel van A niet",
  await tel(B, `SELECT count(*)::int n FROM public.planprofiel`),
  0,
);
check(
  "C wijzigt het profiel van A niet",
  await veranderd(C, `UPDATE public.planprofiel SET weekbudget = 1`),
  0,
);
check(
  "A wijzigt het eigen budget",
  await veranderd(A, `UPDATE public.planprofiel SET weekbudget = 95.5`),
  1,
);
check(
  "anoniem leest niets",
  await lukt(als(db, null, (t) => t.query(`SELECT * FROM public.planprofiel`))),
  "geweigerd",
);

// --- recept_vereisten ---
check(
  "eigenaar A zet apparatuur bij het eigen recept",
  await lukt(
    als(db, A, (t) =>
      t.query(
        `INSERT INTO public.recept_vereisten (recipe_id, apparatuur) VALUES ('${R}','{airfryer}')`,
      ),
    ),
  ),
  "gelukt",
);
check(
  "gezinslid C wijzigt de vereisten van A's recept niet",
  await veranderd(C, `UPDATE public.recept_vereisten SET apparatuur = '{oven}'`),
  0,
);
check(
  "buitenstaander B voegt geen vereisten toe aan A's recept",
  await lukt(
    als(db, B, (t) =>
      t.query(
        `INSERT INTO public.recept_vereisten (recipe_id, apparatuur) VALUES ('${R}','{oven}')`,
      ),
    ),
  ),
  "geweigerd",
);
check(
  "lezen volgt het recept: B ziet de vereisten alleen als B het recept ziet",
  String(
    (await tel(B, `SELECT count(*)::int n FROM public.recept_vereisten`)) ===
      (await tel(B, `SELECT count(*)::int n FROM public.recipes WHERE id = '${R}'`)),
  ),
  "true",
);
check(
  "gezinslid C leest de vereisten als C het recept leest",
  String(
    (await tel(C, `SELECT count(*)::int n FROM public.recept_vereisten`)) ===
      (await tel(C, `SELECT count(*)::int n FROM public.recipes WHERE id = '${R}'`)),
  ),
  "true",
);
check(
  "recept weg = vereisten weg",
  (await db.exec(`DELETE FROM public.recipes WHERE id = '${R}'`),
  String((await db.query(`SELECT count(*)::int n FROM public.recept_vereisten`)).rows[0].n)),
  "0",
);

// --- terugdraaien ---
await db.exec(lees("0013_planprofiel.down.sql"));
check(
  "terugdraaien: beide tabellen weg",
  (
    await db.query(
      `SELECT (to_regclass('public.planprofiel') IS NULL AND to_regclass('public.recept_vereisten') IS NULL)::text n`,
    )
  ).rows[0].n,
  "true",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
