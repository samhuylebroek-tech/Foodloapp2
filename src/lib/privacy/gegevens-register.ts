/**
 * Fase 8 — Eén register van ALLE persoonsgegevens per gebruiker: welke tabel, via welke kolom, en
 * wat er bij het verwijderen van het account mee gebeurt. Gedeeld door:
 * - het opruimen bij accountverwijdering (`account-opruimen.server.ts`);
 * - de PGlite-test `tests/rls/account-verwijderen.mjs` (bouwt alle migraties + voorstellen op en
 *   controleert dat er na het verwijderen geen enkele verwijzing naar de gebruiker overblijft);
 * - de unittest die nagaat dat elke tabel uit de migratievoorstellen hierin staat.
 *
 * Bewust zonder imports en zonder TypeScript-specifieke runtime (geen enum): Node leest dit bestand
 * rechtstreeks in de PGlite-test.
 *
 * Acties:
 * - `wissen`: rij weg (zoals ON DELETE CASCADE, ook waar de databank dat niet zelf doet);
 * - `anonimiseren`: kolom op NULL, rij blijft (wettelijke bewaarplicht boekhouding, of gegevens
 *   die bij iemand anders horen, bv. een toewijzing op de lijst van een ander gezinslid).
 *
 * Volgorde = uitvoeringsvolgorde: kinderen vóór ouders (een `via`-regel zoekt de ouder-id's op,
 * dus die ouder mag nog niet weg zijn).
 */

export type Actie = "wissen" | "anonimiseren";

export type RegisterRegel = {
  tabel: string;
  kolom: string;
  actie: Actie;
  /** Waar de tabel vandaan komt: "bestaand" of het nummer van het migratievoorstel. */
  bron: string;
  /** Rijen waarvan `kolom` in (SELECT id FROM ouder WHERE ouderKolom = gebruiker). */
  via?: { ouder: string; ouderKolom: string };
  /** Waarom anonimiseren in plaats van wissen (in gewone taal). */
  reden?: string;
};

const r = (
  tabel: string,
  kolom: string,
  bron: string,
  extra: Partial<RegisterRegel> = {},
): RegisterRegel => ({ tabel, kolom, actie: "wissen", bron, ...extra });
const viaRecept = { ouder: "recipes", ouderKolom: "user_id" };
const viaMaker = { ouder: "creators", ouderKolom: "user_id" };
const viaLijst = { ouder: "shopping_lists", ouderKolom: "user_id" };
const viaLid = { ouder: "huishouden_leden", ouderKolom: "beheerder_id" };
const BOEKHOUDING = "Boekhouding: 7 jaar bewaren, zonder te weten van wie.";

