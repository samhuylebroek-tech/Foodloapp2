# Architectuurvoorstellen: collecties, gezinsvoorkeuren, creators en schaal

Stand 2026-11-11. **Alleen voorstellen.** Elk onderdeel hieronder vraagt een databankwijziging, en die wordt pas na een test op staging en jouw akkoord uitgevoerd. Er is niets gebouwd dat een nieuwe tabel nodig heeft. Er worden geen fictieve externe diensten of cijfers gebruikt.

Twee omgevingen, nooit verwarren:
- **Live (Lovable Cloud):** recepten- en fotorechten zijn in orde (door de eigenaar gecontroleerd), bucket Private.
- **Repo-migraties (lokaal):** missen die regels. Daarom bestaat de basislijn `0002a` (alleen voor nieuwe omgevingen).

## 1. Eigen collecties (D)
**Nu:** collecties in de Keuken worden afgeleid (favorieten, categorie, …); zelf maken kan niet.

**Voorstel (migratie 0004):**
- `collections` (id, user_id, group_id null, naam ≤ 60, omslag_recipe_id null, positie, zichtbaarheid `prive|gezin|publiek` standaard `prive`).
- `collection_recipes` (collection_id, recipe_id, positie, PK op beide).

**RLS:**
- eigen rijen; gezin via `in_groep`;
- `publiek` pas in de creatorfase (§3);
- een recept toevoegen mag alleen als je het recept mag zien (`has_share`).

**App:**
- "Bewaar in collectie" in het menu van een recept;
- de Keuken toont eigen collecties naast de afgeleide.

**Inspanning:** ±2 dagen.

## 2. Gezinnen: voorkeuren, allergieën, taken (D)
**Nu:**
- geen voorkeuren per lid;
- geen "wie kookt";
- de voorraad blijft zichtbaar voor actieve leden, los van het deelrecht. Dat is BUG-112, een beslissing voor jou.

**Voorstel (migratie 0005):**
- `member_preferences` (group_id, user_id, allergieen text[], lust_niet text[], dieet text null).
  - Lezen: actieve leden van hetzelfde gezin.
  - Schrijven: alleen het lid zelf, of de eigenaar voor kinderen zonder account (later).
- `meal_plan.kok_user_id` (null) en `shopping_lists.wie_haalt_user_id` (null): taken toewijzen.

**App:**
- weekvoorstel en receptkiezer markeren recepten met een allergeen van een gezinslid (rode badge, nooit stil wegfilteren).

**Privacy:** allergieën zijn gezondheidsgegevens (AVG art. 9). Ze vragen uitdrukkelijke toestemming van het lid zelf, en ze komen in de export en worden gewist bij verwijdering.

**Inspanning:** ±3 dagen.

**Gelijktijdige wijzigingen:**
- afvinken is idempotent (dubbel afvinken = één keer, getest);
- realtime bestaat (`.channel`), maar is niet nagebootst in de demo, dus op staging testen met twee toestellen.

## 3. Creators en community (F)
**Volgorde (zie CREATOR-GAP-ANALYSE.md): eerst zonder geld.**
1. `creators` (user_id PK, handle uniek, bio ≤ 300, avatar_path, geverifieerd bool, aangemaakt).
2. `recipes.zichtbaarheid` (`prive|gedeeld|publiek`, standaard `prive`).
   - De bestaande `recipes_select` blijft.
   - Extra regel: `zichtbaarheid = 'publiek' AND deleted_at IS NULL` voor iedereen die ingelogd is.
   - De foto's van publieke recepten via dezelfde storage-regel (recept zichtbaar).
3. `follows` (follower_id, creator_id, PK).
4. `recipe_reactions` (user_id, recipe_id, soort `like|gekookt`, PK). Reacties met tekst pas met moderatie.
5. `content_reports` (melder, recept, reden, status) en een moderatiewachtrij in het Control Center (DSA).
6. **Statistieken:** geaggregeerd per recept per dag (weergaven, bewaard, gekookt), zonder te tonen wie.

**Pas daarna geld** (aparte toestemming en juridisch advies):
- `creator_plans`, `memberships`, `payouts`, ledger (BUSINESS-CONTROL-CENTER-AUDIT §5, §10);
- exclusieve content via RLS op lidmaatschap.

**Lokale fundamenten nu:** geen. Elk punt vraagt een tabel; een half fundament zonder RLS-tests zou meer risico dan waarde geven.

## 4. Zoeken en ontdekken (D)
- **Gebouwd:** zoeken met tikfouten (BUG-100); zoeken op ingrediënt bestaat al.
- **Budgetfilter:** er zijn geen echte prijsgegevens. Een filter op prijs zou verzonnen zijn. Voorstel: eerst een veld `budget_indicatie` (€/€€/€€€) dat de gebruiker of creator zelf kiest. Geen externe prijs-API zonder jouw beslissing.
- **Aanbevelingen:** al gebaseerd op voorraad ("Met wat je in huis hebt"). Uitbreiding met gezinsvoorkeuren na §2.

## 5. Performance en schaal (G)
- **Gedaan (BUG-093):** Finance, budgetrem, dagaggregatie, CSV-exports en de AVG-export pagineren voorbij 1 000 rijen.
- **Gedaan (2026-11-11):** de ±27 dashboardqueries, de ontvangers van meldingen en het weekvoorstel halen nu alle rijen op (`alleRijen`, vaste volgorde). Ze zijn dus volledig.
- **Nog open (kosten en snelheid):** sommige dashboards lezen ruwe rijen. Bij veel gebruikers worden dat veel verzoeken van 1 000 rijen. Voorstel: uit `daily_platform_stats` en `daily_user_stats` lezen (al per dag samengevat). Goedkoper en sneller.
- **Dubbele verzoeken (BUG-118):** Vandaag haalt voorraad, lijst en weekmenu 2–3× op (Vandaag, aanvulkaart, kringloop). Voorstel: één gedeelde query voor die basisgegevens.
- **Indexen (voorstel, op staging meten met `EXPLAIN`):**
  - `ai_usage(created_at)`, `usage_events(created_at)`, `user_sessions(last_seen_at)` (opruiming en dashboards);
  - `recipes(user_id, deleted_at)` (lijsten).
  - Basislijn 0002a voegt `recipes(image_url)` en `recipe_photos(path)` toe.
- **Afbeeldingen:** foto's worden in de browser verkleind vóór upload (`photos.ts`). Voorstel: miniaturen (bv. 400 px) voor lijsten, via Supabase-transformaties (betaald op Pro, dus jouw beslissing) of een tweede kleine versie bij upload (gratis).
- **AI-kosten:** maandbudget met rem (nu ook correct bij > 1 000 oproepen), cache per invoer, limieten per gebruiker in Beheer → Kosten.
