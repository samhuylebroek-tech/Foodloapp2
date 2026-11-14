# Releaseplan F1 (eerste consumentenlancering)
**Bron van waarheid voor:** lanceringsvoorwaarden, blokkades, staging en stores.

**Put uit:**
- `LANCERINGSPLAN-V2.md`;
- `STAGING-PLAN-LOVABLE-CLOUD.md`;
- `OVERSTAP-ONLINE-ONTWIKKELEN.md`;
- `RELEASE-READINESS-2026-11.md`;
- `PRAKTIJKTEST-TOESTELLEN.md`.

**Richting:** ± 6 weken tot een gesloten test (TestFlight en Play). Dat is geen gegarandeerde datum. Elke stap naar productie vraagt een gate (DECISIONS_LOG §1).

## 1. Voorwaarden in drie groepen
### 1.1 Blokkeert de lancering
| # | Voorwaarde | Wie | Gate/beslissing |
|---|---|---|---|
| L1 | Staging (apart Lovable-project, zonder echte gegevens) | eigenaar maakt aan, ik richt in | #1, G1 |
| L2 | Schema van live vergeleken, baseline-migratie | ik, na toegang | N-2, #4 |
| L3 | 0002, 0004 en 0004b op staging, volledige testsuite tegen staging | ik | G1/G2, N-1 |
| L4 | Beveiligingsreleases live (TanStack/seroval, SSRF) | ik, na akkoord | G3/G4 |
| L5 | 2FA voor beheer aan | eigenaar en ik | #2 |
| L6 | Privacylaag AI (BUG-142), betaalpoort op de server (BUG-143) | ik | ronde 2 |
| L7 | iOS-project, iconen, opstartscherm, offline-scherm | ik | #22 |
| L8 | Ontwikkelaarsaccounts Apple en Google | eigenaar | #24/#25, G9 |
| L9 | Echte toesteltest: 2 iPhones en 2 Android-toestellen, met VoiceOver/TalkBack en grote tekst | eigenaar en ik | #26 |
| L10 | Privacyverklaring, voorwaarden, storeteksten juridisch nagelezen; privacylabels en Data safety | jurist; ik bereid voor | #27 |

### 1.2 Moet vóór de lancering
- **Persoonlijke voeding op het account:** allergieën, voorkeuren en uitsluitingen (FR-I-03).
- **Ronde 2 af:** nakijkstappen, verwijderen, Instellingen, Lijst, tests van de invoer.
- **Help-artikels** nagelezen (#8).
- **Bewaartermijnen** (0003/0003b, #6/#12).
- **Prestaties** gemeten op een middenklasse-Android.
- **Wachtwoordherstel:** redirect-URL ingesteld (BUG-022).
- **Native push** (opt-in), aanbevolen voor Apple 4.2.

### 1.3 Mag na de lancering
Alles wat in F2/F3 staat: COMPLETE_PRODUCT_INVENTORY en COMMERCIAL_ROADMAP.

## 2. Staging voorbereiden (ronde 2, punt 10)
1. Eigenaar: nieuw Lovable-project "Foodlo staging", gekoppeld aan deze repository op een aparte branch (niet `main`).
2. Ik: omgevingsvariabelen invullen (alleen namen in `.env.example`; waarden zet de eigenaar zelf in Lovable).
3. Ik:
   - baseline uit het live schema (alleen lezen, N-2);
   - daarna de migraties in de volgorde van DATABASE_ARCHITECTURE §2;
   - elke migratie heen en terug.
4. Ik: testgebruikers met verzonnen gegevens (`tests/e2e/demo-data.mjs` als model). Nooit productiedata.
5. Ik: de volledige E2E-suite tegen staging, de RLS-suite, en de AVG-export met meer dan 1 000 rijen.
6. Eigenaar: akkoord voor productie (G1/G2), per migratie.

## 3. Ontwikkelaarsaccounts voorbereiden (ronde 2, punt 11)
| Stap | Apple | Google Play |
|---|---|---|
| Soort | Organisatie (D-U-N-S nodig, tot 30 dagen) of persoon | Organisatie of persoon (identiteitscontrole) |
| Kost (indicatief, G9) | ± € 99 per jaar | ± $ 25 eenmalig |
| Nodig | Juridische naam, website, contact-e-mail, D-U-N-S, Apple ID met 2FA | Google-account met 2FA, betaalmiddel, adres |
| Daarna | App ID `com.foodloapp.app`, TestFlight | App `com.foodloapp.app`, gesloten test |

Ik maak zelf geen accounts aan en doe geen uitgaven.

## 3b. Mobiele test voorbereiden (ronde 3)
Klaar zonder goedkeuring:
- **Offline-scherm:** gebouwd. Op het web werkt het meteen; in de app is het actief na de volgende build (`server.errorPath`).
- **Testscript:** `docs/foodloapp-v2/PRAKTIJKTEST-TOESTELLEN.md` (bestaat). Extra in ronde 3:
  1. "Iets anders vanavond" kiezen en ongedaan maken;
  2. recept dupliceren;
  3. de voorbeeldweergave bij grote systeemtekst bekijken;
  4. vliegtuigmodus aan, een nieuwe pagina openen en het offline-scherm zien.
- **Wie wat doet bij de test:**
  - eigenaar: 2 iPhones en 2 Android-toestellen, met grote systeemtekst, VoiceOver en TalkBack;
  - ik: de testversie (Android-APK via de Capacitor-build, iOS via TestFlight zodra er accounts zijn) en een bugformulier in het bugregister.

Wacht op de eigenaar:
- **#22:** de keuze tussen de website in de app en een meegeleverde app.
- **Accounts (#24/#25):** nodig voor TestFlight en de gesloten test in Play.
- **iOS-project (M1):** vraagt een Mac met Xcode.

## 4. Volgorde
Zie `DEVELOPMENT_ROADMAP.md` §2–3:

| Ronde | Inhoud |
|---|---|
| 2 | Kwaliteit en veiligheid |
| 3 | Persoonlijke voeding |
| 4 | Mobiel |
| 5 | Staging |
| 6 | Toesteltest en stores |
