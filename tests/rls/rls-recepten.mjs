/**
 * RLS-test recepten en receptfoto's (BUG-105/106) op een echte PostgreSQL (PGlite), opgebouwd uit
 * ALLE migraties in de repo. Fictieve gegevens. Geen verbinding met Supabase of productie.
 *
 * Gebruik:
 *   npm install --prefix /tmp/pglite @electric-sql/pglite@0.5.12      (eenmalig, buiten de repo)
 *   PGLITE_DIR=/tmp/pglite node tests/rls/rls-recepten.mjs             (huidige migraties)
 *   PGLITE_DIR=/tmp/pglite node tests/rls/rls-recepten.mjs --met docs/foodloapp-v2/migratie-voorstel/0002_rollen_en_rls.up.sql
 *
 * Exitcode: 0 = de gemeten toegang komt overeen met de VEILIGE verwachting; 1 = er is minstens één
 * afwijking (bv. een lek). Zonder `--met` hoort de huidige stand dus exitcode 1 te geven zolang
 * BUG-105/106 bestaan.
 */
import { readFileSync } from "node:fs";
import { als, bouwDatabank } from "./databank.mjs";

const MET = process.argv.includes("--met") ? process.argv[process.argv.indexOf("--met") + 1] : null;

// Fictieve personen.
const P = {
  eigenaar: "a0000000-0000-4000-8000-00000000000a",
  andere: "b0000000-0000-4000-8000-00000000000b",
  gezinslid: "c0000000-0000-4000-8000-00000000000c",
  uitgenodigd: "d0000000-0000-4000-8000-00000000000d",
  vriend: "e0000000-0000-4000-8000-00000000000e",
};
const GEZIN = "f0000000-0000-4000-8000-0000000000f0";
const R_A = "1a000000-0000-4000-8000-000000000001"; // recept van de eigenaar
const R_A_WEG = "1a000000-0000-4000-8000-000000000002"; // verwijderd recept van de eigenaar
const R_B = "1b000000-0000-4000-8000-000000000001"; // recept van de andere gebruiker

const { db, fouten } = await bouwDatabank({
  extraNaMigraties: MET ? readFileSync(MET, "utf8") : undefined,
});
if (fouten.length) {
  console.error("Migraties gaven fouten:", fouten);
  process.exit(2);
}

