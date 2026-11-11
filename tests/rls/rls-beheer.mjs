/**
 * RLS-test beheerstabellen (BUG-097), feedback (S8), is_admin (S7) en claim_first_admin (S6) op een
 * echte PostgreSQL (PGlite) uit alle migraties. Fictieve gegevens, geen Supabase-verbinding.
 *
 *   PGLITE_DIR=<map> node tests/rls/rls-beheer.mjs                 (huidige migraties)
 *   PGLITE_DIR=<map> node tests/rls/rls-beheer.mjs --met <up.sql>  (met migratievoorstel)
 *
 * Exitcode 0 = veilige verwachting gehaald; 1 = afwijking; 2 = opbouw mislukt.
 */
import { readFileSync } from "node:fs";
import { als, bouwDatabank } from "./databank.mjs";

const MET = process.argv.includes("--met") ? process.argv[process.argv.indexOf("--met") + 1] : null;
const EIGENAAR = "e11454f4-8b82-4b7a-81a4-4c161b3b222d";
const ANALIST = "a2000000-0000-4000-8000-0000000000a2"; // beheerdersrij, rol analyst, alleen-lezen
const KLANT = "c3000000-0000-4000-8000-0000000000c3"; // gewone gebruiker met gegevens

const { db, fouten } = await bouwDatabank({
  extraNaMigraties: MET ? readFileSync(MET, "utf8") : undefined,
});
if (fouten.length) {
  console.error("Migraties gaven fouten:", fouten);
  process.exit(2);
}

await db.exec(`
  INSERT INTO auth.users (id, email) VALUES ('${EIGENAAR}','eigenaar@voorbeeld.test'),
    ('${ANALIST}','analist@voorbeeld.test'), ('${KLANT}','klant@voorbeeld.test');
  INSERT INTO public.profiles (id, display_name) VALUES ('${EIGENAAR}','E'),('${ANALIST}','A'),('${KLANT}','K')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.admin_users (user_id, role, active, read_only) VALUES ('${EIGENAAR}','super_admin',true,false);
`);
const resultaten = [];
const check = (naam, gemeten, veilig) =>
  resultaten.push({ naam, gemeten, veilig, ok: gemeten === veilig });

// 0. Huidige bescherming (migratie 0008): de databank laat alleen de eigenaar als beheerder toe.
const tweede = await db
  .exec(
    `INSERT INTO public.admin_users (user_id, role, active, read_only) VALUES ('${ANALIST}','analyst',true,true)`,
  )
  .then(
    () => "toegelaten",
    () => "geweigerd",
  );
check("trigger 0008: tweede beheerdersrij (analist) toevoegen", tweede, "geweigerd");

// Toekomstscenario (teamleden, BUG-096): de trigger staat uit en er bestaat een analist met
// alleen-lezen. Vanaf hier meet de test wat zo iemand RECHTSTREEKS in de databank kan lezen.
await db.exec(`
  ALTER TABLE public.admin_users DISABLE TRIGGER admin_users_only_owner_trg;
  INSERT INTO public.admin_users (user_id, role, active, read_only) VALUES ('${ANALIST}','analyst',true,true);
`);

// Rijen van de klant (en platformrijen) in tabellen die vroeger "OR is_admin" hadden. Elke insert
// apart: een tabel waarvan de vorm hier niet past, wordt gemeld en overgeslagen (eerlijk zichtbaar).
const zaaien = {
  ai_usage: `INSERT INTO public.ai_usage (user_id, feature, kost_eur) VALUES ('${KLANT}','import',0.01)`,
  credit_transactions: `INSERT INTO public.credit_transactions (user_id, type, amount, balance_after) VALUES ('${KLANT}','usage',-1,49)`,
  user_credits: `INSERT INTO public.user_credits (user_id, balance) VALUES ('${KLANT}',49) ON CONFLICT (user_id) DO NOTHING`,
  aankopen: `INSERT INTO public.aankopen (user_id, soort, bedrag_cent, status) VALUES ('${KLANT}','pakket',499,'betaald')`,
  user_sessions: `INSERT INTO public.user_sessions (user_id) VALUES ('${KLANT}')`,
  usage_events: `INSERT INTO public.usage_events (user_id, event) VALUES ('${KLANT}','test')`,
  app_errors: `INSERT INTO public.app_errors (user_id, bericht) VALUES ('${KLANT}','test')`,
  daily_user_stats: `INSERT INTO public.daily_user_stats (user_id, dag) VALUES ('${KLANT}', current_date)`,
  notification_log: `INSERT INTO public.notification_log (user_id, soort, status, dedupe_key) VALUES ('${KLANT}','weekly','sent','test-1')`,
  admin_audit_log: `INSERT INTO public.admin_audit_log (actor_id, action, entity_type) VALUES ('${EIGENAAR}','test','test')`,
  feedback: `INSERT INTO public.feedback (user_id, message) VALUES ('${KLANT}','Het werkt niet')`,
};
const overgeslagen = [];
for (const [t, sql] of Object.entries(zaaien)) {
  try {
    await db.exec(sql);
  } catch (e) {
    overgeslagen.push(`${t}: ${String(e.message).split("\n")[0]}`);
  }
}

