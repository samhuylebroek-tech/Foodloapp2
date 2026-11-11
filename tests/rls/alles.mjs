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
const UP = path.join(VOORSTEL, "0002_rollen_en_rls.up.sql");
const HEEN_TERUG = path.join(mkdtempSync(path.join(tmpdir(), "rls-")), "heen-terug.sql");
writeFileSync(
  HEEN_TERUG,
  readFileSync(UP, "utf8") +
    "\n" +
    readFileSync(path.join(VOORSTEL, "0002_rollen_en_rls.down.sql"), "utf8"),
);

const gevallen = [
  ["rls-recepten.mjs", null, 1, "huidig: BUG-105/106 aanwezig"],
  ["rls-beheer.mjs", null, 1, "huidig: BUG-097/S7/S8 aanwezig (toekomstscenario teamleden)"],
  ["rls-gezin.mjs", null, 0, "huidig: gezinsrechten correct"],
  ["rls-recepten.mjs", UP, 0, "voorstel: recepten en foto's veilig"],
  ["rls-beheer.mjs", UP, 0, "voorstel: beheer, feedback, is_admin veilig"],
  ["rls-gezin.mjs", UP, 0, "voorstel: gezinsrechten ongewijzigd"],
  ["rls-recepten.mjs", HEEN_TERUG, 1, "heen+terug: zelfde stand als nu"],
  ["rls-beheer.mjs", HEEN_TERUG, 1, "heen+terug: zelfde stand als nu"],
  ["rls-gezin.mjs", HEEN_TERUG, 0, "heen+terug: zelfde stand als nu"],
  ["bewaartermijnen.mjs", null, 0, "voorstel 0003: opruiming, rechten, heen+terug"],
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
