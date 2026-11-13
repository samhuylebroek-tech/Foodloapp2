# Staging-voorstellen (niets hiervan is uitgevoerd)

> Samengevat in [`docs/foodlo/DATABASE_ARCHITECTURE.md`](../foodlo/DATABASE_ARCHITECTURE.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Elk voorstel raakt database, opslag of persoonsgegevens en valt dus onder een approval gate.
Volgorde per voorstel: **alleen-lezen onderzoek → staging-project → test → akkoord eigenaar → productie**.
Er wordt nooit iets in productie gewijzigd zonder expliciete toestemming.

## 0. Voorwaarde: een staging-omgeving
- Aparte Supabase-project "foodlo-staging" (gratis tier volstaat om te beginnen).
- Schema uit productie halen als **alleen-lezen dump** (`supabase db dump --schema-only`), zonder gegevens.
- Testdata: synthetisch (nooit kopieën van echte gebruikers).
- Eigenaar-actie (eenmalig): project aanmaken en de staging-URL/anon key lokaal in `.env.staging` zetten (nooit committen; `.env.*` is genegeerd).

## 1. BUG-011 — Schema-drift (G1)
**Probleem.** `supabase/migrations` (13) en `drizzle/migrations` (51) beschrijven samen het schema; de gegenereerde types tonen ±62 tabellen. Welke map is leidend, en klopt die met productie?
**Voorstel.**
1. Alleen-lezen schemadump van productie (geen data).
2. Lege staging-database: beide migratiemappen in volgorde toepassen; schemadump nemen.
3. Diff van (1) en (2): ontbrekende tabellen, policies, functies, triggers, grants.
4. Eén leidende migratiemap kiezen; ontbrekende stukken als **baseline-migratie** vastleggen (zonder productie te wijzigen).
**Risico.** Laag (alleen-lezen) tot stap 4. **Rollback:** n.v.t.
**Kosten.** Enkele uren; geen infrastructuurkosten buiten staging.

## 2. BUG-012 — AI-foto's als base64 in `ai_cache` (G1/G8)
**Probleem.** Elke gegenereerde foto (±1–2 MB) staat als tekst in `ai_cache.result` (jsonb) en reist bij elke cachetreffer door de server: database groeit snel, egress-kosten, trage antwoorden.
**Voorstel.**
1. Nieuwe privé-bucket `ai-fotos` (of map in `recipe-photos/_ai/`), pad = `sha256(prompt)`.
2. `gerechtFoto` bewaart het beeld in Storage en zet in `ai_cache.result` alleen `{ pad }`.
3. Lezen: oude cache-rijen met data-URL blijven werken (dubbel lezen); nieuwe rijen gebruiken het pad.
4. Achtergrondtaak (later): oude base64-rijen omzetten naar Storage, daarna pas opruimen.
**Test.** Unit: oude en nieuwe vorm lezen. E2E met nep-Storage. Staging: grootte `ai_cache` vóór/na.
**Rollback.** Code terugdraaien; oude rijen zijn onaangeroerd (stap 4 pas na akkoord).
**Kosten.** Daalt: Storage is goedkoper dan databaseopslag + egress.

## 3. BUG-025 — Account verwijderen laat foto's achter (G7/G8, AVG)
**Probleem.** `verwijderMijnAccount` wist alleen de auth-gebruiker. Foto's in `recipe-photos/{userId}/` blijven. Maar Inspiratie kopieert hetzelfde **pad** naar recepten van anderen, dus blind wissen breekt hun foto's.
**Voorstel (twee fasen).**
1. *Vanaf nu geen gedeelde paden meer:* bij opslaan uit Inspiratie de foto **kopiëren** naar `recipe-photos/{eigen userId}/…` (server-side `storage.copy`). Codewijziging, geen migratie.
2. *Bij verwijderen:* voor elk object in `recipe-photos/{userId}/` tellen hoeveel `recipes.image_url`/`recipe_photos`/`inspiration_recipes.image_url` van **andere** gebruikers ernaar verwijzen.
   - 0 verwijzingen → wissen.
   - ≥ 1 verwijzing → eerst kopiëren naar het pad van die gebruiker(s), verwijzing bijwerken, dan wissen. Nooit een beeld wissen dat nog in gebruik is.
3. Logboek (zonder persoonsgegevens) van wat gewist is; bewaartermijn vastleggen in het privacybeleid.
**Test.** Staging met 3 synthetische gebruikers en gedeelde foto's; controle dat geen enkele andere gebruiker een foto verliest.
**Rollback.** Fase 1 is omkeerbaar; fase 2 wist data → **expliciet akkoord** vereist.

## 4. BUG-026 — Gegevensexport onvolledig en inefficiënt (geen gate voor de code)
**Probleem.** Haalt alle zichtbare `recipe_ingredients` op en filtert daarna; mist foto's, receptversies, meldingsvoorkeuren, notities.
**Voorstel.** Ingrediënten per blok van 100 recept-id's ophalen (`.in("recipe_id", ids)`); export uitbreiden met `recipe_photos` (paden + tijdelijke links), `recipe_versions`, `notification_preferences`, `pantry_items` (al aanwezig), `credit_transactions` van de gebruiker.
**Test.** Unit met nep-Supabase (aantal oproepen, volledigheid); E2E: knop "Mijn gegevens" levert een bestand met alle secties.
**Rollback.** Code terugdraaien.
