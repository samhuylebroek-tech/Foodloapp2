# Bewaartermijnen: concreet voorstel per soort gegevens

> Samengevat in [`docs/foodlo/PRIVACY_AND_SECURITY.md`](../foodlo/PRIVACY_AND_SECURITY.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11. **Alleen een voorstel. Er is niets uitgevoerd of vastgelegd.**
- De automatische opruiming (migratie `0003`) is lokaal getest maar draait nergens.
- Jij kiest de termijnen. Daarna komen ze in het privacybeleid en pas dan in de databank.
- Dit is geen juridisch advies. Laat het privacybeleid nalezen door een jurist voordat het live gaat.

**Uitgangspunt (AVG art. 5.1.e):** we bewaren gegevens niet langer dan nodig voor het doel. Is het doel voorbij, dan wissen we ze of maken we ze anoniem. Het doel staat telkens in de tabel.

## 1. Wat je zelf maakt: blijft tot jij het wist
| Gegevens | Tabellen | Termijn | Waarom | Gevolg |
|---|---|---|---|---|
| Recepten, foto's, versies, beoordelingen, favorieten | `recipes`, `recipe_ingredients`, `recipe_photos`, `recipe_versions`, `recipe_ratings`, `favorites` | Zolang je account bestaat | Dit is de dienst zelf | Bij accountverwijdering meteen weg. Foto's die een ander nog gebruikt, blijven (BUG-025). |
| Recepten in de prullenbak | `recipes.deleted_at` | **30 dagen**, daarna definitief | Terugzetten na een vergissing | Nieuw: daar is een opruimtaak voor nodig (nog niet gebouwd) |
| Oude receptversies | `recipe_versions` | **De laatste 20 per recept** | Ongedaan maken, zonder eindeloze groei | Oudere versies verdwijnen |
| Weekmenu | `meal_plan` | **12 maanden** in het verleden | Historiek ("wat aten we vorige maand?") | Oudere dagen verdwijnen. Statistieken blijven via dagcijfers. |
| Boodschappen, historiek, vaste boodschappen, voorraad | `shopping_*`, `pantry_items` | Zolang je account bestaat; `shopping_history` **24 maanden** | Lijst en suggesties | Oude historiek verdwijnt, waardoor de suggesties iets minder slim worden |
| Klantenkaarten | `loyalty_cards` | Zolang je account bestaat | Tonen aan de kassa | Bij verwijdering weg |
| Gezin en deelrechten | `groups`, `group_members`, `shares` | Zolang het lidmaatschap loopt; **openstaande uitnodigingen 30 dagen** | Samen plannen | Een oude uitnodiging vervalt en moet opnieuw verstuurd worden |
| Voorkeuren (incl. "liever niet") | `profiles.weekmenu` | Zolang je account bestaat | Weekvoorstel | Kan allergieën bevatten. Daarom alleen voor jezelf leesbaar maken (BUG-119, voorstel 0004). |

## 2. Gebruik en techniek: kort bewaren
| Gegevens | Tabellen | Termijn | Waarom | Gevolg |
|---|---|---|---|---|
| Klikgedrag, sessies en AI-gebeurtenissen | `usage_events`, `user_sessions`, `ai_events` | **13 maanden** | Productverbetering, jaar-op-jaar | Daarna gewist. Dagcijfers blijven. |
| Dagcijfers per gebruiker | `daily_user_stats` | **25 maanden** | Twee jaren vergelijken | Daarna gewist |
| Dagcijfers platform (geen personen) | `daily_platform_stats` | Onbeperkt | Bevat geen persoonsgegevens | Geen |
| Foutmeldingen | `app_errors` | **6 maanden** | Bugs oplossen | Oude fouten zijn niet meer na te kijken |
| Meldingslog, push-toestellen | `notification_log`; `push_subscriptions` | 6 maanden; toestel **na 13 maanden ongebruikt** of meteen bij "verlopen" | Afleveren, foutopsporing | Op een oud toestel moet je meldingen opnieuw toestaan |
| AI-verbruik, imports, kaartscans | `ai_usage`, `recipe_import_jobs`, `loyalty_scan_events` | **13 maanden**, dan **anoniem** (persoon eraf) | Kosten en budget | De kostentotalen blijven kloppen (getest: € 0,03 blijft € 0,03) |
| AI-cache | `ai_cache` | **90 dagen** | Kosten besparen | Een oude vraag kost weer een AI-oproep. **Te controleren:** bevat de cache vrije tekst van gebruikers? |
| Snelheidslimiet beheer | `admin_rate_limits` | **1 dag** | Misbruik tegengaan | Geen |

## 3. Contact, geld en verantwoording
| Gegevens | Tabellen | Termijn | Waarom | Gevolg |
|---|---|---|---|---|
| Feedback en supportvragen | `feedback` | **24 maanden** na afhandeling | Opvolging, terugkerende problemen | Oude gesprekken verdwijnen |
| Credits en boekingen | `user_credits`, `credit_transactions`, `credit_requests` | Zolang je account bestaat | Saldo | Bij verwijdering weg (er wordt nu niet echt betaald) |
| Aankopen, **zodra er echte betalingen zijn** | `aankopen` | **7 jaar** (Belgische boekhoudplicht) | Wettelijke plicht | Na accountverwijdering blijft alleen het boekhoudkundige deel, zonder recepten of gedrag. Jurist laten bevestigen. |
| Beheerderslogboek | `admin_audit_log`, `admin_sessions` | Logboek **3 jaar**; sessies **13 maanden** | Wie deed wat (beveiliging, AVG-verantwoording) | Na 3 jaar archiveren of wissen |
| Accounts die niemand meer gebruikt | alle tabellen | **Voorstel:** na **24 maanden** zonder aanmelding een e-mail, en na nog **30 dagen** verwijderen | Geen gegevens van mensen die weg zijn | Een gebruiker die lang wegblijft, verliest zijn kookboek. Dit is een gevoelige keuze: alternatief is nooit automatisch verwijderen. |

## 4. Back-ups
- Gewiste gegevens blijven nog even in de back-ups van de databank tot die vervallen.
- **Te controleren in Lovable Cloud:** hoe lang worden back-ups bewaard? Dat getal komt in het privacybeleid ("na verwijdering nog tot X dagen in back-ups").

## 5. Wat nu al klaar is en wat niet
- **Klaar (lokaal getest, niet uitgevoerd):** migratie `0003` voor de termijnen in §2 en het beheerderslogboek. Test: `tests/rls/bewaartermijnen.mjs`.
- **Nog te bouwen na jouw keuze:**
  - prullenbak 30 dagen;
  - versies maximum 20;
  - weekmenu 12 maanden;
  - `shopping_history` ~~24~~ **12 maanden** (herzien);
  - uitnodigingen 30 dagen;
  - `ai_cache` ~~90 dagen~~ **30 dagen voor invoer van gebruikers, 90 dagen voor algemene resultaten** (herzien);
  - feedback ~~24~~ **12 maanden** na afhandeling (herzien);
  - inactieve accounts.

  Uitgewerkt als voorstel `0003b` (lokaal getest, niet uitgevoerd), behalve inactieve accounts. Test: `tests/rls/bewaartermijnen-inhoud.mjs`.
- **Volgorde:** jij kiest → privacybeleid aanpassen → testen op staging → live.

## 6. Jouw keuzes
1. Akkoord op de termijnen hierboven, of andere getallen.
2. Inactieve accounts: na 24 maanden verwijderen (met waarschuwing), of nooit automatisch?
3. Weekmenu: 12 maanden of langer?