const tel = (tabel) => (t) => t.query(`SELECT count(*)::int n FROM public.${tabel}`);
// Rijen van ANDEREN: de eigen rij (bv. de eigen creditrij die de aanmeldtrigger maakt) telt niet.
const KOLOM = { admin_audit_log: "actor_id" };
const telAnderen = (tabel) => (t) =>
  t.query(
    `SELECT count(*)::int n FROM public.${tabel} WHERE ${KOLOM[tabel] ?? "user_id"} IS DISTINCT FROM auth.uid()`,
  );

// 1. Analist (beheerdersrij, alleen-lezen) leest rechtstreeks via de databank gegevens van anderen?
for (const t of Object.keys(zaaien).filter((t) => t !== "feedback")) {
  if (overgeslagen.some((o) => o.startsWith(`${t}:`))) continue;
  const n = await als(db, ANALIST, telAnderen(t)).then(
    (r) => r.rows[0].n,
    (e) => `fout: ${e.message.slice(0, 50)}`,
  );
  check(`analist leest ${t} van anderen (rechtstreeks)`, n, 0);
}
// 2. De klant ziet zijn eigen rijen nog (geen regressie voor gewone gebruikers).
for (const t of [
  "ai_usage",
  "credit_transactions",
  "user_credits",
  "aankopen",
  "user_sessions",
  "app_errors",
  "daily_user_stats",
  "notification_log",
]) {
  if (overgeslagen.some((o) => o.startsWith(`${t}:`))) continue;
  const n = await als(db, KLANT, tel(t)).then(
    (r) => r.rows[0].n,
    (e) => `fout: ${e.message.slice(0, 50)}`,
  );
  // ai_usage was en blijft alleen-beheer: de klant ziet ook nu niets (geen eigen-rij-policy).
  // Aantal hangt van triggers af (bv. welkomsttransactie bij aanmelden): alleen "ziet eigen rijen".
  check(
    `klant ziet eigen ${t}`,
    typeof n === "number" ? (n > 0 ? "ja" : "nee") : n,
    t === "ai_usage" ? "nee" : "ja",
  );
}
// 3. Feedback: klant mag de status van zijn ticket niet zelf op "opgelost" zetten.
const fb = await als(db, KLANT, (t) =>
  t.query(`UPDATE public.feedback SET status = 'opgelost' WHERE user_id = $1 RETURNING id`, [
    KLANT,
  ]),
).then(
  (r) => r.rows.length,
  () => 0,
);
check("klant zet eigen ticket op 'opgelost'", fb, 0);
const fbMsg = await als(db, KLANT, (t) =>
  t.query(`UPDATE public.feedback SET message = 'Aanvulling' WHERE user_id = $1 RETURNING id`, [
    KLANT,
  ]),
).then(
  (r) => r.rows.length,
  () => 0,
);
check("klant past eigen bericht aan (ticket nog 'nieuw')", fbMsg, 1);
// 4. is_admin is niet aanroepbaar door gebruikers.
const isAdmin = await als(db, KLANT, (t) =>
  t.query(`SELECT public.is_admin($1) a`, [EIGENAAR]),
).then(
  () => "aanroepbaar",
  () => "geweigerd",
);
check("gewone gebruiker roept is_admin(eigenaar) aan", isAdmin, "geweigerd");
// 5. claim_first_admin niet aanroepbaar (en na de migratie verdwenen).
const claim = await als(db, KLANT, (t) => t.query(`SELECT public.claim_first_admin() a`)).then(
  () => "aanroepbaar",
  () => "geweigerd",
);
check("gewone gebruiker roept claim_first_admin() aan", claim, "geweigerd");
// 6. Rooktest: als gewone gebruiker elke tabel in public lezen zonder rechtenfout op functies.
const tabellen = (
  await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`)
).rows.map((r) => r.tablename);
const rook = [];
const tabelWeigering = [];
for (const t of tabellen) {
  await als(db, KLANT, tel(t)).catch((e) => {
    const m = e.message.split("\n")[0];
    // "permission denied for table": bestaande keuze (geen tabelrecht), geen gevolg van 0002.
    // "permission denied for function": een policy roept een functie aan die de gebruiker niet mag.
    (/for table/.test(m) ? tabelWeigering : rook).push(`${t}: ${m}`);
  });
}
check(
  `rooktest: ${tabellen.length} tabellen zonder functie-rechtenfout (gewone gebruiker)`,
  rook.length,
  0,
);

console.log(`\nRLS-test beheer — ${MET ? `met ${MET}` : "huidige migraties (repo)"}\n`);
for (const r of resultaten)
  console.log(`${r.ok ? "OK  " : "FOUT"}  ${r.naam}: gemeten ${r.gemeten}, veilig ${r.veilig}`);
if (rook.length) console.log("\nRooktestfouten:\n  " + rook.join("\n  "));
if (tabelWeigering.length)
  console.log(
    "\nInfo — tabellen zonder leesrecht voor authenticated (ook vóór 0002):\n  " +
      tabelWeigering.join("\n  "),
  );
if (overgeslagen.length)
  console.log("\nNiet gezaaid (vorm past niet):\n  " + overgeslagen.join("\n  "));
const mis = resultaten.filter((r) => !r.ok).length;
console.log(`\n${mis} afwijking(en)`);
process.exit(mis ? 1 : 0);
