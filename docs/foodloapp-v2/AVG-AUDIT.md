# AVG-audit Foodloapp V2: inventaris van persoonsgegevens

> Samengevat in [`docs/foodlo/PRIVACY_AND_SECURITY.md`](../foodlo/PRIVACY_AND_SECURITY.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis. **Let op:** §9–10 noemen BUG-025/110 "niet gebouwd". Dat is verouderd: ze zijn opgelost en lokaal getest (zie BUG-REGISTER).

Stand 2026-11-11, branch `v2/dev`. Fase 1 (inventaris) en **fase 2 (verbeteringen en tests, §7–§10)**. Er is geen databank gewijzigd.

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

## 7. Fase 2: uitgevoerd en getest (lokaal)
| Onderwerp | Wat | Bewijs |
|---|---|---|
| Export (BUG-026/103) | Eén gedeelde, volledige export voor gebruiker en beheer (`avg-export.server.ts`): 32 secties (profiel, recepten, ingrediënten, foto's als paden, versies, beoordelingen, favorieten, imports, weekmenu, lijsten, historiek, vaste boodschappen, voorraad, gezinnen, lidmaatschappen, deelrechten, kaarten, scans, meldingen, toestellen, credits, boekingen, aanvragen, aankopen, AI-gebruik, feedback, sessies, gebeurtenissen, dagstatistieken, fouten). Elke query filtert op de gebruiker of op diens eigen recept-id's, alles gepagineerd | `avg-export.test.ts` (5: secties, filter op elke query, niets van een ander, geheimen weg, 1 205 recepten volledig); `avg-export.spec.ts` (download via Instellingen, niets van een vreemde) |
| Bewust **niet** in de export (beslissing eigenaar) | kaartnummer, push-sleutels en endpoint (geheimen in een gedownload bestand); `admin_note`; interne kostprijs `kost_eur` | Ook als een laag de kolomkeuze negeert, worden ze eruit gefilterd (getest) |
| Google Fonts (BUG-107) | Fraunces en Figtree zelf gehost (`@fontsource-variable` 5.3.0); Outfit was ongebruikt en is weg | `privacy.spec.ts`: 0 verzoeken naar Google, beide lettertypen geladen |
| Locatie (BUG-108) | Afgerond op 2 decimalen (±1 km), ook een eerder bewaarde exacte positie | `weer-privacy.test.ts`. **Opgelet:** `haalWeer` wordt in V2 nergens aangeroepen; er gaat nu dus geen locatie naar Open-Meteo |
| Accountverwijdering | De server wist alleen het eigen account (`/auth/v1/admin/users/<eigen id>`) | `account-verwijderen.spec.ts`; foto-opruiming als `test.fail` (BUG-025 open) |

## 8. Bewaartermijnen (BUG-109): voorstel 0003, uitvoerbaar maar niet uitgevoerd
| Gegevens | Termijn (voorstel) | Na de termijn |
|---|---|---|
| `usage_events`, `user_sessions`, `ai_events` | 13 maanden | wissen |
| `app_errors`, `notification_log` | 6 maanden | wissen |
| `daily_user_stats` | 25 maanden (jaarvergelijking) | wissen |
| `admin_rate_limits` | 1 dag | wissen |
| `ai_usage`, `recipe_import_jobs`, `loyalty_scan_events` | 13 maanden | **pseudonimiseren** (`user_id` leeg); kostentotalen blijven kloppen |
| `admin_audit_log` | niet automatisch (gerechtvaardigd belang, onwijzigbaar) | termijn vastleggen in het privacybeleid (voorstel: 3 jaar, dan handmatig archiveren) |

- **SQL:** `migratie-voorstel/0003_bewaartermijnen.{up,down}.sql`, met de functie `ruim_telemetrie_op()` (alleen `service_role`) en een wekelijkse pg_cron-taak.
- **Test:** `tests/rls/bewaartermijnen.mjs`:
  - alleen de oude rijen verdwijnen;
  - de AI-kosten blijven € 0,03;
  - een gewone gebruiker wordt geweigerd;
  - terugdraaien verwijdert de functie.
- **De termijnen zijn een voorstel; jij kiest.**

## 9. Gezinseigenaar verwijdert zijn account (BUG-110): gemeten
`tests/rls/verwijder-gezinseigenaar.mjs` (echte cascades, lokale PostgreSQL):

| Onderdeel | Voor | Na | Gevolg |
|---|---|---|---|
| Gezin (`groups`) | 1 | 1 | Blijft bestaan, **zonder eigenaar** (`owner_id` heeft geen foreign key) |
| Lidmaatschap van een ander lid | 1 | 1 | Lid zit in een gezin dat niemand nog kan beheren |
| Gezinslijst | 1 | **0** | Verdwijnt (staat op naam van de eigenaar) |
| Items die **een ander lid** op de gezinslijst zette | 1 | **0** | **Dataverlies voor een ander gezinslid** |
| Gezinsweekmenu door een ander lid | 1 | 1 | Blijft (hangt aan een gezin zonder eigenaar) |
| Deelrecht naar een vriend | 1 | 0 | Correct weg |
| Recepten van de eigenaar | 1 | 0 | Correct weg |

**Voorstel (ontwerpbeslissing, niet gebouwd):** vóór `deleteUser` in `verwijderMijnAccount`:
1. is er een ander actief lid? Dan wordt het langst actieve lid eigenaar van het gezin en van de gezinslijst (`groups.owner_id`, `shopping_lists.user_id`). Beide krijgen een melding.
2. Is er geen ander lid? Dan wordt het gezin gewist.

Daarnaast een foreign key `groups.owner_id → auth.users` met `ON DELETE RESTRICT`, zodat het nooit meer stil gebeurt. Migratie, dus staging. **Vraagt jouw beslissing.**

## 10. Foto's wissen zonder gedeelde inspiratiefoto's te breken (BUG-025): analyse
**Gemeten:** na het verwijderen van de eigenaar
- verwijzen `inspiration_recipes.image_url` en het recept van een ander gezinslid (bewaard uit Inspiratie) nog naar `{eigenaar}/lasagne.jpg`;
- het bestand blijft staan.

Een opruiming die blind `{eigenaar}/` wist, breekt dus de foto's van anderen.

**Voorstel (twee fasen, zoals STAGING-VOORSTELLEN §3, nu met bewijs):**
1. **Geen gedeelde paden meer:**
   - bij "Bewaren uit Inspiratie" de foto server-side **kopiëren** naar `{eigen id}/…` (`storage.copy`);
   - bestaande gedeelde verwijzingen eenmalig omzetten (script op staging).
2. **Bij accountverwijdering**, per object in `{id}/`:
   - wordt het nog gebruikt door `recipes.image_url` of `recipe_photos.path` van **iemand anders**, of door `inspiration_recipes.image_url`? Dan eerst kopiëren naar die eigenaar (of een `inspiratie/`-map) en de verwijzing bijwerken;
   - daarna wissen via de Storage-API.
   - Een log zonder persoonsgegevens (aantal gewist, aantal gekopieerd).
3. **Test:** lokaal kan de referentieregel (welke paden in gebruik zijn) met PGlite getest worden; echt kopiëren en wissen kan alleen op staging.

Fase 2 wist gegevens en vraagt **expliciet akkoord**. Er is niets gebouwd.
