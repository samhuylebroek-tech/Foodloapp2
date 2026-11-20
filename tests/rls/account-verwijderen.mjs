/**
 * Fase 8 — Account verwijderen laat NIETS achter (BUG-179, AVG art. 17). Bouwt een echte
 * PostgreSQL (PGlite) uit alle migraties + alle voorstellen 0002a…0025 en controleert:
 *
 * 1. Volledigheid: elke kolom in `public` die naar auth.users verwijst (of zo heet zonder
 *    verwijzing, zoals groups.owner_id) staat in het gegevensregister
 *    (src/lib/privacy/gegevens-register.ts) of in de lijst met bewuste uitzonderingen.
 * 2. Zonder de opruiming van de app (alleen DELETE FROM auth.users, met cascades) blijven er
 *    verwijzingen achter (vaststelling: daarom bestaat de opruiming).
 * 3. Met de stappen van de app (gezin overdragen of opheffen, register opruimen, account wissen,
 *    eigen bestanden in opslag wissen): geen enkele uuid-kolom in `public` en geen bestand in
 *    `storage.objects` verwijst nog naar de gebruiker. Gegevens van anderen blijven, behalve wat
 *    een CASCADE ook zou doen; het gezin gaat naar het andere lid; facturen blijven anoniem.
 *
 * De SQL hieronder volgt exact het register (dezelfde regels die account-opruimen.server.ts via
 * PostgREST uitvoert). Fictieve gegevens.
 *
 *   PGLITE_DIR=<map> node tests/rls/account-verwijderen.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bouwDatabank } from "./databank.mjs";
import { GEGEVENS_REGISTER, NIET_PERSOONLIJK } from "../../src/lib/privacy/gegevens-register.ts";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const VOORSTELLEN = [
  "0002a_",
  "0002_",
  "0004_",
  "0006_",
  "0007_",
  ...Array.from({ length: 18 }, (_, i) => `${String(i + 8).padStart(4, "0")}_`),
];
const bestanden = readdirSync(MAP);
const upVan = (prefix) => bestanden.find((b) => b.startsWith(prefix) && b.endsWith(".up.sql"));

const X = "a9000000-0000-4000-8000-00000000000a"; // verwijdert zijn account
const Y = "b9000000-0000-4000-8000-00000000000b"; // gezinslid, blijft
const Z = "c9000000-0000-4000-8000-00000000000c"; // vreemde, blijft
const G1 = "f9000000-0000-4000-8000-0000000000f1"; // gezin van X met Y → naar Y
const G2 = "f9000000-0000-4000-8000-0000000000f2"; // gezin van X alleen → opgeheven
const R_X = "19000000-0000-4000-8000-0000000000a1";
const R_Y = "19000000-0000-4000-8000-0000000000b1";
const L_X = "29000000-0000-4000-8000-0000000000a1";
const C_X = "39000000-0000-4000-8000-0000000000a1";
const LID = "49000000-0000-4000-8000-0000000000a1";
const MP = "59000000-0000-4000-8000-0000000000a1";
const COL = "69000000-0000-4000-8000-0000000000a1";
const CB_FOTO = `${X}/79000000-0000-4000-8000-0000000000a1.jpg`;

/** Kolommen die naar een persoon verwijzen maar bewust niet in het register staan. */
const UITZONDERINGEN = {
  "admin_users.user_id": "Beheerders: verwijderen via Beheer › Team door de eigenaar.",
  "admin_users.created_by": "Beheer-auditspoor.",
  "admin_audit_log.actor_id": "Auditlog van het beheer (alleen-invoegen, wettelijk spoor).",
  "admin_messages.actor_id": "Bericht van het beheer.",
  "admin_rate_limits.admin_id": "Beheer, korte termijn.",
  "admin_saved_views.admin_id": "Beheer.",
  "admin_sessions.admin_id": "Beheer-auditspoor.",
  "announcements.created_by": "Beheer.",
  "credit_requests.handled_by": "Beheerder die een aanvraag behandelde.",
  "feedback.assigned_to": "Beheerder aan wie een ticket hangt.",
  "platform_settings.updated_by": "Beheer.",
  "site_content.updated_by": "Beheer.",
};

