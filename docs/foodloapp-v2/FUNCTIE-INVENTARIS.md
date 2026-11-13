# Functie-inventaris Foodloapp (stand 2026-11-08, branch `v2/dev`)

> Samengevat in [`docs/foodlo/COMPLETE_PRODUCT_INVENTORY.md`](../foodlo/COMPLETE_PRODUCT_INVENTORY.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Doel: **niets ongemerkt verliezen** tijdens het V2-herontwerp. Per functie: wat er bestaat, of het getest is, en het V2-plan.
Classificatie: **Behouden** · **Verbeteren** · **Herontwerpen** · **Vervangen (met akkoord)** · **Te onderzoeken**.
"E2E" = gedekt door Playwright-tests tegen de nep-Supabase (geen echte database). "—" = nog geen automatische test.

## 1. Gebruikersschermen (30 routes)
| Route | Functie | Getest | V2-status | Plan / risico |
|-------|---------|--------|-----------|---------------|
| `/aanmelden` | E-mail-login, account maken, Google/Apple/Microsoft (Lovable OAuth), wachtwoord vergeten | E2E (34 tests) | Verbeterd | OAuth alleen in echte omgeving te testen |
| `/wachtwoord-herstellen` | Nieuw wachtwoord na herstelmail | E2E | Nieuw (V2) | Redirect-URL toestaan bij release |
| `/welkom` | Onboarding (voorkeuren, momenten) | — | Behouden → Herontwerpen | Stijl V2; E2E toevoegen |
| `/rondleiding` | Rondleiding door de app | — | Behouden | Teksten nalopen na nieuwe navigatie ("Lijst") |
| `/` Start | Vandaag, deze week, favorieten, snelkoppelingen | E2E + overloop | **Herontworpen (V2)** | — |
| `/gerechten` Recepten | Zoeken, filters (soort, dieet, tijd, moeilijkheid, van wie), favorieten, sterren, veeg-verwijderen, concepten | E2E (vinden, overloop) | **Herontworpen (kaarten)** | Filterpaneel nog in oude stijl |
| `/recepten/nieuw` | Zelf invoeren, tekst/link inlezen (AI), foto (AI), zoeken; concept-autosave; controlevenster | E2E (13 tests) | Verbeteren → **volgende batch** | Vastleggen = vlaggenschip (zie §4) |
| `/recepten/$id` | Detail, porties, ingrediënten/bereiding/voeding, foto's (hoofd + extra), delen, kopiëren, inplannen, naar lijst, versies, AI-aanvullen | E2E (deels) | **Herontworpen (kop)** | Tabs en voedingswaarden in oude stijl |
| `/recepten/$id` kookstand | Stap voor stap, scherm aan, porties, timers, hervatten, score | E2E (5 tests) | **Herontworpen (V2)** | Spraak: later |
| `/recepten/$id/bewerken` | Recept aanpassen (zelfde formulier) | via formulier | Verbeteren | — |
| `/planner` Weekmenu | Per dag / hele week, momenten, plannen, verplaatsen/kopiëren, restjes/uit eten, "Laat Foodlo kiezen" (AI), gezinsweergave, boodschappen voor de week, opties | E2E (plannen, dubbel, Escape) | Verbeteren (omslagen) | 2 969 regels → opsplitsen; desktop-raster |
| `/boodschappen` | Lijsten, toevoegen, afdelingen, afvinken, "in je kar", ongedaan maken, eerder gekocht, vaste items, uit gerechten, winkelmodus, klantenkaarten | E2E (afvinken, herladen) | Verbeteren | Gedeelde lijst realtime niet getest |
| `/voorraad` | Voorraadkast | — | Te onderzoeken → Verbeteren | Koppeling met weekmenu (fase 1) |
| `/inspiratie`, `/inspiratie/$id` | Ideeën om te koken, bekijken, toevoegen aan eigen recepten | — | Verbeteren | Foto-pad wordt gedeeld (BUG-025) |
| `/vrienden`, `/vrienden/$id` | Vrienden uitnodigen, rechten (recepten/weekmenu/lijst bekijken/bewerken), gezin | — | Verbeteren | Echte rechten alleen in staging te testen |
| `/gezin` | Gezin beheren, uitnodigen, leden | — | Verbeteren | Idem |
| `/uitnodiging`, `/deel` | Uitnodiging aanvaarden, gedeelde link | — | Behouden | E2E met 2 nep-gebruikers toevoegen |
| `/kaarten`, `/kaarten/$id` | Klantenkaarten, scannen, offline tonen | — | Behouden | Camera alleen op toestel te testen |
| `/meldingen` | Pushmeldingen + voorkeuren | unit (schema) | Behouden | — |
| `/credits` | Credits, aanvragen | unit (motor) | Behouden | Wordt onderdeel van creator/abonnementen |
| `/instellingen` | Profiel, thema, taal, wachtwoord, afmelden, account verwijderen, export | E2E (afmelden) | Behouden → Herontwerpen | Verwijderen: BUG-025 |
| `/meer` | Menu met alle overige onderdelen | — | Behouden | V2-stijl |
| `/feedback`, `/info`, `/privacy`, `/installeren` | Feedback, uitleg, privacy, PWA-installatie | — | Behouden | — |

## 2. Beheer (Control Center, 43 routes)
Dashboard, gebruikers (detail, blokkeren, export, verwijderen), recepten, inhoud/teksten, AI, kosten, credits, finance, integraties, imports, meldingen, communicatie, support, systeem, logboek, beveiliging, team, analytics, user intelligence (sessies, gebeurtenissen, fouten, segmenten).
- **Autorisatie:** alle 76 beheer-serverfuncties roepen `bewaker()` aan (vaste eigenaar + rol + recht + rate limit). **Behouden.**
- V2: geen herontwerp nodig voor eindgebruikers; eventueel later stijl.

## 3. Serverfuncties, integraties en achtergrond
| Gebied | Bestand | Status |
|--------|---------|--------|
| AI (import, foto, suggesties, vertaling, stappen) | `ai.functions.ts`, `vertaal.functions.ts`, `credits.server.ts` | SSRF + creditfixes (V2); unit-tests |
| Beheer / monitoring / user intelligence | `admin`, `monitoring`, `user-intelligence`, `finance` | Bewaker overal; begrensde lijsten (V2) |
| Gezin / vrienden / meldingen | `gezin`, `vrienden`, `meldingen*`, `webpush.server.ts` | zod-validatie, push-SSRF (V2) |
| Account / export / welkom-mail | `account`, `export`, `welkom-mail`, `mail.server.ts` (Resend) | Export onvolledig (BUG-026); verwijderen (BUG-025) |
| **Cron** | `api/public/meldingen.run.ts` (geheim via `LOVABLE_CRON_SECRET`) | Behouden |
| **E-mail** | Lovable transactional + Resend-adapter | Behouden |
| Realtime | `.channel(` in 4 bestanden (gedeelde lijst, gezin) | Niet nagebootst in demo/E2E → staging |
| Externe diensten | Lovable AI-gateway, Brave/DuckDuckGo-zoeken, weer, Supabase Storage | Behouden |

## 4. Gegevens (52 tabellen)
Recepten (`recipes`, `recipe_ingredients`, `recipe_photos`, `recipe_versions`, `recipe_ratings`, `recipe_import_jobs`, `favorites`), planning (`meal_plan`), boodschappen (`shopping_lists`, `shopping_items`, `shopping_history`, `shopping_staples`), voorraad (`pantry_items`), sociaal (`groups`, `group_members`, `shares`), inspiratie (`inspiration_recipes`, `inspiration_ingredients`, **niet in migraties**), klantenkaarten (`loyalty_cards`, `loyalty_stores`, `loyalty_scan_events`), meldingen (`notification_*`, `push_subscriptions`), credits/AI (`user_credits`, `credit_*`, `ai_cache`, `ai_events`, `ai_usage`, `model_prices`, `aankopen`), beheer/telemetrie (`admin_*`, `app_errors`, `usage_events`, `user_sessions`, `daily_*_stats`, `announcements`, `site_content`, `platform_settings`, `feedback`, `profiles`).
- **Twee rechtensystemen:** `shares` (vrienden) en `group_members` (gezin). **Behouden** tot er een gemigreerd model in staging getest is.

## 5. Gaten ten opzichte van de V2-visie (nog te bouwen)
Collecties (eigen mappen), handgeschreven recepten vastleggen (OCR via AI-foto bestaat; nog niet expliciet getest), voorraad → suggesties, automatische lijst bij wijziging van het weekmenu, creatorprofielen en volgen, abonnementen (alleen ontwerp), spraak in de kookstand.
