# Foodlo — volledige mobiele UX/UI-herwerking

## Doel
Foodlo wordt een rustige, hoogwaardige mobiele kookapp die meteen antwoord geeft op vier vragen: **wat eten we vandaag, waar zijn mijn recepten, wat staat op de planning en wat moet ik kopen?** Alle bestaande functies, gegevens, rechten, AI, credits, offlinewerking, analytics en het Control Center blijven behouden.

De gekozen richting ligt vast:
- **Mobiel eerst:** één verticale taakstroom per scherm; desktop vertaalt dezelfde structuur naar meer ruimte.
- **Kleuren:** eucalyptus met spaarzaam citroengeel (`#F5F8F7`, `#CFE1DA`, `#256B5A`, `#E1B94B`).
- **Typografie:** Sora voor titels, Manrope voor tekst.
- **Compositie:** rustige dagelijkse focus, duidelijke foodfoto’s, weinig gelijktijdige keuzes en één dominante actie.
- **Toegankelijkheid:** minimaal 56px voor belangrijke tikdoelen, duidelijke labels, zichtbaar toetsenbordfocus en ondersteuning voor grotere tekst.

## Bevestigde auditbevindingen
- De huidige mobiele onderbalk toont vier bestemmingen, terwijl tien functies in een apart menu concurreren; gezin, meldingen en credits zijn daardoor moeilijk vindbaar.
- `Boodschappen` en `Lijst`, en `gerecht` en `recept`, worden voor dezelfde zaken door elkaar gebruikt.
- Home laadt meerdere losse blokken en de installatievraag kan de volledige dagelijkse inhoud bedekken.
- Recepten zoeken, ideeën vinden en toevoegen hebben meerdere overlappende ingangen; filters en acties staan tegelijk bovenaan.
- Receptdetail, weekmenu, boodschappen, vrienden/gezin en instellingen bevatten veel acties of onderwerpen op één scherm.
- Friends en Family blijven functioneel onderscheiden, maar tonen dubbele uitnodigings- en rechtenpatronen.
- Meerdere schermen gebruiken zelfgemaakte vensters zonder de volledige focus-, Escape- en schermlezerondersteuning van de bestaande toegankelijke vensters.
- Knoppen zijn groot genoeg, maar invoervelden en selectievakjes volgen nog niet overal dezelfde aanraak- en focusregels.
- Laad- en lege toestanden bestaan; een consistente menselijke fouttoestand met opnieuw proberen ontbreekt op meerdere gegevensschermen.
- Grote schermbestanden en losse foto-URL-aanvragen veroorzaken onnodige belasting; sommige overzichten halen meer recepten of ingrediënten op dan zichtbaar nodig is.

## Nieuwe informatiearchitectuur

### Vaste mobiele navigatie
1. **Start** — vandaag en eerstvolgende logische actie.
2. **Recepten** — zoeken, favorieten, eigen en gedeelde recepten, toevoegen en alle importmethodes.
3. **Weekmenu** — vandaag, morgen en de gekozen week plannen.
4. **Lijst** — boodschappen als hoofdweergave, met voorraad logisch in dezelfde omgeving bereikbaar.
5. **Meer** — gezin en vrienden, klantenkaarten, meldingen, profiel, credits, installeren, feedback, hulp en instellingen.

Op desktop wordt dezelfde indeling een compacte zijbalk met labels. Bestaande URL’s en deep links blijven geldig. Het Control Center behoudt zijn eigen beheerstructuur.

### Consistente taal
- `Recept` is de vaste gebruikersnaam voor recepten; bestaande technische routes wijzigen niet.
- `Lijst` heet in navigatie en schermkop consequent `Boodschappen` waar extra duidelijkheid nodig is.
- `Samen` groepeert mensen, gezin en delen zonder de bestaande systemen of rechten samen te voegen.

## Uitvoering

### 1. Eén Foodlo-ontwerpsysteem en app-schil
- Leg het gekozen palet, Sora/Manrope, vaste tekstgroottes, ruimte, radius, schaduw en beweging vast in de bestaande thema-opbouw; alternatieve thema’s blijven werken.
- Maak knoppen, invoervelden, selectievakjes, tabs, chips, menu’s, sheets en dialogen visueel en toegankelijk consistent.
- Voeg gedeelde patronen toe voor paginakop, hoofdactie, compacte statusregel, recepttegel, lege toestand, skeleton, foutmelding en bevestiging.
- Vervang de mobiele hamburger als primaire route door de vijf vaste tabs; toon steeds duidelijke actieve status.
- Bouw **Meer** als scanbare groepen, zodat geen bestaande functie verdwijnt.
- Verplaats installatiehulp naar Meer/Instellingen en een subtiele contextuele ingang; nooit meer als blokkerend startvenster.

