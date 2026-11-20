/**
 * Voorstel 0025 (NIET uitgevoerd) — BUG-164, toestemmingen en sessies.
 *
 * Gezin G: A (eigenaar, mag alles), C (lid, mag bewerken), K (lid, alleen bekijken).
 * 1. Huidige migraties: kijker K kan op de EIGEN lijst (geen gezinslijst) en het eigen recept van
 *    A schrijven, omdat groep_recht naar de rechten van A kijkt (lek, BUG-164).
 * 2. Met 0025: K kan dat niet meer, ziet het wel nog; C (bewerker) kan het nog (bedoeld gedrag
 *    "ik deel mijn spullen met het gezin"); A zelf ongewijzigd. Toestemmingen alleen eigen rij;
 *    sessies alleen eigen sessies, afmelden alleen een eigen sessie.
 * 3. Heen + terug: exact de huidige stand (lek terug, tabel en functies weg).
 *
 *   PGLITE_DIR=<map> node tests/rls/privacy-0025.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const A = "aa250000-0000-4000-8000-00000000000a";
const C = "cc250000-0000-4000-8000-00000000000c";
const K = "dd250000-0000-4000-8000-00000000000d";
const V = "ee250000-0000-4000-8000-00000000000e"; // vreemde, geen gezin
const G = "ff250000-0000-4000-8000-0000000000f1";
const LIJST_A = "ab250000-0000-4000-8000-0000000000a1";
const RECEPT_A = "ac250000-0000-4000-8000-0000000000a1";
const S_A = "5a250000-0000-4000-8000-0000000000a1";
const S_K = "5d250000-0000-4000-8000-0000000000d1";

const { db, fouten } = await bouwDatabank();
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@v.test'),('${C}','c@v.test'),('${K}','k@v.test'),('${V}','v@v.test');
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G}', '${A}', 'Gezin');
  INSERT INTO public.group_members (group_id, user_id, rol, status, shopping_edit, recipes_edit) VALUES
    ('${G}','${A}','eigenaar','actief', true, true),
    ('${G}','${C}','lid','actief', true, true),
    ('${G}','${K}','lid','actief', false, false) ON CONFLICT DO NOTHING;
  INSERT INTO public.shopping_lists (id, user_id, name) VALUES ('${LIJST_A}', '${A}', 'Eigen lijst A');
  INSERT INTO public.recipes (id, user_id, title) VALUES ('${RECEPT_A}', '${A}', 'Lasagne van A');
  INSERT INTO auth.sessions (id, user_id, user_agent) VALUES ('${S_A}', '${A}', 'Telefoon van A'), ('${S_K}', '${K}', 'Tablet van K');
`);

let n = 0;
async function item(naam = "brood") {
  const id = `ab250000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  await db.exec(
    `INSERT INTO public.shopping_items (id, user_id, list_id, name, unit) VALUES ('${id}','${A}','${LIJST_A}','${naam}','')`,
  );
  return id;
}
const resultaten = [];
const check = (naam, gemeten, verwacht) =>
  resultaten.push({ naam, gemeten, verwacht, ok: gemeten === verwacht });
const raak = (wie, sql) =>
  als(db, wie, async (t) => String((await t.query(sql)).affectedRows ?? 0)).catch(() => "fout");
const lees1 = (wie, sql) =>
  als(db, wie, async (t) => String((await t.query(sql)).rows[0]?.n ?? "")).catch(() => "fout");
/** Als wie, met session_id in de JWT-claims (zoals PostgREST). */
const metSessie = (wie, sessie, sql) =>
  db
    .transaction(async (tx) => {
      await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [wie]);
      await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: wie, session_id: sessie }),
      ]);
      await tx.exec("SET LOCAL ROLE authenticated");
      return (await tx.query(sql)).rows;
    })
    .catch(() => "fout");

