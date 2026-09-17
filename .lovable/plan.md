# Dubbel dagmenu oplossen + duidelijke installatiepopup

## 1. Dubbel gerecht op het beginscherm

Bevestigd in de database: op 17 september staat exact hetzelfde gerecht twee keer gepland — één keer persoonlijk en één keer als gezinsmaaltijd. Het beginscherm haalt alle maaltijden van vandaag op zonder onderscheid, dus beide verschijnen als aparte kaart.

Wat er verandert:
- Het beginscherm toont elk gerecht nog maar één keer per moment van de dag (ontbijt, middag, avond). Staat hetzelfde gerecht zowel persoonlijk als bij het gezin, dan blijft één kaart over.
- Die kaart krijgt een klein label "Gezin" wanneer de maaltijd uit het gedeelde weekmenu komt, zodat duidelijk blijft waar het vandaan komt.
- Er wordt niets verwijderd uit de planning zelf; enkel de weergave wordt ontdubbeld.

## 2. Popup "Zet Foodlo op je beginscherm"

Vandaag verschijnt er onderaan een klein tipbalkje dat makkelijk over het hoofd wordt gezien. Dat wordt een echte popup in het midden van het scherm.

- De popup verschijnt telkens opnieuw bij het openen van de app (hoogstens één keer per sessie, na een paar seconden) zolang de gebruiker niet definitief kiest.
- Twee keuzes onderaan: **"Dit heb ik gedaan"** en **"Niet meer tonen"**. Beide zetten de popup voorgoed uit. Wegklikken/"Later" laat hem de volgende keer terugkomen.
- De popup verschijnt niet wanneer de app al vanaf het beginscherm geopend wordt.

Uitleg in stappen, aangepast aan het toestel:
- **iPhone/iPad (Safari):** 1. Tik onderaan in het midden op het deel-icoontje. 2. Scrol in de lijst naar beneden. 3. Tik op "Zet op beginscherm". 4. Tik op "Voeg toe".
- **iPhone met Chrome:** eerst rechtsonder op de drie puntjes tikken, daarna "Deel" en "Zet op beginscherm".
- **Android:** wanneer de telefoon het toelaat één knop "Installeren"; anders: rechtsboven op de drie puntjes tikken en "App installeren" / "Toevoegen aan startscherm" kiezen.
- **Computer:** uitleg met het installatie-icoontje in de adresbalk.

Elke stap staat als genummerde regel met een icoontje, in grote leesbare tekst en met knoppen van minstens 56 px. De bestaande pagina met QR-code en link blijft bestaan en is bereikbaar via "Meer uitleg".

## Technische details

- `src/routes/index.tsx`: dagmenu-query ontdubbelen op sleutel `meal_type + (recipe_id ?? custom_title)`, persoonlijke rij krijgt voorrang, `group_id` gebruiken voor het gezinslabel.
- `src/components/InstallatieTip.tsx`: omzetten naar een gecentreerde Dialog (bestaande shadcn `ui/dialog`) met toestelherkenning (iOS Safari / iOS Chrome / Android / desktop) en genummerde stappen. `beforeinstallprompt` blijft gebruikt voor de directe installeerknop op Android/desktop.
- Opslag: bestaande sleutel `installatie-tip-weg` in localStorage blijft de definitieve keuze; een sessiesleutel (`sessionStorage`) voorkomt meerdere popups binnen dezelfde sessie.
- Geen databasewijzigingen, geen tweede installatiesysteem; `/installeren` blijft de uitgebreide pagina.