### 2. Home — alleen wat vandaag helpt
- Toon een korte begroeting en **Wat eten we vandaag?** als eerste inhoud.
- Bij een gepland recept: grote foto, titel, `tijd · personen` en één knop **Start koken**.
- Zonder planning: één uitnodiging **Kies iets voor vandaag**.
- Toon daarna maximaal twee compacte vervolgstappen: status van weekmenu en open boodschappen.
- Sluit af met één kleine horizontale rij recente of favoriete recepten.
- AI-inspiratie, installatie en overige statusinformatie blijven bereikbaar, maar domineren Home niet.
- Gebruik uitsluitend echte gebruikersgegevens en passende lege toestanden.

### 3. Recepten vinden en toevoegen
- Maak zoeken onmiddellijk zichtbaar met `Zoek recepten…`; gewone zoekopdrachten blijven zonder AI werken op naam, ingrediënt, categorie, tag, keuken, maaltijdtype, dieet en kooktijd.
- Toon alleen **Alles / Van mij / Van vrienden** en favorieten als snelle keuzes; overige filters openen in één sheet met actieve chips en **Alles wissen**.
- Recepttegels tonen foto, naam, tijd, personen, favoriet en indien nodig eigenaar; overige metadata verschijnt pas op detail.
- Gebruik één herkenbare **Toevoegen**-actie. De eerste stap biedt: zoeken, website/link, Instagram/social, foto/scannen en zelf schrijven.
- Behoud URL-import, social import, tekstimport, OCR, fotoherkenning, webzoekresultaten, AI-foto, creditcontrole, duplicaatcontrole, PWA-share-target, voorbeeldcontrole, geschiedenis en direct inplannen.
- Laad alleen de gekozen invoermethode, zodat het scherm sneller en eenvoudiger opent.

### 4. Receptdetail en kookstand
- Bouw receptdetail als foto → titel → `tijd · personen` → favoriet/delen → **Start koken** → tabs **Overzicht / Ingrediënten / Bereiding / Voeding**.
- Zet **Op boodschappenlijst** en **Inplannen** duidelijk bij de relevante context, maar visueel ondergeschikt aan koken.
- Plaats bron, tags, notities, geschiedenis, AI/importinformatie, snel aanpassen, kopiëren, bewerken en verwijderen onder **Meer over dit recept** of een contextmenu.
- Houd porties schalen, voeding, ratings, stap-ingrediëntkoppelingen en foto vervangen volledig intact.
- Kookstand blijft afleidingsvrij: één stap, gekoppelde ingrediënten, timer waar relevant, altijd vorige/volgende en terug vanaf het beoordelingsscherm.
- Bewaar de actieve kookstap in de route, zodat teruggaan of vernieuwen de voortgang niet onverwacht verliest.

### 5. Weekmenu
- Start met Vandaag/Morgen en een rustige weekstrook; weekpijlen en datumkeuze blijven direct zichtbaar.
- Toon per dag alleen relevante maaltijdmomenten; lege momenten krijgen **Maaltijd toevoegen**.
- Tik op een gerecht opent het recept; verplaatsen, vervangen, verwijderen en boodschappen opruimen blijven contextueel bereikbaar.
- Houd de Foodlo-voorstelflow dag per dag: foto, kooktijd, type, eigen recept of alternatief, per dag accepteren/overslaan en op het einde geselecteerde gerechten in één keer naar boodschappen.
- Behoud persoonlijke/gezinweergave, per-dag voorkeuren, bronkeuze, foto’s, uitsluiten van verstreken of reeds geplande recepten en realtime samenwerking.

### 6. Boodschappen, voorraad en klantenkaarten
- Laat Boodschappen voelen als winkelmodus: compacte regels per nuttige categorie, grote checkbox, naam, hoeveelheid en snelle aanpassing.
- Houd toevoegen als hoofdactie; bewerken, verwijderen, meerdere selecteren, afgevinkte items opruimen, hele lijst legen, delen, ongedaan maken en realtime samenwerking blijven beschikbaar.
- Plaats voorraad als logisch tweede onderdeel van dezelfde dagelijkse winkelomgeving, zonder route of gegevens te verwijderen.
- Toon bij een gekoppelde winkelkaart een contextuele ingang; klantenkaarten blijven ook onder Meer bereikbaar.
- Kaartdetail heeft één dominante actie **Toon kaart**, waarna barcode/QR schermvullend en offline beschikbaar is; scannen, foto, handmatige invoer, delen en analyse blijven behouden.