async function bouw() {
  const { db, fouten } = await bouwDatabank();
  if (fouten.length) {
    console.error(fouten);
    process.exit(2);
  }
  for (const p of VOORSTELLEN) {
    const b = upVan(p);
    if (!b) continue;
    try {
      await db.exec(readFileSync(path.join(MAP, b), "utf8"));
    } catch (e) {
      console.error(`opbouw ${b}:`, String(e?.message ?? e).split("\n")[0]);
      process.exit(2);
    }
  }
  return db;
}

async function zaai(db) {
  const stappen = [
    `INSERT INTO auth.users (id, email) VALUES ('${X}','x@voorbeeld.test'),('${Y}','y@voorbeeld.test'),('${Z}','z@voorbeeld.test')`,
    `INSERT INTO public.profiles (id, display_name) VALUES ('${X}','X'),('${Y}','Y'),('${Z}','Z') ON CONFLICT (id) DO NOTHING`,
    `INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G1}','${X}','Gezin X'),('${G2}','${X}','Alleen X')`,
    `INSERT INTO public.group_members (group_id, user_id, rol, status, created_at) VALUES ('${G1}','${X}','eigenaar','actief','2026-01-01'),('${G1}','${Y}','lid','actief','2026-02-01'),('${G2}','${X}','eigenaar','actief','2026-01-01') ON CONFLICT DO NOTHING`,
    `INSERT INTO public.shopping_items (user_id, list_id, name) SELECT '${Y}', id, 'brood (Y)' FROM public.shopping_lists WHERE group_id = '${G1}'`,
    `INSERT INTO public.shopping_items (user_id, list_id, name) SELECT '${X}', id, 'melk (X)' FROM public.shopping_lists WHERE group_id = '${G1}'`,
    `INSERT INTO public.shopping_items (user_id, list_id, name) SELECT '${X}', id, 'kaas (X)' FROM public.shopping_lists WHERE group_id = '${G2}'`,
    `INSERT INTO public.meal_plan (id, user_id, plan_date, group_id, custom_title) VALUES ('${MP}','${X}', current_date, '${G2}', 'Gezinsdiner X')`,
    `INSERT INTO public.meal_plan (user_id, plan_date, group_id, custom_title) VALUES ('${Y}', current_date, '${G1}', 'Gezinsdiner Y')`,
    `INSERT INTO public.recipes (id, user_id, title, image_url) VALUES ('${R_X}','${X}','Lasagne X','${X}/lasagne.jpg'),('${R_Y}','${Y}','Soep Y',null)`,
    `INSERT INTO public.recipe_ingredients (recipe_id, name) VALUES ('${R_X}','pasta')`,
    `INSERT INTO public.recipe_photos (recipe_id, path) VALUES ('${R_X}','${X}/lasagne.jpg')`,
    `INSERT INTO public.favorites (user_id, recipe_id) VALUES ('${Y}','${R_X}'),('${X}','${R_Y}')`,
    `INSERT INTO public.meal_plan (user_id, plan_date, recipe_id) VALUES ('${Z}', current_date, '${R_X}')`,
    `INSERT INTO public.shopping_lists (id, user_id, name) VALUES ('${L_X}','${X}','Eigen lijst X')`,
    `INSERT INTO public.shopping_items (user_id, list_id, name) VALUES ('${X}','${L_X}','appels'),('${Z}','${L_X}','peren (Z via delen)')`,
    `INSERT INTO public.pantry_items (user_id, naam) VALUES ('${X}','rijst'),('${Y}','pasta')`,
    `INSERT INTO public.shares (owner_id, member_id, status) VALUES ('${X}','${Z}','accepted'),('${Z}','${X}','accepted')`,
    `INSERT INTO public.usage_events (user_id, event) VALUES ('${X}','app.open'),('${Y}','app.open')`,
    `INSERT INTO public.user_sessions (user_id) VALUES ('${X}')`,
    `INSERT INTO public.daily_user_stats (user_id, dag) VALUES ('${X}', current_date)`,
    `INSERT INTO public.ai_usage (user_id, feature) VALUES ('${X}','kookhulp')`,
    `INSERT INTO public.app_errors (user_id, bericht) VALUES ('${X}','fout')`,
    `INSERT INTO public.recipe_import_jobs (user_id, source_url) VALUES ('${X}','https://voorbeeld.test/recept')`,
    `INSERT INTO public.loyalty_scan_events (user_id, methode) VALUES ('${X}','camera')`,
    `INSERT INTO public.feedback (user_id, message) VALUES ('${X}','Mooie app')`,
    `INSERT INTO public.persoonlijke_voeding (user_id, toestemming_op) VALUES ('${X}', now())`,
    `INSERT INTO public.huishouden_leden (id, group_id, naam, beheerder_id) VALUES ('${LID}','${G1}','Kind van X','${X}')`,
    `INSERT INTO public.lid_voeding (lid_id, toestemming_soort, toestemming_op, toestemming_door) VALUES ('${LID}','beheerder', now(), '${X}')`,
    `INSERT INTO public.creators (id, user_id, handle, naam) VALUES ('${C_X}','${X}','kok-x','Kok X')`,
    `INSERT INTO public.follows (follower_id, creator_id) VALUES ('${Y}','${C_X}')`,
    `INSERT INTO public.collections (id, user_id, naam) VALUES ('${COL}','${X}','Favorieten X')`,
    `INSERT INTO public.collection_recipes (collection_id, recipe_id) VALUES ('${COL}','${R_Y}')`,
    `INSERT INTO public.community_bijdragen (recipe_id, user_id, tekst, soort, sterren, foto_url) VALUES ('${R_Y}','${X}','Lekker gemaakt','gemaakt',5,'${CB_FOTO}')`,
    `INSERT INTO public.community_bijdragen (recipe_id, user_id, tekst, soort) VALUES ('${R_X}','${Y}','Mooi recept','reactie')`,
    `INSERT INTO public.app_meldingen (user_id, actor_id, soort, tekst) VALUES ('${Y}','${X}','menu','X plande het menu')`,
    `INSERT INTO public.restjes (user_id, titel, porties) VALUES ('${X}','Soep',2)`,
    `INSERT INTO public.planprofiel (user_id) VALUES ('${X}')`,
    `INSERT INTO public.kookmomenten (user_id, recipe_id) VALUES ('${X}','${R_X}')`,
    `INSERT INTO public.ai_gebruik_dag (user_id, dag, soort, aantal) VALUES ('${X}', current_date, 'kookhulp.vraag', 2)`,
    `INSERT INTO public.facturen (user_id, nummer, omschrijving, bedrag_cent, status) VALUES ('${X}','TEST-2026-0001','Premium (test)',499,'betaald')`,
    `INSERT INTO public.toestemmingen (user_id, soort, aan) VALUES ('${X}','analyse',false)`,
    `INSERT INTO storage.buckets (id, name) VALUES ('recipe-photos','recipe-photos') ON CONFLICT DO NOTHING`,
    `INSERT INTO storage.objects (bucket_id, name) VALUES ('recipe-photos','${X}/lasagne.jpg'),('community-fotos','${CB_FOTO}'),('recipe-photos','${Y}/soep.jpg')`,
  ];
  for (const sql of stappen) {
    try {
      await db.exec(sql);
    } catch (e) {
      console.error(
        "zaaien mislukt:",
        sql.slice(0, 90),
        "→",
        String(e?.message ?? e).split("\n")[0],
      );
      process.exit(2);
    }
  }
}

