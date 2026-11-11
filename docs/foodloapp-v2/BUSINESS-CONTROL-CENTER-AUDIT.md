# Business Control Center en financieel controlecentrum: audit en voorstel

Stand 2026-11-11, branch `v2/dev` (lokaal, niet gepusht). Onderzocht vanaf commit `f5bc8dd`. De fixes staan in de commit die bij dit document hoort (zie masterplan §21).

**Hoe gemeten**
- Code gelezen: alle 43 beheerroutes, `admin.functions.ts`, `monitoring.functions.ts`, `finance.functions.ts`, `meldingen-admin.functions.ts`, `user-intelligence.functions.ts` en de RLS-migraties.
- In de lokale demo getest: Chromium, nep-Supabase met fictieve gegevens, op 390 en 1280 px. Zes rollen getest met `tests/e2e/audit-persona-az.spec.ts` (AUDIT=1, verkennend) en `tests/e2e/beheer-rechten.spec.ts` (harde poort).

**Wat niet kon:**
- **Geen echte Supabase**, dus RLS-policies, `auth.admin`, back-ups en realtime niet getest.
- **Geen betaalprovider:** er bestaat er geen.
- **Geen productiecijfers.** Alle bedragen in de schermafdrukken zijn demo-waarden (€ 0,00 en 50 credits).

Legende:
- ✅ bestaat en werkt (in de demo);
- 🟡 gedeeltelijk;
- 👁 alleen visueel of als tijdelijke tekst;
- ❌ niet gebouwd;
- 🔒 niet testbaar zonder externe dienst of staging.

---

## 1. Samenvatting voor de eigenaar
1. **Wat al goed is: het operationele beheer van een gratis app.**
   - Gebruikers zoeken, bekijken, blokkeren, exporteren en verwijderen; gezinnen; support-tickets (uit feedback); activiteit en fouten.
   - Het AI-verbruik en de AI-kosten per functie, met een maandbudget en waarschuwingen.
   - Een auditlogboek dat niet te wijzigen is (databanktrigger). Snelheidslimiet per beheerder.
   - Het scherm Integraties toont eerlijk "Niet gekoppeld" bij betalingen.
2. **Wat er niet is: elke commerciële of financiële stroom.**
   - Er is geen betaalprovider, geen abonnement, geen creator, geen uitbetaling, geen btw en geen boekhoudexport.
   - De tabel `aankopen` wordt nergens door de app gevuld. "Omzet" is dus altijd € 0, en dat is correct.
3. **Het financiële scherm is een kostenscherm, geen financieel controlecentrum.**
   - "Resultaat" is omzet min AI-kosten. Hosting, e-mail, betaalkosten en software tellen niet mee.
   - Valuta worden blind opgeteld.
   - Totalen werden stil afgekapt bij 1 000 rijen. Dat is nu opgelost voor Finance (BUG-093).
4. **Rollen bestaan op papier, maar zijn onbruikbaar en lekten.**
   - Het Control Center laat alleen één vaste eigenaar-ID binnen. Andere teamleden kunnen er dus nooit in, ook niet met de rol "support".
   - Als die vergrendeling ooit weg moet, waren er twee problemen. Beide zijn in de app-laag opgelost:
     - support, analyst en content_manager zagen alle financiële cijfers (BUG-091);
     - meldingenbeheer omzeilde de rollen volledig (BUG-090).
   - **Twee problemen blijven open en vragen jouw akkoord:**
     - **MFA:** 2FA wordt niet afgedwongen op de server (BUG-095).
     - **RLS:** RLS-policies geven elke beheerdersrij rechtstreeks leesrecht op kosten-, credit- en sessietabellen (BUG-097).
5. **Advies.** Bouw geen financieel controlecentrum voordat er een betaalmodel en een betaalprovider gekozen zijn (G-beslissing B5).
   - Doe eerst fase 0 (§9): beveiliging en rollen, en eerlijke labels.
   - Kies daarna één betaalarchitectuur.

---

