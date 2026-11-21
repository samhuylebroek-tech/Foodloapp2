/**
 * Test van voorstellen 0011 (partners, campagnes, gesponsord, samenwerkingen, statistiek,
 * aanvragen) en 0012 (abonnementen, facturen, entitlements, betaal_events) op PGlite, bovenop
 * alle migraties + 0002a + 0008. P1 = eigenaar van partner A, AN = analist van A, P2 = eigenaar
 * van partner B, K = gewone gebruiker (klant), M = maker, T = Foodlo-team (beheer).
 *
 *   PGLITE_DIR=<map> node tests/rls/partners-premium.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");

const P1 = "a1100000-0000-4000-8000-000000000001";
const AN = "a1100000-0000-4000-8000-000000000002";
const P2 = "a1100000-0000-4000-8000-000000000003";
const K = "a1100000-0000-4000-8000-000000000004";
const M = "a1100000-0000-4000-8000-000000000005";
const T = "e11454f4-8b82-4b7a-81a4-4c161b3b222d";
const A = "b1100000-0000-4000-8000-00000000000a";
const B = "b1100000-0000-4000-8000-00000000000b";
const CM = "c1100000-0000-4000-8000-000000000001";
const OPEN = "d1100000-0000-4000-8000-000000000001";
const PRIVE = "d1100000-0000-4000-8000-000000000002";
const CA = "e1100000-0000-4000-8000-000000000001"; // lopend, partner A
const CB = "e1100000-0000-4000-8000-000000000002"; // concept, partner B
const ITEM = "f1100000-0000-4000-8000-000000000001";

const { db, fouten } = await bouwDatabank({
  extraNaMigraties:
    lees("0002a_basislijn_recepten_fotos.up.sql") +
    lees("0008_creators_community.up.sql") +
    lees("0011_partners.up.sql") +
    lees("0012_premium_betalingen.up.sql"),
});
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}

// Opzet als server (geen auth.uid()).
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${P1}','p1@voorbeeld.test'),('${AN}','an@voorbeeld.test'),('${P2}','p2@voorbeeld.test'),
    ('${K}','k@voorbeeld.test'),('${M}','m@voorbeeld.test'),('${T}','t@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES
    ('${P1}','P1'),('${AN}','AN'),('${P2}','P2'),('${K}','K'),('${M}','M'),('${T}','T')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.admin_users (user_id, role, active, read_only) VALUES ('${T}','super_admin',true,false);
  INSERT INTO public.recipes (id, user_id, title) VALUES ('${OPEN}','${M}','Pompoen'),('${PRIVE}','${M}','Geheim');
  INSERT INTO public.creators (id, user_id, handle, naam) VALUES ('${CM}','${M}','chef-m','Chef M');
  INSERT INTO public.recipe_publicaties (recipe_id, creator_id, zichtbaarheid, status, moderatie)
    VALUES ('${OPEN}','${CM}','openbaar','gepubliceerd','goedgekeurd');
  INSERT INTO public.partners (id, naam, soort, verificatie_status) VALUES
    ('${A}','Hoeve A','producent','geverifieerd'),('${B}','Merk B','merk','aangevraagd');
  INSERT INTO public.partner_leden (partner_id, user_id, rol) VALUES
    ('${A}','${P1}','eigenaar'),('${A}','${AN}','analist'),('${B}','${P2}','eigenaar');
  INSERT INTO public.partner_producten (partner_id, naam, ingredient_koppeling) VALUES
    ('${A}','Butternut A','pompoen'),('${B}','Kruiden B','tijm');
  INSERT INTO public.campagnes (id, partner_id, naam, status, start, einde) VALUES
    ('${CA}','${A}','Herfst','actief', current_date - 1, current_date + 10),
    ('${CB}','${B}','Winter','concept', current_date, current_date + 10);
  INSERT INTO public.gesponsorde_items (id, campagne_id, soort, recipe_id) VALUES ('${ITEM}','${CA}','recept','${OPEN}');
  INSERT INTO public.samenwerkingen (partner_id, creator_id, status) VALUES ('${A}','${CM}','lopend');
  INSERT INTO public.gesponsord_statistiek (campagne_id, dag, vertoningen, klikken) VALUES ('${CA}', current_date - 1, 100, 4);
  INSERT INTO public.abonnementen (id, user_id, plan, status, provider_ref) VALUES
    ('a2200000-0000-4000-8000-000000000001','${K}','premium_maand','proef','sub_k');
  INSERT INTO public.abonnementen (partner_id, plan, status, provider_ref) VALUES ('${A}','partner_plus','actief','sub_a');
  INSERT INTO public.facturen (user_id, nummer, omschrijving, bedrag_cent, status) VALUES ('${K}','TEST-1','Proef',0,'betaald');
  INSERT INTO public.facturen (partner_id, nummer, omschrijving, bedrag_cent, status) VALUES ('${A}','TEST-2','Plus',4900,'betaald');
  INSERT INTO public.entitlements (user_id, recht, geldig_tot) VALUES ('${K}','premium.weekmenu_extra', current_date + 14);
  INSERT INTO public.betaal_events (event_id, provider, soort, abonnement_ref, user_id) VALUES ('evt_1','test','proef_gestart','sub_k','${K}');
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
const aantal = (wie, sql) =>
  als(
    db,
    wie,
    async (t) =>
      (await t.query(`WITH u AS (${sql} RETURNING 1) SELECT count(*)::int n FROM u`)).rows[0].n,
  );

// --- isolatie per organisatie ---
check(
  "P1 ziet alleen de producten van A",
  await tel(P1, `SELECT count(*)::int n FROM public.partner_producten`),
  1,
);
check(
  "P2 ziet alleen de producten van B",
  await tel(P2, `SELECT count(*)::int n FROM public.partner_producten`),
  1,
);
check(
  "klant ziet geen partnerproducten",
  await tel(K, `SELECT count(*)::int n FROM public.partner_producten`),
  0,
);
check(
  "P2 ziet de leden van A niet",
  await tel(P2, `SELECT count(*)::int n FROM public.partner_leden WHERE partner_id = '${A}'`),
  0,
);
check(
  "P1 ziet de twee leden van A",
  await tel(P1, `SELECT count(*)::int n FROM public.partner_leden`),
  2,
);
check(
  "P1 ziet de conceptcampagne van B niet",
  await tel(P1, `SELECT count(*)::int n FROM public.campagnes WHERE id = '${CB}'`),
  0,
);
check("anon ziet geen partners", await doe(null, `SELECT 1 FROM public.partners`), "geweigerd");
check(
  "klant ziet alleen de geverifieerde partner (naam bij gesponsord)",
  await tel(K, `SELECT count(*)::int n FROM public.partners`),
  1,
);
check(
  "P2 wijzigt partner A niet",
  await aantal(P2, `UPDATE public.partners SET naam = 'Gekaapt' WHERE id = '${A}'`),
  0,
);
check(
  "P2 maakt geen product voor A",
  await doe(
    P2,
    `INSERT INTO public.partner_producten (partner_id, naam, ingredient_koppeling) VALUES ('${A}','X','ui')`,
  ),
  "geweigerd",
);

// --- rollen ---
check(
  "analist maakt geen product",
  await doe(
    AN,
    `INSERT INTO public.partner_producten (partner_id, naam, ingredient_koppeling) VALUES ('${A}','X','ui')`,
  ),
  "geweigerd",
);
check(
  "eigenaar maakt een product",
  await doe(
    P1,
    `INSERT INTO public.partner_producten (partner_id, naam, ingredient_koppeling) VALUES ('${A}','Prei A','prei')`,
  ),
  "gelukt",
);
check(
  "analist ziet de statistiek",
  await tel(AN, `SELECT count(*)::int n FROM public.gesponsord_statistiek`),
  1,
);
check(
  "analist maakt zichzelf geen eigenaar",
  await aantal(AN, `UPDATE public.partner_leden SET rol = 'eigenaar' WHERE user_id = '${AN}'`),
  0,
);
check(
  "eigenaar verwijdert de laatste eigenaar niet",
  await doe(P1, `DELETE FROM public.partner_leden WHERE user_id = '${P1}'`),
  "geweigerd",
);
check(
  "eigenaar zet de analist op finance",
  await aantal(P1, `UPDATE public.partner_leden SET rol = 'finance' WHERE user_id = '${AN}'`),
  1,
);
check(
  "verificatie zet een partner niet zelf",
  await als(db, P2, async (t) => {
    await t.query(
      `UPDATE public.partners SET verificatie_status = 'geverifieerd', naam = 'Merk B2' WHERE id = '${B}'`,
    );
    return (
      await t.query(
        `SELECT verificatie_status || '/' || naam AS n FROM public.partners WHERE id = '${B}'`,
      )
    ).rows[0].n;
  }),
  "aangevraagd/Merk B2",
);

// --- campagnes: indienen, goedkeuren alleen door het team ---
check(
  "P2 dient het concept in",
  await aantal(P2, `UPDATE public.campagnes SET status = 'ingediend' WHERE id = '${CB}'`),
  1,
);
check(
  "P2 keurt de eigen campagne niet goed",
  await doe(P2, `UPDATE public.campagnes SET status = 'goedgekeurd' WHERE id = '${CB}'`),
  "geweigerd",
);
check(
  "nieuwe campagne start altijd als concept",
  await als(db, P1, async (t) => {
    await t.query(
      `INSERT INTO public.campagnes (partner_id, naam, status) VALUES ('${A}','Sluw','actief')`,
    );
    return (await t.query(`SELECT status AS n FROM public.campagnes WHERE naam = 'Sluw'`)).rows[0]
      .n;
  }),
  "concept",
);
check(
  "team keurt goed",
  await aantal(T, `UPDATE public.campagnes SET status = 'goedgekeurd' WHERE id = '${CB}'`),
  1,
);
check(
  "P2 wijzigt een goedgekeurde campagne niet meer",
  await doe(P2, `UPDATE public.campagnes SET naam = 'Anders' WHERE id = '${CB}'`),
  "geweigerd",
);

// --- gesponsorde items ---
check(
  "klant ziet het item van de lopende campagne",
  await tel(K, `SELECT count(*)::int n FROM public.gesponsorde_items`),
  1,
);
check(
  "klant ziet de lopende campagne",
  await tel(K, `SELECT count(*)::int n FROM public.campagnes`),
  1,
);
check(
  "goedgekeurde campagne van een niet-geverifieerde partner loopt niet",
  await tel(K, `SELECT count(*)::int n FROM public.campagnes WHERE id = '${CB}'`),
  0,
);
const SLUW = `(SELECT id FROM public.campagnes WHERE naam = 'Sluw')`;
check(
  "privérecept kan niet gesponsord worden",
  await doe(
    P1,
    `INSERT INTO public.gesponsorde_items (campagne_id, soort, recipe_id) SELECT ${SLUW}, 'recept', '${PRIVE}'`,
  ),
  "geweigerd",
);
check(
  "misleidend label geweigerd",
  await doe(
    P1,
    `INSERT INTO public.gesponsorde_items (campagne_id, soort, product_naam, label_tekst) SELECT ${SLUW}, 'product', 'X', 'Tip van de chef'`,
  ),
  "geweigerd",
);
check(
  "openbaar recept koppelen aan een concept lukt",
  await doe(
    P1,
    `INSERT INTO public.gesponsorde_items (campagne_id, soort, recipe_id) SELECT ${SLUW}, 'recept', '${OPEN}'`,
  ),
  "gelukt",
);
check(
  "koppelen aan een lopende campagne niet",
  await doe(
    P1,
    `INSERT INTO public.gesponsorde_items (campagne_id, soort, product_naam) VALUES ('${CA}','product','Y')`,
  ),
  "geweigerd",
);

// --- statistiek: alleen aggregaten ---
check(
  "statistiek heeft geen persoonskolom",
  (
    await db.query(
      `SELECT count(*)::int n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gesponsord_statistiek' AND column_name ~ 'user|melder|follower|profiel'`,
    )
  ).rows[0].n,
  0,
);
check(
  "klant ziet de statistiek niet",
  await tel(K, `SELECT count(*)::int n FROM public.gesponsord_statistiek`),
  0,
);
check(
  "klant schrijft geen statistiek rechtstreeks",
  await doe(
    K,
    `INSERT INTO public.gesponsord_statistiek (campagne_id, dag) VALUES ('${CA}', current_date)`,
  ),
  "geweigerd",
);
await als(db, K, (t) => t.query(`SELECT public.gesponsord_tel('${ITEM}', 'vertoning')`));
await als(db, K, (t) => t.query(`SELECT public.gesponsord_tel('${ITEM}', 'klik')`));
check(
  "gesponsord_tel telt +1 op het dagtotaal",
  (
    await db.query(
      `SELECT vertoningen || '/' || klikken AS n FROM public.gesponsord_statistiek WHERE campagne_id = '${CA}' AND dag = current_date`,
    )
  ).rows[0].n,
  "1/1",
);

// --- aanvragen en samenwerkingen ---
check(
  "klant dient een aanvraag in",
  await doe(
    K,
    `INSERT INTO public.partner_aanvragen (user_id, bedrijfsnaam, soort) VALUES ('${K}','Bakkerij K','retail')`,
  ),
  "gelukt",
);
check(
  "klant zet de eigen aanvraag niet op goedgekeurd",
  await doe(
    K,
    `INSERT INTO public.partner_aanvragen (user_id, bedrijfsnaam, soort, status) VALUES ('${K}','Bakkerij K2','retail','goedgekeurd')`,
  ),
  "geweigerd",
);
check(
  "P1 ziet de aanvraag van de klant niet",
  await tel(P1, `SELECT count(*)::int n FROM public.partner_aanvragen`),
  0,
);
check(
  "maker ziet de eigen samenwerking",
  await tel(M, `SELECT count(*)::int n FROM public.samenwerkingen`),
  1,
);
check(
  "P2 ziet de samenwerking van A niet",
  await tel(P2, `SELECT count(*)::int n FROM public.samenwerkingen`),
  0,
);

// --- 0012: abonnementen, facturen, entitlements, betaal_events ---
check(
  "klant ziet het eigen abonnement",
  await tel(K, `SELECT count(*)::int n FROM public.abonnementen`),
  1,
);
check(
  "klant ziet de eigen testfactuur",
  await tel(K, `SELECT count(*)::int n FROM public.facturen`),
  1,
);
check(
  "klant leest het eigen recht",
  await tel(K, `SELECT count(*)::int n FROM public.entitlements`),
  1,
);
check(
  "klant schrijft zichzelf geen recht",
  await doe(
    K,
    `INSERT INTO public.entitlements (user_id, recht) VALUES ('${K}','premium.seizoenskalender')`,
  ),
  "geweigerd",
);
check(
  "klant zet het eigen abonnement niet op actief",
  await doe(K, `UPDATE public.abonnementen SET status = 'actief'`),
  "geweigerd",
);
check(
  "klant ziet geen betaal_events",
  await tel(K, `SELECT count(*)::int n FROM public.betaal_events`),
  0,
);
check(
  "team ziet de betaal_events",
  await tel(T, `SELECT count(*)::int n FROM public.betaal_events`),
  1,
);
check(
  "P2 ziet het abonnement van A niet",
  await tel(P2, `SELECT count(*)::int n FROM public.abonnementen`),
  0,
);
check(
  "finance van A ziet de facturen van A",
  await tel(AN, `SELECT count(*)::int n FROM public.facturen`),
  1,
);
check(
  "eigenaar van A ziet het abonnement van A, niet dat van de klant",
  await tel(P1, `SELECT count(*)::int n FROM public.abonnementen`),
  1,
);
check(
  "zelfde event-id twee keer geweigerd (idempotent)",
  await lukt(
    db.query(
      `INSERT INTO public.betaal_events (event_id, provider, soort, abonnement_ref) VALUES ('evt_1','test','proef_gestart','sub_k')`,
    ),
  ),
  "geweigerd",
);
check(
  "live-modus kan (nog) niet, ook niet voor de server",
  await lukt(
    db.query(
      `INSERT INTO public.abonnementen (user_id, plan, status, modus, provider_ref) VALUES ('${M}','premium_maand','actief','live','sub_live')`,
    ),
  ),
  "geweigerd",
);
check(
  "abonnement voor gebruiker én partner tegelijk geweigerd",
  await lukt(
    db.query(
      `INSERT INTO public.abonnementen (user_id, partner_id, plan, status, provider_ref) VALUES ('${M}','${A}','premium_maand','actief','sub_x')`,
    ),
  ),
  "geweigerd",
);

// --- terugdraaien ---
await db.exec(lees("0012_premium_betalingen.down.sql"));
await db.exec(lees("0011_partners.down.sql"));
check(
  "terugdraaien: alle nieuwe tabellen en functies weg; recepten en makers blijven",
  (
    await db.query(
      `SELECT (to_regclass('public.partners') IS NULL AND to_regclass('public.abonnementen') IS NULL
     AND to_regclass('public.betaal_events') IS NULL AND to_regclass('public.gesponsord_statistiek') IS NULL
     AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('partner_mag','partner_rol','gesponsord_tel','campagne_loopt'))
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipe_publicaties' AND column_name = 'moderatie_reden')
     AND (SELECT count(*) FROM public.recipes) = 2 AND (SELECT count(*) FROM public.creators) = 1)::text n`,
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
