import { pagineer } from "@/lib/pagineer";
import { isOntbrekendeTabel } from "@/lib/ontbrekende-tabel";

/**
 * Eén lijst van persoonsgegevens per gebruiker (AVG art. 15/20), gedeeld door de eigen export en
 * de beheer-export (BUG-026, BUG-103). Zie docs/foodloapp-v2/AVG-AUDIT.md §1.
 *
 * Veiligheid: draait met de service-sleutel (ziet ook zacht verwijderde recepten), dus ELKE query
 * filtert expliciet op de gebruiker of op diens eigen recept-id's. Een unittest controleert dat
 * (`avg-export.test.ts`). Alles wordt gepagineerd (max. 1000 rijen per verzoek bij PostgREST).
 *
 * Bewust NIET opgenomen (keuze van de eigenaar, zie AVG-AUDIT §7):
 * - kaartnummers van klantenkaarten en push-sleutels (`p256dh`, `auth`, `endpoint`): geheimen die
 *   in een gedownload bestand misbruikt kunnen worden;
 * - beheerdersnotities (`admin_note`) en interne kostprijzen (`kost_eur`).
 */
/** Het deel van de Supabase-querybouwer dat hier gebruikt wordt (los getypt, ook voor de unittest). */
type Bouwer = {
  select: (k: string) => Bouwer;
  eq: (k: string, v: unknown) => Bouwer;
  in: (k: string, v: unknown[]) => Bouwer;
  order: (k: string) => Bouwer;
  range: (a: number, b: number) => PromiseLike<{ data: unknown; error?: unknown }>;
};
export type AvgDb = { from: (t: string) => Bouwer };
type Db = AvgDb;

export const AVG_SECTIES = [
  "profiel",
  "recepten",
  "ingredienten",
  "receptfotos",
  "receptversies",
  "beoordelingen",
  "favorieten",
  "importpogingen",
  "weekmenu",
  "boodschappenlijsten",
  "boodschappen",
  "aankoopgeschiedenis",
  "vaste_boodschappen",
  "voorraadkast",
  "gezinnen_eigenaar",
  "gezinslidmaatschappen",
  "deelrechten",
  "klantenkaarten",
  "klantenkaart_scans",
  "meldingsvoorkeuren",
  "toestellen_voor_meldingen",
  "verstuurde_meldingen",
  "credits",
  "credit_boekingen",
  "credit_aanvragen",
  "aankopen",
  "ai_gebruik",
  "feedback",
  "sessies",
  "gebruiksgebeurtenissen",
  "dagstatistieken",
  "foutmeldingen",
  // Nieuwe modules (voorstellen 0008–0012). In productie bestaan deze tabellen pas na de
  // migratie; tot dan is de sectie een lege lijst (de export faalt er niet door).
  "mijn_voeding",
  "huishouden_leden",
  "huishouden_voeding",
  "makerprofiel",
  "maker_publicaties",
  "volgt",
  "verzamelingen",
  "verzameling_recepten",
  "community_bijdragen",
  "inhoud_meldingen",
  "partner_aanvragen",
  "partner_lidmaatschappen",
  "abonnementen",
  "facturen",
  "toegangsrechten",
  // Fase 4 (voorstel 0021): makerabonnementen in testmodus, plan als maker, blokkades.
  "maker_abonnementen",
  "maker_testbetalingen",
  "maker_plan",
  "blokkades",
] as const;

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type AvgExport = { gemaakt_op: string; gebruiker_id: string } & Record<
  (typeof AVG_SECTIES)[number],
  Json
>;

/** Tabellen zonder kolom `id`: vaste volgorde op een andere kolom (nodig voor paginering). */
const VOLGORDE: Record<string, string> = {
  daily_user_stats: "dag",
  persoonlijke_voeding: "user_id",
  lid_voeding: "lid_id",
  notification_preferences: "user_id",
  user_credits: "user_id",
};