## 2. Functiematrix: beheer en systeem (wat er werkelijk is)
| Domein | Functie | Status | Bewijs / opmerking |
|---|---|---|---|
| Toegang | Vaste eigenaar-ID + `admin_users` + rol + recht + alleen-lezen + snelheidslimiet (120 per minuut) | ✅ | `bewaker()` in `admin.functions.ts`. Test: een tweede super_admin die niet de eigenaar is, krijgt "Geen toegang" (schermafdruk Y-02) |
| Toegang | Rollen super_admin, admin, support, content_manager, analyst | 🟡 | Matrix bestaat, maar alleen de eigenaar komt binnen → rollen in de praktijk onbruikbaar (BUG-096). Geen rol "financieel beheerder" |
| Toegang | 2FA verplicht per rol | 👁 | Alleen een rode banner. De server levert de gegevens toch bij `aal1` (schermafdruk Y-09, BUG-095) |
| Toegang | Beheerders toevoegen (Team) | 🟡 | Scherm en upsert werken, maar het nieuwe teamlid komt nooit binnen door de eigenaarvergrendeling |
| Audit | Auditlogboek (wie, wat, IP, user-agent) | ✅ | Wijzigen of wissen geblokkeerd door de trigger `block_audit_mutation` 🔒 (trigger niet getest in de demo) |
| Audit | Sessielog beheerders | ✅ | `admin_sessions` |
| Dashboard | "Hoe gaat Foodlo?": actief vandaag, nieuwe gebruikers, kosten vandaag, gezondheid | ✅ | Schermafdruk Y-10/Y-20 |
| Dashboard | DAU / WAU / MAU | 🟡 | "Actief vandaag" en "Actief (7 dagen)" bestaan. Geen MAU, geen stickiness (DAU/MAU) |
| Dashboard | Registraties en uitstroom (churn) | 🟡 | Nieuwe gebruikers ✅. Uitstroom of verwijderde accounts ❌ |
| Dashboard | Actieve gezinnen | ✅ | Beheer → Gezinnen (tabel met leden, activiteit, kosten) |
| Dashboard | Actieve creators | ❌ | Creators bestaan niet |
| Dashboard | Gratis versus betalende accounts | ❌ | Er bestaan geen betalende accounts |
| Dashboard | Doorklikbare KPI's | 🟡 | Een deel ("Details", "Alle kosten"). Niet elke KPI |
| Gebruikers | Zoeken, detail, segmenten, vergelijken | ✅ | |
| Gebruikers | Blokkeren en deblokkeren met reden | ✅ | Gelogd |
| Gebruikers | AVG-export per gebruiker | 🟡 | Maar 7 tabellen (BUG-103, zie BUG-026) |
| Gebruikers | Account verwijderen (beheer en zelf) | 🟡 | Auth-gebruiker weg plus cascade. Foto's in Storage blijven staan (BUG-025) |
| Gebruikers | CSV-export | ✅ | Nu beveiligd tegen formule-injectie (BUG-092). Financiële soorten vragen `finance.view` (BUG-091) |
| Support | Tickets (uit feedback) met status nieuw / bezig / opgelost / gesloten | ✅ | Geen SLA, geen toewijzing aan een medewerker, geen antwoord via e-mail vanuit het ticket (inkomende e-mail "Niet gekoppeld") |
| Inhoud | Recepten, imports, teksten en aankondigingen, labels, klantenkaartwinkels | ✅ | |
| Moderatie | Meldingen of klachten over inhoud van gebruikers | ❌ | Nog niet nodig: er is geen publieke inhoud van gebruikers. Wordt verplicht zodra creators publiceren (DSA, §6) |
| Communicatie | Berichten en e-mail naar segmenten, pushmeldingen, standaarden | ✅ 🔒 | Verzenden niet getest (geen e-mail- of push-sleutel in de demo) |
| Systeem | Status: databank-ping, AI-sleutel, opslag, recente fouten | ✅ | |
| Systeem | Integraties | ✅ | Toont eerlijk "Niet gekoppeld" bij betalingen, App Store, Google Play en inkomende e-mail |
| Systeem | Feature flags (functies aan/uit) | ✅ | Beheer → Instellingen |
| Systeem | Achtergrondtaken | 🟡 | Één cron (meldingen) en handmatig "aggregeer nu". Geen overzicht van wachtrijen of mislukte taken |
| Systeem | Foutlog (app_errors) met detail | ✅ | Beheer → UI → Fouten |
| Systeem | Beveiligingsincidenten | ❌ | Geen incidentregister. Alleen het auditlog en de foutlog |
| Systeem | Back-ups en herstel | ❌ 🔒 | Hangt van het Supabase-plan af. Niets zichtbaar in het Control Center |
| Systeem | Migratiestatus | ❌ | Schema-drift (BUG-011, G1) |
| Systeem | AVG-verzoekenregister (inzage, wissen, termijn van 30 dagen) | ❌ | Alleen losse acties per gebruiker, geen register met termijnen |
| Fraude | Snelheidslimieten (beheer, AI, credits) | ✅ | Verder niets (geen detectie van meerdere accounts) |