/** Zelfde stappen als draagGezinnenOver (account-opruimen.server.ts). */
async function gezinnen(db) {
  const g = await db.query(`SELECT id FROM public.groups WHERE owner_id = '${X}'`);
  for (const { id } of g.rows) {
    const opvolger = await db.query(
      `SELECT user_id FROM public.group_members WHERE group_id = '${id}' AND user_id <> '${X}' AND status = 'actief' ORDER BY created_at LIMIT 1`,
    );
    const o = opvolger.rows[0]?.user_id;
    if (o) {
      await db.exec(`UPDATE public.groups SET owner_id = '${o}' WHERE id = '${id}'`);
      await db.exec(
        `UPDATE public.shopping_lists SET user_id = '${o}' WHERE group_id = '${id}' AND user_id = '${X}'`,
      );
    } else {
      await db.exec(`DELETE FROM public.shopping_lists WHERE group_id = '${id}'`);
      await db.exec(`DELETE FROM public.meal_plan WHERE group_id = '${id}'`);
      await db.exec(`DELETE FROM public.groups WHERE id = '${id}'`);
    }
  }
}

const bestaat = async (db, tabel, kolom) =>
  (
    await db.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [tabel, kolom],
    )
  ).rows.length > 0;

/** Zelfde regels als ruimRegisterOp (account-opruimen.server.ts), in SQL. */
async function register(db) {
  const overgeslagen = [];
  for (const r of GEGEVENS_REGISTER) {
    if (!(await bestaat(db, r.tabel, r.kolom))) {
      overgeslagen.push(`${r.tabel}.${r.kolom}`);
      continue;
    }
    const waar = r.via
      ? `${r.kolom} IN (SELECT id FROM public.${r.via.ouder} WHERE ${r.via.ouderKolom} = '${X}')`
      : `${r.kolom} = '${X}'`;
    const sql =
      r.actie === "wissen"
        ? `DELETE FROM public.${r.tabel} WHERE ${waar}`
        : `UPDATE public.${r.tabel} SET ${r.kolom} = NULL WHERE ${waar}`;
    await db.exec(sql);
  }
  return overgeslagen;
}

