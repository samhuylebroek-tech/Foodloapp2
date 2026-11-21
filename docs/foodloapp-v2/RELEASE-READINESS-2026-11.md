# Release readiness: eerste gecontroleerde gebruikerstest van V2

> Samengevat in [`docs/foodlo/IMPLEMENTATION_STATUS.md`](../foodlo/IMPLEMENTATION_STATUS.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11, branch `v2/dev` (lokaal, **niet gepusht, niet uitgerold**). Geschreven voor de eigenaar; geen technische voorkennis nodig.

**Labels:**
- **Lokaal getest:** op deze computer, met verzonnen gegevens en een nep-databank.
- **Simulatie:** een browser die een telefoon nabootst, geen echt toestel.
- **Alleen voorgesteld:** niet gebouwd of niet uitgevoerd.
- **Bevestigd:** door jou in de live omgeving gecontroleerd.

## 1. Score

| Onderdeel | Score | Waarom |
|---|---|---|
| Beveiliging van de app (server) | 7/10 | Elke beheerfunctie controleert rol en recht; 2FA is volledig gebouwd en lokaal bewezen, maar staat **uit** tot jouw akkoord. |
| Beveiliging van de databank | 6/10 | Live: recepten en foto's in orde (**bevestigd**). Beheerregels (`is_admin`, BUG-097) vandaag niet uit te buiten, maar niet live nagekeken. Repo en live verschillen (BUG-011). |
| Privacy (AVG) | 6/10 | Export, verwijderen, gezin overdragen en gedeelde foto's: **lokaal getest**. Bewaartermijnen: **alleen voorgesteld** (AVG-AUDIT §8). Niets daarvan staat live. |
| Dagelijks gebruik (UX) | 7/10 | Kernflow Vandaag → Week → Lijst → Koken werkt in alle tests; foutmeldingen zijn eerlijk. Grote herontwerpen (onboarding, filters) niet gedaan. |
| Mobiel en toegankelijkheid | 5/10 | 320–430 px, tekst tot 200 %, toetsenbord: **simulatie in Chromium**. Geen Safari/WebKit (BUG-117), geen echt toestel, geen VoiceOver of TalkBack. |
| Performance en kosten | 6/10 | Geen stille afkapping meer bij 1 000 rijen; AI-budgetrem correct. Vandaag doet dubbele verzoeken (BUG-118). Niet gemeten op een echt netwerk. |
| Business Control Center | 6/10 | Eerlijke labels en demo-band; omzet alleen in euro; geen betaalprovider (bewust). Cijfers alleen met demogegevens getest. |

**Totaal: 6/10 voor een eerste gecontroleerde test met 5 à 8 mensen.** De code is daar inhoudelijk bijna klaar voor. Wat ontbreekt, zijn stappen die buiten deze computer liggen: staging, een echte telefoon en jouw beslissingen.

## 2. Wat een gebruikerstest vandaag nog blokkeert
1. **V2 staat nergens online.** Een tester kan V2 alleen gebruiken via staging of de live app, en beide vragen jouw toestemming (G1/B6).
2. **Nooit op een echte iPhone of Android getest** (BUG-086, BUG-117). De Safari-engine kon op deze Mac niet draaien.
3. **2FA voor het Control Center staat uit** (BUG-095). Dat blokkeert testers niet, maar met echte gebruikersgegevens in de databank is jouw beheerdersaccount het grootste risico.
4. **De nieuwe privacycode** (gezin overdragen, foto's opruimen, export) is alleen lokaal getest, niet tegen de echte opslag.

## 3. Veilige stagingtest (voorbereid, niet uitgevoerd)
> **Bijgewerkt 2026-11-11:** Lovable heeft Test en Live stopgezet en drafts delen de live-databank. Staging = een apart Lovable-project. Het actuele plan staat in [STAGING-PLAN-LOVABLE-CLOUD.md](STAGING-PLAN-LOVABLE-CLOUD.md).
**Wat je zelf moet doen** (alleen jij kan dit):
1. Een apart stagingproject aanmaken, **zonder echte gebruikersgegevens**.
2. Het schema van live overnemen (alleen de structuur, geen inhoud).

**Wat ik daarna doe, in deze volgorde:**

| Stap | Wat | Hoe gecontroleerd | Stopcriterium |
|---|---|---|---|
| 1 | Schema van live vergelijken met de repo (BUG-011) | Lijst van verschillen | Elk verschil verklaard vóór stap 2 |
| 2 | Migraties `0002` (beheer, feedback) en `0003` (bewaartermijnen) op staging | `tests/rls/alles.mjs` tegen staging: 14/14 | Eén afwijking: terugdraaien (`.down.sql`) |
| 3 | V2-code uitrollen op staging | Volledige Playwright-suite tegen staging | Een kernflow faalt |
| 4 | 2FA met een echte authenticator-app: koppelen, afmelden, aanmelden, tweede stap, reserve, herstel (scenario C) | Checklist 2FA-HERSTELPLAN §5 | De eigenaar raakt buitengesloten zonder herstel |
| 5 | Account verwijderen als gezinseigenaar, met gedeelde foto's in de echte opslag | Ander gezinslid houdt lijst en items; inspiratiefoto's blijven | Eén foto van een ander verdwijnt |
| 6 | AVG-export van een testaccount met > 1 000 rijen | Alle 32 secties volledig | Iets ontbreekt of te veel |
| 7 | Twee toestellen tegelijk op één gezinslijst (realtime) | Afvinken verschijnt op beide | Dubbele of verloren items |
| 8 | Echte iPhone (Safari) en Android (Chrome) | PRAKTIJKTEST-TOESTELLEN §3 | Kernflow onbruikbaar |

**Grenzen:** geen echte betalingen, geen echte persoonsgegevens, geen LAN of tunnel zonder jouw toestemming.

## 4. Bewaartermijnen (overzicht)
Het volledige voorstel staat in AVG-AUDIT §8 (migratie `0003`, **alleen voorgesteld**, lokaal getest):
- **Gebruiksgegevens en sessies:** 13 maanden.
- **Foutmeldingen en meldingslog:** 6 maanden.
- **Dagcijfers:** 25 maanden.
- **AI-verbruik:** na 13 maanden geanonimiseerd, zodat de kostentotalen blijven kloppen.
- **Auditlog:** blijft, met een termijn in het privacybeleid (voorstel: 3 jaar).

**Jij kiest de termijnen.**

## 5. Wat alleen op echte toestellen te testen is
- **Safari op iPhone:**
  - het schermtoetsenbord dat invoervelden bedekt;
  - de "safe area" onderaan;
  - foto kiezen of maken;
  - zelf invullen van de code uit sms of authenticator.
- **VoiceOver en TalkBack:** voorleesvolgorde, namen van knoppen en de navigatie in vensters.
- **Tekstgrootte:**
  - **iPhone:** Dynamic Type werkt anders dan tekstzoom in de browser;
  - **Android:** de systeeminstelling "Lettergrootte". In de simulatie werkt 200 % nu wel.
- **Echt netwerk:** traag 4G, verbinding weg in de winkel, de offline wachtrij van de lijst.
- **Realtime:** twee mensen tegelijk op dezelfde lijst.
- **Push en installeren:** meldingen en "Op beginscherm zetten".

## 6. Volgende stappen tot een eerste gebruikerstest
1. **Jij:**
   - het 2FA-herstelplan goedkeuren (inclusief §2b);
   - de bewaartermijnen kiezen;
   - beslissen over BUG-112 (voorraad zichtbaar voor het gezin).
2. **Jij:** toestemming voor staging (G1/B6) en het aanmaken ervan, zonder echte gegevens.
3. **Ik, op staging:** de stappen 1 tot en met 7 uit §3, met verslag per stap (geslaagd of gestopt).
4. **Samen:** een echte iPhone en een echte Android doorlopen met het script uit PRAKTIJKTEST-TOESTELLEN, ± 45 minuten per toestel.
5. **Jij:** 2FA aanzetten. Daarna zet ik `MFA_AFDWINGEN` op `true`, en de twee "verwacht falend"-tests worden gewone tests.
6. **Begeleide test met 5 à 8 mensen**, één per persona: kern Vandaag → Week → Lijst → Koken, met een korte vragenlijst. Geen betalingen, en creatorfuncties uit.