## 3. Financiële functiematrix
| Onderwerp | Status | Wat er werkelijk is |
|---|---|---|
| Omzet (web, App Store, Google Play, abonnementen) | 👁 | Kaarten "Niet gekoppeld". De tabel `aankopen` bestaat, maar **de app schrijft er nooit in** |
| Creator memberships en commissies | ❌ | |
| Premium content | ❌ | |
| Creditpakketten kopen | 👁 | Pakketten met prijs zichtbaar als `kopenActief`. Knop "binnenkort beschikbaar" |
| "Betalingen actief"-schakelaar | 🟡 → ✅ | Was een val: aanzetten blokkeerde gebruikers zonder dat er gekocht kon worden. Kan nu niet meer aan zonder betaalprovider (BUG-094) |
| AI-kosten per functie | ✅ | Gemeten per oproep (`ai_usage.kost_eur`) uit `model_prices`. **Schatting op basis van de prijslijst**, niet afgestemd op de factuur van de AI-leverancier |
| AI-budget en waarschuwing | ✅ | Maandbudget (`ai_budget_maand_eur`) en een drempel in `credits.server.ts` |
| Hosting- en infrastructuurkosten | 👁 | **Handmatig ingestelde** waarde (credits per dag, euro per credit). Geen koppeling met een factuur |
| E-mail, push, Supabase, opslag, software | ❌ | Niet in de kosten opgenomen |
| Brutomarge en operationeel resultaat | 👁 | "Resultaat = omzet − AI-kosten". Misleidende naam (BUG-099) |
| Dag, week, maand en jaar | ✅ | Periodekeuze 7 / 30 / 90 dagen / jaar |
| Kosten per actieve gebruiker | 🟡 | Kost per gebruiker in Gebruikers en Gezinnen (alleen AI) |
| Cashflow en prognoses | ❌ | |
| Terugbetalingen en chargebacks | 👁 | Teller op basis van `status = refunded`. Geen terugbetalingsproces |
| Openstaande creator-uitbetalingen | ❌ | |
| Btw- en boekhoudexport | ❌ | CSV "kosten" is geen boekhoudexport |
| MRR, ARR, churn, conversie, ARPPU, proefperiodes | ❌ | |
| Verschil geboekt / ontvangen / terugbetaald / te betalen | ❌ | Één statusveld op `aankopen` |
| Totalen reproduceerbaar uit brontransacties | 🟡 → ✅ (Finance) | Werd stil afgekapt op 1 000 rijen (PostgREST). Nu gepagineerd en met fout bij falen (BUG-093). Andere beheerqueries met `.limit(5000)` hebben hetzelfde risico (open) |
| Valuta | ❌ | `bedrag_cent` wordt opgeteld ongeacht `valuta` (BUG-099) |
| Idempotentie, webhooks, dubbele uitbetaling | n.v.t. | Er zijn geen betalingen, webhooks of uitbetalingen. Ontwerp in §5 |
| Financiële gegevens van anderen afgeschermd | 🟡 | In de app: alleen eigen `aankopen` (limiet). Door de RLS-policies kan **elke beheerdersrij** kosten- en credittabellen lezen (BUG-097) |
| Demo-gegevens als werkelijk voorgesteld | ✅ geen | Het Finance-scherm zegt "alleen echte cijfers". In de demo staat overal € 0. **Risico:** de demo-omgeving heeft geen label "DEMO" in het Control Center. Voorstel: een vaste band "Demogegevens" wanneer `DEMO=1` (zie §7) |

