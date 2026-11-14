/**
 * Test van voorstel 0008 (makers, publicaties, volgen, verzamelingen, community, meldingen) op
 * PGlite uit alle migraties + 0002a (veilige basis voor recepten). M is maker, V volgt/kookt,
 * X is een buitenstaander.
 *
 *   PGLITE_DIR=<map> node tests/rls/makers-community.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const M = "a8000000-0000-4000-8000-00000000000a";
const V = "b8000000-0000-4000-8000-00000000000b";
const X = "c8000000-0000-4000-8000-00000000000c";
const CM = "d8000000-0000-4000-8000-0000000000d1";
const OPEN = "e8000000-0000-4000-8000-000000000001"; // openbaar + goedgekeurd
const WACHT = "e8000000-0000-4000-8000-000000000002"; // openbaar, wacht op moderatie
const PRIVE = "e8000000-0000-4000-8000-000000000003"; // geen publicatie
const VAN_V = "e8000000-0000-4000-8000-000000000004";

const { db, fouten } = await bouwDatabank({
  extraNaMigraties:
    lees("0002a_basislijn_recepten_fotos.up.sql") + lees("0008_creators_community.up.sql"),
});
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
// Opzet als server (geen auth.uid(): triggers laten moderatie/verificatie door).
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${M}','m@voorbeeld.test'),('${V}','v@voorbeeld.test'),('${X}','x@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${M}','M'),('${V}','V'),('${X}','X') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.recipes (id, user_id, title) VALUES
    ('${OPEN}','${M}','Tajine'),('${WACHT}','${M}','Soep'),('${PRIVE}','${M}','Geheim'),('${VAN_V}','${V}','Van V');
  INSERT INTO public.recipe_ingredients (recipe_id, name) VALUES ('${OPEN}','kip'),('${PRIVE}','geheim');
  INSERT INTO public.creators (id, user_id, handle, naam, geverifieerd) VALUES ('${CM}','${M}','chef-m','Chef M', true);
  INSERT INTO public.recipe_publicaties (recipe_id, creator_id, zichtbaarheid, status, moderatie) VALUES
    ('${OPEN}','${CM}','openbaar','gepubliceerd','goedgekeurd'),
    ('${WACHT}','${CM}','openbaar','gepubliceerd','wacht');
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

// --- makers en publicaties ---
check("V ziet het makerprofiel", await tel(V, `SELECT count(*)::int n FROM public.creators`), 1);
check(
  "anon ziet geen makerprofielen",
  await lukt(als(db, null, (t) => t.query(`SELECT 1 FROM public.creators`))),
  "geweigerd",
);
check(
  "V ziet alleen het goedgekeurde openbare recept van M",
  await tel(V, `SELECT count(*)::int n FROM public.recipes WHERE user_id = '${M}'`),
  1,
);
check(
  "V ziet de ingrediënten van het openbare recept, niet van het privérecept",
  await tel(
    V,
    `SELECT count(*)::int n FROM public.recipe_ingredients WHERE recipe_id IN ('${OPEN}','${PRIVE}')`,
  ),
  1,
);
check(
  "V ziet geen publicatie die op moderatie wacht",
  await tel(V, `SELECT count(*)::int n FROM public.recipe_publicaties`),
  1,
);
check(
  "M ziet al zijn eigen publicaties",
  await tel(M, `SELECT count(*)::int n FROM public.recipe_publicaties`),
  2,
);
check(
  "M keurt zijn eigen publicatie niet goed (trigger zet 'wacht')",
  await als(db, M, async (t) => {
    await t.query(
      `UPDATE public.recipe_publicaties SET moderatie = 'goedgekeurd' WHERE recipe_id = '${WACHT}'`,
    );
    return (
      await t.query(
        `SELECT moderatie n FROM public.recipe_publicaties WHERE recipe_id = '${WACHT}'`,
      )
    ).rows[0].n;
  }),
  "wacht",
);
check(
  "M publiceert een privérecept openbaar: komt in de wachtrij",
  await als(db, M, async (t) => {
    await t.query(
      `INSERT INTO public.recipe_publicaties (recipe_id, creator_id, zichtbaarheid, status, moderatie) VALUES ('${PRIVE}','${CM}','openbaar','gepubliceerd','goedgekeurd')`,
    );
    return (
      await t.query(
        `SELECT moderatie n FROM public.recipe_publicaties WHERE recipe_id = '${PRIVE}'`,
      )
    ).rows[0].n;
  }),
  "wacht",
);
check(
  "X publiceert het recept van V niet onder de maker van M",
  await doe(
    X,
    `INSERT INTO public.recipe_publicaties (recipe_id, creator_id) VALUES ('${VAN_V}','${CM}')`,
  ),
  "geweigerd",
);
check(
  "M publiceert niet andermans recept",
  await doe(
    M,
    `INSERT INTO public.recipe_publicaties (recipe_id, creator_id) VALUES ('${VAN_V}','${CM}')`,
  ),
  "geweigerd",
);
check(
  "X wijzigt het profiel van M niet",
  await tel(
    X,
    `WITH u AS (UPDATE public.creators SET naam = 'Gekaapt' RETURNING 1) SELECT count(*)::int n FROM u`,
  ),
  0,
);
check(
  "X maakt zichzelf niet geverifieerd",
  await als(db, X, async (t) => {
    await t.query(
      `INSERT INTO public.creators (user_id, handle, naam, geverifieerd) VALUES ('${X}','x-kookt','X kookt', true)`,
    );
    return (
      await t.query(`SELECT geverifieerd::text n FROM public.creators WHERE user_id = '${X}'`)
    ).rows[0].n;
  }),
  "false",
);
check(
  "handle is uniek (ook met hoofdletters)",
  await doe(
    V,
    `INSERT INTO public.creators (user_id, handle, naam) VALUES ('${V}','chef-m','Kopie')`,
  ),
  "geweigerd",
);

// --- volgen ---
check(
  "V volgt M",
  await doe(V, `INSERT INTO public.follows (creator_id) VALUES ('${CM}')`),
  "gelukt",
);
check(
  "V volgt niet op naam van X",
  await doe(V, `INSERT INTO public.follows (follower_id, creator_id) VALUES ('${X}','${CM}')`),
  "geweigerd",
);
check("M ziet niet wie hem volgt", await tel(M, `SELECT count(*)::int n FROM public.follows`), 0);
check(
  "M ziet wel het totaal (maker_statistiek)",
  await als(
    db,
    M,
    async (t) =>
      (await t.query(`SELECT (public.maker_statistiek('${CM}')->>'volgers')::int n`)).rows[0].n,
  ),
  1,
);
check(
  "X krijgt geen cijfers van M",
  await als(
    db,
    X,
    async (t) => (await t.query(`SELECT public.maker_statistiek('${CM}') IS NULL AS n`)).rows[0].n,
  ),
  true,
);

// --- verzamelingen ---
const COL = "f8000000-0000-4000-8000-000000000001";
check(
  "V maakt een verzameling en bewaart het openbare recept",
  await lukt(
    als(db, V, async (t) => {
      await t.query(`INSERT INTO public.collections (id, naam) VALUES ('${COL}','Zondag')`);
      await t.query(
        `INSERT INTO public.collection_recipes (collection_id, recipe_id) VALUES ('${COL}','${OPEN}')`,
      );
    }),
  ),
  "gelukt",
);
check(
  "V bewaart geen privérecept van M",
  await doe(
    V,
    `INSERT INTO public.collection_recipes (collection_id, recipe_id) VALUES ('${COL}','${PRIVE}')`,
  ),
  "geweigerd",
);
check(
  "X ziet de privéverzameling van V niet",
  await tel(X, `SELECT count(*)::int n FROM public.collections`),
  0,
);
await als(db, V, (t) =>
  t.query(`UPDATE public.collections SET openbaar = true WHERE id = '${COL}'`),
);
check(
  "X ziet de openbare verzameling van V",
  await tel(X, `SELECT count(*)::int n FROM public.collection_recipes`),
  1,
);
check(
  "X voegt niets toe aan de verzameling van V",
  await doe(
    X,
    `INSERT INTO public.collection_recipes (collection_id, recipe_id) VALUES ('${COL}','${OPEN}')`,
  ),
  "geweigerd",
);
check(
  "bewaard door V telt mee voor M",
  await als(
    db,
    M,
    async (t) =>
      (await t.query(`SELECT (public.maker_statistiek('${CM}')->>'bewaard')::int n`)).rows[0].n,
  ),
  1,
);

// --- community ---
check(
  "V schrijft een bijdrage op het openbare recept",
  await doe(
    V,
    `INSERT INTO public.community_bijdragen (recipe_id, tekst, sterren) VALUES ('${OPEN}','Lekker!',5)`,
  ),
  "gelukt",
);
check(
  "geen bijdrage op een recept dat op moderatie wacht",
  await doe(
    V,
    `INSERT INTO public.community_bijdragen (recipe_id, tekst, sterren) VALUES ('${WACHT}','Lekker!',5)`,
  ),
  "geweigerd",
);
check(
  "6 sterren geweigerd",
  await doe(
    V,
    `INSERT INTO public.community_bijdragen (recipe_id, tekst, sterren) VALUES ('${OPEN}','Top',6)`,
  ),
  "geweigerd",
);
check(
  "X leest de bijdrage",
  await tel(X, `SELECT count(*)::int n FROM public.community_bijdragen`),
  1,
);
check(
  "X verwijdert de bijdrage van V niet",
  await tel(
    X,
    `WITH d AS (DELETE FROM public.community_bijdragen RETURNING 1) SELECT count(*)::int n FROM d`,
  ),
  0,
);
await db.exec(`UPDATE public.community_bijdragen SET verborgen = true`);
check(
  "verborgen bijdrage: X ziet ze niet meer",
  await tel(X, `SELECT count(*)::int n FROM public.community_bijdragen`),
  0,
);
check(
  "verborgen bijdrage: V ziet de eigen nog",
  await tel(V, `SELECT count(*)::int n FROM public.community_bijdragen`),
  1,
);
check(
  "V verwijdert de eigen bijdrage",
  await tel(
    V,
    `WITH d AS (DELETE FROM public.community_bijdragen RETURNING 1) SELECT count(*)::int n FROM d`,
  ),
  1,
);

// --- meldingen ---
check(
  "X meldt het openbare recept",
  await doe(
    X,
    `INSERT INTO public.content_meldingen (soort, doel_id, reden) VALUES ('recept','${OPEN}','onveilig')`,
  ),
  "gelukt",
);
check(
  "melding met status 'behandeld' indienen geweigerd",
  await doe(
    X,
    `INSERT INTO public.content_meldingen (soort, doel_id, reden, status) VALUES ('recept','${OPEN}','onveilig','behandeld')`,
  ),
  "geweigerd",
);
check(
  "M (gemelde maker) ziet de melding niet",
  await tel(M, `SELECT count(*)::int n FROM public.content_meldingen`),
  0,
);
check(
  "X ziet de eigen melding",
  await tel(X, `SELECT count(*)::int n FROM public.content_meldingen`),
  1,
);
check(
  "X zet de eigen melding niet op 'behandeld'",
  await tel(
    X,
    `WITH u AS (UPDATE public.content_meldingen SET status = 'behandeld' RETURNING 1) SELECT count(*)::int n FROM u`,
  ),
  0,
);

// --- terugdraaien ---
await db.exec(lees("0008_creators_community.down.sql"));
check(
  "terugdraaien: tabellen en functies weg, recepten blijven",
  (
    await db.query(
      `SELECT (to_regclass('public.creators') IS NULL AND to_regclass('public.content_meldingen') IS NULL
         AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('maker_statistiek','is_openbaar_recept'))
         AND (SELECT count(*) FROM public.recipes) = 4)::text n`,
    )
  ).rows[0].n,
  "true",
);
check(
  "terugdraaien: V ziet het recept van M niet meer",
  await tel(V, `SELECT count(*)::int n FROM public.recipes WHERE user_id = '${M}'`),
  0,
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(
  `\n${resultaten.length - mis}/${resultaten.length} zoals verwacht, ${mis} afwijking(en)`,
);
process.exit(mis ? 1 : 0);
