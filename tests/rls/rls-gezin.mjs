/**
 * RLS-test gezinsrechten op een echte PostgreSQL (PGlite) uit alle migraties. Fictieve gegevens.
 * Rollen: eigenaar (A), andere gebruiker (B), actief gezinslid (C), uitgenodigd maar niet actief (D).
 * Daarna zet A zijn deelrecht "boodschappen/weekmenu" uit: C moet dan A's privélijst en privé-
 * weekmenu niet meer zien, maar de gezamenlijke gezinslijst wel.
 *
 *   PGLITE_DIR=<map> node tests/rls/rls-gezin.mjs [--met <up.sql>]
 * Exitcode 0 = verwachting gehaald; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import { als, bouwDatabank } from "./databank.mjs";

const MET = process.argv.includes("--met") ? process.argv[process.argv.indexOf("--met") + 1] : null;
const A = "a0000000-0000-4000-8000-00000000000a";
const B = "b0000000-0000-4000-8000-00000000000b";
const C = "c0000000-0000-4000-8000-00000000000c";
const D = "d0000000-0000-4000-8000-00000000000d";
const G = "f0000000-0000-4000-8000-0000000000f0";
const PRIVE = "f1000000-0000-4000-8000-0000000000f1";

const { db, fouten } = await bouwDatabank({
  extraNaMigraties: MET ? readFileSync(MET, "utf8") : undefined,
});
if (fouten.length) {
  console.error("Migraties gaven fouten:", fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${B}','b@voorbeeld.test'),
    ('${C}','c@voorbeeld.test'),('${D}','d@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${B}','B'),('${C}','C'),('${D}','D')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G}', '${A}', 'Testgezin');
  INSERT INTO public.group_members (group_id, user_id, rol, status) VALUES
    ('${G}','${C}','lid','actief'), ('${G}','${D}','lid','uitgenodigd') ON CONFLICT DO NOTHING;
  INSERT INTO public.shopping_lists (id, user_id, name) VALUES ('${PRIVE}', '${A}', 'Privé van A');
  INSERT INTO public.shopping_items (user_id, list_id, name) VALUES ('${A}', '${PRIVE}', 'verjaardagscadeau');
  INSERT INTO public.shopping_items (user_id, list_id, name)
    SELECT '${A}', id, 'melk' FROM public.shopping_lists WHERE group_id = '${G}';
  INSERT INTO public.meal_plan (user_id, plan_date, group_id, custom_title) VALUES
    ('${A}', current_date, '${G}', 'Gezinsdiner'), ('${A}', current_date, NULL, 'Privé lunch');
  INSERT INTO public.pantry_items (user_id, naam) VALUES ('${A}', 'rijst');
`);

const q =
  (sql, ...p) =>
  (t) =>
    t.query(sql, p).then((r) => r.rows[0].n);
const M = {
  "gezinslijst zichtbaar": q(
    `SELECT count(*)::int n FROM public.shopping_lists WHERE group_id = $1`,
    G,
  ),
  "items op de gezinslijst": q(
    `SELECT count(*)::int n FROM public.shopping_items i JOIN public.shopping_lists l ON l.id = i.list_id WHERE l.group_id = $1`,
    G,
  ),
  "privélijst van A": q(`SELECT count(*)::int n FROM public.shopping_lists WHERE id = $1`, PRIVE),
  "items op A's privélijst": q(
    `SELECT count(*)::int n FROM public.shopping_items WHERE list_id = $1`,
    PRIVE,
  ),
  gezinsweekmenu: q(`SELECT count(*)::int n FROM public.meal_plan WHERE group_id = $1`, G),
  "privé-weekmenu van A": q(
    `SELECT count(*)::int n FROM public.meal_plan WHERE user_id = $1 AND group_id IS NULL`,
    A,
  ),
  "voorraad van A": q(`SELECT count(*)::int n FROM public.pantry_items WHERE user_id = $1`, A),
  "profiel van A": q(`SELECT count(*)::int n FROM public.profiles WHERE id = $1`, A),
  "item toevoegen aan gezinslijst": (t) =>
    t
      .query(
        `INSERT INTO public.shopping_items (user_id, list_id, name)
         SELECT auth.uid(), id, 'brood' FROM public.shopping_lists WHERE group_id = $1 RETURNING id`,
        [G],
      )
      // Terugdraaien: een meting mag de volgende metingen niet beïnvloeden.
      .then(
        async (r) => {
          await t.rollback();
          return r.rows.length;
        },
        () => 0,
      ),
};
const namen = Object.keys(M);
const fase1 = {
  A: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  B: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  // Actief lid: gezinslijst/-menu, plus A's privélijst/-menu/voorraad via groep_recht (standaard
  // staan de deelrechten van een lid aan: shopping_view/planner_view = true).
  C: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  // Uitgenodigd: nog niets, ook geen profiel via het gezin.
  D: [0, 0, 0, 0, 0, 0, 0, 0, 0],
};
// Fase 2: A zet shopping/planner-rechten uit voor het gezin (eigen lidrij, als A zelf).
// M7 blijft 1: de voorraad-policy gebruikt samen_in_groep (gedeelde huishoudvoorraad), los van de
// deelrechten per lid. Ontwerpkeuze, vastgelegd in SECURITY-AUDIT (beslissing eigenaar).
const fase2 = { C: [1, 1, 0, 0, 1, 0, 1, 1, 1] };

async function meet(wie, sub) {
  const rij = [];
  for (const n of namen)
    rij.push(await als(db, sub, M[n]).catch((e) => `fout: ${e.message.slice(0, 40)}`));
  return rij;
}
let afwijkingen = 0;
const toon = (titel, wie, rij, v) => {
  const mis = rij
    .map((n, i) => (n === v[i] ? "" : `${namen[i]}: gemeten ${n}, verwacht ${v[i]}`))
    .filter(Boolean);
  afwijkingen += mis.length;
  console.log(
    `${titel.padEnd(8)} ${wie}  ${rij.map((n) => String(n).padStart(3)).join("")}${mis.length ? "   ← " + mis.join("; ") : ""}`,
  );
};

console.log(`\nRLS-test gezin — ${MET ? `met ${MET}` : "huidige migraties (repo)"}\n`);
console.log("         wie " + namen.map((_, i) => `M${i + 1}`.padStart(3)).join(""));
for (const [wie, sub] of [
  ["A", A],
  ["B", B],
  ["C", C],
  ["D", D],
])
  toon("fase 1", wie, await meet(wie, sub), fase1[wie]);

const uit = await als(db, A, (t) =>
  t.query(
    `UPDATE public.group_members SET shopping_view = false, shopping_edit = false, planner_view = false, planner_edit = false
     WHERE group_id = $1 AND user_id = $2 RETURNING id`,
    [G, A],
  ),
).then(
  (r) => r.rows.length,
  (e) => `fout: ${e.message.slice(0, 60)}`,
);
console.log(`\nA zet eigen deelrechten uit (rijen geraakt): ${uit}`);
toon("fase 2", "C", await meet("C", C), fase2.C);

console.log("\nLegende:");
namen.forEach((n, i) => console.log(`  M${i + 1} = ${n}`));
console.log(`\n${afwijkingen} afwijking(en)`);
process.exit(afwijkingen ? 1 : 0);