## 4. Rollen en rechten: testresultaten
Getest in de demo (de nep-Supabase kent geen RLS, dus alleen de serverlaag is getest):

| Rol | Finance | Gebruikers | Resultaat vóór | Na de fix |
|---|---|---|---|---|
| Gewone gebruiker | geweigerd | geweigerd | ✅ | ✅ |
| Tweede super_admin (niet de eigenaar) | geweigerd | geweigerd | ✅ (eigenaarvergrendeling) | ✅ |
| support | **zag de cijfers** | ziet ze (mag) | ❌ | ✅ geweigerd. Getest in `beheer-rechten.spec.ts`; faalt op de oude code |
| analyst | **zag de cijfers** | server weigert, UI toont "0 gebruikers" | ❌ | ✅ geweigerd. UI-melding nog open (BUG-098) |
| content_manager | **zag de cijfers** | idem | ❌ | ✅ geweigerd |
| super_admin met verplichte 2FA, sessie zonder 2e stap | **zag de cijfers** (alleen een banner) | idem | ❌ | ❌ open (BUG-095, vraagt akkoord) |
| Financieel beheerder | — | — | rol bestaat niet | voorstel: rol `finance` met `dashboard.view` + `finance.view` + `audit.view` |

**Gewenste rollen** (voorstel, nog niet gebouwd):
- **Eigenaar:** alles. 2FA verplicht. Enige die betalingen en uitbetalingen kan aanzetten.
- **Financieel beheerder:** finance, export en auditlog lezen. Geen persoonsgegevens buiten de transacties. Geen gebruikersbeheer.
- **Support:** gebruikers zoeken, tickets. **Geen** finance, geen beveiliging, geen privé-inhoud zonder aparte vlag. Inzage gelogd.
- **Contentmoderator:** inhoud en meldingen, recepten verbergen. Geen gebruikersgegevens buiten de melding.
- **Creator:** alleen eigen statistieken en uitbetalingen, **via de gewone app**, nooit via het Control Center.
- **Gewone gebruiker:** niets in het beheer.

## 5. Financiële architectuur (voorstel voor België en de EU)
**Uitgangspunten**
- Nooit zelf kaartgegevens zien of bewaren: de gehoste checkout of de elementen van de provider houden ons buiten PCI-scope (SAQ A).
- Elke euro in het Control Center is te herleiden tot een **onwijzigbare grootboekregel** (append-only `ledger_entries`), die op haar beurt te herleiden is tot een gebeurtenis van de provider (`provider_event_id`, uniek).
- Webhooks: handtekening controleren, het ruwe event eerst bewaren (`payment_events`, uniek op event-id = idempotent) en daarna verwerken in een taak die opnieuw mag lopen.
- Uitbetalingen aan creators gebeuren **door de provider** (Connect / split payments), niet door ons. Een uitbetaling heeft een unieke sleutel per creator en periode, dus nooit dubbel.

**Kandidaten** (tarieven niet geverifieerd voor België; controleer vóór een beslissing)
| Optie | Sterk | Zwak / aandachtspunt |
|---|---|---|
| **Stripe Billing + Connect (Express)** | Volledig: abonnementen, proefperiodes, facturen, Customer Portal (zelf opzeggen), Connect-onboarding met KYC, uitbetalingen, Stripe Tax. Bancontact via Stripe | Prijs per actief verbonden account en per uitbetaling (de openbare prijspagina noemt 0,25 % + vast bedrag per uitbetaling; een euro-tarief voor België niet gevonden). Wie is "merchant of record" voor de btw: zie hieronder |
| **Mollie (+ Mollie Connect / split payments)** | Belgisch-Nederlands, Bancontact sterk, eenvoudige prijs per transactie, abonnementen via "Subscriptions" | Minder volwassen voor marktplaatsen (onboarding van creators, rapportering). Bancontact-tarief op de eigen sites inconsistent (vast € 0,39 versus % + € 0,25) |
| **Merchant of record (Paddle, Lemon Squeezy)** | Zij zijn de verkoper: btw, OSS, facturen en terugbetalingen geregeld | Niet gemaakt voor uitbetalingen aan veel creators (marktplaats). Hogere vergoeding |
| **App Store / Google Play** | Nodig als er een native app met digitale inhoud komt | 15–30 % commissie. Andere regels. Niet nodig zolang Foodlo een PWA/web-app is |

