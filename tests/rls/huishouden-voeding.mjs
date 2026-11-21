/**
 * Test van voorstel 0009 (persoonlijke voeding) en 0010 (gezinsleden, voeding per lid, mee-eters,
 * maaltijd_veilig_voor) op PGlite uit alle migraties + 0002a. A is eigenaar van gezin G, B is
 * actief lid, D is alleen uitgenodigd, X is een buitenstaander. K is een kind zonder account dat B
 * beheert (notenallergie, niet gedeeld); O is opa zonder account die A beheert (vegetarisch, gedeeld).
 *
 *   PGLITE_DIR=<map> node tests/rls/huishouden-voeding.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const A = "a9000000-0000-4000-8000-00000000000a";
const B = "b9000000-0000-4000-8000-00000000000b";
const D = "d9000000-0000-4000-8000-00000000000d";
const X = "c9000000-0000-4000-8000-00000000000c";
const G = "e9000000-0000-4000-8000-000000000001";
const LA = "f9000000-0000-4000-8000-00000000000a"; // A zelf
const LB = "f9000000-0000-4000-8000-00000000000b"; // B zelf
const K = "f9000000-0000-4000-8000-0000000000c1"; // kind, beheerd door B
const O = "f9000000-0000-4000-8000-0000000000c2"; // opa, beheerd door A
const PESTO = "aa900000-0000-4000-8000-000000000001";
const STOOF = "aa900000-0000-4000-8000-000000000002";
const SOEP = "aa900000-0000-4000-8000-000000000003";
const LEEG = "aa900000-0000-4000-8000-000000000004";
const VAN_X = "aa900000-0000-4000-8000-000000000005";

const { db, fouten } = await bouwDatabank({
  extraNaMigraties:
    lees("0002a_basislijn_recepten_fotos.up.sql") +
    lees("0009_persoonlijke_voeding.up.sql") +
    lees("0010_huishouden_leden.up.sql"),
});
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test'),
    ('${D}','d@voorbeeld.test'),('${X}','x@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B'),('${D}','D'),('${X}','X')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G}', '${A}', 'Thuis');
  INSERT INTO public.group_members (group_id, user_id, rol, status) VALUES
    ('${G}','${B}','lid','actief'), ('${G}','${D}','lid','uitgenodigd') ON CONFLICT DO NOTHING;
  INSERT INTO public.recipes (id, user_id, title) VALUES
    ('${PESTO}','${A}','Pasta met pesto'), ('${STOOF}','${A}','Stoofvlees'),
    ('${SOEP}','${B}','Pompoensoep'), ('${LEEG}','${A}','Iets zonder ingrediënten'),
    ('${VAN_X}','${X}','Notentaart van X');
  INSERT INTO public.recipe_ingredients (recipe_id, name) VALUES
    ('${PESTO}','spaghetti'),('${PESTO}','hazelnoten'),('${PESTO}','basilicum'),
    ('${STOOF}','rundvlees'),('${STOOF}','uien'),
    ('${SOEP}','pompoen'),('${SOEP}','kokosmelk'),('${SOEP}','nootmuskaat'),
    ('${VAN_X}','walnoten');
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
const doe = (wie, sql) => lukt(als(db, wie, (t) => t.query(sql)));
const veilig = async (wie, recept, leden) =>
  als(db, wie, async (t) => {
    const r = await t.query(
      `SELECT lid_id, veilig FROM public.maaltijd_veilig_voor('${recept}', ARRAY[${leden
        .map((l) => `'${l}'`)
        .join(",")}]::uuid[]) ORDER BY lid_id`,
    );
    return r.rows.map((x) => `${x.lid_id.slice(-2)}=${x.veilig}`).join(",");
  });

// ---------- 0009: persoonlijke voeding ----------
check(
  "A bewaart de eigen voeding met toestemming",
  await doe(
    A,
    `INSERT INTO public.persoonlijke_voeding (user_id, allergieen, dieet, toestemming_op) VALUES ('${A}', '{sesam}', 'vegetarisch', now())`,
  ),
  "gelukt",
);
check(
  "zonder toestemmingsdatum: geweigerd",
  await doe(
    B,
    `INSERT INTO public.persoonlijke_voeding (user_id, allergieen) VALUES ('${B}', '{noten}')`,
  ),
  "geweigerd",
);
check(
  "onbekende allergiecode: geweigerd",
  await doe(
    B,
    `INSERT INTO public.persoonlijke_voeding (user_id, allergieen, toestemming_op) VALUES ('${B}', '{kanker}', now())`,
  ),
  "geweigerd",
);
check(
  "B schrijft geen rij op naam van A",
  await doe(
    B,
    `INSERT INTO public.persoonlijke_voeding (user_id, allergieen, toestemming_op) VALUES ('${X}', '{noten}', now())`,
  ),
  "geweigerd",
);
check(
  "gezinslid B leest de voeding van A niet",
  await tel(B, `SELECT count(*)::int n FROM public.persoonlijke_voeding`),
  0,
);
check(
  "buitenstaander X leest niets",
  await tel(X, `SELECT count(*)::int n FROM public.persoonlijke_voeding`),
  0,
);
check(
  "anon leest niets",
  await lukt(als(db, null, (t) => t.query(`SELECT 1 FROM public.persoonlijke_voeding`))),
  "geweigerd",
);
check(
  "A leest de eigen rij",
  await tel(A, `SELECT count(*)::int n FROM public.persoonlijke_voeding`),
  1,
);
check(
  "B wijzigt de rij van A niet",
  await tel(
    B,
    `WITH u AS (UPDATE public.persoonlijke_voeding SET allergieen = '{}' RETURNING 1) SELECT count(*)::int n FROM u`,
  ),
  0,
);

// ---------- 0010: gezinsleden ----------
check(
  "A voegt zichzelf toe",
  await doe(
    A,
    `INSERT INTO public.huishouden_leden (id, group_id, naam, user_id, beheerder_id) VALUES ('${LA}','${G}','Marie','${A}','${A}')`,
  ),
  "gelukt",
);
check(
  "B voegt zichzelf en een kind toe",
  await doe(
    B,
    `INSERT INTO public.huishouden_leden (id, group_id, naam, user_id, beheerder_id, rol) VALUES
      ('${LB}','${G}','Jan','${B}','${B}','volwassene'), ('${K}','${G}','Lotte',NULL,'${B}','kind')`,
  ),
  "gelukt",
);
check(
  "A voegt opa toe (zonder account)",
  await doe(
    A,
    `INSERT INTO public.huishouden_leden (id, group_id, naam, beheerder_id) VALUES ('${O}','${G}','Gust','${A}')`,
  ),
  "gelukt",
);
check(
  "A kan B niet als account-lid toevoegen (alleen zichzelf)",
  await doe(
    A,
    `INSERT INTO public.huishouden_leden (group_id, naam, user_id, beheerder_id) VALUES ('${G}','Nep','${X}','${A}')`,
  ),
  "geweigerd",
);
check(
  "uitgenodigde D voegt niemand toe",
  await doe(
    D,
    `INSERT INTO public.huishouden_leden (group_id, naam, beheerder_id) VALUES ('${G}','D-kind','${D}')`,
  ),
  "geweigerd",
);
check(
  "buitenstaander X voegt niemand toe",
  await doe(
    X,
    `INSERT INTO public.huishouden_leden (group_id, naam, beheerder_id) VALUES ('${G}','X-kind','${X}')`,
  ),
  "geweigerd",
);
check(
  "A ziet alle 4 de gezinsleden",
  await tel(A, `SELECT count(*)::int n FROM public.huishouden_leden`),
  4,
);
check(
  "uitgenodigde D ziet geen gezinsleden",
  await tel(D, `SELECT count(*)::int n FROM public.huishouden_leden`),
  0,
);
check(
  "X ziet geen gezinsleden",
  await tel(X, `SELECT count(*)::int n FROM public.huishouden_leden`),
  0,
);
check(
  "A hernoemt het kind van B niet",
  await tel(
    A,
    `WITH u AS (UPDATE public.huishouden_leden SET naam = 'X' WHERE id = '${K}' RETURNING 1) SELECT count(*)::int n FROM u`,
  ),
  0,
);

// ---------- voeding per lid ----------
check(
  "B bewaart de voeding van het kind (beheerder, met toestemming)",
  await doe(
    B,
    `INSERT INTO public.lid_voeding (lid_id, allergieen, toestemming_door, toestemming_soort, toestemming_op)
      VALUES ('${K}', '{noten}', '${B}', 'beheerder', now())`,
  ),
  "gelukt",
);
check(
  "A bewaart de voeding van opa (gedeeld)",
  await doe(
    A,
    `INSERT INTO public.lid_voeding (lid_id, dieet, delen_met_gezin, toestemming_door, toestemming_soort, toestemming_op)
      VALUES ('${O}', 'vegetarisch', true, '${A}', 'beheerder', now())`,
  ),
  "gelukt",
);
check(
  "A schrijft geen voeding voor het kind van B",
  await doe(
    A,
    `UPDATE public.lid_voeding SET allergieen = '{}' WHERE lid_id = '${K}' RETURNING 1`,
  ).then(async () =>
    tel(B, `SELECT cardinality(allergieen)::int n FROM public.lid_voeding WHERE lid_id = '${K}'`),
  ),
  1,
);
check(
  "A maakt geen voeding aan voor B (account-lid beheert zichzelf)",
  await doe(
    A,
    `INSERT INTO public.lid_voeding (lid_id, allergieen, toestemming_door, toestemming_soort, toestemming_op)
      VALUES ('${LB}', '{soja}', '${A}', 'beheerder', now())`,
  ),
  "geweigerd",
);
check(
  "toestemming op naam van iemand anders: geweigerd",
  await doe(
    B,
    `INSERT INTO public.lid_voeding (lid_id, allergieen, toestemming_door, toestemming_soort, toestemming_op)
      VALUES ('${LB}', '{soja}', '${A}', 'zelf', now())`,
  ),
  "geweigerd",
);
check(
  "A (planner) leest de niet-gedeelde allergie van het kind NIET",
  await tel(A, `SELECT count(*)::int n FROM public.lid_voeding WHERE lid_id = '${K}'`),
  0,
);
check(
  "B (beheerder) leest de allergie van het kind",
  await tel(B, `SELECT count(*)::int n FROM public.lid_voeding WHERE lid_id = '${K}'`),
  1,
);
check(
  "B leest het gedeelde dieet van opa",
  await tel(B, `SELECT count(*)::int n FROM public.lid_voeding WHERE lid_id = '${O}'`),
  1,
);
check(
  "uitgenodigde D en buitenstaander X lezen geen lid-voeding",
  (await tel(D, `SELECT count(*)::int n FROM public.lid_voeding`)) +
    (await tel(X, `SELECT count(*)::int n FROM public.lid_voeding`)),
  0,
);

// ---------- veiligheidsoordeel zonder reden ----------
check(
  "pesto (hazelnoten): niet veilig voor het kind, wel voor opa — alleen waar/onwaar",
  await veilig(A, PESTO, [K, O]),
  "c1=false,c2=true",
);
check(
  "stoofvlees: niet veilig voor opa (vegetarisch)",
  await veilig(A, STOOF, [K, O]),
  "c1=true,c2=false",
);
check(
  "pompoensoep van B (kokosmelk, nootmuskaat): veilig voor iedereen",
  await veilig(A, SOEP, [K, O, LA, LB]),
  "0a=true,0b=true,c1=true,c2=true",
);
check(
  "zonder ingrediënten en met allergie: NULL (niet te controleren)",
  await veilig(A, LEEG, [K]),
  "c1=null",
);
check(
  "het oordeel geeft geen kolom met de reden",
  (
    await als(db, A, (t) =>
      t.query(`SELECT * FROM public.maaltijd_veilig_voor('${PESTO}', ARRAY['${K}']::uuid[])`),
    )
  ).fields
    .map((f) => f.name)
    .join(","),
  "lid_id,veilig",
);
check("X krijgt geen oordeel over leden van G", await veilig(X, VAN_X, [K, O]), "");
check("uitgenodigde D krijgt geen oordeel", await veilig(D, PESTO, [K]), "");
check(
  "geen oordeel voor recepten van buitenstaanders (geen sonde)",
  await veilig(A, VAN_X, [K]),
  "",
);
check(
  "anon mag de functie niet aanroepen",
  await lukt(
    als(db, null, (t) =>
      t.query(`SELECT * FROM public.maaltijd_veilig_voor('${PESTO}', ARRAY['${K}']::uuid[])`),
    ),
  ),
  "geweigerd",
);

// ---------- mee-eters ----------
await db.exec(
  `INSERT INTO public.meal_plan (id, user_id, plan_date, group_id, custom_title) VALUES
    ('ab900000-0000-4000-8000-000000000001', '${A}', current_date, '${G}', 'Gezinsdiner'),
    ('ab900000-0000-4000-8000-000000000002', '${X}', current_date, NULL, 'Van X')`,
);
check(
  "A zet mee-eters bij de gezinsmaaltijd",
  await doe(
    A,
    `INSERT INTO public.maaltijd_eters (meal_plan_id, lid_id) VALUES
      ('ab900000-0000-4000-8000-000000000001','${LA}'), ('ab900000-0000-4000-8000-000000000001','${K}')`,
  ),
  "gelukt",
);
check(
  "B ziet de mee-eters van de gezinsmaaltijd",
  await tel(B, `SELECT count(*)::int n FROM public.maaltijd_eters`),
  2,
);
check(
  "X zet geen leden van G bij de eigen maaltijd",
  await doe(
    X,
    `INSERT INTO public.maaltijd_eters (meal_plan_id, lid_id) VALUES ('ab900000-0000-4000-8000-000000000002','${K}')`,
  ),
  "geweigerd",
);
check(
  "X ziet geen mee-eters",
  await tel(X, `SELECT count(*)::int n FROM public.maaltijd_eters`),
  0,
);

// ---------- verwijderen ----------
check(
  "kind weghalen wist ook voeding en mee-eters (cascade)",
  await doe(B, `DELETE FROM public.huishouden_leden WHERE id = '${K}'`).then(
    async () =>
      (
        await db.query(
          `SELECT ((SELECT count(*) FROM public.lid_voeding WHERE lid_id = '${K}') +
                 (SELECT count(*) FROM public.maaltijd_eters WHERE lid_id = '${K}'))::int n`,
        )
      ).rows[0].n,
  ),
  0,
);
check(
  "account van A verwijderen wist persoonlijke voeding",
  await db
    .exec(`DELETE FROM auth.users WHERE id = '${A}'`)
    .then(
      async () =>
        (await db.query(`SELECT count(*)::int n FROM public.persoonlijke_voeding`)).rows[0].n,
    )
    .catch(() => -1),
  0,
);

// ---------- terugdraaien ----------
await db.exec(lees("0010_huishouden_leden.down.sql") + lees("0009_persoonlijke_voeding.down.sql"));
check(
  "terugdraaien: tabellen en functies weg, gezin en weekmenu blijven",
  (
    await db.query(
      `SELECT (to_regclass('public.persoonlijke_voeding') IS NULL AND to_regclass('public.huishouden_leden') IS NULL
         AND to_regclass('public.lid_voeding') IS NULL AND to_regclass('public.maaltijd_eters') IS NULL
         AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('maaltijd_veilig_voor','is_actief_gezinslid','foodlo_bevat'))
         AND (SELECT count(*) FROM public.groups) >= 0
         AND (SELECT count(*) FROM public.meal_plan WHERE custom_title = 'Van X') = 1)::text n`,
    )
  ).rows[0].n,
  "true",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(
  `\n${resultaten.length - mis}/${resultaten.length} zoals verwacht, ${mis} afwijking(en)`,
);
process.exit(mis ? 1 : 0);
