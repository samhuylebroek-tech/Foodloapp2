/**
 * Wat gebeurt er in de databank als een gezinseigenaar zijn account verwijdert? (BUG-110, BUG-025)
 * Bootst `auth.admin.deleteUser` na met `DELETE FROM auth.users` (de cascades doen de rest) op een
 * echte PostgreSQL (PGlite) uit alle migraties. Fictieve gegevens. Rapporteert; faalt alleen bij
 * een technische fout. Storage-bestanden zelf bestaan hier alleen als rijen in storage.objects.
 *
 *   PGLITE_DIR=<map> node tests/rls/verwijder-gezinseigenaar.mjs
 */
import { bouwDatabank } from "./databank.mjs";

const A = "a0000000-0000-4000-8000-00000000000a"; // gezinseigenaar, verwijdert zijn account
const C = "c0000000-0000-4000-8000-00000000000c"; // actief gezinslid
const E = "e0000000-0000-4000-8000-00000000000e"; // vriend
const G = "f0000000-0000-4000-8000-0000000000f0";
const R_A = "1a000000-0000-4000-8000-000000000001";
const R_C = "1c000000-0000-4000-8000-000000000001";
const FOTO_A = `${A}/lasagne.jpg`;

const { db, fouten } = await bouwDatabank();
if (fouten.length) {
  console.error(fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${C}','c@voorbeeld.test'),('${E}','e@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${C}','C'),('${E}','E') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G}', '${A}', 'Gezin van A');
  INSERT INTO public.group_members (group_id, user_id, rol, status) VALUES ('${G}','${C}','lid','actief') ON CONFLICT DO NOTHING;
  INSERT INTO public.shopping_items (user_id, list_id, name)
    SELECT '${A}', id, 'melk (door A)' FROM public.shopping_lists WHERE group_id = '${G}';
  INSERT INTO public.shopping_items (user_id, list_id, name)
    SELECT '${C}', id, 'brood (door C)' FROM public.shopping_lists WHERE group_id = '${G}';
  INSERT INTO public.meal_plan (user_id, plan_date, group_id, custom_title) VALUES
    ('${A}', current_date, '${G}', 'Gezinsdiner gepland door A'),
    ('${C}', current_date + 1, '${G}', 'Gezinsdiner gepland door C');
  INSERT INTO public.shares (owner_id, member_id, status, recipes_view) VALUES ('${A}', '${E}', 'accepted', true);
  INSERT INTO public.recipes (id, user_id, title, image_url) VALUES ('${R_A}', '${A}', 'Lasagne van A', '${FOTO_A}');
  INSERT INTO public.recipe_photos (recipe_id, path) VALUES ('${R_A}', '${FOTO_A}');
  INSERT INTO public.inspiration_recipes (title, image_url, bron_recipe_id) VALUES ('Lasagne (inspiratie)', '${FOTO_A}', '${R_A}');
  -- C bewaarde de inspiratie: zelfde PAD als de foto van A (zo werkt Inspiratie vandaag).
  INSERT INTO public.recipes (id, user_id, title, image_url) VALUES ('${R_C}', '${C}', 'Lasagne (van C, uit inspiratie)', '${FOTO_A}');
  INSERT INTO storage.buckets (id, name) VALUES ('recipe-photos','recipe-photos') ON CONFLICT DO NOTHING;
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('recipe-photos', '${FOTO_A}', '${A}');
`);

const tel = async (sql) => (await db.query(sql)).rows[0].n;
const meting = async () => ({
  "gezin (groups)": await tel(`SELECT count(*)::int n FROM public.groups WHERE id = '${G}'`),
  "gezin met bestaande eigenaar": await tel(
    `SELECT count(*)::int n FROM public.groups g JOIN auth.users u ON u.id = g.owner_id WHERE g.id = '${G}'`,
  ),
  "lidmaatschap van C": await tel(
    `SELECT count(*)::int n FROM public.group_members WHERE group_id = '${G}' AND user_id = '${C}'`,
  ),
  gezinslijst: await tel(
    `SELECT count(*)::int n FROM public.shopping_lists WHERE group_id = '${G}'`,
  ),
  "items van C op de gezinslijst": await tel(
    `SELECT count(*)::int n FROM public.shopping_items WHERE user_id = '${C}'`,
  ),
  "gezinsweekmenu door C": await tel(
    `SELECT count(*)::int n FROM public.meal_plan WHERE user_id = '${C}'`,
  ),
  "deelrecht A→vriend": await tel(
    `SELECT count(*)::int n FROM public.shares WHERE owner_id = '${A}'`,
  ),
  "recepten van A": await tel(`SELECT count(*)::int n FROM public.recipes WHERE user_id = '${A}'`),
  "inspiratie die naar A's recept wijst": await tel(
    `SELECT count(*)::int n FROM public.inspiration_recipes WHERE image_url = '${FOTO_A}'`,
  ),
  "recept van C met A's fotopad": await tel(
    `SELECT count(*)::int n FROM public.recipes WHERE user_id = '${C}' AND image_url = '${FOTO_A}'`,
  ),
  "fotobestand van A in storage": await tel(
    `SELECT count(*)::int n FROM storage.objects WHERE name = '${FOTO_A}'`,
  ),
});

const voor = await meting();
let fout = null;
await db
  .exec(`DELETE FROM auth.users WHERE id = '${A}'`)
  .catch((e) => (fout = e.message.split("\n")[0]));
const na = await meting();

console.log("\nAccount van gezinseigenaar A verwijderen (DELETE FROM auth.users, met cascades)\n");
if (fout) console.log(`VERWIJDEREN MISLUKT: ${fout}\n`);
console.log("onderdeel".padEnd(42) + "voor  na");
for (const k of Object.keys(voor))
  console.log(k.padEnd(42) + String(voor[k]).padStart(4) + String(na[k]).padStart(4));
process.exit(0);
