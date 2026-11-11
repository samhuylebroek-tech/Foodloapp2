/**
 * Test van voorstellen 0006 (aanbeveling_feedback) en 0007 (houdbaarheid in de voorraad) op PGlite
 * uit alle migraties. A en C zitten in hetzelfde gezin; B is een buitenstaander.
 *
 *   PGLITE_DIR=<map> node tests/rls/intelligentie-voorstellen.mjs
 * Exitcode 0 = alles zoals verwacht; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { als, bouwDatabank } from "./databank.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "../../docs/foodloapp-v2/migratie-voorstel");
const lees = (n) => readFileSync(path.join(MAP, n), "utf8");
const A = "a6000000-0000-4000-8000-00000000000a";
const B = "b6000000-0000-4000-8000-00000000000b";
const C = "c6000000-0000-4000-8000-00000000000c";
const G = "f6000000-0000-4000-8000-0000000000f0";
const R = "e6000000-0000-4000-8000-000000000001";

const { db, fouten } = await bouwDatabank({
  extraNaMigraties:
    lees("0006_aanbeveling_feedback.up.sql") + lees("0007_voorraad_houdbaarheid.up.sql"),
});
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test'),('${C}','c@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B'),('${C}','C') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G}', '${A}', 'Testgezin');
  INSERT INTO public.group_members (group_id, user_id, rol, status) VALUES ('${G}','${C}','lid','actief') ON CONFLICT DO NOTHING;
  INSERT INTO public.recipes (id, user_id, title) VALUES ('${R}','${A}','Curry');
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

// --- 0006 ---
check(
  "A geeft eigen reactie op een recept",
  await lukt(
    als(db, A, (t) =>
      t.query(
        `INSERT INTO public.aanbeveling_feedback (recept_id, signaal, reden) VALUES ('${R}','niet_nu','warm_weer')`,
      ),
    ),
  ),
  "gelukt",
);
check(
  "A geeft reactie op een onderwerp",
  await lukt(
    als(db, A, (t) =>
      t.query(
        `INSERT INTO public.aanbeveling_feedback (onderwerp, signaal) VALUES ('curry','niet_voor_mij')`,
      ),
    ),
  ),
  "gelukt",
);
check(
  "A schrijft geen reactie op naam van B",
  await lukt(
    als(db, A, (t) =>
      t.query(
        `INSERT INTO public.aanbeveling_feedback (user_id, onderwerp, signaal) VALUES ('${B}','curry','niet_nu')`,
      ),
    ),
  ),
  "geweigerd",
);
check(
  "vrije tekst als onderwerp geweigerd (geen gezondheidsinfo)",
  await lukt(
    als(db, A, (t) =>
      t.query(
        `INSERT INTO public.aanbeveling_feedback (onderwerp, signaal) VALUES ('ik ben allergisch voor noten','niet_nu')`,
      ),
    ),
  ),
  "geweigerd",
);
check(
  "onbekend signaal geweigerd",
  await lukt(
    als(db, A, (t) =>
      t.query(
        `INSERT INTO public.aanbeveling_feedback (onderwerp, signaal) VALUES ('curry','haat')`,
      ),
    ),
  ),
  "geweigerd",
);
check(
  "reactie zonder recept en zonder onderwerp geweigerd",
  await lukt(
    als(db, A, (t) =>
      t.query(`INSERT INTO public.aanbeveling_feedback (signaal) VALUES ('niet_nu')`),
    ),
  ),
  "geweigerd",
);
check(
  "A ziet eigen reacties",
  await tel(A, `SELECT count(*)::int n FROM public.aanbeveling_feedback`),
  2,
);
check(
  "gezinslid C ziet niets van A",
  await tel(C, `SELECT count(*)::int n FROM public.aanbeveling_feedback`),
  0,
);
check(
  "buitenstaander B ziet niets",
  await tel(B, `SELECT count(*)::int n FROM public.aanbeveling_feedback`),
  0,
);
check(
  "niet aangemeld ziet niets",
  await lukt(als(db, null, (t) => t.query(`SELECT 1 FROM public.aanbeveling_feedback`))),
  "geweigerd",
);
check(
  "A kan een reactie niet wijzigen (alleen terugzetten)",
  await lukt(
    als(db, A, (t) => t.query(`UPDATE public.aanbeveling_feedback SET signaal = 'gekozen'`)),
  ),
  "geweigerd",
);
check(
  "C kan de reacties van A niet verwijderen",
  await als(
    db,
    C,
    async (t) => (await t.query(`DELETE FROM public.aanbeveling_feedback`)).affectedRows ?? 0,
  ),
  0,
);
check(
  "A zet 'Niet voor mij' terug",
  await als(
    db,
    A,
    async (t) =>
      (await t.query(`DELETE FROM public.aanbeveling_feedback WHERE signaal = 'niet_voor_mij'`))
        .affectedRows,
  ),
  1,
);
check(
  "gewone gebruiker start de opruiming niet",
  await lukt(als(db, A, (t) => t.query(`SELECT public.ruim_aanbeveling_feedback_op()`))),
  "geweigerd",
);
await db.exec(`
  INSERT INTO public.aanbeveling_feedback (user_id, onderwerp, signaal, created_at) VALUES
    ('${A}','oud_niet_nu','niet_nu', now() - interval '13 months'),
    ('${A}','oud_gekozen','gekozen', now() - interval '13 months'),
    ('${A}','oud_nee','niet_voor_mij', now() - interval '30 months'),
    ('${A}','recent','gekozen', now() - interval '11 months');
`);
const gewist = (await db.query(`SELECT public.ruim_aanbeveling_feedback_op() n`)).rows[0].n;
check("opruiming: 2 oude rijen gewist", Number(gewist), 2);
check(
  "opruiming: 'Niet voor mij' blijft tot je het terugzet",
  (
    await db.query(
      `SELECT string_agg(coalesce(onderwerp,'recept'), ',' ORDER BY coalesce(onderwerp,'recept')) n FROM public.aanbeveling_feedback`,
    )
  ).rows[0].n,
  "oud_nee,recent,recept",
);
await db.exec(`DELETE FROM public.recipes WHERE id = '${R}'`);
check(
  "recept verwijderd → reactie erop ook",
  (
    await db.query(
      `SELECT count(*)::int n FROM public.aanbeveling_feedback WHERE recept_id IS NOT NULL`,
    )
  ).rows[0].n,
  0,
);
await db.exec(`DELETE FROM auth.users WHERE id = '${A}'`);
check(
  "account verwijderd → alle reacties weg",
  (await db.query(`SELECT count(*)::int n FROM public.aanbeveling_feedback`)).rows[0].n,
  0,
);

// --- 0007 --- (A is weg; C wordt eigenaar van een nieuw gezin met B als lid)
const G2 = "f6000000-0000-4000-8000-0000000000f2";
await db.exec(`
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G2}', '${C}', 'Gezin 2');
  INSERT INTO public.group_members (group_id, user_id, rol, status) VALUES ('${G2}','${B}','lid','actief') ON CONFLICT DO NOTHING;
`);
check(
  "C zet een houdbaarheidsdatum",
  await lukt(
    als(db, C, (t) =>
      t.query(
        `INSERT INTO public.pantry_items (user_id, naam, houdbaar_tot) VALUES ('${C}','spinazie', current_date + 2)`,
      ),
    ),
  ),
  "gelukt",
);
check(
  "onzinnige datum geweigerd",
  await lukt(
    als(db, C, (t) =>
      t.query(
        `INSERT INTO public.pantry_items (user_id, naam, houdbaar_tot) VALUES ('${C}','x', date '1900-01-01')`,
      ),
    ),
  ),
  "geweigerd",
);
check(
  "product zonder datum blijft mogelijk",
  await lukt(
    als(db, C, (t) =>
      t.query(`INSERT INTO public.pantry_items (user_id, naam) VALUES ('${C}','rijst')`),
    ),
  ),
  "gelukt",
);
check(
  "gezinslid B leest de datum mee (BUG-112, ongewijzigd)",
  await tel(B, `SELECT count(*)::int n FROM public.pantry_items WHERE houdbaar_tot IS NOT NULL`),
  1,
);
check(
  "gezinslid B wijzigt de datum van C niet",
  await als(
    db,
    B,
    async (t) =>
      (await t.query(`UPDATE public.pantry_items SET houdbaar_tot = current_date`)).affectedRows ??
      0,
  ),
  0,
);

// --- terugdraaien ---
await db.exec(
  lees("0007_voorraad_houdbaarheid.down.sql") + lees("0006_aanbeveling_feedback.down.sql"),
);
check(
  "terugdraaien: tabel en functie weg",
  (
    await db.query(
      `SELECT (to_regclass('public.aanbeveling_feedback') IS NULL AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ruim_aanbeveling_feedback_op'))::text n`,
    )
  ).rows[0].n,
  "true",
);
check(
  "terugdraaien: kolom weg, producten blijven",
  (
    await db.query(
      `SELECT (count(*) FILTER (WHERE column_name = 'houdbaar_tot'))::int n FROM information_schema.columns WHERE table_name = 'pantry_items'`,
    )
  ).rows[0].n +
    "/" +
    (await db.query(`SELECT count(*)::int n FROM public.pantry_items`)).rows[0].n,
  "0/2",
);

for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, verwacht ${r.verwacht}`);
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
