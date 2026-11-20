/**
 * Test van voorstel 0021 (fase 4: makerabonnementen in testmodus, exclusiviteit, community met
 * reacties/foto's/blokkeren, meldingen van inhoud) op PGlite: alle migraties + 0002a + 0008 +
 * 0017 + 0021. M is maker, F is fan met abonnement, X heeft geen abonnement.
 *
 *   PGLITE_DIR=<map> node tests/rls/makers-abonnement.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const M = "a9000000-0000-4000-8000-00000000000a";
const F = "b9000000-0000-4000-8000-00000000000b";
const X = "c9000000-0000-4000-8000-00000000000c";
const Y = "d9000000-0000-4000-8000-00000000000d";
const Z = "e9000000-0000-4000-8000-00000000000e";
const CM = "f9000000-0000-4000-8000-0000000000c1";
const OPEN = "a9100000-0000-4000-8000-000000000001"; // openbaar, voor iedereen
const EXCL = "a9100000-0000-4000-8000-000000000002"; // openbaar, alleen abonnees
const COL = "a9200000-0000-4000-8000-000000000001"; // exclusieve collectie
const ABO = "a9300000-0000-4000-8000-000000000001";
const BIJ = "a9400000-0000-4000-8000-000000000001"; // bijdrage van X op OPEN

const ladder = [
  "0002a_basislijn_recepten_fotos.up.sql",
  "0008_creators_community.up.sql",
  "0017_samenwerking.up.sql",
  "0021_makers_abonnement_community.up.sql",
];
const { db, fouten } = await bouwDatabank({ extraNaMigraties: ladder.map(lees).join("\n") });
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
// Opzet als server (service: geen auth.uid()).
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${M}','m@voorbeeld.test'),('${F}','f@voorbeeld.test'),
    ('${X}','x@voorbeeld.test'),('${Y}','y@voorbeeld.test'),('${Z}','z@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${M}','Maker M'),('${F}','Fien Fan'),('${X}','Xavier X'),
    ('${Y}','Y'),('${Z}','Z') ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;
  INSERT INTO public.recipes (id, user_id, title) VALUES ('${OPEN}','${M}','Tajine'),('${EXCL}','${M}','Harira');
  INSERT INTO public.recipe_ingredients (recipe_id, name) VALUES ('${OPEN}','kip'),('${EXCL}','linzen');
  INSERT INTO public.creators (id, user_id, handle, naam) VALUES ('${CM}','${M}','chef-m','Chef M');
  INSERT INTO public.recipe_publicaties (recipe_id, creator_id, zichtbaarheid, status, moderatie, exclusief, gepubliceerd_op) VALUES
    ('${OPEN}','${CM}','openbaar','gepubliceerd','goedgekeurd', false, now()),
    ('${EXCL}','${CM}','openbaar','gepubliceerd','goedgekeurd', true, now());
  INSERT INTO public.collections (id, user_id, naam, openbaar, exclusief) VALUES ('${COL}','${M}','Ramadan', true, true);
  INSERT INTO public.collection_recipes (collection_id, recipe_id) VALUES ('${COL}','${EXCL}');
  INSERT INTO public.maker_plannen (creator_id, prijs_cent, voordelen, actief) VALUES ('${CM}', 399, ARRAY['Exclusieve recepten'], true);
  INSERT INTO public.maker_abonnementen (id, fan_id, creator_id, status, prijs_cent, periode_einde)
    VALUES ('${ABO}','${F}','${CM}','actief', 399, now() + interval '30 days');
  INSERT INTO public.maker_betalingen (abonnement_id, fan_id, creator_id, soort, bedrag_cent, btw_cent, provider_ref)
    VALUES ('${ABO}','${F}','${CM}','betaling', 399, 69, 'test_1');
  INSERT INTO public.community_bijdragen (id, recipe_id, user_id, weergavenaam, tekst, sterren)
    VALUES ('${BIJ}','${OPEN}','${X}','Xavier','Heerlijk gerecht!', 5);
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
const aantalRecepten = (wie, id) =>
  tel(wie, `SELECT count(*)::int n FROM public.recipes WHERE id = '${id}'`);

// --- exclusieve recepten ---
check("X (geen abonnement) ziet het gewone openbare recept", await aantalRecepten(X, OPEN), 1);
check("X (geen abonnement) ziet het exclusieve recept NIET", await aantalRecepten(X, EXCL), 0);
check(
  "X ziet de ingrediënten van het exclusieve recept niet",
  await tel(X, `SELECT count(*)::int n FROM public.recipe_ingredients WHERE recipe_id = '${EXCL}'`),
  0,
);
check("F (actief abonnement) ziet het exclusieve recept", await aantalRecepten(F, EXCL), 1);
check("M (maker) ziet het eigen exclusieve recept", await aantalRecepten(M, EXCL), 1);
check(
  "X ziet wel de aankondiging (titel), zonder inhoud",
  await tel(
    X,
    `SELECT count(*)::int n FROM public.exclusieve_aankondigingen('${CM}') WHERE title = 'Harira'`,
  ),
  1,
);
check(
  "anon krijgt geen aankondigingen",
  await lukt(
    als(db, null, (t) => t.query(`SELECT * FROM public.exclusieve_aankondigingen('${CM}')`)),
  ),
  "geweigerd",
);
check(
  "X ziet de exclusieve collectie niet",
  await tel(X, `SELECT count(*)::int n FROM public.collections WHERE id = '${COL}'`),
  0,
);
check(
  "X ziet de recepten van de exclusieve collectie niet",
  await tel(
    X,
    `SELECT count(*)::int n FROM public.collection_recipes WHERE collection_id = '${COL}'`,
  ),
  0,
);
check(
  "F ziet de exclusieve collectie en de recepten erin",
  await tel(
    F,
    `SELECT count(*)::int n FROM public.collection_recipes cr JOIN public.collections c ON c.id = cr.collection_id WHERE c.id = '${COL}'`,
  ),
  1,
);

// --- abonnementen en betalingen ---
check(
  "F leest het eigen abonnement",
  await tel(F, `SELECT count(*)::int n FROM public.maker_abonnementen`),
  1,
);
check(
  "X maakt zelf geen abonnement aan (alleen de server)",
  await doe(
    X,
    `INSERT INTO public.maker_abonnementen (fan_id, creator_id, status, prijs_cent, periode_einde) VALUES ('${X}','${CM}','actief',399, now() + interval '30 days')`,
  ),
  "geweigerd",
);
check(
  "F verlengt het eigen abonnement niet zelf",
  await tel(
    F,
    `WITH u AS (UPDATE public.maker_abonnementen SET periode_einde = now() + interval '10 years' RETURNING 1) SELECT count(*)::int n FROM u`,
  ).catch(() => "geweigerd"),
  "geweigerd",
);
check(
  "M (maker) leest de abonnemententabel niet rechtstreeks",
  await tel(M, `SELECT count(*)::int n FROM public.maker_abonnementen`),
  0,
);
check(
  "M ziet de testbetalingen van zijn abonnees NIET",
  await tel(M, `SELECT count(*)::int n FROM public.maker_betalingen`),
  0,
);
check(
  "M ziet zijn abonnees via maker_abonnees(): alleen voornaam, sinds, status",
  await als(db, M, async (t) => {
    const r = await t.query(`SELECT * FROM public.maker_abonnees('${CM}')`);
    return r.rows.length === 1 &&
      Object.keys(r.rows[0]).sort().join(",") === "sinds,status,voornaam"
      ? `${r.rows[0].voornaam}/${r.rows[0].status}`
      : JSON.stringify(r.rows);
  }),
  "Fien/actief",
);
check(
  "X krijgt de abonnees van M niet",
  await tel(X, `SELECT count(*)::int n FROM public.maker_abonnees('${CM}')`),
  0,
);
check(
  "X ziet geen betalingen van anderen",
  await tel(X, `SELECT count(*)::int n FROM public.maker_betalingen`),
  0,
);
check(
  "F ziet de eigen testbetaling",
  await tel(F, `SELECT count(*)::int n FROM public.maker_betalingen`),
  1,
);
check(
  "een echte (niet-test) betaling kan zelfs de server niet bewaren",
  await lukt(
    db.query(
      `INSERT INTO public.maker_betalingen (fan_id, creator_id, soort, bedrag_cent, btw_cent, provider_ref, test) VALUES ('${F}','${CM}','betaling',399,69,'live_1', false)`,
    ),
  ),
  "geweigerd",
);
check(
  "live-modus voor een abonnement wordt geweigerd",
  await lukt(
    db.query(
      `INSERT INTO public.maker_abonnementen (fan_id, creator_id, status, modus, prijs_cent, periode_einde) VALUES ('${X}','${CM}','actief','live',399, now())`,
    ),
  ),
  "geweigerd",
);
check(
  "X past het plan van M niet aan",
  await tel(
    X,
    `WITH u AS (UPDATE public.maker_plannen SET prijs_cent = 100 RETURNING 1) SELECT count(*)::int n FROM u`,
  ),
  0,
);
check(
  "M past het eigen plan aan",
  await tel(
    M,
    `WITH u AS (UPDATE public.maker_plannen SET prijs_cent = 450 RETURNING 1) SELECT count(*)::int n FROM u`,
  ),
  1,
);

// Opzeggen (zoals de server): toegang stopt meteen.
await db.exec(
  `UPDATE public.maker_abonnementen SET status = 'opgezegd', opgezegd_op = now(), periode_einde = now() WHERE id = '${ABO}'`,
);
check("na opzeggen ziet F het exclusieve recept niet meer", await aantalRecepten(F, EXCL), 0);
check(
  "na opzeggen ziet F de exclusieve collectie niet meer",
  await tel(F, `SELECT count(*)::int n FROM public.collections WHERE id = '${COL}'`),
  0,
);
check("na opzeggen ziet F het gewone recept nog", await aantalRecepten(F, OPEN), 1);

// --- community: reacties, foto's, blokkeren ---
check(
  "F plaatst een reactie zonder sterren",
  await doe(
    F,
    `INSERT INTO public.community_bijdragen (recipe_id, user_id, soort, tekst) VALUES ('${OPEN}','${F}','reactie','Kan dit met tofu?')`,
  ),
  "gelukt",
);
check(
  "reactie mét sterren geweigerd",
  await doe(
    F,
    `INSERT INTO public.community_bijdragen (recipe_id, user_id, soort, tekst, sterren) VALUES ('${OPEN}','${F}','reactie','Lekker hoor', 5)`,
  ),
  "geweigerd",
);
check(
  "'gemaakt' zonder sterren geweigerd",
  await doe(
    F,
    `INSERT INTO public.community_bijdragen (recipe_id, user_id, soort, tekst) VALUES ('${OPEN}','${F}','gemaakt','Gemaakt!')`,
  ),
  "geweigerd",
);
check(
  "foto in de eigen map: toegestaan",
  await doe(
    F,
    `INSERT INTO public.community_bijdragen (recipe_id, user_id, soort, tekst, sterren, foto_url) VALUES ('${OPEN}','${F}','gemaakt','Met foto', 4, '${F}/a9500000-0000-4000-8000-000000000001.jpg')`,
  ),
  "gelukt",
);
check(
  "foto uit andermans map of een externe link: geweigerd",
  (await doe(
    F,
    `INSERT INTO public.community_bijdragen (recipe_id, user_id, soort, tekst, sterren, foto_url) VALUES ('${OPEN}','${F}','gemaakt','Andermans foto', 4, '${X}/a9500000-0000-4000-8000-000000000002.jpg')`,
  )) +
    "/" +
    (await doe(
      F,
      `INSERT INTO public.community_bijdragen (recipe_id, user_id, soort, tekst, sterren, foto_url) VALUES ('${OPEN}','${F}','gemaakt','Extern', 4, 'https://evil.example/x.jpg')`,
    )),
  "geweigerd/geweigerd",
);
check(
  "bijdrage op een exclusief recept zonder recht: geweigerd",
  await doe(
    X,
    `INSERT INTO public.community_bijdragen (recipe_id, user_id, soort, tekst) VALUES ('${EXCL}','${X}','reactie','Mag ik dit?')`,
  ),
  "geweigerd",
);
check(
  "F blokkeert X",
  await doe(
    F,
    `INSERT INTO public.gebruiker_blokkades (blokkeerder_id, geblokkeerd_id) VALUES ('${F}','${X}')`,
  ),
  "gelukt",
);
check(
  "jezelf blokkeren: geweigerd",
  await doe(
    F,
    `INSERT INTO public.gebruiker_blokkades (blokkeerder_id, geblokkeerd_id) VALUES ('${F}','${F}')`,
  ),
  "geweigerd",
);
check(
  "na blokkeren ziet F de bijdrage van X niet",
  await tel(F, `SELECT count(*)::int n FROM public.community_bijdragen WHERE user_id = '${X}'`),
  0,
);
check(
  "Y ziet de bijdrage van X nog wel",
  await tel(Y, `SELECT count(*)::int n FROM public.community_bijdragen WHERE user_id = '${X}'`),
  1,
);
check(
  "X ziet niet wie hem blokkeerde",
  await tel(X, `SELECT count(*)::int n FROM public.gebruiker_blokkades`),
  0,
);
check(
  "foto lezen in opslag: alleen bij een zichtbare bijdrage",
  await (async () => {
    await db.query(
      `INSERT INTO storage.objects (bucket_id, name) VALUES ('community-fotos','${F}/a9500000-0000-4000-8000-000000000001.jpg'),('community-fotos','${F}/geheim.jpg')`,
    );
    return tel(
      Y,
      `SELECT count(*)::int n FROM storage.objects WHERE bucket_id = 'community-fotos'`,
    );
  })(),
  1,
);
check(
  "uploaden in andermans map: geweigerd",
  await doe(
    Y,
    `INSERT INTO storage.objects (bucket_id, name) VALUES ('community-fotos','${F}/x.jpg')`,
  ),
  "geweigerd",
);

// --- meldingen van inhoud ---
check(
  "F meldt dezelfde bijdrage geen twee keer tegelijk",
  (await doe(
    F,
    `INSERT INTO public.content_meldingen (soort, doel_id, reden) VALUES ('bijdrage','${BIJ}','ongepast')`,
  )) +
    "/" +
    (await doe(
      F,
      `INSERT INTO public.content_meldingen (soort, doel_id, reden) VALUES ('bijdrage','${BIJ}','reclame')`,
    )),
  "gelukt/geweigerd",
);
await doe(
  Y,
  `INSERT INTO public.content_meldingen (soort, doel_id, reden) VALUES ('bijdrage','${BIJ}','ongepast')`,
);
check(
  "na twee melders is de bijdrage nog zichtbaar",
  (await db.query(`SELECT verborgen::text v FROM public.community_bijdragen WHERE id = '${BIJ}'`))
    .rows[0].v,
  "false",
);
await doe(
  Z,
  `INSERT INTO public.content_meldingen (soort, doel_id, reden) VALUES ('bijdrage','${BIJ}','ongepast')`,
);
check(
  "na drie verschillende melders is de bijdrage verborgen (tot beheer beslist)",
  (await db.query(`SELECT verborgen::text v FROM public.community_bijdragen WHERE id = '${BIJ}'`))
    .rows[0].v,
  "true",
);

// --- meldingen in de app (0017) ---
check(
  "soort 'maker' mag uit in de meldinginstellingen",
  await doe(
    F,
    `INSERT INTO public.app_melding_instellingen (user_id, uit) VALUES ('${F}', ARRAY['maker'])`,
  ),
  "gelukt",
);

// --- terugdraaien ---
await db.exec(lees("0021_makers_abonnement_community.down.sql"));
check(
  "terugdraaien: nieuwe tabellen, kolommen en functies weg; recepten blijven",
  (
    await db.query(
      `SELECT (to_regclass('public.maker_abonnementen') IS NULL AND to_regclass('public.gebruiker_blokkades') IS NULL
         AND to_regclass('public.maker_betalingen') IS NULL AND to_regclass('public.maker_plannen') IS NULL
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name IN ('recipe_publicaties','collections') AND column_name = 'exclusief')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'community_bijdragen' AND column_name = 'soort')
         AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('heeft_maker_recht','maker_abonnees','exclusieve_aankondigingen','verberg_na_meldingen'))
         AND (SELECT count(*) FROM public.recipes) = 2)::text n`,
    )
  ).rows[0].n,
  "true",
);
check(
  "terugdraaien: het (vroeger exclusieve) recept is weer gewoon openbaar zoals in 0008",
  await aantalRecepten(X, EXCL),
  1,
);
check(
  "terugdraaien: reacties weg, 'gemaakt' met sterren blijft",
  (await db.query(`SELECT count(*)::int n FROM public.community_bijdragen WHERE sterren IS NULL`))
    .rows[0].n,
  0,
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(
  `\n${resultaten.length - mis}/${resultaten.length} zoals verwacht, ${mis} afwijking(en)`,
);
process.exit(mis ? 1 : 0);
