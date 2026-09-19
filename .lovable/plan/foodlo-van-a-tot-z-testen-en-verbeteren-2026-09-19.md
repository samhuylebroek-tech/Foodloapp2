# Foodlo van A tot Z testen en verbeteren

## Doel
Foodlo volledig doorlopen zoals een echte gebruiker en beheerder dat doet, op mobiel en desktop. Gevonden problemen worden meteen geprioriteerd en opgelost. Verbeteringen moeten de app rustiger, duidelijker en slimmer maken zonder nieuwe parallelle systemen te bouwen.

## Aanpak

### 1. Nulmeting en testbasis
- De actuele fouten, mislukte netwerkverzoeken en bestaande monitoring controleren.
- Een herhaalbare controle opzetten voor de belangrijkste gebruikersroutes; het project heeft momenteel geen aparte automatische testscript-configuratie.
- Testen met realistische tijdelijke gegevens en twee gebruikers; alle herkenbaar gemarkeerde testgegevens na afloop verwijderen.
- Per bevinding ernst vastleggen: blokkerend, belangrijk, verbetering of idee.

### 2. Volledige gebruikersreis
Alle stappen echt uitvoeren, niet alleen visueel bekijken:
- aanmelden, account maken, afmelden, uitnodigingen en eerste gebruik;
- startscherm, recepten zoeken, filteren, favorieten, handmatig toevoegen, foto, bewerken en verwijderen;
- import via website/sociale link, webzoeken, AI-voorstellen, dubbele recepten en foutieve bronnen;
- recept naar weekmenu en boodschappen, porties aanpassen, kookstand en stap-ingrediënten;
- weekmenu over meerdere weken, voorstel per dag, voorkeuren, alternatieven, aanvaarden, overslaan en bestaande plannen respecteren;
- boodschappenlijsten, categorieën, hoeveelheden samenvoegen, dubbels, afvinken, voorraadkast en gedeeld gebruik;
- vrienden, gezin, uitnodigen, accepteren/weigeren, rechten wijzigen, realtime wijzigingen en toegang intrekken;
- klantenkaarten, meldingen, feedback, instellingen, taal/thema en installatie als web-app;
- beheercentrum: toegang uitsluitend voor Sam, gebruikers, activiteit, AI/credits, kosten, fouten, groepen, exports en filters.

### 3. Gebruiksgemak en inventieve verbeteringen
Elk scherm beoordelen op één duidelijke hoofdactie, rust en begrijpelijkheid voor jongere én oudere gebruikers:
- overbodige stappen, lange teksten, drukke schermen en verborgen acties vereenvoudigen;
- lege, laad-, fout-, offline- en successtanden verbeteren;
- slimme vervolgstappen aanbieden op het juiste moment, bijvoorbeeld na bewaren, plannen of afvinken;
- Nederlandse teksten en benamingen consistent maken;
- alleen verbeteringen uitvoeren die het bestaande proces aantoonbaar korter of duidelijker maken.

### 4. Mobiel, toegankelijkheid en PWA
- Controleren op gangbare kleine telefoon, tablet en desktop.
- Geen overlap, horizontaal schuiven, afgesneden tekst of bedekte knoppen.
- Toetsenbordbediening, focusvolgorde, schermlezerlabels, contrast, tekstvergroting, grote tikvlakken en minder beweging controleren.
- Installatie, heropenen, nieuwe versie, offline gedrag en herstel na verbindingsverlies testen.

### 5. Veiligheid, privacy, snelheid en kosten
- Een verse veiligheidsscan uitvoeren en alleen echte bevindingen na controle herstellen.
- Toegang tussen twee gebruikers beproeven: recepten, lijsten, groepen, uitnodigingen, beheer en directe links.
- Uploads en imports controleren op bestandstype, grootte, onveilige URL’s en foutafhandeling.
- Trage of overmatige gegevensopvragingen, grote lijsten en dubbele verzoeken aanpakken.
- Elke AI-actie controleren op expliciete toestemming, correcte creditmelding, reservering/terugbetaling, caching, limieten en kostregistratie.
- Persoonsgegevens, exports, monitoring en foutdetails controleren op minimale blootstelling.

### 6. Herstelrondes
- Eerst blokkades, dataverlies, verkeerde toegang en betaalde AI-fouten oplossen.
- Daarna problemen in kernflows en mobiel gebruik.
- Vervolgens de meest waardevolle overzichts- en gemakverbeteringen.
- Na iedere ronde de betrokken volledige gebruikersreis opnieuw testen om neveneffecten te voorkomen.

### 7. Eindcontrole en oplevering
- Belangrijkste flows opnieuw op mobiel en desktop uitvoeren.
- Samenwerking nogmaals met twee gebruikers testen.
- Bevestigen dat tijdelijke testgegevens zijn verwijderd en bestaande echte gegevens intact bleven.
- Eindrapport geven met: opgelost, aantoonbaar getest, resterende bewuste keuzes en verbeterideeën voor later.
- Alleen publiceren na een groene eindcontrole en jouw expliciete toestemming.

## Afbakening en veiligheidsregels
- Geen echte gebruikersgegevens verwijderen of onomkeerbaar wijzigen.
- Geen tweede systeem bouwen voor bestaande functies.
- Geen creditpakketten of betalingen activeren.
- Externe AI-acties alleen doelgericht gebruiken; testkosten worden zo laag mogelijk gehouden.
- Bevindingen in het beheercentrum of de database alleen wijzigen als de test aantoont dat dit nodig is.

## Technische uitvoering
- Bestaande TanStack-routes, Lovable Cloud-rechten, serverfuncties en gedeelde componenten blijven leidend.
- Geautomatiseerde controles richten zich eerst op rooktesten en kritieke end-to-endpaden; gerichte logica krijgt regressietests waar dat blijvende waarde biedt.
- De bestaande logs, serverfunctie-logs, veiligheidsscan en browsercontrole vormen samen de verificatie.
- Iedere oplossing moet bouwen zonder fouten en zichtbaar gecontroleerd zijn in de draaiende app.