async function lekMeting(fase, verwachtLek) {
  const w = verwachtLek ? "1" : "0";
  const i = await item();
  check(
    `${fase}: kijker K wist op de eigen lijst van A`,
    await raak(K, `DELETE FROM public.shopping_items WHERE id = '${i}'`),
    w,
  );
  const j = await item();
  check(
    `${fase}: kijker K hernoemt op de eigen lijst van A`,
    await raak(K, `UPDATE public.shopping_items SET name = 'x' WHERE id = '${j}'`),
    w,
  );
  check(
    `${fase}: kijker K hernoemt het recept van A`,
    await raak(K, `UPDATE public.recipes SET title = 'x' WHERE id = '${RECEPT_A}'`),
    w,
  );
  check(
    `${fase}: kijker K ziet de lijst van A nog (delen blijft)`,
    await lees1(
      K,
      `SELECT (count(*) > 0)::text n FROM public.shopping_items WHERE list_id = '${LIJST_A}'`,
    ),
    "true",
  );
  const k = await item("melk");
  check(
    `${fase}: bewerker C mag op de lijst van A wijzigen (bedoeld)`,
    await raak(C, `UPDATE public.shopping_items SET name = 'volle melk' WHERE id = '${k}'`),
    "1",
  );
  check(
    `${fase}: A zelf wijzigt de eigen lijst`,
    await raak(A, `UPDATE public.shopping_items SET name = 'magere melk' WHERE id = '${k}'`),
    "1",
  );
  check(
    `${fase}: vreemde V wijzigt niets`,
    await raak(V, `UPDATE public.shopping_items SET name = 'x' WHERE id = '${k}'`),
    "0",
  );
}

// ---------- 1. huidige migraties ----------
await lekMeting("NU (BUG-164)", true);

// ---------- 2. met 0025 ----------
await db.exec(lees("0025_privacy_toestemmingen_rechten.up.sql"));
await lekMeting("0025", false);
{
  check(
    "0025: eigen toestemming zetten",
    await raak(A, `INSERT INTO public.toestemmingen (soort, aan) VALUES ('ai', false)`),
    "1",
  );
  check(
    "0025: toestemming voor een ander zetten mag niet",
    await raak(
      A,
      `INSERT INTO public.toestemmingen (user_id, soort, aan) VALUES ('${K}','ai', true)`,
    ),
    "fout",
  );
  check(
    "0025: gezinslid ziet de toestemmingen van een ander niet",
    await lees1(K, `SELECT count(*)::int n FROM public.toestemmingen`),
    "0",
  );
  check(
    "0025: toestemming aan een ander overdragen mag niet",
    await raak(A, `UPDATE public.toestemmingen SET user_id = '${K}' WHERE soort = 'ai'`),
    "fout",
  );
  check(
    "0025: onbekende soort geweigerd",
    await raak(A, `INSERT INTO public.toestemmingen (soort, aan) VALUES ('alles', true)`),
    "fout",
  );
  check(
    "0025: anoniem leest geen toestemmingen",
    await lees1(null, `SELECT count(*)::int n FROM public.toestemmingen`),
    "fout",
  );
  const eigen = await metSessie(A, S_A, `SELECT id, huidige FROM public.mijn_aanmeldingen()`);
  check(
    "0025: A ziet alleen de eigen sessie, als 'dit toestel'",
    JSON.stringify(eigen),
    JSON.stringify([{ id: S_A, huidige: true }]),
  );
  check(
    "0025: A kan de sessie van K niet afmelden",
    JSON.stringify(await metSessie(A, S_A, `SELECT public.meld_aanmelding_af('${S_K}') ok`)),
    '"fout"',
  );
  check(
    "0025: sessie van K bestaat nog",
    String(
      (await db.query(`SELECT count(*)::int n FROM auth.sessions WHERE id = '${S_K}'`)).rows[0].n,
    ),
    "1",
  );
  check(
    "0025: K meldt de eigen sessie af",
    JSON.stringify(await metSessie(K, S_K, `SELECT public.meld_aanmelding_af('${S_K}') ok`)),
    JSON.stringify([{ ok: true }]),
  );
  check(
    "0025: anoniem kan geen sessies opvragen",
    await als(db, null, (t) => t.query(`SELECT * FROM public.mijn_aanmeldingen()`))
      .then(() => "ok")
      .catch(() => "fout"),
    "fout",
  );
}

// ---------- 3. heen + terug ----------
await db.exec(lees("0025_privacy_toestemmingen_rechten.down.sql"));
await lekMeting("terug", true);
check(
  "terug: tabel toestemmingen weg",
  String((await db.query(`SELECT to_regclass('public.toestemmingen') IS NULL v`)).rows[0].v),
  "true",
);
check(
  "terug: sessiefuncties weg",
  String(
    (
      await db.query(
        `SELECT count(*)::int n FROM pg_proc WHERE proname IN ('mijn_aanmeldingen','meld_aanmelding_af')`,
      )
    ).rows[0].n,
  ),
  "0",
);

let fout = 0;
for (const r of resultaten) {
  if (!r.ok) fout++;
  console.log(
    `${r.ok ? "✓" : "✗"} ${r.naam}${r.ok ? "" : ` — gemeten ${r.gemeten}, verwacht ${r.verwacht}`}`,
  );
}
console.log(`\n${resultaten.length - fout}/${resultaten.length} zoals verwacht`);
process.exit(fout ? 1 : 0);
