# Productontwikkelingsronde 2026-11-11: stand per werkstroom

Branch `v2/dev`, lokaal. **Niet gepusht, niet uitgerold, niets gemigreerd.** Startpunt: `8b47d6e`.

**Labels:**
- **Bevestigd:** door de eigenaar in de live omgeving gecontroleerd.
- **Gebouwd:** de code bestaat.
- **Lokaal getest:** de code bestaat en is getest op deze computer, met verzonnen gegevens.
- **Alleen voorgesteld:** ontwerp of SQL, niet gebouwd of niet uitgevoerd.
- **Nog niet getest:** gebouwd, maar zonder bewijs.

## A. Security en privacy
| Onderwerp | Stand | Label |
|---|---|---|
| BUG-025 foto-opruiming bij verwijderen | Zelf verwijderen en verwijderen via beheer (BUG-122) volgen dezelfde regels | Lokaal getest; niet tegen echte opslag |
| BUG-095 2FA op de server | Gebouwd, staat UIT; stappenplan en buitensluitanalyse in 2FA-STAPPENPLAN-EIGENAAR | Lokaal getest; wacht op akkoord |
| BUG-097 beheerregels in de databank | Voorstel 0002 met RLS-test | Alleen voorgesteld; live niet nagekeken |
| BUG-107 lettertypen zelf gehost | Opgelost (vorige ronde) | Lokaal getest |
| BUG-108 locatie afgerond | Opgelost (vorige ronde) | Lokaal getest |
| BUG-109 bewaartermijnen | 0003 (telemetrie) en **nieuw 0003b** (inhoud en contact): prullenbak 30 d, versies max 20, weekmenu 12 m, aankoophistoriek 24 m, open uitnodigingen 30 d, AI-cache 90 d, afgehandelde feedback 24 m, push-toestellen, beheersessies. PGlite 11/11, heen en terug | Alleen voorgesteld (lokaal getest) |
| BUG-110 gezin overdragen | Ook bij verwijderen via beheer (BUG-122) | Lokaal getest |
| BUG-112 gezinsvoorraad | Beslist: zichtbaar; gecontroleerd dat er verder niets privé zichtbaar is | Lokaal getest |
| BUG-119 weekmenuvoorkeuren leesbaar voor gezin | Voorstel 0004 + compatibele app | Alleen voorgesteld (lokaal getest) |
| **Nieuw** gezondheidsgegevens uit de kennismaking | Dieet en allergieën blijven op het toestel en worden bij afmelden gewist (BUG-125) | Lokaal getest |
| Eigenaarsaccount niet verwijderbaar (BUG-121) | Vorige ronde | Lokaal getest |
| Auditlog | Verwijderen via beheer wordt gelogd vóór het wissen | Lokaal getest |
| Live receptenpolicy en fotobucket | **Niet aangeraakt.** Live = in orde (bevestigd); de repo-migraties missen dit en daarvoor is basislijn 0002a. | Bevestigd (live) |

## B. Smart Onboarding
**Gebouwd en lokaal getest:**
1. **Welkom** (taal, kleuren, momenten), gevolgd door de **kennismaking** (`/kennismaking`):
   - kookervaring, kooktijd, wat je eet, allergieën (14 EU-allergenen), voor hoeveel personen en hoe je plant;
   - alles is optioneel, en per vraag staat waarvoor Foodlo het antwoord gebruikt;
   - de kooktijd gaat naar je weekmenu-instelling; je dieet alleen als je dat zelf aanvinkt, met de waarschuwing dat gezinsleden het dan zien (BUG-119).
2. **Rondleiding** van 10 stappen: Vandaag, Week, Lijst, Keuken, Recepten, Voorraad, Ontdek, Gezin, Iets toevoegen, Profiel en hulp.
   - Ervaren koks krijgen 7 stappen.
   - Pauzeren met "Later verder" of Escape, en later hervatten, ook na herladen.
   - De focus gaat naar de uitleg.
3. **Eerste stappen** (`/eerste-stappen`): 6 oefeningen in de echte app.
   - Een recept bewaren, een maaltijd plannen, een lijst maken, een product afvinken, de voorraad aanvullen en de kookstand starten.
   - Ze worden herkend aan echte gegevens in de databank; alleen "kookstand gestart" wordt op het toestel bewaard.
4. **Wegwijs-kaart** op Vandaag, alleen voor nieuwe gebruikers. Je kan ze altijd verbergen.
5. **Allergiewaarschuwing** op recepten: "mogelijk", met de ingrediënten erbij, nooit stil wegfilteren, altijd "lees het etiket".
6. Opnieuw starten of aanpassen kan via Meer en Instellingen ("Kennismaking aanpassen", "Rondleiding opnieuw bekijken").

**Beperkingen:**
- De voortgang staat op het toestel, niet op het account. Daarvoor is tabel `0005` nodig.
- Er zijn geen instructievideo's in de onboarding zelf; die staan in het Help Center (zie C).

## C. Help Center, tutorials en AI
**Gebouwd en lokaal getest:**
- **Help Center** (`/hulp`):
  - zoeken tegen tikfouten;
  - categorieën per module;
  - veelgestelde vragen en probleemoplossing;
  - contact met support;
  - "Hulp bij dit scherm" onderaan elk scherm;
  - "Doe het nu" naar het juiste scherm.
