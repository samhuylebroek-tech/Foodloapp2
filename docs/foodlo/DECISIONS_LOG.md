# Beslissingenlog
**Bron van waarheid voor:**
- genomen beslissingen (met datum);
- open beslissingen;
- gates G1–G8;
- tegenstrijdigheden tussen documenten.

**Put uit:**
- `docs/foodloapp-v2/BESLISSINGEN-EIGENAAR.md` (blijft geldig voor de details van #1–#33 en B1–B9);
- `V2-IMPLEMENTATION-PLAN.md` (gates).

## 1. Gates (goedkeuring van de eigenaar vereist)
| Gate | Wat |
|---|---|
| G1 | Migratie op een gedeelde of echte databank (staging met echte infrastructuur, productie) |
| G2 | Wijziging aan RLS of rechten op een echte databank |
| G3 | Push of merge naar `main` of een Lovable-branch; elke merge van een PR |
| G4 | Deploy |
| G5 | Betalingen activeren |
| G6 | Geheimen roteren |
| G7 | Een functie of dode code verwijderen |
| G8 | Gegevens corrigeren of wissen op productie. Voorheen wel gebruikt maar niet gedefinieerd; vastgelegd op 2026-11-13 (T7). |
| G9 | Externe uitgaven: betaalde diensten, accounts, licenties |

**Altijd toegestaan, zonder aparte goedkeuring:** werk op een featurebranch, lokale tests, de nep-databank, documentatie, en pushen naar de featurebranch.

## 2. Genomen beslissingen
| ID | Datum | Beslissing | Gevolg |
|---|---|---|---|
| B1, B2, B4, B7, B8, B9 | ≤ 2026-11-11 | Zie BESLISSINGEN-EIGENAAR §A | — |
| BUG-112 | 2026-11-11 | De voorraad van het gezin is zichtbaar voor actieve leden | Behouden |
| D-2026-11-12-1 | 2026-11-12 | Schermreview top 10 aanpakken (productronde 1) | PR #1 |
| D-2026-11-12-2 | 2026-11-12 | Werken op featurebranches met PR's naar `v2/dev`, nooit automatisch mergen | Zie §1 |
| **D-2026-11-13-1** | 2026-11-13 | **Optie B, gefaseerde lancering.** **F1:** persoonlijke allergieën, voorkeuren en uitsluitingen op het account; de bestaande gezinsplanning; alle consumentenfuncties; de 14 invoermanieren; de assistent. **F2:** gezinsuitbreiding (allergieën en voorkeuren per lid, uitgebreide planning, eigen verzamelingen). **F3:** het commerciële geheel. Het Growth OS blijft architecturaal mogelijk, zonder F1 te vertragen. | MASTER_PRODUCT_VISION §4, COMPLETE_PRODUCT_INVENTORY §3 |
| **D-2026-11-13-2** | 2026-11-13 | Persoonlijke allergieën en gevoelige voedingsinformatie gaan **nooit** naar externe AI-diensten; er komt een expliciete privacylaag | AI_ARCHITECTURE §2 |
| **D-2026-11-13-3** | 2026-11-13 | **Ronde 2 goedgekeurd** (12 punten, DEVELOPMENT_ROADMAP §2), inclusief de privacyfix BUG-142 en de betaalpoort op de server BUG-143 | Uitvoeren op de featurebranch |
| D-2026-11-13-4 | 2026-11-13 | 0004 eerst technisch controleren en op staging uitvoeren; **0005 niet aanmaken of uitvoeren** | DATABASE_ARCHITECTURE §3, §5 |
| D-2026-11-13-5 | 2026-11-13 | Werken op de bestaande featurebranch `claude/sleepy-euler-eghoc3` | — |

## 3. Open beslissingen
Op volgorde van wat de lancering het meest blokkeert. De nummers #1–#33 komen uit BESLISSINGEN-EIGENAAR.

| ID | Beslissing | Mijn advies | Blokkeert |
|---|---|---|---|
| **#1** | Staging aanmaken (een apart Lovable-project) | Ja, zonder echte gegevens | migraties, toesteltest, lancering |
| **#24/#25** | Ontwikkelaarsaccounts Apple en Google (organisatie of persoon) | Nu starten: een D-U-N-S-nummer kan tot 30 dagen duren | stores |
| **#22** | Website in de app, of de app meeleveren | Starten met de website in de app, plus een offline-scherm en native push; tegelijk een proef met de meegeleverde app (MOBILE_ARCHITECTURE §3) | iOS, stores |
| **#27** | Jurist: privacyverklaring, voorwaarden, storeteksten | Ja | stores |
| **#26** | Echte toesteltest: welke toestellen, wie test | 2 iPhones en 2 Android-toestellen | lancering |
| **N-1** | Opzet van 0004b: persoonlijke voeding op het account (DATABASE_ARCHITECTURE §4) | Akkoord op de opzet. Het migratiebestand komt pas daarna en wordt eerst op staging uitgevoerd. | F1-eis FR-I-03 |
| **N-2** | Toegang tot het live schema, alleen lezen, om te vergelijken (BUG-011, #4) | Ja | 0004 en elke migratie |
| **N-3** | Beeldbeleid voor de startrecepten: ontworpen omslag, eigen foto's, beeldrechten of AI-illustraties | De ontworpen omslag voor F1 en echte foto's voor de 20 populairste recepten | premium uitstraling |
| #2 | 2FA voor het Control Center | Ja, eerst op staging | beveiliging van beheer |
| #3, #5, #6, #12 | 0002, 0004, bewaartermijnen, inactieve accounts | Zie BESLISSINGEN-EIGENAAR | AVG |
| #8 | Help-artikels nalezen | Iemand die schrijft voor ouderen | hulp in productie |
| #15/#16, #21 | Weer, locatie, budget | F2 | — |
| #18/#23 | Proactieve en native push | Ja, opt-in, maximaal 1 per dag | Apple 4.2 |
| #19, #10, #14, #20 | AI-budget, aantal vragen, starten zonder generatieve AI, gezondheidsgegevens | #20 is beslist via D-2026-11-13-2 | — |
| #28–#32 | Creators, betaalprovider, huishoudmodel, teamleden, BCC | F2/F3 | — |
| #33 | Back-ups en PITR | Nakijken vóór de eerste migratie | migraties |

## 4. Tegenstrijdigheden (niets weggehaald)
| # | Tegenstrijdigheid | Oplossing | Stand |
|---|---|---|---|
| T1 | Verzamelingen en allergieën per lid in F1 of in F2 | Beslist: optie B (D-2026-11-13-1) | opgelost |
| T2 | Belofte "allergieën nooit naar AI" tegenover het vrije veld | BUG-142, ronde 2 | in uitvoering |
| T3 | Betaalpoort alleen in de interface | BUG-143, ronde 2 | in uitvoering |
| T4 | Migratienummers 0004 en 0005 dubbel gebruikt | Nieuwe nummering (DATABASE_ARCHITECTURE §2) | opgelost in de docs |
| T5 | Testaantallen verschillen per document | Alleen IMPLEMENTATION_STATUS telt, met datum | opgelost in de docs |
| T6 | AVG-AUDIT §9–10 verouderd (BUG-025/110) | Verwijzing bovenaan AVG-AUDIT | opgelost |
| T7 | G8 niet gedefinieerd | §1 | opgelost |
| T8 | Help Center 22 of 24 artikels | Code telt 24 | opgelost |
| T9 | Push-controle eist `v2/dev` | Script toelaten op featurebranches, `main` nooit (ronde 2) | in uitvoering |
| T10 | 8 overlappende plannen | `docs/foodlo/` als bron, oude docs met verwijzing | opgelost |
| T11 | `@capacitor/ios` zonder iOS-project | RELEASE_PLAN M1 | gepland |
| T12 | Growth OS staat nergens | INDUSTRY_AND_GROWTH_FUTURE | opgelost |