**Advies:** Stripe Billing voor Foodlo-abonnementen (fase 2). Stripe Connect Express pas voor creator memberships (fase 3), na juridisch advies over de btw-rol.

**Juridisch en fiscaal (geen advies; laten valideren door een boekhouder of jurist)**
- **Btw.** Elektronische diensten aan consumenten in de EU: btw van het land van de klant, via OSS. Een platform dat elektronische diensten van derden (creators) verkoopt, wordt in de EU vermoed in eigen naam te handelen (art. 9bis Uitvoeringsverordening 282/2011). Dan factureert **Foodlo** de btw op het hele bedrag, niet de creator.
- **DAC7.** Platformen die verkopers of dienstverleners (creators) laten verdienen, moeten in België hun gegevens verzamelen en jaarlijks rapporteren aan de FOD Financiën. Bewaartermijn: zie de huidige richtlijnen van de FOD.
- **Herroepingsrecht.**
  - Voor digitale inhoud geldt een herroepingstermijn van 14 dagen. Die vervalt alleen met uitdrukkelijke toestemming en erkenning bij directe levering.
  - **Herroepingsknop:** Richtlijn 2023/2673 voegt een verplichte online "herroepingsfunctie" toe voor overeenkomsten op afstand, van toepassing vanaf 19 juni 2026. Volgens een advocatenkantoor (juni 2026) was die in België nog niet omgezet.
  - Opzeggen moet even eenvoudig zijn als afsluiten.
- **DSA.** Zodra gebruikers inhoud publiceren: een meldingsmechanisme ("notice and action"), een motivering bij verwijdering, en een contactpunt.
- **AVG.** Transactie- en uitbetalingsgegevens: bewaartermijn voor de boekhouding (België: 7 jaar voor boekhoudstukken; nakijken). Gescheiden van de app-gegevens. Afgeschermd van support.

## 6. Ontbrekende functionaliteit (prioriteit)
| Prio | Wat | Waarom |
|---|---|---|
| P0 | 2FA afdwingen op de server; RLS `is_admin` vervangen door rolgebonden rechten | Beveiliging; vóór een tweede teamlid |
| P0 | Rollen echt bruikbaar maken (eigenaarvergrendeling vervangen door "eigenaar + toegelaten teamleden met 2FA") | Anders kan niemand helpen met support |
| P0 | Band "Demogegevens" in het Control Center bij `DEMO=1` | Demo nooit verwarren met echte cijfers |
| P1 | Kostenposten: Supabase, hosting, e-mail, opslag, domein en software als handmatige maandkost met bron (factuur-id); "Resultaat" hernoemen of volledig maken | Eerlijke marge |
| P1 | AVG-register (verzoek, datum, termijn, afhandeling) en volledige export (BUG-026/103); foto's wissen (BUG-025) | Wettelijk |
| P1 | Supportticket: toewijzen, antwoorden, SLA | Werkbaarheid |
| P2 | Betaalarchitectuur fase 2 (abonnementen) | Na beslissing B5 |
| P3 | Creatorketen (§5, CREATOR-GAP-ANALYSE.md) | Na fase 2 en juridisch advies |

## 7. UX/UI van het controlecentrum
**Gemeten:**
- **Op 390 px:** 0 ernstige axe-meldingen, geen zijscroll, 0 tikdoelen onder 24 px.
- **Navigatie:** zes hoofdsecties met tabbladen.

**Kritisch:**
- **Tabellen op de telefoon** scrollen horizontaal. Bruikbaar, maar een eigenaar die onderweg "wie heeft er problemen?" wil zien, heeft kaarten nodig.
  - Voorstel per rij: één kaart met naam, status en één actie. De details staan op een detailpagina.
