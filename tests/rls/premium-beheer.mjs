/**
 * Test van voorstel 0023 (fase 6: premium en abonnementsbeheer in testmodus) op PGlite, bovenop
 * alle migraties + 0002a + 0008 + 0011 + 0012 + 0017 + 0021 + 0022. K en K2 = gewone gebruikers,
 * P1 = eigenaar van partner A, AN = analist van A, T = Foodlo-team (super_admin).
 *
 *   PGLITE_DIR=<map> node tests/rls/premium-beheer.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");

const K = "a2300000-0000-4000-8000-000000000001";
const K2 = "a2300000-0000-4000-8000-000000000002";
const P1 = "a2300000-0000-4000-8000-000000000003";
const AN = "a2300000-0000-4000-8000-000000000004";
const T = "e11454f4-8b82-4b7a-81a4-4c161b3b222d";
const A = "b2300000-0000-4000-8000-00000000000a";
const ABO_K = "c2300000-0000-4000-8000-000000000001";
const ABO_K2 = "c2300000-0000-4000-8000-000000000002";
const F_K = "d2300000-0000-4000-8000-000000000001";
const F_K2 = "d2300000-0000-4000-8000-000000000002";

const ladder = [
  "0002a_basislijn_recepten_fotos.up.sql",
  "0008_creators_community.up.sql",
  "0011_partners.up.sql",
  "0012_premium_betalingen.up.sql",
  "0017_samenwerking.up.sql",
  "0021_makers_abonnement_community.up.sql",
  "0022_bcc_testmodus.up.sql",
];
const { db, fouten } = await bouwDatabank({
  extraNaMigraties: [...ladder, "0023_premium_beheer.up.sql"].map(lees).join("\n"),
});
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}

// Opzet als server (geen auth.uid()).
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${K}','k@voorbeeld.test'),('${K2}','k2@voorbeeld.test'),('${P1}','p1@voorbeeld.test'),
    ('${AN}','an@voorbeeld.test'),('${T}','t@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES
    ('${K}','K'),('${K2}','K2'),('${P1}','P1'),('${AN}','AN'),('${T}','T') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.admin_users (user_id, role, active, read_only) VALUES ('${T}','super_admin',true,false);
  INSERT INTO public.partners (id, naam, soort, verificatie_status) VALUES ('${A}','Hoeve A','producent','geverifieerd');
  INSERT INTO public.partner_leden (partner_id, user_id, rol) VALUES ('${A}','${P1}','eigenaar'),('${A}','${AN}','analist');
  INSERT INTO public.abonnementen (id, user_id, plan, status, provider_ref, periode_einde) VALUES
    ('${ABO_K}','${K}','premium_jaar','actief','sub_k', current_date + 365),
    ('${ABO_K2}','${K2}','premium_maand','betaling_mislukt','sub_k2', current_date + 3);
  UPDATE public.abonnementen SET genade_tot = current_date + 7 WHERE id = '${ABO_K2}';
  INSERT INTO public.abonnementen (partner_id, plan, status, provider_ref) VALUES ('${A}','partner_plus','actief','sub_a');
  INSERT INTO public.facturen (id, user_id, abonnement_id, nummer, omschrijving, bedrag_cent, btw_cent, status) VALUES
    ('${F_K}','${K}','${ABO_K}','TEST-23-1','Premium jaar',4990,866,'betaald'),
    ('${F_K2}','${K2}','${ABO_K2}','TEST-23-2','Premium maand',499,87,'betaald');
  INSERT INTO public.facturen (user_id, nummer, omschrijving, bedrag_cent, btw_cent, status, soort, verwijst_naar) VALUES
    ('${K2}','TEST-23-3','Terugbetaling TEST-23-2',499,87,'betaald','creditnota','${F_K2}');
  INSERT INTO public.facturen (partner_id, nummer, omschrijving, bedrag_cent, btw_cent, status) VALUES
    ('${A}','TEST-23-4','Partner Plus',4900,850,'betaald');
  INSERT INTO public.entitlements (user_id, recht, geldig_tot) VALUES
    ('${K}','premium.weekmenu_extra', current_date + 365),('${K}','premium.seizoenskalender', current_date + 365);
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
/** Gewijzigde rijen, of "geweigerd" als de databank het verbiedt (beide = veilig). */
const geschreven = (wie, sql) =>
  als(
    db,
    wie,
    async (t) =>
      (await t.query(`WITH u AS (${sql} RETURNING 1) SELECT count(*)::int n FROM u`)).rows[0].n,
  ).then(
    (n) => (n === 0 ? "niets" : `${n} rijen`),
    () => "niets",
  );

