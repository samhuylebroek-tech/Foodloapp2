# AVG-audit Foodloapp V2: inventaris van persoonsgegevens

Stand 2026-11-11, branch `v2/dev`. **Fase 1: inventaris.** Er is niets gewijzigd.

**Bron:**
- `src/integrations/supabase/types.ts` (50 tabellen);
- de migraties;
- de code (opslag, logging, externe aanroepen).

**Niet geverifieerd:**
- de echte databank en buckets;
- de instellingen van Supabase Auth;
- de contracten en verwerkersovereenkomsten met leveranciers.

## 1. Databank
| Categorie | Tabellen | Persoonsgegevens | In eigen export? | In beheer-export? | Wissen bij verwijderen? |
|---|---|---|---|---|---|
| Account | `auth.users` (Supabase) | e-mail, wachtwoordhash, aanmeld-IP en -tijden, OAuth-identiteit | ❌ (e-mail wel bekend in de app) | ❌ | ✓ (`deleteUser`) |
| Profiel | `profiles` | `display_name`, `handle`, taal, thema, momenten, `admin_note` (beheerdersnotitie over de persoon), `blocked_at` | ✓ | ✓ | ✓ cascade (te verifiëren) |
| Recepten | `recipes`, `recipe_ingredients`, `recipe_photos`, `recipe_versions`, `recipe_ratings`, `favorites`, `recipe_import_jobs` | eigen inhoud, bron-URL's, foto's, beoordelingen | 🟡 recepten, ingrediënten, favorieten; ❌ foto's, versies, beoordelingen, imports | 🟡 recepten, favorieten | ✓ rijen (cascade, te verifiëren); ❌ **foto's in Storage** (BUG-025) |
| Planning en boodschappen | `meal_plan`, `shopping_lists`, `shopping_items`, `shopping_history`, `shopping_staples`, `pantry_items` | eetgewoonten, aankopen (kunnen gezondheid of religie laten vermoeden) | 🟡 (geen `shopping_history`, `shopping_staples`) | 🟡 | ✓ (te verifiëren) |
| Gezin en vrienden | `groups`, `group_members`, `shares` | wie met wie samenwoont of deelt, `invited_email`, `invited_name` (gegevens van **derden**) | ❌ | ❌ | 🟡 eigen lidmaatschap; groep van de eigenaar: **te bepalen** wat er met de andere leden gebeurt |
| Klantenkaarten | `loyalty_cards`, `loyalty_scan_events` | kaartnummer, winkel | 🟡 (zonder nummer) | ❌ | ✓ (te verifiëren) |
| Meldingen | `push_subscriptions`, `notification_preferences`, `notification_log` | push-endpoint (toestelidentificatie), user-agent, tijdzone, meldingsteksten | ❌ | ❌ | ✓ (te verifiëren) |
| Credits en AI | `user_credits`, `credit_transactions`, `credit_requests`, `ai_usage`, `aankopen` | verbruik, aanvraagreden, aankopen | ❌ | ❌ | ✓ (te verifiëren); boekhoudplicht voor `aankopen` zodra er betalingen zijn (bewaren, pseudonimiseren) |
| Gebruik en telemetrie | `user_sessions`, `usage_events`, `daily_user_stats`, `app_errors` | toestel, browser, tijdzone, paden, gebeurtenissen, foutteksten (kunnen ingevoerde tekst bevatten) | ❌ | ❌ | **te verifiëren** (geen bewaartermijn vastgelegd) |
| Support | `feedback` | vrije tekst, `admin_note` | ❌ | ✓ | te verifiëren |
| Beheer | `admin_audit_log`, `admin_sessions`, `admin_message_recipients` | IP en user-agent van beheerders; welke gebruiker welke e-mail kreeg | n.v.t. | ❌ | Auditlog **bewust niet wisbaar** (gerechtvaardigd belang; vastleggen in het privacybeleid) |
| AI-cache | `ai_cache` | resultaten op basis van ingevoerde tekst of foto's (gehasht op invoer, gedeeld tussen gebruikers bij dezelfde invoer) | n.v.t. | n.v.t. | ❌ vervalt (`expires_at`) |