- **Prioriteiten op het dashboard.** "Foodlo draait goed" bovenaan is goed. Ontbreekt: een vaste lijst "Vraagt jouw aandacht" (open tickets ouder dan 48 u, mislukte meldingen, budget > 80 %, fouten die stijgen) met één tik naar de oorzaak.
- **Geen recht = lege tabel.** "0 gebruikers" waar het "je rol mag dit niet zien" moet zijn (BUG-098). Een niet-technische eigenaar denkt dan dat er geen gebruikers zijn.
- **Financiële periodes:** 7 / 30 / 90 / jaar bestaat. Kalendermaand en kwartaal ontbreken; die zijn nodig voor btw en boekhouding.
- **Woorden:**
  - "Resultaat" en "Refunds" (Engels) naast Nederlandse labels;
  - "Kosten (AI)" naast "Hosting: zie Kosten" verwart.
  - Voorstel: "Omzet · Kosten (alle) · Marge", met een uitlegicoon per KPI.
- **Gevoelige acties:**
  - Verwijderen vraagt "VERWIJDER" en wordt gelogd ✅.
  - Blokkeren vraagt een reden ✅.
  - "Credits toekennen" en "Betalingen actief" hebben geen tweede bevestiging. Het eerste is laag risico; het tweede is nu vergrendeld.

## 8. Toegangs- en beveiligingsbevindingen (samengevat)
| ID | Ernst | Wat | Status |
|---|---|---|---|
| BUG-090 | Medium | Meldingenbeheer gebruikte `is_admin`: geen eigenaarscontrole, rol, alleen-lezen, limiet of log | Opgelost en getest |
| BUG-091 | Hoog* | Finance, kosten en credits (scherm en CSV) leesbaar voor support, analyst en content_manager | Opgelost en getest |
| BUG-092 | Medium | CSV-injectie in de beheerexports | Opgelost en getest |
| BUG-093 | Hoog | Financiële totalen stil afgekapt op 1 000 rijen | Opgelost voor Finance, gedeeltelijk getest |
| BUG-094 | Hoog | "Betalingen actief" zonder provider blokkeert gebruikers | Opgelost en getest |
| BUG-095 | Hoog* | Verplichte 2FA niet afgedwongen op de server | Goedkeuring nodig |
| BUG-096 | Medium | Rollen onbruikbaar door de vaste eigenaar-ID; geen financiële rol | Productbeslissing |
| BUG-097 | Hoog* | RLS: elke actieve beheerdersrij leest rechtstreeks `ai_usage`, `credit_transactions`, `user_credits`, `user_sessions`, … (ook analyst of alleen-lezen). `claim_first_admin()`: correctie, volgens de repo niet aanroepbaar door gebruikers (SECURITY-AUDIT S6) | Goedkeuring nodig (migratie, G1) |
| BUG-098 | Laag | Geen recht wordt getoond als een lege lijst | Open |
| BUG-099 | Medium | "Resultaat" telt alleen AI-kosten; valuta worden opgeteld | Open |

\* Vandaag beperkt door de eigenaarvergrendeling: alleen de eigenaar komt binnen. Het risico wordt reëel zodra een tweede beheerder toegang krijgt, of bij BUG-097 zodra er een tweede rij in `admin_users` staat. **Of dat in productie al zo is, is niet gecontroleerd.**

## 9. Fasering
| Fase | Inhoud | Databank? | Toestemming |
|---|---|---|---|
| **0. Nu (lokaal)** | Fixes BUG-090 t/m 094 (gedaan); band "Demogegevens"; meldingen bij geen recht; UI-teksten Finance | Nee | Push |
| **1. Beveiliging en rollen** | 2FA op de server (met noodprocedure voor de eigenaar); RLS van `is_admin` naar `has_admin_role(…, rol)` per tabel; `claim_first_admin` intrekken; rol `finance`; eigenaarvergrendeling → lijst met toegelaten teamleden | Ja (migratie) | G1 staging + akkoord |
| **2. Abonnementen** | Stripe Billing (test-modus op staging): `subscriptions`, `payment_events` (idempotent), `ledger_entries` (append-only), MRR/ARR/churn uit de ledger, Customer Portal, herroepingsknop | Ja | B5 + juridisch advies + staging |
| **3. Kosten volledig** | Tabel `kostenposten` (maand, leverancier, bedrag, factuur-ref); marge en kost per actieve gebruiker | Ja | Akkoord |
| **4. Creators** | Zie CREATOR-GAP-ANALYSE.md: profielen, publicatie, moderatie (DSA), Connect, uitbetalingen, DAC7 | Ja | Afzonderlijk akkoord |
| **5. Boekhouding** | Maand- en kwartaalexport (btw, OSS), afstemming met de providerrapporten | Ja | Boekhouder |