// --- facturen: alleen de eigen ---
check(
  "K ziet alleen zijn eigen factuur",
  await tel(K, `SELECT count(*)::int n FROM public.facturen`),
  1,
);
check(
  "K2 ziet zijn factuur en creditnota, niet die van K",
  await tel(K2, `SELECT count(*)::int n FROM public.facturen`),
  2,
);
check(
  "K ziet de creditnota van K2 niet",
  await tel(K, `SELECT count(*)::int n FROM public.facturen WHERE soort = 'creditnota'`),
  0,
);
check(
  "eigenaar P1 ziet de factuur van zijn organisatie",
  await tel(P1, `SELECT count(*)::int n FROM public.facturen`),
  1,
);
check(
  "analist AN ziet geen facturen van de organisatie",
  await tel(AN, `SELECT count(*)::int n FROM public.facturen`),
  0,
);
check("anon leest geen facturen", await doe(null, `SELECT 1 FROM public.facturen`), "geweigerd");
check(
  "team (beheer) leest alle facturen",
  await tel(T, `SELECT count(*)::int n FROM public.facturen`),
  4,
);
check(
  "btw staat apart op de factuur",
  await tel(K, `SELECT btw_cent::int n FROM public.facturen`),
  866,
);

// --- de app schrijft zelf niets ---
check(
  "K maakt zelf geen recht aan",
  await doe(
    K,
    `INSERT INTO public.entitlements (user_id, recht) VALUES ('${K}','premium.weekmenu_extra')`,
  ),
  "geweigerd",
);
check(
  "K2 geeft zichzelf geen Premium",
  await doe(
    K2,
    `INSERT INTO public.entitlements (user_id, recht, geldig_tot) VALUES ('${K2}','premium.seizoenskalender', current_date + 999)`,
  ),
  "geweigerd",
);
check(
  "K verlengt zijn eigen recht niet",
  await geschreven(K, `UPDATE public.entitlements SET geldig_tot = NULL WHERE user_id = '${K}'`),
  "niets",
);
check(
  "K wist zijn eigen recht niet (ook niet om een ander te krijgen)",
  await geschreven(K, `DELETE FROM public.entitlements WHERE user_id = '${K}'`),
  "niets",
);
check(
  "K maakt geen factuur of creditnota",
  await doe(
    K,
    `INSERT INTO public.facturen (user_id, nummer, omschrijving, bedrag_cent, status, soort, verwijst_naar) VALUES ('${K}','VALS','x',4990,'betaald','creditnota','${F_K}')`,
  ),
  "geweigerd",
);
check(
  "K wijzigt het bedrag van zijn factuur niet",
  await geschreven(K, `UPDATE public.facturen SET bedrag_cent = 0 WHERE id = '${F_K}'`),
  "niets",
);
check(
  "K2 zet zijn mislukte betaling niet zelf op actief",
  await geschreven(
    K2,
    `UPDATE public.abonnementen SET status = 'actief', genade_tot = NULL WHERE id = '${ABO_K2}'`,
  ),
  "niets",
);
check(
  "K2 verlengt zijn genadeperiode niet",
  await geschreven(
    K2,
    `UPDATE public.abonnementen SET genade_tot = current_date + 99 WHERE id = '${ABO_K2}'`,
  ),
  "niets",
);
check(
  "K ziet het abonnement van K2 niet",
  await tel(K, `SELECT count(*)::int n FROM public.abonnementen WHERE id = '${ABO_K2}'`),
  0,
);

// --- plannen: iedereen leest, niemand schrijft ---
check("K leest de vier plannen", await tel(K, `SELECT count(*)::int n FROM public.plannen`), 4);
check("anon leest geen plannen", await doe(null, `SELECT 1 FROM public.plannen`), "geweigerd");
check(
  "K maakt Premium niet gratis",
  await geschreven(K, `UPDATE public.plannen SET prijs_cent = 0 WHERE id = 'premium_maand'`),
  "niets",
);
check(
  "K voegt geen plan toe",
  await doe(
    K,
    `INSERT INTO public.plannen (id, naam, voor, interval, prijs_cent) VALUES ('gratis_alles','Alles','consument','maand',0)`,
  ),
  "geweigerd",
);
check(
  "het team schrijft plannen ook niet via de app",
  await geschreven(T, `UPDATE public.plannen SET prijs_cent = 1 WHERE id = 'premium_maand'`),
  "niets",
);
check(
  "plannen bevatten de rechten van premium",
  await tel(
    K,
    `SELECT array_to_string(rechten, ',') n FROM public.plannen WHERE id = 'premium_jaar'`,
  ),
  "premium.weekmenu_extra,premium.seizoenskalender",
);