## 2. Opslag
| Bucket | Inhoud | Pad | Toegang (repo) | Bij verwijderen |
|---|---|---|---|---|
| `recipe-photos` | receptfoto's (verkleind in de browser) | `{userId}/{uuid}.ext` | **elke ingelogde gebruiker kan alles lezen en opsommen** (SECURITY-AUDIT S2) | **niet gewist** (BUG-025). Valkuil: Inspiratie kopieert het **pad**, dus blind wissen breekt de foto's van anderen (STAGING-VOORSTELLEN §3) |

## 3. Logs buiten de databank
- **Server-console** (Cloudflare/Lovable): foutmeldingen. `gerechtFoto` en andere logs zetten alleen een korte foutboodschap, geen inhoud. Bewaartermijn: bij de hostingleverancier, **te verifiëren**.
- **Browser:** `localStorage` met sessie, voorkeuren, de exacte locatie (weer, onafgerond) en de offline wachtrij.

## 4. Externe diensten (verwerkers)
| Dienst | Wat gaat erheen | Opmerking |
|---|---|---|
| Supabase (databank, auth, opslag) | alles | Verwerkersovereenkomst en regio (EU?): te verifiëren |
| Lovable (hosting, AI-gateway, e-mail) | receptteksten, foto's, links (AI); e-mailadressen (e-mail) | AI-gateway stuurt door naar Google (Gemini). Doorgifte buiten de EU: te verifiëren |
| Resend (e-mail, adapter) | e-mailadres, inhoud | Alleen als geconfigureerd |
| Google Fonts | **IP-adres van elke bezoeker** (fonts.googleapis.com/gstatic) | Bekend AVG-risico (Duitse rechtspraak 2022). Voorstel: lettertypen zelf hosten |
| Open-Meteo | **exacte** coördinaten (alleen na toestemming voor locatie) | Voorstel: afronden op ±1 km (2 decimalen) |
| Brave Search / DuckDuckGo | zoektermen (receptzoeken) | Geen identiteit meegestuurd (server-side); te verifiëren |
| Web push (Google FCM, Apple, Mozilla) | versleutelde melding, endpoint | Standaard |

## 5. Bevindingen (AVG)
| ID | Ernst | Bevinding |
|---|---|---|
| BUG-025 | Hoog | Foto's niet gewist bij accountverwijdering; gedeelde paden uit Inspiratie |
| BUG-026 / BUG-103 | Medium | Exports onvolledig; eigen export haalt `recipe_ingredients` zonder filter op (combinatie met S1: mogelijk ingrediënten van anderen) en botst op de grens van 1 000 rijen |
| BUG-105 / BUG-106 | Kritiek/Hoog | Recepten en foto's van iedereen leesbaar (SECURITY-AUDIT S1/S2): **datalek als het live zo staat** |
| BUG-107 | Medium | Google Fonts laadt bij elke bezoeker van Google (IP-doorgifte zonder toestemming) |
| BUG-108 | Laag | Exacte locatie naar Open-Meteo en in `localStorage` |
| BUG-109 | Medium | Geen bewaartermijnen voor telemetrie (`user_sessions`, `usage_events`, `app_errors`, `notification_log`) en geen automatische opschoning |
| BUG-110 | Medium | Gezin bij accountverwijdering: wat gebeurt er met een gezin waarvan de verwijderde gebruiker eigenaar is (lijsten, weekmenu, andere leden)? Niet bepaald en niet getest |

## 6. Wat lokaal kan en wat staging vereist
| Test | Lokaal (nep-Supabase / PGlite) | Staging |
|---|---|---|
| Volledigheid van de export (alle tabellen §1) | ✓ unit + E2E | – |
| Accountverwijdering: welke serveraanroepen, welke paden gewist | ✓ met een nep-Storage-endpoint | echte `deleteUser` + cascade + Storage |
| Gedeelde foto's niet stuk (Inspiratie) | ✓ logica | ✓ echte bucket |
| Gezinsgegevens na verwijdering | 🟡 logica | ✓ cascade |
| Toegangsrechten (RLS) | ✓ PGlite (databank) | ✓ incl. Storage |
| Auditlog wordt geschreven | ✓ | ✓ trigger `block_audit_mutation` |