- **"Vraag het Foodlo":** antwoordt alleen met de stappen uit een artikel en noemt de bron.
  - Vindt hij niets, dan zegt hij dat en verwijst hij naar support.
  - Het is **geen generatieve AI**: hij kan dus niets verzinnen. Een AI-laag erbovenop vraagt een beslissing over budget.
- **22 artikels:** voorbereid door AI (Claude), op basis van de code en de knoppen van de demo-app.
  - Ze staan als **concept** en zijn in een productie-build **verborgen** tot een mens ze naleest en goedkeurt.
  - Lokaal toont een band dat ze nog niet nagelezen zijn.
- **Content Manager** (controle in elke testrun):
  - elke knop die een artikel citeert, moet letterlijk in de app staan;
  - elke functie uit het register heeft uitleg;
  - elk bestand uit het register bestaat;
  - "goedgekeurd" zonder nalezer is een fout.
- **Control Center → Hulpinhoud:** status per artikel, functies zonder uitleg, en supportvragen gegroepeerd per artikel. Wat nergens bij past, is een signaal voor nieuwe uitleg.
- **Tutorials** (`/hulp/tutorials`): per module een script, storyboard, ondertitels (WebVTT), hoofdstukken en een vertaalbestand (te vertalen, daarna na te lezen).
- **Opnames:** een Playwright-test (alleen met `OPNAME=1`) maakt een stille video van de demo-app, met ondertitels in beeld.
  - Er zijn er 2 opgenomen als proef: ±1,3 en 1,8 MB.
  - Beeld nagekeken: ondertitel en aangewezen knop zichtbaar.
  - De video's staan niet in git en zijn nog niet in de app gezet.

**Alleen voorgesteld:**
- artikels en voortgang in de databank (`0005`);
- een knop "Goedkeuren" in het Control Center;
- een generatieve assistent;
- automatische vertaling.

## D. Dagelijkse gebruikerservaring
- **De kringloop** (Ontdekken → Bewaren → Week → Voorraad → Lijst → Winkelen → Voorraad bijwerken → Koken) is gedekt door bestaande E2E-tests (`reis-modules`, `kringloop`, `winkelmodus`) in 4 projecten. Die slagen.
- **Deze ronde:**
  - uitleg en contextuele hulp op elk kernscherm;
  - oefeningen die naar de echte schermen leiden;
  - de rondleiding toont nu ook Voorraad, Recepten en Gezin.
- **Geen nieuwe fouten gevonden** in dubbele gegevens of hoeveelheden. De bestaande tests op dubbel afvinken, dubbele productregels en ongedaan maken slagen.

## E. Recepten en ontdekken
- **Bestaat al:** zoeken met tikfouten, zoeken op ingrediënt, filters (soort, tijd, moeilijkheid), porties en "Wat kan ik koken?".
- **Nieuw:** allergiewaarschuwing op recepten.
- **Eigen collecties:** niet gebouwd, omdat ze een tabel met RLS vragen (ARCHITECTUUR-VOORSTELLEN §1). Alleen voorgesteld.

## F. Gezinnen en samenwerking
- **Gezinsvoorraad:** blijft zichtbaar (beslist), en er is gecontroleerd dat niets anders lekt.
- **Allergieën en voorkeuren per lid:** alleen voorgesteld. Het voorstel:
  - tabel `member_preferences`;
  - leesbaar voor het gezin alleen met uitdrukkelijke toestemming van dat lid;
  - een badge "let op voor iemand in je gezin" zonder te tonen wie;
  - in de export en gewist bij verwijderen.
  - Pas na `0004` en staging.
- **Taken per lid** ("wie kookt", "wie haalt"): alleen voorgesteld (ARCHITECTUUR §2).
- **Gelijktijdige wijzigingen:** dubbel afvinken is lokaal getest; realtime met twee toestellen wacht op staging.

## G. Business Control Center
- **Bestaat al en is eerlijk gelabeld:**
  - omzet alleen in euro;
  - demo-band op verzonnen gegevens;
  - geen betaalprovider;
  - AI-kosten met budgetrem;
  - auditlog;
  - rollen.
- **Nieuw:** Hulpinhoud.
- **Niet gebouwd:**
  - kasstroom, terugbetalingen en creatorverplichtingen: geen betaalgegevens;
  - hosting- en softwarekosten: geen bron, dus niet verzonnen;
  - back-upstatus: onbekend in Lovable Cloud.
- Zie BUSINESS-CONTROL-CENTER-AUDIT voor de matrix.

## H. Creatorplatform
Alleen voorgesteld (ARCHITECTUUR-VOORSTELLEN §3, CREATOR-GAP-ANALYSE):
1. eerst profielen, publiceren, volgen en reacties met moderatie;
2. pas daarna geld, en alleen met juridisch advies.

Er zijn geen lokale fundamenten gebouwd. Elk onderdeel vraagt tabellen met RLS-tests, en een half fundament geeft meer risico dan waarde. Er zijn geen betalingen, abonnementen of uitbetalingen.

## I. Performance
- **Bestaat al:** Vandaag 35 → 24 verzoeken (vorige ronde).
- **Nieuw:**
  - het Help Center doet **0** databankverzoeken; de artikels zitten in de app;
  - Eerste stappen doet alleen tellingen (head-verzoeken), en alleen op dat scherm;
  - de Wegwijs-kaart doet geen verzoeken.
- **Afbeeldingen** (miniaturen) en **indexen**: alleen voorgesteld (ARCHITECTUUR §5).

## J. Tests
Zie het hertest-log in BUG-REGISTER en het eindrapport.