export const GEGEVENS_REGISTER: readonly RegisterRegel[] = [
  // ---------- bij jouw recepten (anderen die erop reageerden, ze bewaarden of plannen) ----------
  r("recipe_ingredients", "recipe_id", "bestaand", { via: viaRecept }),
  r("recipe_photos", "recipe_id", "bestaand", { via: viaRecept }),
  r("recipe_versions", "recipe_id", "bestaand", { via: viaRecept }),
  r("recipe_versions", "gewijzigd_door", "bestaand", {
    actie: "anonimiseren",
    reden: "Versie van het recept van iemand anders: de versie blijft, jouw naam niet.",
  }),
  r("recept_vereisten", "recipe_id", "0013", { via: viaRecept }),
  r("community_bijdragen", "recipe_id", "0008", { via: viaRecept }),
  r("collection_recipes", "recipe_id", "0008", { via: viaRecept }),
  r("recipe_publicaties", "recipe_id", "0008", { via: viaRecept }),
  r("kookmomenten", "recipe_id", "0015", { via: viaRecept }),
  r("favorites", "recipe_id", "bestaand", { via: viaRecept }),
  r("gesponsorde_items", "recipe_id", "0011", { via: viaRecept }),
  r("recipe_ratings", "recipe_id", "bestaand", { via: viaRecept }),
  r("meal_plan", "recipe_id", "bestaand", {
    via: viaRecept,
    actie: "anonimiseren",
    reden: "Weekmenu van iemand anders met jouw recept: de maaltijd blijft, het recept niet.",
  }),
  r("restjes", "recipe_id", "0019", {
    via: viaRecept,
    actie: "anonimiseren",
    reden: "Restje van iemand anders: blijft, zonder link naar jouw recept.",
  }),

  // ---------- koken, plannen, lijst, voorraad ----------
  r("kookmomenten", "user_id", "0015"),
  r("aanbeveling_feedback", "user_id", "0006"),
  r("recipe_ratings", "user_id", "bestaand"),
  r("favorites", "user_id", "bestaand"),
  r("recipe_import_jobs", "user_id", "bestaand"),
  r("maaltijd_eters", "lid_id", "0010", { via: viaLid }),
  r("kookmomenten", "meal_plan_id", "0015", {
    via: { ouder: "meal_plan", ouderKolom: "user_id" },
    actie: "anonimiseren",
  }),
  r("maaltijd_eters", "meal_plan_id", "0010", {
    via: { ouder: "meal_plan", ouderKolom: "user_id" },
  }),
  r("meal_plan", "user_id", "bestaand"),
  r("lijst_toewijzingen", "list_id", "0017", { via: viaLijst }),
  r("lijst_toewijzingen", "toegewezen_door", "0017"),
  r("lijst_toewijzingen", "toegewezen_aan", "0017", {
    actie: "anonimiseren",
    reden: "Toewijzing op de lijst van een ander gezinslid: het product blijft, jouw naam niet.",
  }),
  r("shopping_items", "list_id", "bestaand", { via: viaLijst }),
  r("shopping_items", "user_id", "bestaand"),
  r("winkel_mandjes", "user_id", "0024"),
  r("shopping_lists", "user_id", "bestaand"),
  r("shopping_history", "user_id", "bestaand"),
  r("shopping_staples", "user_id", "bestaand"),
  r("pantry_items", "user_id", "bestaand"),
  r("restjes", "user_id", "0019"),
  r("budget_weken", "user_id", "0014"),
  r("planprofiel", "user_id", "0013"),
  r("suggestie_instellingen", "user_id", "0016"),
  r("recipes", "user_id", "bestaand"),

  // ---------- gezondheid en gezin ----------
  r("persoonlijke_voeding", "user_id", "0009"),
  r("lid_voeding", "lid_id", "0010", { via: viaLid }),
  r("lid_voeding", "toestemming_door", "0010"),
  r("huishouden_leden", "beheerder_id", "0010"),
  r("huishouden_leden", "user_id", "0010"),
  r("app_meldingen", "user_id", "0017"),
  r("app_meldingen", "actor_id", "0017"),
  r("gezin_activiteit", "actor_id", "0017"),
  r("app_melding_instellingen", "user_id", "0017"),
  r("shares", "owner_id", "bestaand"),
  r("shares", "member_id", "bestaand"),
  // Gezinnen waarvan je eigenaar bent, zijn vooraf overgedragen of opgeheven (draagGezinnenOver).
  r("group_members", "user_id", "bestaand"),
  r("groups", "owner_id", "bestaand"),

  // ---------- makers en community ----------
  r("maker_plannen", "creator_id", "0021", { via: viaMaker }),
  r("samenwerkingen", "creator_id", "0011", { via: viaMaker }),
  r("maker_uitbetalingen", "creator_id", "0022", {
    via: viaMaker,
    actie: "anonimiseren",
    reden: BOEKHOUDING,
  }),
  r("maker_uitbetalingen", "vastgelegd_door", "0022", {
    actie: "anonimiseren",
    reden: BOEKHOUDING,
  }),
  r("maker_abonnementen", "creator_id", "0021", { via: viaMaker }),
  r("maker_betalingen", "creator_id", "0021", {
    via: viaMaker,
    actie: "anonimiseren",
    reden: BOEKHOUDING,
  }),
  r("follows", "creator_id", "0008", { via: viaMaker }),
  r("recipe_publicaties", "creator_id", "0008", { via: viaMaker }),
  r("follows", "follower_id", "0008"),
  r("collection_recipes", "collection_id", "0008", {
    via: { ouder: "collections", ouderKolom: "user_id" },
  }),
  r("collections", "user_id", "0008"),
  r("community_bijdragen", "user_id", "0008"),
  r("content_meldingen", "melder_id", "0008"),
  r("maker_abonnementen", "fan_id", "0021"),
  r("maker_betalingen", "fan_id", "0021", { actie: "anonimiseren", reden: BOEKHOUDING }),
  r("gebruiker_blokkades", "blokkeerder_id", "0021"),
  r("gebruiker_blokkades", "geblokkeerd_id", "0021"),
  r("creators", "user_id", "0008"),

  // ---------- partners, premium, betalingen ----------
  r("partner_aanvragen", "beoordeeld_door", "0022", { actie: "anonimiseren", reden: BOEKHOUDING }),
  r("partner_aanvragen", "user_id", "0011"),
  r("partner_leden", "user_id", "0011"),
  r("beheer_uitnodigingen", "uitgenodigd_door", "0022", {
    actie: "anonimiseren",
    reden: "Auditspoor van het beheer: de uitnodiging blijft, wie ze verstuurde niet.",
  }),
  r("entitlements", "user_id", "0012"),
  r("abonnementen", "user_id", "0012"),
  r("facturen", "user_id", "0012", { actie: "anonimiseren", reden: BOEKHOUDING }),
  r("betaal_events", "user_id", "0012", { actie: "anonimiseren", reden: BOEKHOUDING }),
  r("aankopen", "user_id", "bestaand"),

  // ---------- klantenkaarten, meldingen, credits, AI ----------
  r("loyalty_scan_events", "user_id", "bestaand"),
  r("loyalty_cards", "user_id", "bestaand"),
  r("notification_log", "user_id", "bestaand"),
  r("push_subscriptions", "user_id", "bestaand"),
  r("notification_preferences", "user_id", "bestaand"),
  r("admin_message_recipients", "user_id", "bestaand"),
  r("credit_transactions", "user_id", "bestaand"),
  r("credit_requests", "user_id", "bestaand"),
  r("user_credits", "user_id", "bestaand"),
  r("ai_usage", "user_id", "bestaand"),
  r("ai_gebruik_dag", "user_id", "0024"),
  r("toestemmingen", "user_id", "0025"),

  // ---------- gebruik en fouten ----------
  r("feedback", "user_id", "bestaand"),
  r("usage_events", "user_id", "bestaand"),
  r("daily_user_stats", "user_id", "bestaand"),
  r("app_errors", "user_id", "bestaand"),
  r("user_sessions", "user_id", "bestaand"),

  // Als laatste: het profiel (andere tabellen verwijzen soms naar profiles.id).
  r("profiles", "id", "bestaand"),
];

/**
 * Tabellen die bewust NIET in het register staan, met reden. De unittest eist dat elke tabel uit
 * de migratievoorstellen óf in het register óf hier staat.
 */
export const NIET_PERSOONLIJK: Readonly<Record<string, string>> = {
  allergeen_woorden: "Vaste woordenlijst, van niemand.",
  partners: "Organisatie, geen persoon (leden staan in partner_leden).",
  partner_producten: "Producten van een organisatie.",
  campagnes: "Campagnes van een organisatie.",
  gesponsorde_items: "Gesponsorde plekken van een organisatie.",
  gesponsord_statistiek: "Alleen tellers per dag, nooit wie.",
  ai_gebruik_totaal: "Anoniem totaal per dag en soort, nooit wie.",
  plannen: "Prijsplannen van Foodlo, van niemand.",
};

/** Opslagmappen met eigen bestanden in `{userId}/…`. */
export const OPSLAG_MAPPEN = ["recipe-photos", "community-fotos"] as const;

/** Alle unieke tabelnamen uit het register. */
export function registerTabellen(): string[] {
  return [...new Set(GEGEVENS_REGISTER.map((g) => g.tabel))];
}