/**
 * Houdt alleen de gevraagde kolommen over. Dubbele zekerheid naast `select(kolommen)`: geheimen
 * (kaartnummer, push-sleutels) mogen nooit in het bestand belanden, ook niet als een laag de
 * kolomkeuze negeert.
 */
function alleen(kolommen: string, rijen: unknown[]): unknown[] {
  if (kolommen === "*") return rijen;
  const toegelaten = kolommen.split(",").map((k) => k.trim());
  return rijen.map((r) =>
    Object.fromEntries(
      Object.entries(r as Record<string, unknown>).filter(([k]) => toegelaten.includes(k)),
    ),
  );
}

const allesVan = (db: Db, tabel: string, kolommen: string, kolom: string, waarde: string) =>
  pagineer((van, tot) =>
    db
      .from(tabel)
      .select(kolommen)
      .eq(kolom, waarde)
      .order(VOLGORDE[tabel] ?? "id")
      .range(van, tot),
  ).then((r) => alleen(kolommen, r.data));

/** Haalt rijen op waarvan `kolom` in `ids` zit, in blokken van 100 id's (lange URL's vermijden). */
async function perBlok(db: Db, tabel: string, kolommen: string, kolom: string, ids: string[]) {
  const uit: unknown[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const blok = ids.slice(i, i + 100);
    const r = await pagineer((van, tot) =>
      db
        .from(tabel)
        .select(kolommen)
        .in(kolom, blok)
        .order(VOLGORDE[tabel] ?? "id")
        .range(van, tot),
    );
    uit.push(...r.data);
  }
  return uit;
}

/** Een tabel die (nog) niet bestaat: geen fout, gewoon niets. */
class OntbrekendeTabel extends Error {}

/**
 * Voor tabellen uit de migratievoorstellen: bestaat de tabel niet (productie vóór de migratie),
 * dan een lege lijst. Elke andere fout laat de export wel falen (liever geen onvolledig bestand).
 */
async function optioneel(werk: (db: Db) => Promise<unknown[]>, db: Db): Promise<unknown[]> {
  const bewaakt: Db = {
    from: (t) => {
      const q = db.from(t);
      const wrap = (b: Bouwer): Bouwer => ({
        select: (k) => wrap(b.select(k)),
        eq: (k, v) => wrap(b.eq(k, v)),
        in: (k, v) => wrap(b.in(k, v)),
        order: (k) => wrap(b.order(k)),
        range: (a, z) =>
          Promise.resolve(b.range(a, z)).then((r) => {
            if (r.error && isOntbrekendeTabel(r.error)) throw new OntbrekendeTabel(t);
            return r;
          }),
      });
      return wrap(q);
    },
  };
  try {
    return await werk(bewaakt);
  } catch (fout) {
    if (fout instanceof OntbrekendeTabel) return [];
    throw fout;
  }
}

