/**
 * Alle RLS-tests in één keer, met de verwachte uitkomst per variant:
 * - huidige migraties: recepten en beheer tonen de lekken (exit 1), gezin klopt (exit 0);
 * - met het migratievoorstel 0002: alles veilig (exit 0);
 * - voorstel heen + terug: exact dezelfde stand als nu (exit 1/1/0 zoals de huidige migraties).
 *
 *   npm install --prefix /tmp/pglite @electric-sql/pglite@0.5.12     (eenmalig, buiten de repo)
 *   PGLITE_DIR=/tmp/pglite node tests/rls/alles.mjs
 *
 * Exitcode 0 = elke test gaf de verwachte exitcode.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const VOORSTEL = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(VOORSTEL, n), "utf8");
const MAP = mkdtempSync(path.join(tmpdir(), "rls-"));
const schrijf = (naam, delen) => {
  const p = path.join(MAP, naam);
  writeFileSync(p, delen.map(lees).join("\n"));
  return p;
};
// 0002a: basislijn recepten/foto's (alleen nieuwe omgevingen; productie heeft dit al).
// 0002: beheerdersrechten, feedback, is_admin, claim_first_admin.
const BASIS = schrijf("basis.sql", ["0002a_basislijn_recepten_fotos.up.sql"]);
const BEHEER = schrijf("beheer.sql", ["0002_rollen_en_rls.up.sql"]);
const SAMEN = schrijf("samen.sql", [
  "0002a_basislijn_recepten_fotos.up.sql",
  "0002_rollen_en_rls.up.sql",
]);
const HEEN_TERUG = schrijf("heen-terug.sql", [
  "0002a_basislijn_recepten_fotos.up.sql",
  "0002_rollen_en_rls.up.sql",
  "0002_rollen_en_rls.down.sql",
  "0002a_basislijn_recepten_fotos.down.sql",
]);

// 0004: weekmenuvoorkeuren niet meer leesbaar voor gezinsleden/uitnodigers (BUG-119).
const PRIVE = schrijf("prive.sql", [
  "0002a_basislijn_recepten_fotos.up.sql",
  "0004_profielinstellingen_prive.up.sql",
]);
const PRIVE_HT = schrijf("prive-ht.sql", [
  "0002a_basislijn_recepten_fotos.up.sql",
  "0004_profielinstellingen_prive.up.sql",
  "0004_profielinstellingen_prive.down.sql",
]);
// 0006/0007: Foodloapp Intelligence (feedback, houdbaarheid), samen met alle andere voorstellen.
const ALLE_VOORSTELLEN = schrijf("alle-voorstellen.sql", [
  "0002a_basislijn_recepten_fotos.up.sql",
  "0002_rollen_en_rls.up.sql",
  "0004_profielinstellingen_prive.up.sql",
  "0006_aanbeveling_feedback.up.sql",
  "0007_voorraad_houdbaarheid.up.sql",
  "0008_creators_community.up.sql",
  "0009_persoonlijke_voeding.up.sql",
  "0010_huishouden_leden.up.sql",
  "0011_partners.up.sql",
  "0012_premium_betalingen.up.sql",
  "0013_planprofiel.up.sql",
  "0014_budget_weken.up.sql",
  "0015_kookmomenten.up.sql",
  "0016_suggestie_instellingen.up.sql",
  "0017_samenwerking.up.sql",
  "0018_gezinslijst_kijker.up.sql",
  "0019_restjes.up.sql",
  "0020_voorraad_plek.up.sql",
  "0021_makers_abonnement_community.up.sql",
  "0022_bcc_testmodus.up.sql",
  "0023_premium_beheer.up.sql",
  "0024_ai_gebruik_mandjes.up.sql",
  "0025_privacy_toestemmingen_rechten.up.sql",
]);

const gevallen = [
  ["rls-recepten.mjs", null, 1, "repo-migraties: BUG-105/106 aanwezig (productie heeft dit NIET)"],
  [
    "rls-beheer.mjs",
    null,
    1,
    "repo-migraties: BUG-097/S7/S8 aanwezig (toekomstscenario teamleden)",
  ],
  ["rls-gezin.mjs", null, 0, "repo-migraties: gezinsrechten correct"],
  ["rls-recepten.mjs", BASIS, 0, "0002a basislijn: recepten en foto's veilig"],
  ["rls-recepten.mjs", BEHEER, 1, "0002 alleen: raakt recepten/foto's niet (bewust)"],
  ["rls-beheer.mjs", BEHEER, 0, "0002: beheer, feedback, is_admin veilig"],
  ["rls-recepten.mjs", SAMEN, 0, "0002a + 0002: recepten en foto's veilig"],
  ["rls-beheer.mjs", SAMEN, 0, "0002a + 0002: beheer veilig"],
  ["rls-gezin.mjs", SAMEN, 0, "0002a + 0002: gezinsrechten ongewijzigd"],
  ["rls-recepten.mjs", HEEN_TERUG, 1, "heen+terug: zelfde stand als de repo"],
  ["rls-beheer.mjs", HEEN_TERUG, 1, "heen+terug: zelfde stand als de repo"],
  ["rls-gezin.mjs", HEEN_TERUG, 0, "heen+terug: zelfde stand als de repo"],
  ["rls-gezin-privacy.mjs", null, 1, "repo: recepten (BUG-105) + weekmenu (BUG-119) leesbaar"],
  ["rls-gezin-privacy.mjs", BASIS, 1, "0002a: alleen voorraad + weekmenu (BUG-119) open"],
  ["rls-gezin-privacy.mjs", PRIVE, 0, "0002a + 0004: alleen de gedeelde voorraad (BUG-112)"],
  ["rls-gezin-privacy.mjs", PRIVE_HT, 1, "0004 heen+terug: weekmenu weer leesbaar"],
  ["bewaartermijnen-inhoud.mjs", null, 0, "voorstel 0003b: inhoud en contact, heen+terug"],
  ["bewaartermijnen.mjs", null, 0, "voorstel 0003: opruiming, rechten, heen+terug"],
  [
    "intelligentie-voorstellen.mjs",
    null,
    0,
    "voorstellen 0006 + 0007: rechten, opruiming, heen+terug",
  ],
  [
    "rls-gezin-privacy.mjs",
    ALLE_VOORSTELLEN,
    0,
    "0002a + 0002 + 0004 + 0006 … 0025: alleen de voorraad",
  ],
  [
    "makers-community.mjs",
    null,
    0,
    "voorstel 0008: makers, publiceren, volgen, verzamelingen, community, meldingen, heen+terug",
  ],
  [
    "huishouden-voeding.mjs",
    null,
    0,
    "voorstellen 0009 + 0010: eigen voeding, gezinsleden, voeding per lid, oordeel zonder reden, heen+terug",
  ],
  [
    "partners-premium.mjs",
    null,
    0,
    "voorstellen 0011 + 0012: partners per organisatie, campagnes, gesponsord, statistiek, abonnementen, heen+terug",
  ],
  [
    "planprofiel.mjs",
    null,
    0,
    "voorstel 0013: planprofiel alleen eigen rij, vereisten volgen het recept, heen+terug",
  ],
  [
    "budget-weken.mjs",
    null,
    0,
    "voorstel 0014: budgetgeschiedenis alleen eigen rijen, één rij per week, heen+terug",
  ],
  [
    "kookmomenten.mjs",
    null,
    0,
    "voorstel 0015: kookmomenten alleen eigen rijen, één per maaltijd, receptversies van de eigenaar, heen+terug",
  ],
  [
    "suggesties.mjs",
    null,
    0,
    "voorstel 0016: suggestie-instellingen alleen eigen rij, vaste soorten, heen+terug",
  ],
  [
    "samenwerking.mjs",
    null,
    0,
    "voorstel 0017: toewijzingen, meldingen, activiteitslog alleen binnen het eigen gezin, kijker verdeelt niet, heen+terug",
  ],
  [
    "gezinslijst-kijker.mjs",
    null,
    0,
    "voorstel 0018 (BUG-163): lek aangetoond, kijker mag na 0018 alleen afvinken, heen+terug",
  ],
  [
    "restjes.mjs",
    null,
    0,
    "voorstel 0019: restjes eigen + actief gezin, ander gezin niets, afloop, vaste velden, heen+terug",
  ],
  [
    "voorraad-plek.mjs",
    null,
    0,
    "voorstel 0020: plek in de voorraad, vaste waarden, eigen rijen, heen+terug",
  ],
  [
    "makers-abonnement.mjs",
    null,
    0,
    "voorstel 0021: exclusief alleen met abonnement, maker ziet abonnees zonder betaalgegevens, testmodus verplicht, reacties/foto's/blokkeren, meldingen, heen+terug",
  ],
  [
    "bcc-testmodus.mjs",
    null,
    0,
    "voorstel 0022: aanvragen alleen via de server, testbudget per organisatie, testfacturen, uitnodigingen zonder e-mail, uitbetalingen alleen testmodus, auditlog alleen-invoegen, heen+terug",
  ],
  [
    "premium-beheer.mjs",
    null,
    0,
    "voorstel 0023: alleen eigen facturen, rechten/plannen/abonnementen niet door de app te schrijven, creditnota en btw-regels, testmodus verplicht, heen+terug",
  ],
  [
    "ai-gebruik-mandjes.mjs",
    null,
    0,
    "voorstel 0024: AI-gebruik alleen eigen dagtotaal via ai_gebruik_tel (vaste soorten, plafond), anoniem totaal alleen server, testmandjes eigen + testmodus verplicht, heen+terug",
  ],
  [
    "privacy-0025.mjs",
    null,
    0,
    "voorstel 0025 (BUG-164): kijker schrijft niet meer bij een ander, toestemmingen en sessies alleen eigen, heen+terug",
  ],
  [
    "account-verwijderen.mjs",
    null,
    0,
    "fase 8: register volledig, account verwijderen laat niets achter (alle voorstellen t/m 0025), gezin overgedragen/opgeheven, facturen anoniem",
  ],
  ["verwijder-gezinseigenaar.mjs", null, 0, "verslag BUG-110/025 (rapporteert, faalt niet)"],
];

let fout = 0;
for (const [script, met, verwacht, uitleg] of gevallen) {
  const args = [path.join(HIER, script), ...(met ? ["--met", met] : [])];
  const r = spawnSync(process.execPath, args, { encoding: "utf8", env: process.env });
  const ok = r.status === verwacht;
  if (!ok) fout++;
  console.log(
    `${ok ? "OK  " : "FOUT"}  ${script.padEnd(17)} exit ${r.status} (verwacht ${verwacht})  ${uitleg}`,
  );
  if (!ok) console.log((r.stdout + r.stderr).split("\n").slice(-25).join("\n"));
}
console.log(`\n${gevallen.length - fout}/${gevallen.length} zoals verwacht`);
process.exit(fout ? 1 : 0);