// ---------- Gegevens (als eigenaar van de databank, dus buiten RLS) ----------
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${P.eigenaar}', 'eigenaar@voorbeeld.test'), ('${P.andere}', 'andere@voorbeeld.test'),
    ('${P.gezinslid}', 'gezinslid@voorbeeld.test'), ('${P.uitgenodigd}', 'uitgenodigd@voorbeeld.test'),
    ('${P.vriend}', 'vriend@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES
    ('${P.eigenaar}','Eigenaar'),('${P.andere}','Andere'),('${P.gezinslid}','Gezinslid'),
    ('${P.uitgenodigd}','Uitgenodigd'),('${P.vriend}','Vriend')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${GEZIN}', '${P.eigenaar}', 'Testgezin');
  INSERT INTO public.group_members (group_id, user_id, rol, status, recipes_view, planner_view, shopping_view)
    VALUES ('${GEZIN}', '${P.eigenaar}', 'eigenaar', 'actief', true, true, true)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.group_members (group_id, user_id, rol, status, recipes_view, planner_view, shopping_view) VALUES
    ('${GEZIN}', '${P.gezinslid}', 'lid', 'actief', true, true, true),
    ('${GEZIN}', '${P.uitgenodigd}', 'lid', 'uitgenodigd', true, true, true)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.shares (owner_id, member_id, status, recipes_view)
    VALUES ('${P.eigenaar}', '${P.vriend}', 'accepted', true);
  INSERT INTO public.recipes (id, user_id, title) VALUES
    ('${R_A}', '${P.eigenaar}', 'Lasagne van de eigenaar'),
    ('${R_A_WEG}', '${P.eigenaar}', 'Verwijderd recept'),
    ('${R_B}', '${P.andere}', 'Soep van de andere');
  UPDATE public.recipes SET deleted_at = now() WHERE id = '${R_A_WEG}';
  INSERT INTO public.recipe_ingredients (recipe_id, name) VALUES ('${R_A}', 'pasta'), ('${R_B}', 'prei');
  INSERT INTO public.recipe_photos (recipe_id, path) VALUES ('${R_A}', '${P.eigenaar}/lasagne.jpg');
  INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-photos', 'recipe-photos', false)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES
    ('recipe-photos', '${P.eigenaar}/lasagne.jpg', '${P.eigenaar}'),
    ('recipe-photos', '${P.eigenaar}/los-niet-gekoppeld.jpg', '${P.eigenaar}'),
    ('recipe-photos', '${P.andere}/soep.jpg', '${P.andere}'),
    ('recipe-photos', '${P.eigenaar}/inspiratie.jpg', '${P.eigenaar}');
  INSERT INTO public.inspiration_recipes (title, image_url) VALUES ('Inspiratie', '${P.eigenaar}/inspiratie.jpg');
`);

// ---------- Metingen per persoon ----------
const metingen = {
  "recepten van de eigenaar (niet verwijderd)": (t) =>
    t.query(`SELECT count(*)::int n FROM public.recipes WHERE user_id = $1 AND id <> $2`, [
      P.eigenaar,
      R_A_WEG,
    ]),
  "verwijderd recept van de eigenaar": (t) =>
    t.query(`SELECT count(*)::int n FROM public.recipes WHERE id = $1`, [R_A_WEG]),
  "ingrediënten van het recept van de eigenaar": (t) =>
    t.query(`SELECT count(*)::int n FROM public.recipe_ingredients WHERE recipe_id = $1`, [R_A]),
  "fotorij (recipe_photos) van de eigenaar": (t) =>
    t.query(`SELECT count(*)::int n FROM public.recipe_photos WHERE recipe_id = $1`, [R_A]),
  "opslag: gekoppelde foto van de eigenaar": (t) =>
    t.query(`SELECT count(*)::int n FROM storage.objects WHERE name = $1`, [
      `${P.eigenaar}/lasagne.jpg`,
    ]),
  "opslag: losse foto van de eigenaar (geen recept)": (t) =>
    t.query(`SELECT count(*)::int n FROM storage.objects WHERE name = $1`, [
      `${P.eigenaar}/los-niet-gekoppeld.jpg`,
    ]),
  "opslag: opsommen hele bucket (aantal objecten)": (t) =>
    t.query(`SELECT count(*)::int n FROM storage.objects WHERE bucket_id = 'recipe-photos'`),
  "opslag: inspiratiefoto": (t) =>
    t.query(`SELECT count(*)::int n FROM storage.objects WHERE name = $1`, [
      `${P.eigenaar}/inspiratie.jpg`,
    ]),
  "recept van de eigenaar wijzigen (rijen geraakt)": (t) =>
    t
      .query(`UPDATE public.recipes SET title = title WHERE id = $1 RETURNING id`, [R_A])
      .then((r) => ({
        rows: [{ n: r.rows.length }],
      })),
};

// Veilige verwachting. Vriend en gezinslid hebben recipes_view; uitgenodigd en andere niet.
// Opsommen: je ziet alleen je eigen objecten + wat je mag zien. Eigenaar heeft 3 objecten.
const verwacht = {
  eigenaar: [1, 0, 1, 1, 1, 1, 3, 1, 1],
  andere: [0, 0, 0, 0, 0, 0, 2, 1, 0], // eigen soep.jpg + inspiratiefoto
  // Wijzigen = 1: gezinsleden krijgen standaard recipes_edit (group_members-default), bewust ontwerp.
  gezinslid: [1, 0, 1, 1, 1, 0, 2, 1, 1], // lasagne.jpg + inspiratie.jpg
  uitgenodigd: [0, 0, 0, 0, 0, 0, 1, 1, 0], // alleen inspiratie.jpg
  vriend: [1, 0, 1, 1, 1, 0, 2, 1, 0],
  anoniem: [0, 0, 0, 0, 0, 0, 0, 0, 0],
};

const namen = Object.keys(metingen);
let afwijkingen = 0;
const uit = [];
for (const [wie, sub] of [...Object.entries(P), ["anoniem", null]]) {
  const rij = [];
  for (const naam of namen) {
    let n;
    try {
      const r = await als(db, sub, metingen[naam]);
      n = r.rows[0].n;
    } catch (e) {
      n = `fout: ${String(e.message).slice(0, 40)}`;
    }
    rij.push(n);
  }
  const v = verwacht[wie];
  const mis = rij
    .map((n, i) => (n === v[i] ? "" : `${namen[i]}: gemeten ${n}, veilig ${v[i]}`))
    .filter(Boolean);
  afwijkingen += mis.length;
  uit.push({ wie, rij, mis });
}

console.log(`\nRLS-test recepten en foto's — ${MET ? `met ${MET}` : "huidige migraties (repo)"}\n`);
console.log(["wie".padEnd(12), ...namen.map((_, i) => `M${i + 1}`.padStart(4))].join(""));
for (const r of uit)
  console.log([r.wie.padEnd(12), ...r.rij.map((n) => String(n).padStart(4))].join(""));
console.log("\nLegende:");
namen.forEach((n, i) => console.log(`  M${i + 1} = ${n}`));
console.log("\nAfwijkingen van de veilige verwachting:");
for (const r of uit) for (const m of r.mis) console.log(`  ${r.wie}: ${m}`);
if (!afwijkingen) console.log("  geen");

const pol = await db.query(
  `SELECT tablename, policyname, permissive, cmd, qual FROM pg_policies
   WHERE (schemaname='public' AND tablename IN ('recipes','recipe_photos','recipe_ingredients'))
      OR (schemaname='storage' AND tablename='objects') ORDER BY 1, 2`,
);
console.log("\nUiteindelijke policies volgens PostgreSQL (pg_policies):");
for (const p of pol.rows)
  console.log(
    `  ${p.tablename} | ${p.policyname} | ${p.permissive} ${p.cmd} | ${String(p.qual ?? "").replace(/\s+/g, " ")}`,
  );

process.exit(afwijkingen ? 1 : 0);