/** Nieuwe modules (0008–0012): alleen eigen rijen, of rijen die horen bij eigen rijen. */
async function nieuweModules(db: Db, userId: string) {
  const eigen = (tabel: string, kolommen = "*", kolom = "user_id") =>
    optioneel((d) => allesVan(d, tabel, kolommen, kolom, userId), db);

  // Gezinsleden die jij bent of beheert (bv. je kind), en alleen hun voorkeuren.
  const [ledenZelf, ledenBeheerd] = await Promise.all([
    eigen("huishouden_leden", "id, group_id, naam, user_id, rol, beheerder_id, created_at"),
    eigen(
      "huishouden_leden",
      "id, group_id, naam, user_id, rol, beheerder_id, created_at",
      "beheerder_id",
    ),
  ]);
  const leden = [
    ...new Map(
      [...ledenZelf, ...ledenBeheerd].map((l) => [String((l as { id: string }).id), l]),
    ).values(),
  ];
  const lidIds = leden.map((l) => String((l as { id: string }).id));

  const makers = (await eigen("creators")) as { id: string }[];
  const makerIds = makers.map((m) => m.id);
  const verzamelingen = (await eigen("collections")) as { id: string }[];
  const verzamelingIds = verzamelingen.map((v) => v.id);

  const [
    voeding,
    lidVoeding,
    publicaties,
    volgt,
    verzamelingRecepten,
    bijdragen,
    meldingen,
    aanvragen,
    partnerLeden,
    abonnementen,
    facturen,
    rechten,
  ] = await Promise.all([
    eigen("persoonlijke_voeding"),
    optioneel((d) => perBlok(d, "lid_voeding", "*", "lid_id", lidIds), db),
    optioneel((d) => perBlok(d, "recipe_publicaties", "*", "creator_id", makerIds), db),
    eigen("follows", "*", "follower_id"),
    optioneel((d) => perBlok(d, "collection_recipes", "*", "collection_id", verzamelingIds), db),
    eigen("community_bijdragen"),
    eigen("content_meldingen", "id, soort, doel_id, reden, created_at, behandeld_op", "melder_id"),
    eigen("partner_aanvragen"),
    eigen("partner_leden", "id, partner_id, rol, created_at"),
    eigen("abonnementen"),
    eigen("facturen"),
    eigen("entitlements"),
  ]);
  const [makerAbos, makerBetalingen, makerPlan, blokkades] = await Promise.all([
    eigen("maker_abonnementen", "*", "fan_id"),
    eigen("maker_betalingen", "id, soort, bedrag_cent, btw_cent, test, created_at", "fan_id"),
    optioneel((d) => perBlok(d, "maker_plannen", "*", "creator_id", makerIds), db),
    eigen("gebruiker_blokkades", "*", "blokkeerder_id"),
  ]);

  return {
    mijn_voeding: voeding,
    huishouden_leden: leden,
    huishouden_voeding: lidVoeding,
    makerprofiel: makers,
    maker_publicaties: publicaties,
    volgt,
    verzamelingen,
    verzameling_recepten: verzamelingRecepten,
    community_bijdragen: bijdragen,
    inhoud_meldingen: meldingen,
    partner_aanvragen: aanvragen,
    partner_lidmaatschappen: partnerLeden,
    abonnementen,
    facturen,
    toegangsrechten: rechten,
    maker_abonnementen: makerAbos,
    maker_testbetalingen: makerBetalingen,
    maker_plan: makerPlan,
    blokkades,
  };
}

