# Risico- en kostenanalyse (VOORSTEL)

> Samengevat in [`docs/foodlo/AI_ARCHITECTURE.md`](../foodlo/AI_ARCHITECTURE.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11. **Ramingen, geen offertes.** Er is niets aangeschaft of geactiveerd. Prijzen komen uit openbare bronnen of derden en moeten vóór aankoop op de officiële prijspagina nagekeken worden. Onzekerheden staan erbij.

## 1. Kosten
| Dienst | Waarvoor | Soort | Raming | Onzekerheid en bron |
|---|---|---|---|---|
| Apple Developer Program | iOS-app, TestFlight, APNs | Terugkerend | ± $99 / ± €99 per jaar | Officieel $99; facturen tonen ± €99 ([Apple fee waiver](https://developer.apple.com/support/fee-waiver), [factuur](https://opencollective.com/actual/expenses/279604)) |
| Google Play Console | Android-app | Eenmalig | Vaak $25 vermeld | **Niet bevestigd** in deze ronde |
| D-U-N-S-nummer | Organisatieaccount | Eenmalig | Meestal gratis via Apple | Tot ± 30 dagen doorlooptijd ([Choicely](https://www.choicely.com/blog/google-play-12-tester-rule)) |
| Lovable (plan) | Hosting, bouwen | Terugkerend | Pro vanaf ± $25/maand + gebruik Cloud/AI | Derden, datums verschillen ([Activepieces](https://www.activepieces.com/blog/lovable-cloud-pricing-in-2026-and-what-a-build-costs), [Hatchable](https://hatchable.com/articles/lovable-cloud-pricing-explained), [Zite](https://www.zite.com/blog/lovable-pricing)) |
| Lovable Cloud gebruik | Databank, opslag, netwerk, serverfuncties | Per gebruik | Hangt af van gebruikers en foto's | Stijgt met foto's (BUG-012) en realtime |
| Staging (apart project) | Veilig testen | Terugkerend (klein) | Mogelijk binnen het gratis gebruik | Nakijken bij de aanmaak (STAGING-PLAN §3 stap 1) |
| Lovable AI-gateway | Import, foto, ideeën | Per oproep | Begrensd door de bestaande budgetrem | Per model; fase 2 begint zonder extra AI |
| Weerdata Open-Meteo | Weer en verwachting | Terugkerend | Gratis = **niet-commercieel**; commerciële plannen geschat tussen ± €5 en ± €30 per maand | Bronnen spreken elkaar tegen ([Open-Meteo](https://open-meteo.com/en/pricing), [apispine](https://apispine.com/open-meteo/pricing), [europeanpurpose](https://europeanpurpose.com/tool/open-meteo)); met een cache per gemeente blijven de oproepen laag |
| Push iOS (APNs) | Meldingen | Gratis | € 0 | Inbegrepen bij het Apple-account |
| Push Android (FCM) | Meldingen | Gratis | € 0 | Firebase Cloud Messaging |
| Monitoring en foutlogging | Fouten in de app | Optioneel | € 0 (eigen `app_errors`, bestaat) tot een betaalde dienst | Bestaande logging volstaat voor de start |
| Opslag van video's | Tutorials | Klein | ± 1–2 MB per video | Binnen de opslag; een videodienst is niet nodig |
| Jurist of boekhouder | Privacy, voorwaarden, btw, DAC7 | Eenmalig + jaarlijks | Onbekend | Offerte vragen |
| Betalingen (Stripe/Mollie) | Creators, abonnementen | Per transactie | % + vast bedrag | Pas na B5 (BUSINESS-CONTROL-CENTER-AUDIT §11) |
| Toestellen voor tests | 2 iPhones, 2 Android | Eenmalig | Eigen of geleende toestellen | — |

**Grootteorde voor de eerste lancering** (zonder creators of betalingen):
- **Vast:** Apple ± €99 per jaar, Google eenmalig, Lovable-plan per maand en een eventuele weerlicentie per maand.
- **Variabel:** Lovable Cloud en AI per gebruik.
- **Per actieve gebruiker:** hangt vooral af van foto's en AI-oproepen. De budgetrem en de cache houden AI-kosten begrensd.
- **Wat we nog niet weten:** een betrouwbaar bedrag per gebruiker. Dat kan pas met metingen op staging en in de begeleide test.

## 2. Risico's
| Risico | Soort | Kans | Impact | Maatregel |
|---|---|---|---|---|
| Apple wijst de app af als "alleen een website" (richtlijn 4.2) | Technisch / store | Hoog met de huidige `server.url` | Hoog | App-shell meeleveren, native push, offline-stand (MOBIELE-STRATEGIE §2) |
| TanStack Start laat zich moeilijk als app-shell bouwen | Technisch | Middel | Hoog | Eerst onderzoeken op staging; terugvaloptie: `server.url` + sterke native functies |
| Web push werkt niet in de native app | Technisch | Zeker | Middel | Native push (APNs/FCM) |
| Geen staging → geen migraties en geen echte toesteltests | Operationeel | Zeker zolang er geen staging is | Hoog | Beslissing 1 |
| Repo en live verschillen (BUG-011) | Technisch | Bekend | Hoog | Schemavergelijking op staging |
| Eigenaar buitengesloten van het Control Center | Operationeel | Laag (BUG-113/121 opgelost) | Hoog | 2FA-stappenplan, reserve, oefening op staging |
| Gezondheidsgegevens lekken (allergieën en dieet) | Privacy | Laag (toestel-only) | Zeer hoog | Toestel-only, 0004/0005, nooit naar AI of push |
| Weerdienst ziet IP-adressen of locatie van gebruikers | Privacy | Middel bij oproepen vanuit de app | Middel | Server-proxy + gemeente |
| Open-Meteo gratis gebruiken voor een commerciële app | Juridisch | Middel | Middel | Licentie kopen of een andere dienst |
| Proactieve meldingen worden als irritant ervaren | Product | Middel | Middel | Opt-in, max. 1 per dag, uitknop |
| Voorstellen voelen stereotiep of fout | Product | Middel | Middel | Leren uit de eigen geschiedenis, "Niet voor mij", uitleg |
| Allergiewaarschuwing mist iets | Product / juridisch | Middel | Hoog | Altijd "mogelijk" + "lees het etiket"; geen garantieclaim |
| AI-kosten lopen op | Financieel | Laag (budgetrem) | Middel | Rem, cache, fase 2 zonder AI |
| Help Center-artikels niet nagelezen → leeg in productie | Product | Middel | Laag | Beslissing 8 |
| 12-testersregel van Google (persoonlijk account) | Operationeel | Hoog bij een persoonlijk account | Middel | Organisatieaccount of de begeleide test als gesloten test |
| Lovable-conflicten bij grote wijzigingen | Technisch | Middel | Middel | Kleine commits, lint-ratchet, geen massale herformattering |
| Creatorbetalingen (btw, DAC7, uitbetalingen) | Juridisch / financieel | — (na lancering) | Hoog | Pas na B5 en juridisch advies |

## 3. Business Control Center: bronnen per onderdeel
| Onderdeel | Gegevensbron nodig | Integratie | Kost | Bij de eerste lancering? |
|---|---|---|---|---|
| Actieve gebruikers, registraties, retentie, activatie | `user_sessions`, `daily_*_stats`, `usage_events` (bestaan) | Geen | € 0 | **Ja** (bestaat grotendeels) |
| AI-kosten en budget | `ai_usage`, budgetrem (bestaan) | Geen | € 0 | **Ja** |
| Hostingkosten | Factuur of verbruik van Lovable | Handmatige invoer per maand (geen API bekend) | € 0 | Ja, als handmatige invoer met bron en datum |
| Softwarekosten (Apple, Google, weer) | Facturen | Handmatige invoer | € 0 | Ja, handmatig |
| Omzet, betalingen, terugbetalingen | Betaalprovider | Stripe of Mollie (na B5) | Per transactie | **Nee** (geen betalingen) |
| Kasstroom | Bank + betaalprovider | Boekhoudpakket of export | Onbekend | Nee |
| Creatorverplichtingen | Ledger + uitbetalingen | Stripe Connect | Per transactie | Nee |
| Financiële rapportering (btw, DAC7) | Boekhouding | Boekhouder | Jaarlijks | Nee, tot er omzet is |

Regel: wat geen echte bron heeft, wordt niet getoond. Demogegevens blijven duidelijk gemarkeerd (bestaat: demo-band).