### 7. Samen koken
- Maak onder Meer één menselijke ingang **Samen koken** met overzicht van gezin, vrienden, uitnodigingen en gedeelde inhoud.
- Toon persoon/avatar en wat gedeeld wordt; zet technische rechten achter **Wat delen we?**.
- Hergebruik één visueel rechten- en uitnodigingspatroon voor vrienden en gezin, maar behoud beide bestaande gegevensmodellen, servercontroles, QR-links en realtime updates.
- Maak accepteren, weigeren en teruggaan duidelijk; geen bestaande deelrechten worden verruimd of verwijderd.

### 8. Instellingen, meldingen en onboarding
- Deel Meer/Instellingen op in: **Profiel**, **Foodlo-voorkeuren**, **Samen delen**, **Meldingen**, **App op je telefoon**, **Privacy & gegevens**, **Credits**, **Hulp en over Foodlo**.
- Toon per scherm één onderwerp in plaats van één lange instellingenpagina; bestaande routes en functies blijven bereikbaar.
- Meldingen beginnen met één heldere aan/uit-status; soorten, dagen, timing en testmelding verschijnen daarna.
- Onboarding wordt vijf korte schermen: Foodlo, recepten, plannen, boodschappen, klaar. Gezin, kaarten en meldingen worden later contextueel ontdekt.
- Rondleiding en onboarding gebruiken dezelfde korte teksten en dezelfde voortgangsbron.

### 9. Toestanden, toegankelijkheid en snelheid
- Vervang zelfgemaakte vensters door de bestaande toegankelijke Dialog/Sheet/AlertDialog-patronen, inclusief focus, Escape en focusherstel.
- Voeg op ieder gegevensscherm een korte foutmelding met **Opnieuw proberen** toe; gebruik vaste skeletons en actiegerichte lege toestanden.
- Controleer labels, toetsenbord, schermlezer, contrast, tekstvergroting, veilige schermranden en bediening met één hand.
- Cache foto-URL’s, beperk overzichtsqueries tot relevante recepten/ingrediënten en voorkom dubbele refetches zonder het datamodel te wijzigen.
- Splits zware schermen intern op en laad AI/importpanelen pas wanneer de gebruiker ze kiest; gedrag en meetevents blijven gelijk.

## Bescherming van bestaande werking
- Geen nieuwe productfuncties, tabellen, parallelle systemen of onnodige datamigraties.
- Geen bestaande functie, data, permissie, creditregel, analytics-event, offlinefunctie of URL verdwijnt.
- Auth, server-side rechten, realtime samenwerking, AI-kostenbeheer, PWA, privacy/GDPR en Control Center blijven intact.
- Geen betalingen of creditpakketten activeren.
- Het Control Center krijgt alleen gedeelde basisverbeteringen die rechten, cijfers en compacte beheerstijl niet veranderen.

## Gefaseerde oplevering
1. Ontwerpsysteem, gedeelde toestanden, toegankelijke vensters en mobiele/desktopnavigatie.
2. Home, Meer en consistente terminologie.
3. Receptenoverzicht, zoeken, filters en toevoegen/importeren.
4. Receptdetail, koken, voeding, notities, ratings en geschiedenis.
5. Weekmenu en volledige voorstelreis.
6. Boodschappen, voorraad en klantenkaarten.
7. Samen koken, meldingen, instellingen, onboarding en resterende consumentenschermen.
8. Prestatie-, toegankelijkheids-, route-, klik- en vereenvoudigingsronde.

## Eindcontrole
- Test op telefoon eerst en daarna tablet/desktop: geen overlap, afkapping of horizontale uitloop.
- Doorloop de acht gevraagde reizen, inclusief social/URL/foto-import, familie-uitnodiging, supermarkt + kaart, terugkerende gebruiker en zoeken → koken.
- Test iedere belangrijke knop, kaart, tab, chip, menuactie en terugknop; zoek- en filtercontext blijft behouden.
- Simuleer een nieuwe gebruiker met de opdrachten: recept bewaren, vegetarisch zoeken, morgen plannen, lijst maken, Carrefour-kaart vinden, koken starten, delen, favorieten vinden, meldingen wijzigen en Instagram importeren.
- Controleer na iedere fase actuele buildstatus, runtimefouten en gerichte mobiele browserflows; sluit af met een tweede volledige navigatie-audit.
- Publiceer pas na een groene eindcontrole en expliciete publicatiekeuze.