/** `client`: Supabase-client met service-sleutel (of een nep-client in tests). */
export async function verzamelPersoonsgegevens(
  client: unknown,
  userId: string,
): Promise<AvgExport> {
  const db = client as Db;
  const eigen = (tabel: string, kolommen = "*") => allesVan(db, tabel, kolommen, "user_id", userId);

  const [profielRij] = (await pagineer((van, tot) =>
    db
      .from("profiles")
      .select(
        "id, display_name, handle, taal, thema, momenten, weekmenu, onboarding_klaar, created_at",
      )
      .eq("id", userId)
      .range(van, tot),
  ).then((r) =>
    alleen(
      "id, display_name, handle, taal, thema, momenten, weekmenu, onboarding_klaar, created_at",
      r.data,
    ),
  )) as unknown[];

  const recepten = (await eigen("recipes")) as { id: string }[];
  const receptIds = recepten.map((r) => r.id);

  const [ingredienten, fotos, versies] = await Promise.all([
    perBlok(db, "recipe_ingredients", "*", "recipe_id", receptIds),
    perBlok(db, "recipe_photos", "*", "recipe_id", receptIds),
    perBlok(db, "recipe_versions", "*", "recipe_id", receptIds),
  ]);

  const [
    beoordelingen,
    favorieten,
    imports,
    weekmenu,
    lijsten,
    items,
    historiek,
    vaste,
    voorraad,
    gezinnen,
    lidmaatschappen,
    deelEigenaar,
    deelLid,
    kaarten,
    scans,
    meldingsvoorkeuren,
    toestellen,
    meldingen,
    credits,
    boekingen,
    aanvragen,
    aankopen,
    ai,
    feedback,
    sessies,
    gebeurtenissen,
    dagen,
    fouten,
  ] = await Promise.all([
    eigen("recipe_ratings"),
    eigen("favorites"),
    eigen(
      "recipe_import_jobs",
      "id, created_at, source_url, platform, status, extraction_method, credits_used, error_message",
    ),
    eigen("meal_plan"),
    eigen("shopping_lists"),
    eigen("shopping_items"),
    eigen("shopping_history"),
    eigen("shopping_staples"),
    eigen("pantry_items"),
    allesVan(db, "groups", "id, naam, created_at", "owner_id", userId),
    eigen("group_members"),
    allesVan(
      db,
      "shares",
      "id, member_id, invited_name, invited_email, status, created_at, accepted_at, recipes_view, recipes_edit, planner_view, planner_edit, shopping_view, shopping_edit",
      "owner_id",
      userId,
    ),
    allesVan(
      db,
      "shares",
      "id, owner_id, status, created_at, accepted_at, recipes_view, recipes_edit, planner_view, planner_edit, shopping_view, shopping_edit",
      "member_id",
      userId,
    ),
    eigen(
      "loyalty_cards",
      "id, winkel_naam, kaartnaam, store_slug, formaat, favoriet, gedeeld, created_at",
    ),
    eigen("loyalty_scan_events", "id, created_at, store_slug, formaat, methode, ok"),
    eigen("notification_preferences"),
    eigen("push_subscriptions", "id, created_at, actief, user_agent, last_ok_at"),
    eigen("notification_log", "id, created_at, soort, titel, body, status, clicked_at"),
    eigen("user_credits"),
    eigen("credit_transactions", "id, created_at, type, amount, balance_after, feature, status"),
    eigen("credit_requests", "id, created_at, aantal, bericht, status, toegekend, handled_at"),
    eigen(
      "aankopen",
      "id, created_at, soort, bedrag_cent, valuta, status, provider, extra_gerechten",
    ),
    eigen("ai_usage", "id, created_at, feature, credits, ok, cache_hit"),
    eigen("feedback", "id, created_at, kind, message, page, rating, status"),
    eigen(
      "user_sessions",
      "id, started_at, ended_at, last_seen_at, platform, device, browser, taal, tijdzone, app_version",
    ),
    eigen(
      "usage_events",
      "id, created_at, event, feature, path, entity_type, platform, device, browser",
    ),
    eigen(
      "daily_user_stats",
      "dag, sessies, handelingen, recepten, plan_items, imports, ai_calls, credits, fouten",
    ),
    eigen("app_errors", "id, created_at, soort, bericht, path, platform, device, browser"),
  ]);
  const nieuw = await nieuweModules(db, userId);

  return {
    gemaakt_op: new Date().toISOString(),
    gebruiker_id: userId,
    profiel: profielRij ?? null,
    recepten,
    ingredienten,
    receptfotos: fotos,
    receptversies: versies,
    beoordelingen,
    favorieten,
    importpogingen: imports,
    weekmenu,
    boodschappenlijsten: lijsten,
    boodschappen: items,
    aankoopgeschiedenis: historiek,
    vaste_boodschappen: vaste,
    voorraadkast: voorraad,
    gezinnen_eigenaar: gezinnen,
    gezinslidmaatschappen: lidmaatschappen,
    deelrechten: { die_jij_gaf: deelEigenaar, die_jij_kreeg: deelLid },
    klantenkaarten: kaarten,
    klantenkaart_scans: scans,
    meldingsvoorkeuren,
    toestellen_voor_meldingen: toestellen,
    verstuurde_meldingen: meldingen,
    credits,
    credit_boekingen: boekingen,
    credit_aanvragen: aanvragen,
    aankopen,
    ai_gebruik: ai,
    feedback,
    sessies,
    gebruiksgebeurtenissen: gebeurtenissen,
    dagstatistieken: dagen,
    foutmeldingen: fouten,
    ...nieuw,
  } as AvgExport;
}