## 10. Benodigde databankwijzigingen (voorstel, niet uitgevoerd)
- **Fase 1:**
  - `admin_users.role` uitbreiden met `finance`;
  - RLS-policies op `ai_usage`, `ai_cache`, `credit_transactions`, `user_credits`, `user_sessions`, `daily_*_stats`, `app_errors`, `model_prices` en `loyalty_scan_events` van `is_admin(auth.uid())` naar een rolgebonden functie;
  - `REVOKE EXECUTE ON FUNCTION claim_first_admin()`.
- **Fase 2:**
  - `subscriptions` (user_id, provider_ref uniek, plan, status, periode, `cancel_at`);
  - `payment_events` (provider, event_id **uniek**, payload jsonb, ontvangen_at, verwerkt_at);
  - `ledger_entries` (append-only via trigger: soort `charge/refund/fee/payout/chargeback`, bedrag_cent, valuta, btw_cent, land, bron_event_id);
  - views voor MRR en churn.
- **Fase 3:** `kostenposten`.
- **Fase 4:** `creators`, `creator_plans`, `memberships`, `payouts` (uniek per creator en periode), `content_reports`.

Alles met RLS: gebruikers zien alleen hun eigen abonnement en betalingen; creators hun eigen omzet en uitbetalingen; support niets financieels.

## 11. Externe diensten en verwachte kosten (te verifiëren)
| Dienst | Waarvoor | Kost (indicatief, niet geverifieerd voor België) |
|---|---|---|
| Stripe (Billing, Connect, Tax) | Betalingen, abonnementen, uitbetalingen | % + vast bedrag per transactie; Connect: per actief account en per uitbetaling; Billing en Tax: % van het volume |
| Mollie (alternatief) | Bancontact, kaarten | Per transactie, geen vaste kost |
| Supabase Pro | Back-ups, meer opslag, point-in-time recovery (add-on) | Vaste maandprijs plus gebruik |
| Boekhouder of jurist | Btw-rol, DAC7, algemene voorwaarden, herroepingsknop | Eenmalig en jaarlijks |

Er worden **geen kosten gemaakt** zonder jouw akkoord.

## 12. Wat toestemming vereist
1. Fase 1-migratie (rollen, RLS, 2FA): staging (G1), daarna productie.
2. Keuze van betaalprovider en betaalmodel (B5), plus juridisch advies over de btw-rol en DAC7.
3. Elke betaalde dienst (Stripe- of Mollie-account, Supabase Pro).
4. Push van deze commits naar `v2/dev`.

### Bronnen (tarieven en regelgeving, geraadpleegd 2026-11-11)
- [Stripe Connect-prijzen](https://stripe.com/connect/pricing) en [Stripe Global Payouts-prijzen](https://docs.stripe.com/global-payouts/pricing)
- [Mollie Bancontact](https://www.mollie.com/gb/payments/bancontact) en [Mollie Bancontact (tweede tariefvermelding)](https://mollie.com/en/payments/bancontact)
- [FOD Financiën: DAC7](https://finance.belgium.be/en/E-services/dac7/introduction), [Deloitte: DAC7-wijzigingen](https://www.deloitte.com/be/en/services/tax/blogs/updates-to-dac7-reporting-and-registration-obligations-following-belgium-s-new-tax-law.html) en [PwC: DAC7 in België](https://news.pwc.be/key-insights-and-practical-challenges-as-we-enter-the-third-year-of-dac-7-compliance-in-belgium/)
- [Van Bael & Bellis: de online herroepingsknop (juni 2026)](https://vbb.com/wp-content/uploads/2026/06/8-06-26-The-online-withdrawal-button.pdf), [Hogan Lovells](https://www.hoganlovells.com/en/publications/eu-consumer-protection-law-update-new-mandatory-withdrawal-button-what-online-traders-need-to-know) en [Greenberg Traurig](https://www.gtlaw.com/en/insights/2026/5/eu-consumer-law-new-withdrawal-button-requirements-for-online-contracts)
