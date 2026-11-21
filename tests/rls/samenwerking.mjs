/**
 * Test van voorstel 0017 (samenwerking) op PGlite uit alle migraties.
 * Gezin G1: A (eigenaar), C (lid, mag de lijst bewerken), K (lid, alleen bekijken).
 * Gezin G2: B (buitenstaander voor G1).
 *
 *   PGLITE_DIR=<map> node tests/rls/samenwerking.mjs
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
const C = "c9000000-0000-4000-8000-00000000000c";
const K = "d9000000-0000-4000-8000-00000000000d";
const G1 = "f9000000-0000-4000-8000-0000000000f1";
const G2 = "f9000000-0000-4000-8000-0000000000f2";
const EIGEN_A = "e9000000-0000-4000-8000-0000000000e1";
const ITEM_G = "e9000000-0000-4000-8000-0000000000a1";
const ITEM_G2 = "e9000000-0000-4000-8000-0000000000a2";
const ITEM_A = "e9000000-0000-4000-8000-0000000000a3";
const ITEM_B = "e9000000-0000-4000-8000-0000000000a4";

const { db, fouten } = await bouwDatabank({ extraNaMigraties: lees("0017_samenwerking.up.sql") });
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
// groups-trigger maakt per gezin een "Gezinslijst".
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test'),('${C}','c@voorbeeld.test'),('${K}','k@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B'),('${C}','C'),('${K}','K') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G1}', '${A}', 'Gezin een'), ('${G2}', '${B}', 'Gezin twee');
  INSERT INTO public.group_members (group_id, user_id, rol, status, shopping_view, shopping_edit) VALUES ('${G1}','${A}','eigenaar','actief', true, true) ON CONFLICT DO NOTHING;
  INSERT INTO public.group_members (group_id, user_id, rol, status, shopping_view, shopping_edit) VALUES ('${G2}','${B}','eigenaar','actief', true, true) ON CONFLICT DO NOTHING;
  INSERT INTO public.group_members (group_id, user_id, rol, status, shopping_view, shopping_edit) VALUES ('${G1}','${C}','lid','actief', true, true) ON CONFLICT DO NOTHING;
  INSERT INTO public.group_members (group_id, user_id, rol, status, shopping_view, shopping_edit) VALUES ('${G1}','${K}','lid','actief', true, false) ON CONFLICT DO NOTHING;
  INSERT INTO public.shopping_lists (id, user_id, name) VALUES ('${EIGEN_A}', '${A}', 'Eigen');
  INSERT INTO public.shopping_items (id, user_id, list_id, name, unit) VALUES
    ('${ITEM_G}', '${A}', (SELECT id FROM public.shopping_lists WHERE group_id = '${G1}'), 'brood', ''),
    ('${ITEM_A}', '${A}', '${EIGEN_A}', 'melk', 'l'),
    ('${ITEM_B}', '${B}', (SELECT id FROM public.shopping_lists WHERE group_id = '${G2}'), 'kaas', '');
  INSERT INTO public.shopping_items (id, user_id, list_id, name, unit) VALUES
    ('${ITEM_G2}', '${A}', (SELECT id FROM public.shopping_lists WHERE group_id = '${G1}'), 'boter', '');
`);
const GL1 = (await db.query(`SELECT id FROM public.shopping_lists WHERE group_id = '${G1}'`))
  .rows[0].id;
const GL2 = (await db.query(`SELECT id FROM public.shopping_lists WHERE group_id = '${G2}'`))
  .rows[0].id;

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
const doe = (wie, sql) => lukt(als(db, wie, (t) => t.query(sql)));

// ---------- lijst verdelen ----------
check(
  "A laat C het brood halen (gezinslijst)",
  await doe(
    A,
    `INSERT INTO public.lijst_toewijzingen (item_id, list_id, toegewezen_aan, winkel) VALUES ('${ITEM_G}','${GL1}','${C}','Bakker')`,
  ),
  "gelukt",
);
check(
  "C (gezinslid) ziet de toewijzing",
  await tel(C, `SELECT count(*)::int n FROM public.lijst_toewijzingen`),
  1,
);
check(
  "K (kijker) ziet de toewijzing ook",
  await tel(K, `SELECT count(*)::int n FROM public.lijst_toewijzingen`),
  1,
);
check(
  "B (ander gezin) ziet niets",
  await tel(B, `SELECT count(*)::int n FROM public.lijst_toewijzingen`),
  0,
);
check(
  "K (kijker) mag niet verdelen",
  await doe(
    K,
    `INSERT INTO public.lijst_toewijzingen (item_id, list_id, winkel) VALUES ('${ITEM_G2}','${GL1}','Aldi')`,
  ),
  "geweigerd",
);
check("K wist de toewijzing niet", await veranderd(K, `DELETE FROM public.lijst_toewijzingen`), 0);
check(
  "B wijst niets toe op de lijst van G1",
  await doe(
    B,
    `INSERT INTO public.lijst_toewijzingen (item_id, list_id, winkel) VALUES ('${ITEM_G2}','${GL1}','Aldi')`,
  ),
  "geweigerd",
);
check(
  "C wijst niet toe aan B (geen lid van G1)",
  await doe(
    C,
    `INSERT INTO public.lijst_toewijzingen (item_id, list_id, toegewezen_aan) VALUES ('${ITEM_G2}','${GL1}','${B}')`,
  ),
  "geweigerd",
);
check(
  "item van een andere lijst kan niet (lijst-id vervalst)",
  await doe(
    A,
    `INSERT INTO public.lijst_toewijzingen (item_id, list_id, winkel) VALUES ('${ITEM_B}','${GL1}','Aldi')`,
  ),
  "geweigerd",
);
check(
  "eigen lijst: A kiest een winkel",
  await doe(
    A,
    `INSERT INTO public.lijst_toewijzingen (item_id, list_id, winkel) VALUES ('${ITEM_A}','${EIGEN_A}','Colruyt')`,
  ),
  "gelukt",
);
check(
  "eigen lijst: toewijzen aan een persoon kan niet",
  await veranderd(
    A,
    `UPDATE public.lijst_toewijzingen SET toegewezen_aan = '${C}' WHERE item_id = '${ITEM_A}'`,
  ).then(
    () => "gelukt",
    () => "geweigerd",
  ),
  "geweigerd",
);
check(
  "C (gezinslid) ziet de winkel op de eigen lijst van A niet",
  await tel(C, `SELECT count(*)::int n FROM public.lijst_toewijzingen WHERE item_id = '${ITEM_A}'`),
  0,
);
check(
  "C past de toewijzing aan (winkel)",
  await veranderd(
    C,
    `UPDATE public.lijst_toewijzingen SET winkel = 'Delhaize' WHERE item_id = '${ITEM_G}'`,
  ),
  1,
);
check(
  "toegewezen_door volgt wie het deed (C), niet wat de app meestuurt",
  (
    await db.query(
      `SELECT toegewezen_door::text n FROM public.lijst_toewijzingen WHERE item_id = '${ITEM_G}'`,
    )
  ).rows[0].n,
  C,
);
check(
  "lege toewijzing (niemand, geen winkel) geweigerd",
  await doe(
    A,
    `INSERT INTO public.lijst_toewijzingen (item_id, list_id) VALUES ('${ITEM_G2}','${GL1}')`,
  ),
  "geweigerd",
);
check(
  "item weg = toewijzing weg",
  (await db.exec(`DELETE FROM public.shopping_items WHERE id = '${ITEM_A}'`),
  (
    await db.query(
      `SELECT count(*)::int n FROM public.lijst_toewijzingen WHERE item_id = '${ITEM_A}'`,
    )
  ).rows[0].n),
  0,
);

// ---------- meldingen ----------
check(
  "A stuurt C een melding (zelfde gezin)",
  await doe(
    A,
    `INSERT INTO public.app_meldingen (user_id, group_id, soort, tekst, link) VALUES ('${C}','${G1}','toegewezen','A vraagt of jij brood haalt','/boodschappen?lijst=gezin')`,
  ),
  "gelukt",
);
check(
  "A stuurt B geen melding (ander gezin)",
  await doe(
    A,
    `INSERT INTO public.app_meldingen (user_id, group_id, soort, tekst) VALUES ('${B}','${G1}','menu','x')`,
  ),
  "geweigerd",
);
check(
  "A stuurt B ook niet via B's eigen gezin",
  await doe(
    A,
    `INSERT INTO public.app_meldingen (user_id, group_id, soort, tekst) VALUES ('${B}','${G2}','menu','x')`,
  ),
  "geweigerd",
);
check(
  "afzender vervalsen kan niet",
  await doe(
    A,
    `INSERT INTO public.app_meldingen (user_id, group_id, actor_id, soort, tekst) VALUES ('${C}','${G1}','${K}','menu','x')`,
  ),
  "geweigerd",
);
check(
  "externe link geweigerd",
  await doe(
    A,
    `INSERT INTO public.app_meldingen (user_id, group_id, soort, tekst, link) VALUES ('${C}','${G1}','menu','x','//boef.example')`,
  ),
  "geweigerd",
);
check(
  "onbekende soort geweigerd",
  await doe(
    A,
    `INSERT INTO public.app_meldingen (user_id, group_id, soort, tekst) VALUES ('${C}','${G1}','reclame','x')`,
  ),
  "geweigerd",
);
check(
  "B maakt een melding voor zichzelf (restje)",
  await doe(
    B,
    `INSERT INTO public.app_meldingen (user_id, soort, tekst, sleutel) VALUES ('${B}','restje','Restje soep','restje:1')`,
  ),
  "gelukt",
);
check(
  "zelfde sleutel twee keer: geweigerd (geen dubbels)",
  await doe(
    B,
    `INSERT INTO public.app_meldingen (user_id, soort, tekst, sleutel) VALUES ('${B}','restje','Restje soep','restje:1')`,
  ),
  "geweigerd",
);
check(
  "C ziet de eigen melding",
  await tel(C, `SELECT count(*)::int n FROM public.app_meldingen`),
  1,
);
check(
  "A ziet de melding aan C niet",
  await tel(A, `SELECT count(*)::int n FROM public.app_meldingen`),
  0,
);
check(
  "K ziet de melding aan C niet",
  await tel(K, `SELECT count(*)::int n FROM public.app_meldingen`),
  0,
);
check(
  "C markeert als gelezen",
  await veranderd(C, `UPDATE public.app_meldingen SET gelezen_op = now()`),
  1,
);
check(
  "C past de tekst niet aan (alleen gelezen mag veranderen)",
  await doe(C, `UPDATE public.app_meldingen SET tekst = 'vervalst'`),
  "geweigerd",
);
check(
  "A markeert de melding van C niet als gelezen",
  await veranderd(A, `UPDATE public.app_meldingen SET gelezen_op = now()`),
  0,
);
check(
  "B wist de melding van C niet",
  await veranderd(B, `DELETE FROM public.app_meldingen WHERE user_id = '${C}'`),
  0,
);

// ---------- activiteitslog ----------
check(
  "C logt een menuwijziging in G1",
  await doe(
    C,
    `INSERT INTO public.gezin_activiteit (group_id, soort, tekst) VALUES ('${G1}','menu','C veranderde woensdag in Lasagne')`,
  ),
  "gelukt",
);
check(
  "B logt niets in G1",
  await doe(
    B,
    `INSERT INTO public.gezin_activiteit (group_id, soort, tekst) VALUES ('${G1}','menu','x')`,
  ),
  "geweigerd",
);
check(
  "A logt niet op naam van C",
  await doe(
    A,
    `INSERT INTO public.gezin_activiteit (group_id, actor_id, soort, tekst) VALUES ('${G1}','${C}','menu','x')`,
  ),
  "geweigerd",
);
check(
  "K (lid) leest het log",
  await tel(K, `SELECT count(*)::int n FROM public.gezin_activiteit`),
  1,
);
check(
  "B (ander gezin) leest niets",
  await tel(B, `SELECT count(*)::int n FROM public.gezin_activiteit`),
  0,
);
check(
  "niemand wijzigt het log",
  await doe(C, `UPDATE public.gezin_activiteit SET tekst = 'anders'`),
  "geweigerd",
);
check("niemand wist het log", await doe(A, `DELETE FROM public.gezin_activiteit`), "geweigerd");
check(
  "uitgenodigd (nog niet actief) leest niets",
  // Testopbouw als beheerder (de triggers op group_members laten dat alleen de app via RPC doen).
  (await db.exec(`ALTER TABLE public.group_members DISABLE TRIGGER USER;
    UPDATE public.group_members SET status = 'uitgenodigd' WHERE user_id = '${K}';
    ALTER TABLE public.group_members ENABLE TRIGGER USER;`),
  await tel(K, `SELECT count(*)::int n FROM public.gezin_activiteit`)),
  0,
);

// ---------- meldingkeuzes ----------
check(
  "C zet 'menu' uit",
  await doe(C, `INSERT INTO public.app_melding_instellingen (uit) VALUES ('{menu}')`),
  "gelukt",
);
check(
  "onbekende soort geweigerd",
  await doe(B, `INSERT INTO public.app_melding_instellingen (uit) VALUES ('{raket}')`),
  "geweigerd",
);
check(
  "A leest de keuzes van C niet",
  await tel(A, `SELECT count(*)::int n FROM public.app_melding_instellingen`),
  0,
);
check(
  "anoniem leest niets",
  await lukt(als(db, null, (t) => t.query(`SELECT * FROM public.app_meldingen`))),
  "geweigerd",
);
check(
  "opruimen kan een gewone gebruiker niet aanroepen",
  await doe(A, `SELECT public.ruim_samenwerking_op()`),
  "geweigerd",
);
check(
  "opruimen (beheer): oude rijen weg",
  (await db.exec(`UPDATE public.app_meldingen SET created_at = now() - interval '100 days'`),
  String((await db.query(`SELECT public.ruim_samenwerking_op() n`)).rows[0].n)),
  "2",
);
check(
  "gezin weg = log weg",
  (await db.exec(
    `DELETE FROM public.shopping_lists WHERE group_id = '${G1}'; DELETE FROM public.groups WHERE id = '${G1}'`,
  ),
  String((await db.query(`SELECT count(*)::int n FROM public.gezin_activiteit`)).rows[0].n)),
  "0",
);
void GL2;

await db.exec(lees("0017_samenwerking.down.sql"));
check(
  "terugdraaien: tabellen en functies weg",
  (
    await db.query(`SELECT (to_regclass('public.app_meldingen') IS NULL
      AND to_regclass('public.lijst_toewijzingen') IS NULL
      AND to_regclass('public.gezin_activiteit') IS NULL
      AND to_regclass('public.app_melding_instellingen') IS NULL
      AND to_regprocedure('public.samenwerking_is_lid(uuid)') IS NULL)::text n`)
  ).rows[0].n,
  "true",
);
check(
  "terugdraaien: lijsten en items blijven",
  String((await db.query(`SELECT count(*)::int n FROM public.shopping_items`)).rows[0].n),
  "1",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