/** Elke (tabel, kolom) van het type uuid in public met een rij = X. */
async function verwijzingen(db, wie = X) {
  const kolommen = await db.query(`
    SELECT c.table_name t, c.column_name k FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public' AND tb.table_type = 'BASE TABLE' AND c.data_type = 'uuid'`);
  const uit = [];
  for (const { t, k } of kolommen.rows) {
    const n = (await db.query(`SELECT count(*)::int n FROM public.${t} WHERE ${k} = '${wie}'`))
      .rows[0].n;
    if (n) uit.push(`${t}.${k} (${n})`);
  }
  const opslag = (
    await db.query(`SELECT count(*)::int n FROM storage.objects WHERE name LIKE '${wie}/%'`)
  ).rows[0].n;
  if (opslag) uit.push(`storage.objects (${opslag})`);
  return uit;
}

const resultaten = [];
const check = (naam, gemeten, verwacht) =>
  resultaten.push({
    naam,
    gemeten,
    verwacht,
    ok: JSON.stringify(gemeten) === JSON.stringify(verwacht),
  });

// ---------- 1. volledigheid ----------
{
  const db = await bouw();
  const fk = await db.query(`
    SELECT tc.table_name t, kcu.column_name k
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND ccu.table_schema = 'auth' AND ccu.table_name = 'users'`);
  // Persoonskolommen zonder verwijzing (de databank ruimt ze dus NIET zelf op).
  const naam = await db.query(`
    SELECT table_name t, column_name k FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'uuid'
      AND column_name IN ('user_id','owner_id','member_id','actor_id','admin_id','follower_id','fan_id','melder_id','beheerder_id')`);
  const inRegister = new Set(GEGEVENS_REGISTER.map((r) => `${r.tabel}.${r.kolom}`));
  const ontbreekt = [...new Set([...fk.rows, ...naam.rows].map((r) => `${r.t}.${r.k}`))]
    .filter((k) => !inRegister.has(k) && !UITZONDERINGEN[k])
    .sort();
  check(
    "volledig: elke persoonskolom staat in het register (of is een uitzondering)",
    ontbreekt,
    [],
  );
  const tabellen = (
    await db.query(
      `SELECT table_name t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    )
  ).rows.map((r) => r.t);
  const onbekend = GEGEVENS_REGISTER.map((r) => r.tabel)
    .filter((t, i, a) => a.indexOf(t) === i)
    .filter((t) => !tabellen.includes(t));
  check("register: elke tabel bestaat na alle voorstellen (geen tikfout)", onbekend, []);
  const verkeerdUitgezonderd = Object.keys(NIET_PERSOONLIJK).filter((t) => !tabellen.includes(t));
  check("uitzonderingen: elke tabel bestaat", verkeerdUitgezonderd, []);
}

// ---------- 2. vaststelling: alleen DELETE FROM auth.users laat sporen achter ----------
{
  const db = await bouw();
  await zaai(db);
  let fout = "geen";
  try {
    await db.exec(`DELETE FROM auth.users WHERE id = '${X}'`);
  } catch (e) {
    fout = String(e?.message ?? e).split("\n")[0];
  }
  const sporen = fout === "geen" ? await verwijzingen(db) : [];
  check(
    "ZONDER opruiming: account wissen faalt of laat verwijzingen achter (daarom de opruiming)",
    fout !== "geen" || sporen.length > 0,
    true,
  );
  console.log(
    `  (vaststelling zonder opruiming: ${fout !== "geen" ? `fout: ${fout}` : `achter: ${sporen.join(", ")}`})`,
  );
}

// ---------- 2b. vaststelling: gezin opheffen zonder eerst de gezinslijst te wissen faalt ----------
{
  const db = await bouw();
  await zaai(db);
  let fout = "geen";
  try {
    await db.exec(`DELETE FROM public.groups WHERE id = '${G2}'`);
  } catch (e) {
    fout = String(e?.code ?? e);
  }
  check(
    "OUDE volgorde: gezin wissen met gezinslijst faalt (FK, 23503) → nu eerst lijst + menu weg",
    fout,
    "23503",
  );
}

// ---------- 3. met de stappen van de app ----------
{
  const db = await bouw();
  await zaai(db);
  const tel = async (sql) => (await db.query(sql)).rows[0].n;
  const yVoor = await tel(`SELECT count(*)::int n FROM public.pantry_items WHERE user_id = '${Y}'`);
  let fout = "geen";
  let overgeslagen = [];
  try {
    await gezinnen(db);
    overgeslagen = await register(db);
    await db.exec(`DELETE FROM auth.users WHERE id = '${X}'`);
    await db.exec(`DELETE FROM storage.objects WHERE name LIKE '${X}/%'`);
  } catch (e) {
    fout = String(e?.message ?? e).split("\n")[0];
  }
  check("opruimen lukt zonder databankfout", fout, "geen");
  check("geen register-regel overgeslagen (alle voorstellen aanwezig)", overgeslagen, []);
  check("NIETS verwijst nog naar de gebruiker (public + opslag)", await verwijzingen(db), []);
  check(
    "gezin met een ander lid → nieuwe eigenaar Y",
    (await db.query(`SELECT owner_id FROM public.groups WHERE id = '${G1}'`)).rows[0]?.owner_id,
    Y,
  );
  check(
    "gezinslijst van G1 blijft, met het product van Y",
    await tel(
      `SELECT count(*)::int n FROM public.shopping_items i JOIN public.shopping_lists l ON l.id = i.list_id WHERE l.group_id = '${G1}' AND i.user_id = '${Y}'`,
    ),
    1,
  );
  check(
    "gezin zonder ander lid → opgeheven",
    await tel(`SELECT count(*)::int n FROM public.groups WHERE id = '${G2}'`),
    0,
  );
  check(
    "voorraad van Y onaangeroerd",
    await tel(`SELECT count(*)::int n FROM public.pantry_items WHERE user_id = '${Y}'`),
    yVoor,
  );
  check(
    "recept van Y blijft",
    await tel(`SELECT count(*)::int n FROM public.recipes WHERE id = '${R_Y}'`),
    1,
  );
  check(
    "weekmenu van Z blijft, zonder link naar het gewiste recept",
    (
      await db.query(
        `SELECT count(*)::int n, bool_and(recipe_id IS NULL) leeg FROM public.meal_plan WHERE user_id = '${Z}'`,
      )
    ).rows[0],
    { n: 1, leeg: true },
  );
  check(
    "factuur blijft (boekhouding), zonder persoon",
    (
      await db.query(
        `SELECT count(*)::int n, bool_and(user_id IS NULL) anoniem FROM public.facturen WHERE nummer = 'TEST-2026-0001'`,
      )
    ).rows[0],
    { n: 1, anoniem: true },
  );
  check(
    "foto van Y in de opslag blijft",
    await tel(`SELECT count(*)::int n FROM storage.objects WHERE name = '${Y}/soep.jpg'`),
    1,
  );
  check(
    "Y en Z bestaan nog",
    await tel(`SELECT count(*)::int n FROM auth.users WHERE id IN ('${Y}','${Z}')`),
    2,
  );
}

let fouten = 0;
for (const r of resultaten) {
  if (!r.ok) fouten++;
  console.log(
    `${r.ok ? "✓" : "✗"} ${r.naam}${r.ok ? "" : ` — gemeten ${JSON.stringify(r.gemeten)}, verwacht ${JSON.stringify(r.verwacht)}`}`,
  );
}
console.log(`\n${resultaten.length - fouten}/${resultaten.length} zoals verwacht`);
process.exit(fouten ? 1 : 0);