// --- vaste regels (ook voor de server) ---
check(
  "server: een plan in live-modus kan niet",
  await server(
    `INSERT INTO public.plannen (id, naam, voor, interval, prijs_cent, modus) VALUES ('echt','Echt','consument','maand',499,'live')`,
  ),
  "geweigerd",
);
check(
  "server: een creditnota zonder verwijzing kan niet",
  await server(
    `INSERT INTO public.facturen (user_id, nummer, omschrijving, bedrag_cent, status, soort) VALUES ('${K}','TEST-23-9','x',100,'betaald','creditnota')`,
  ),
  "geweigerd",
);
check(
  "server: een tweede creditnota voor dezelfde factuur kan niet",
  await server(
    `INSERT INTO public.facturen (user_id, nummer, omschrijving, bedrag_cent, status, soort, verwijst_naar) VALUES ('${K2}','TEST-23-8','x',499,'betaald','creditnota','${F_K2}')`,
  ),
  "geweigerd",
);
check(
  "server: btw groter dan het bedrag kan niet",
  await server(
    `INSERT INTO public.facturen (user_id, nummer, omschrijving, bedrag_cent, btw_cent, status) VALUES ('${K}','TEST-23-7','x',100,200,'betaald')`,
  ),
  "geweigerd",
);
check(
  "server: btw-tarief boven 30 % kan niet",
  await server(
    `INSERT INTO public.facturen (user_id, nummer, omschrijving, bedrag_cent, btw_procent, status) VALUES ('${K}','TEST-23-6','x',100,45,'betaald')`,
  ),
  "geweigerd",
);
check(
  "server: een echte (niet-test)factuur kan nog steeds niet",
  await server(
    `INSERT INTO public.facturen (user_id, nummer, omschrijving, bedrag_cent, status, test) VALUES ('${K}','ECHT-1','x',100,'betaald',false)`,
  ),
  "geweigerd",
);
check(
  "server: genadeperiode alleen bij een mislukte betaling",
  await server(
    `UPDATE public.abonnementen SET genade_tot = current_date + 7 WHERE id = '${ABO_K}'`,
  ),
  "geweigerd",
);
check(
  "server: onbekend gepland plan kan niet",
  await server(
    `UPDATE public.abonnementen SET gepland_plan = 'partner_plus' WHERE id = '${ABO_K}'`,
  ),
  "geweigerd",
);
check(
  "server: overstap naar maandelijks plannen lukt",
  await server(
    `UPDATE public.abonnementen SET gepland_plan = 'premium_maand' WHERE id = '${ABO_K}'`,
  ),
  "gelukt",
);
check(
  "server: hetzelfde recht twee keer uit dezelfde bron kan niet",
  await server(
    `INSERT INTO public.entitlements (user_id, recht) VALUES ('${K}','premium.weekmenu_extra')`,
  ),
  "geweigerd",
);
check(
  "server: een live-abonnement kan nog steeds niet",
  await server(
    `INSERT INTO public.abonnementen (user_id, plan, status, modus, provider_ref) VALUES ('${K2}','premium_jaar','actief','live','sub_live')`,
  ),
  "geweigerd",
);
check(
  "server: een factuur met creditnota kan niet gewist worden (spoor blijft)",
  await server(`DELETE FROM public.facturen WHERE id = '${F_K2}'`),
  "geweigerd",
);

// --- terugdraaien ---
await db.exec(lees("0023_premium_beheer.down.sql"));
check(
  "terugdraaien: plannen en nieuwe kolommen weg; facturen, abonnementen en rechten blijven",
  (
    await db.query(
      `SELECT (to_regclass('public.plannen') IS NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturen' AND column_name IN ('soort','btw_cent','btw_procent','verwijst_naar'))
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'abonnementen' AND column_name IN ('genade_tot','gepland_plan'))
     AND (SELECT count(*) FROM public.facturen) = 4
     AND (SELECT count(*) FROM public.abonnementen) = 3
     AND (SELECT count(*) FROM public.entitlements) = 2
     AND (SELECT count(*) FROM public.facturen WHERE omschrijving LIKE 'CREDITNOTA:%') = 1
     AND (SELECT plan FROM public.abonnementen WHERE id = '${ABO_K}') = 'premium_maand')::text n`,
    )
  ).rows[0].n,
  "true",
);
check(
  "na terugdraaien geldt de plan-CHECK van 0012 weer",
  await server(
    `INSERT INTO public.abonnementen (user_id, plan, status, provider_ref) VALUES ('${K2}','premium_jaar','actief','sub_x')`,
  ),
  "geweigerd",
);
check(
  "na terugdraaien schrijft K nog steeds geen rechten",
  await doe(
    K,
    `INSERT INTO public.entitlements (user_id, recht) VALUES ('${K}','premium.weekmenu_extra')`,
  ),
  "geweigerd",
);
await db.exec(["0023_premium_beheer.up.sql"].map(lees).join("\n"));
check("opnieuw heen na terug lukt", await tel(K, `SELECT count(*)::int n FROM public.plannen`), 4);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(
  `\n${resultaten.length - mis}/${resultaten.length} zoals verwacht, ${mis} afwijking(en)`,
);
process.exit(mis ? 1 : 0);
