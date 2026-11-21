/**
 * Test van voorstel 0022 (fase 5: Business Control Center in testmodus) op PGlite, bovenop alle
 * migraties + 0002a + 0008 + 0011 + 0012 + 0021. P1 = eigenaar van partner A, AN = analist van A,
 * P2 = eigenaar van partner B, K = gewone gebruiker, M = maker, T = Foodlo-team (super_admin).
 *
 *   PGLITE_DIR=<map> node tests/rls/bcc-testmodus.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");

const P1 = "a2200000-0000-4000-8000-000000000001";
const AN = "a2200000-0000-4000-8000-000000000002";
const P2 = "a2200000-0000-4000-8000-000000000003";
const K = "a2200000-0000-4000-8000-000000000004";
const M = "a2200000-0000-4000-8000-000000000005";
const T = "e11454f4-8b82-4b7a-81a4-4c161b3b222d";
const A = "b2200000-0000-4000-8000-00000000000a";
const B = "b2200000-0000-4000-8000-00000000000b";
const CM = "c2200000-0000-4000-8000-000000000001";
const CA = "e2200000-0000-4000-8000-000000000001"; // concept, partner A
const CB = "e2200000-0000-4000-8000-000000000002"; // concept, partner B
const AV = "f2200000-0000-4000-8000-000000000001"; // aanvraag van K

const ladder = [
  "0002a_basislijn_recepten_fotos.up.sql",
  "0008_creators_community.up.sql",
  "0011_partners.up.sql",
  "0012_premium_betalingen.up.sql",
  "0017_samenwerking.up.sql",
  "0021_makers_abonnement_community.up.sql",
];
const { db, fouten } = await bouwDatabank({
  extraNaMigraties: [...ladder, "0022_bcc_testmodus.up.sql"].map(lees).join("\n"),
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
  INSERT INTO public.creators (id, user_id, handle, naam) VALUES ('${CM}','${M}','chef-m','Chef M');
  INSERT INTO public.partners (id, naam, soort, verificatie_status) VALUES
    ('${A}','Hoeve A','producent','geverifieerd'),('${B}','Merk B','merk','geverifieerd');
  INSERT INTO public.partner_leden (partner_id, user_id, rol) VALUES
    ('${A}','${P1}','eigenaar'),('${A}','${AN}','analist'),('${B}','${P2}','eigenaar');
  INSERT INTO public.campagnes (id, partner_id, naam, status, start, einde, testbudget_cent) VALUES
    ('${CA}','${A}','Herfst','concept', current_date, current_date + 10, 25000),
    ('${CB}','${B}','Winter','concept', current_date, current_date + 10, 9900);
  INSERT INTO public.facturen (partner_id, campagne_id, nummer, omschrijving, bedrag_cent, status) VALUES
    ('${A}','${CA}','TEST-A1','Campagne Herfst: testbudget',25000,'open'),
    ('${B}','${CB}','TEST-B1','Campagne Winter: testbudget',9900,'open');
  INSERT INTO public.partner_aanvragen (id, user_id, bedrijfsnaam, soort) VALUES ('${AV}','${K}','Bakkerij K','producent');
  INSERT INTO public.admin_audit_log (actor_id, actor_role, action, entity_type) VALUES ('${T}','super_admin','test.start','test');
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
const server = (sql) => lukt(db.exec(sql));
const aantal = (wie, sql) =>
  als(
    db,
    wie,
    async (t) =>
      (await t.query(`WITH u AS (${sql} RETURNING 1) SELECT count(*)::int n FROM u`)).rows[0].n,
  );

// --- partneraanvragen: alleen de server beslist, afwijzen vraagt een reden ---
check(
  "K keurt de eigen aanvraag niet zelf goed",
  await doe(K, `UPDATE public.partner_aanvragen SET status = 'goedgekeurd' WHERE id = '${AV}'`),
  "geweigerd",
);
check(
  "ook beheer (T) wijzigt een aanvraag niet rechtstreeks: alleen via de server",
  await doe(T, `UPDATE public.partner_aanvragen SET status = 'goedgekeurd' WHERE id = '${AV}'`),
  "geweigerd",
);
check(
  "K dient geen aanvraag in die al goedgekeurd is",
  await doe(
    K,
    `INSERT INTO public.partner_aanvragen (user_id, bedrijfsnaam, soort, status) VALUES ('${K}','Slim','merk','goedgekeurd')`,
  ),
  "geweigerd",
);
check(
  "server: afwijzen zonder reden kan niet (CHECK)",
  await server(`UPDATE public.partner_aanvragen SET status = 'geweigerd' WHERE id = '${AV}'`),
  "geweigerd",
);
check(
  "server: afwijzen met reden lukt en bewaart wie en wanneer",
  await server(
    `UPDATE public.partner_aanvragen SET status = 'geweigerd', beoordeling_reden = 'Geen voedingsbedrijf', beoordeeld_door = '${T}', beoordeeld_op = now() WHERE id = '${AV}'`,
  ),
  "gelukt",
);
check(
  "K ziet de reden van de eigen aanvraag",
  await tel(
    K,
    `SELECT count(*)::int n FROM public.partner_aanvragen WHERE beoordeling_reden = 'Geen voedingsbedrijf'`,
  ),
  1,
);
check(
  "P2 ziet de aanvraag van K niet",
  await tel(P2, `SELECT count(*)::int n FROM public.partner_aanvragen`),
  0,
);

// --- campagnes: testbudget per organisatie, na indienen vast ---
check(
  "P1 zet het testbudget van het eigen concept",
  await aantal(P1, `UPDATE public.campagnes SET testbudget_cent = 30000 WHERE id = '${CA}'`),
  1,
);
check(
  "P2 wijzigt het testbudget van A niet",
  await aantal(P2, `UPDATE public.campagnes SET testbudget_cent = 1 WHERE id = '${CA}'`),
  0,
);
check(
  "P2 ziet de campagne (en het budget) van A niet",
  await tel(P2, `SELECT count(*)::int n FROM public.campagnes WHERE id = '${CA}'`),
  0,
);
check(
  "negatief testbudget kan niet",
  await doe(P1, `UPDATE public.campagnes SET testbudget_cent = -5 WHERE id = '${CA}'`),
  "geweigerd",
);
await als(db, P1, (t) =>
  t.query(`UPDATE public.campagnes SET status = 'ingediend' WHERE id = '${CA}'`),
);
check(
  "na indienen wijzigt P1 het testbudget niet meer",
  await doe(P1, `UPDATE public.campagnes SET testbudget_cent = 1 WHERE id = '${CA}'`),
  "geweigerd",
);
check(
  "P1 keurt de eigen campagne niet goed",
  await doe(P1, `UPDATE public.campagnes SET status = 'goedgekeurd' WHERE id = '${CA}'`),
  "geweigerd",
);

// --- testfacturen: alleen eigen organisatie, alleen met recht abonnement ---
check(
  "P1 (eigenaar A) ziet de testfactuur van A",
  await tel(P1, `SELECT count(*)::int n FROM public.facturen WHERE campagne_id IS NOT NULL`),
  1,
);
check(
  "AN (analist A) ziet geen facturen",
  await tel(AN, `SELECT count(*)::int n FROM public.facturen`),
  0,
);
check(
  "P2 ziet de factuur van A niet",
  await tel(P2, `SELECT count(*)::int n FROM public.facturen WHERE partner_id = '${A}'`),
  0,
);
check(
  "een factuur die geen test is, kan niet (0012)",
  await server(
    `INSERT INTO public.facturen (partner_id, nummer, omschrijving, bedrag_cent, status, test) VALUES ('${A}','LIVE-1','Echt',100,'betaald',false)`,
  ),
  "geweigerd",
);

// --- teamuitnodigingen: alleen de server; nooit eigenaar; geen dubbel ---
check(
  "server: uitnodiging als moderator",
  await server(
    `INSERT INTO public.beheer_uitnodigingen (email, rol, uitgenodigd_door) VALUES ('mod@voorbeeld.test','content_manager','${T}')`,
  ),
  "gelukt",
);
check(
  "T (ingelogd, niet via de server) leest de uitnodigingen niet",
  await doe(T, `SELECT 1 FROM public.beheer_uitnodigingen`),
  "geweigerd",
);
check(
  "K maakt geen uitnodiging",
  await doe(
    K,
    `INSERT INTO public.beheer_uitnodigingen (email, rol) VALUES ('k2@voorbeeld.test','admin')`,
  ),
  "geweigerd",
);
check(
  "niemand wordt als eigenaar uitgenodigd",
  await server(
    `INSERT INTO public.beheer_uitnodigingen (email, rol) VALUES ('baas@voorbeeld.test','super_admin')`,
  ),
  "geweigerd",
);
check(
  "geen tweede open uitnodiging voor hetzelfde adres (hoofdletters tellen niet)",
  await server(
    `INSERT INTO public.beheer_uitnodigingen (email, rol) VALUES ('MOD@voorbeeld.test','analyst')`,
  ),
  "geweigerd",
);
check(
  "geen ongeldig e-mailadres",
  await server(
    `INSERT INTO public.beheer_uitnodigingen (email, rol) VALUES ('geen-adres','analyst')`,
  ),
  "geweigerd",
);
check(
  "status 'verstuurd' bestaat niet (er wordt nooit gemaild)",
  await server(
    `INSERT INTO public.beheer_uitnodigingen (email, rol, status) VALUES ('x@voorbeeld.test','analyst','verstuurd')`,
  ),
  "geweigerd",
);
await db.exec(`UPDATE public.beheer_uitnodigingen SET status = 'ingetrokken'`);
check(
  "na intrekken kan hetzelfde adres opnieuw",
  await server(
    `INSERT INTO public.beheer_uitnodigingen (email, rol) VALUES ('mod@voorbeeld.test','analyst')`,
  ),
  "gelukt",
);

// --- makeruitbetalingen: alleen testmodus, maker ziet alleen de eigen rij ---
check(
  "server: testuitbetaling vastleggen (som klopt)",
  await server(
    `INSERT INTO public.maker_uitbetalingen (creator_id, maand, bruto_cent, btw_cent, betaalkosten_cent, platform_cent, maker_cent, platform_procent)
     VALUES ('${CM}', date_trunc('month', current_date)::date, 399, 69, 31, 50, 249, 15)`,
  ),
  "gelukt",
);
check(
  "M (maker) ziet de eigen testuitbetaling",
  await tel(M, `SELECT count(*)::int n FROM public.maker_uitbetalingen`),
  1,
);
check(
  "K ziet de uitbetalingen van M niet",
  await tel(K, `SELECT count(*)::int n FROM public.maker_uitbetalingen`),
  0,
);
check(
  "M zet zelf geen uitbetaling klaar",
  await doe(
    M,
    `INSERT INTO public.maker_uitbetalingen (creator_id, maand, bruto_cent, btw_cent, betaalkosten_cent, platform_cent, maker_cent, platform_procent)
     VALUES ('${CM}', '2026-01-01', 1, 0, 0, 0, 1, 0)`,
  ),
  "geweigerd",
);
check(
  "M wijzigt het eigen makerdeel niet",
  await doe(M, `UPDATE public.maker_uitbetalingen SET maker_cent = 399`),
  "geweigerd",
);
check(
  "status 'uitbetaald' kan niet: er wordt niets echt uitbetaald",
  await server(
    `INSERT INTO public.maker_uitbetalingen (creator_id, maand, bruto_cent, btw_cent, betaalkosten_cent, platform_cent, maker_cent, platform_procent, status)
     VALUES ('${CM}', '2026-01-01', 100, 0, 0, 0, 100, 0, 'uitbetaald')`,
  ),
  "geweigerd",
);
check(
  "KYC kan niet op 'gecontroleerd' (geen KYC-provider)",
  await server(
    `INSERT INTO public.maker_uitbetalingen (creator_id, maand, bruto_cent, btw_cent, betaalkosten_cent, platform_cent, maker_cent, platform_procent, kyc)
     VALUES ('${CM}', '2026-01-01', 100, 0, 0, 0, 100, 0, 'gecontroleerd')`,
  ),
  "geweigerd",
);
check(
  "test = false kan niet",
  await server(
    `INSERT INTO public.maker_uitbetalingen (creator_id, maand, bruto_cent, btw_cent, betaalkosten_cent, platform_cent, maker_cent, platform_procent, test)
     VALUES ('${CM}', '2026-01-01', 100, 0, 0, 0, 100, 0, false)`,
  ),
  "geweigerd",
);
check(
  "de delen moeten exact optellen tot het bruto bedrag",
  await server(
    `INSERT INTO public.maker_uitbetalingen (creator_id, maand, bruto_cent, btw_cent, betaalkosten_cent, platform_cent, maker_cent, platform_procent)
     VALUES ('${CM}', '2026-01-01', 399, 69, 31, 50, 300, 15)`,
  ),
  "geweigerd",
);
check(
  "platformpercentage boven 50 kan niet",
  await server(
    `INSERT INTO public.maker_uitbetalingen (creator_id, maand, bruto_cent, btw_cent, betaalkosten_cent, platform_cent, maker_cent, platform_procent)
     VALUES ('${CM}', '2026-01-01', 100, 0, 0, 0, 100, 60)`,
  ),
  "geweigerd",
);
check(
  "maand moet de eerste van de maand zijn",
  await server(
    `INSERT INTO public.maker_uitbetalingen (creator_id, maand, bruto_cent, btw_cent, betaalkosten_cent, platform_cent, maker_cent, platform_procent)
     VALUES ('${CM}', '2026-01-15', 100, 0, 0, 0, 100, 0)`,
  ),
  "geweigerd",
);

// --- auditlog: alleen invoegen ---
check(
  "K schrijft niet in het auditlog",
  await doe(K, `INSERT INTO public.admin_audit_log (action, entity_type) VALUES ('vals','x')`),
  "geweigerd",
);
check(
  "T (ingelogd) schrijft niet rechtstreeks in het auditlog",
  await doe(T, `INSERT INTO public.admin_audit_log (action, entity_type) VALUES ('vals','x')`),
  "geweigerd",
);
check(
  "K leest geen enkele regel van het auditlog (0 rijen of geweigerd)",
  await tel(K, `SELECT count(*)::int n FROM public.admin_audit_log`).then(
    (n) => (n === 0 ? "niets" : `${n} rijen`),
    () => "niets",
  ),
  "niets",
);
check(
  "server: invoegen lukt",
  await server(
    `INSERT INTO public.admin_audit_log (actor_id, actor_role, action, entity_type) VALUES ('${T}','super_admin','partner.aanvraag.geweigerd','partner_aanvraag')`,
  ),
  "gelukt",
);
check(
  "server: wijzigen kan niet",
  await server(`UPDATE public.admin_audit_log SET action = 'weg'`),
  "geweigerd",
);
check("server: wissen kan niet", await server(`DELETE FROM public.admin_audit_log`), "geweigerd");
check(
  "server: leegmaken (TRUNCATE) kan niet",
  await server(`TRUNCATE public.admin_audit_log`),
  "geweigerd",
);

// --- centrale instelling ---
check(
  "standaardverdeling: platform 15 %",
  (
    await db.query(
      `SELECT value::text n FROM public.platform_settings WHERE key = 'maker_platform_procent'`,
    )
  ).rows[0]?.n,
  "15",
);

// --- terugdraaien ---
await db.exec(lees("0022_bcc_testmodus.down.sql"));
check(
  "terugdraaien: nieuwe tabellen, kolommen en instelling weg; partners, facturen en auditlog blijven",
  (
    await db.query(
      `SELECT (to_regclass('public.beheer_uitnodigingen') IS NULL AND to_regclass('public.maker_uitbetalingen') IS NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campagnes' AND column_name = 'testbudget_cent')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturen' AND column_name = 'campagne_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_aanvragen' AND column_name = 'beoordeling_reden')
     AND NOT EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'maker_platform_procent')
     AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'block_audit_truncate')
     AND (SELECT count(*) FROM public.partners) = 2 AND (SELECT count(*) FROM public.facturen) = 2
     AND (SELECT count(*) FROM public.admin_audit_log) = 2)::text n`,
    )
  ).rows[0].n,
  "true",
);
check(
  "na terugdraaien blijft het auditlog onwijzigbaar (bestaande trigger)",
  await server(`UPDATE public.admin_audit_log SET action = 'weg'`),
  "geweigerd",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(
  `\n${resultaten.length - mis}/${resultaten.length} zoals verwacht, ${mis} afwijking(en)`,
);
process.exit(mis ? 1 : 0);
