/**
 * BUG-112: de voorraad blijft zichtbaar voor actieve gezinsleden, ook als een lid zijn deelrechten
 * uitzet (beslissing eigenaar 2026-11-11). Deze test bewijst dat dat GEEN deur opent naar andere
 * privégegevens: voor ELKE tabel met een user_id-kolom krijgt A één privérij (verzonnen, zonder
 * gezin), A zet daarna alle deelrechten uit, en we tellen wat het actieve gezinslid C nog ziet.
 *
 *   PGLITE_DIR=<map> node tests/rls/rls-gezin-privacy.mjs [--met <up.sql>]
 * Exitcode 0 = alleen de toegelaten tabellen zichtbaar; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import { als, bouwDatabank } from "./databank.mjs";

const MET = process.argv.includes("--met") ? process.argv[process.argv.indexOf("--met") + 1] : null;
const A = "a0000000-0000-4000-8000-00000000000a";
const C = "c0000000-0000-4000-8000-00000000000c";
const G = "f0000000-0000-4000-8000-0000000000f0";

// Wat C van A mag blijven zien na het uitzetten van de deelrechten, en waarom.
const TOEGELATEN = {
  pantry_items: "gedeelde huishoudvoorraad (BUG-112, beslissing eigenaar)",
  group_members: "lidmaatschap van hetzelfde gezin",
  creators: "makerprofiel: bewust leesbaar voor ingelogde gebruikers (voorstel 0008)",
};

const { db, fouten } = await bouwDatabank({
  extraNaMigraties: MET ? readFileSync(MET, "utf8") : undefined,
});
if (fouten.length) {
  console.error("Migraties gaven fouten:", fouten);
  process.exit(2);
}
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${A}','a@voorbeeld.test'),('${C}','c@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${A}','A'),('${C}','C') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, owner_id, naam) VALUES ('${G}', '${A}', 'Testgezin');
  INSERT INTO public.group_members (group_id, user_id, rol, status) VALUES ('${G}','${C}','lid','actief')
    ON CONFLICT DO NOTHING;
`);

// Alle tabellen met een user_id-kolom (behalve de gezinstabellen zelf).
const tabellen = (
  await db.query(`SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t USING (table_schema, table_name)
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND c.column_name = 'user_id'
    ORDER BY 1`)
).rows.map((r) => r.table_name);

const metGroep = new Set(
  (
    await db.query(`SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'group_id'`)
  ).rows.map((r) => r.table_name),
);

// Kolommen met een vaste lijst van toegelaten waarden (CHECK), bv. voorstel 0006.
const VASTE_WAARDEN = { signaal: "'niet_nu'", handle: "'test-a'", tekst: "'Lekker'" };
// Optionele kolommen die een tabelregel (CHECK) toch vraagt.
// Ook verplichte kolommen met een CHECK krijgen hier een geldige waarde (voorstellen 0011/0012).
const EXTRA_KOLOMMEN = {
  aanbeveling_feedback: { onderwerp: "'curry'" },
  // Voorstel 0017: afzender (standaard auth.uid(), hier zonder sessie) en een vaste soort.
  app_meldingen: { actor_id: `'${A}'`, soort: "'menu'" },
  abonnementen: { plan: "'premium_maand'", status: "'proef'" },
  budget_weken: { week: "date_trunc('week', current_date)::date" },
  // Voorstel 0021: "gemaakt" (standaard) vraagt 1–5 sterren; sterren is niet meer verplicht.
  community_bijdragen: { sterren: "5" },
  entitlements: { recht: "'premium.weekmenu_extra'" },
  facturen: { status: "'betaald'" },
  partner_aanvragen: { bedrijfsnaam: "'Bakkerij A'", soort: "'retail'" },
  partner_leden: { rol: "'eigenaar'" },
};

function waarde(type) {
  if (type === "uuid") return "gen_random_uuid()";
  if (/int|numeric|double|real/.test(type)) return "1";
  if (type === "boolean") return "false";
  if (type === "date") return "current_date";
  if (/timestamp/.test(type)) return "now()";
  if (/json/.test(type)) return "'{}'";
  if (type === "ARRAY") return "'{}'";
  return "'x'";
}

// Eén privérij van A per tabel. Verwijzingen worden even niet gecontroleerd (alleen in deze test).
const nietGevuld = [];
await db.exec("SET session_replication_role = replica");
for (const t of tabellen) {
  if (t === "group_members") continue;
  const kol = (
    await db.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND is_nullable = 'NO'
         AND column_default IS NULL AND is_identity = 'NO' AND column_name <> 'user_id'`,
      [t],
    )
  ).rows;
  const namen = ["user_id", ...kol.map((k) => k.column_name)];
  const waarden = [
    `'${A}'`,
    ...kol.map(
      (k) =>
        EXTRA_KOLOMMEN[t]?.[k.column_name] ?? VASTE_WAARDEN[k.column_name] ?? waarde(k.data_type),
    ),
  ];
  for (const [k, w] of Object.entries(EXTRA_KOLOMMEN[t] ?? {})) {
    if (namen.includes(k)) continue;
    namen.push(k);
    waarden.push(w);
  }
  try {
    // ON CONFLICT: sommige rijen bestaan al via een trigger (bv. user_credits bij een nieuw account).
    await db.exec(
      `INSERT INTO public.${t} (${namen.join(",")}) VALUES (${waarden.join(",")}) ON CONFLICT DO NOTHING`,
    );
  } catch (e) {
    nietGevuld.push(`${t}: ${String(e.message).slice(0, 60)}`);
  }
}
await db.exec("SET session_replication_role = origin");

// A zet alle deelrechten uit (zoals in de app, als A zelf).
const uit = await als(db, A, (t) =>
  t.query(
    `UPDATE public.group_members SET shopping_view = false, shopping_edit = false,
       planner_view = false, planner_edit = false, recipes_view = false, recipes_edit = false
     WHERE group_id = $1 AND user_id = $2 RETURNING id`,
    [G, A],
  ),
).then(
  (r) => r.rows.length,
  (e) => `fout: ${String(e.message).slice(0, 80)}`,
);
console.log(`A zet eigen deelrechten uit (rijen geraakt): ${uit}`);
if (uit !== 1) process.exit(2);

let afwijkingen = 0;
console.log(
  `\nRLS-test gezinsprivacy (BUG-112) — ${MET ? `met ${MET}` : "huidige migraties (repo)"}`,
);
console.log("Wat ziet actief gezinslid C van A, nadat A alle deelrechten uitzette?\n");
for (const t of tabellen) {
  const n = await als(db, C, (tx) =>
    // Rijen die A uitdrukkelijk aan het gezin hangt (group_id gezet, bv. de gezinslijst) tellen niet.
    tx.query(
      `SELECT count(*)::int n FROM public.${t} WHERE user_id = $1${metGroep.has(t) ? " AND group_id IS NULL" : ""}`,
      [A],
    ),
  ).then(
    (r) => r.rows[0].n,
    (e) => `geweigerd (${String(e.message).slice(0, 30)})`,
  );
  const mag = t in TOEGELATEN;
  const fout = typeof n === "number" && n > 0 && !mag;
  if (fout) afwijkingen++;
  if (n !== 0 || mag)
    console.log(
      `${fout ? "AFWIJKING" : "ok       "} ${t.padEnd(28)} ${String(n).padStart(3)}  ${mag ? TOEGELATEN[t] : ""}`,
    );
}
// Profiel: via het gezin zichtbaar (naam). Welke kolommen mag een ingelogde gebruiker lezen?
const profielKolommen = (
  await db.query(`SELECT column_name FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'authenticated'
      AND privilege_type = 'SELECT' ORDER BY column_name`)
).rows.map((r) => r.column_name);
const profiel = await als(db, C, (tx) =>
  tx.query(`SELECT count(*)::int n FROM public.profiles WHERE id = $1`, [A]),
).then(
  (r) => r.rows[0].n,
  (e) => `geweigerd (${String(e.message).slice(0, 40)})`,
);
// weekmenu bevat "vermijd" (vrije tekst, mogelijk allergieën): BUG-119, voorstel 0004.
const GEVOELIG = ["admin_note", "blocked_at", "welkom_mail_op", "weekmenu"];
const lek = profielKolommen.filter((k) => GEVOELIG.includes(k));
if (lek.length) afwijkingen++;
console.log(`\nprofiel van A zichtbaar voor C: ${profiel} (gezinsnaam in de app)`);
console.log(`leesbare profielkolommen: ${profielKolommen.join(", ") || "(geen kolomrechten)"}`);
console.log(
  lek.length
    ? `AFWIJKING gevoelige kolommen leesbaar voor elk zichtbaar profiel: ${lek.join(", ")}`
    : "ok        geen beheernotitie, blokkering, mailgegevens of weekmenuvoorkeuren leesbaar",
);
// Met voorstel 0004: A leest zijn eigen voorkeuren nog via eigen_weekmenu(); C krijgt die van A niet.
const heeftFunctie = (
  await db.query(`SELECT count(*)::int n FROM pg_proc WHERE proname = 'eigen_weekmenu'`)
).rows[0].n;
if (heeftFunctie) {
  await db.query(`UPDATE public.profiles SET weekmenu = '{"vermijd":"noten"}' WHERE id = $1`, [A]);
  const eigen = await als(db, A, (tx) => tx.query(`SELECT public.eigen_weekmenu() w`)).then(
    (r) => r.rows[0].w?.vermijd,
  );
  const vanC = await als(db, C, (tx) => tx.query(`SELECT public.eigen_weekmenu() w`)).then(
    (r) => r.rows[0].w?.vermijd ?? null,
  );
  const ok = eigen === "noten" && vanC !== "noten";
  if (!ok) afwijkingen++;
  console.log(
    `${ok ? "ok       " : "AFWIJKING"} eigen_weekmenu(): A leest eigen voorkeur (${eigen}), C krijgt die van A niet (${vanC})`,
  );
}
console.log(
  `\n${tabellen.length} tabellen met user_id gecontroleerd; niet te vullen: ${nietGevuld.length}`,
);
for (const f of nietGevuld) console.log("  - " + f);
if (nietGevuld.length) afwijkingen++;
console.log(
  afwijkingen
    ? `\n${afwijkingen} afwijking(en)`
    : "\nGeen privégegevens buiten de voorraad zichtbaar.",
);
process.exit(afwijkingen ? 1 : 0);
