# Foodlo herontwerp — rustig, eenvoudig en intuïtief

## Doel
Foodlo herwerken tot één samenhangende, mobiele consumentenervaring die binnen drie seconden duidelijk maakt waar de gebruiker is, wat belangrijk is en wat de volgende logische actie is. Alle bestaande gegevens, rechten, functies, offline werking, meldingen, credits, AI, analytics en het Control Center blijven behouden.

De gekozen richting ligt vast:
- **Compositie:** rustig en functioneel, met één duidelijke hoofdactie en compacte ondersteunende informatie
- **Kleuren:** eucalyptus met spaarzaam citroengeel accent (`#F5F8F7`, `#CFE1DA`, `#256B5A`, `#E1B94B`)
- **Typografie:** Outfit voor titels, Figtree voor tekst
- **Structuur:** mobiel-eerst, visueel en direct, details pas na een tik

## Bevestigde UX-problemen
- Home kan tot zes receptstroken, AI-inhoud en meerdere links naar hetzelfde receptenoverzicht tonen.
- Het receptenoverzicht toont zes filters tegelijk en plaatst toevoegen vóór de frequentere zoekactie.
- Het receptscherm toont alle onderdelen in één lange pagina en herhaalt bewerkacties.
- Boodschappen, vrienden/gezin en instellingen stapelen meerdere verschillende taken op één scherm.
- Instellingen bevat twaalf verschillende onderwerpen in één lange lijst.
- Onboarding, rondleiding en installatiehulp overlappen inhoudelijk en gebruiken verschillende voortgangsstatussen.
- Laad-, lege en fouttoestanden zijn per pagina anders; bestaande skeletons worden nog niet gebruikt.
- Verschillende acties gebruiken nog browservensters in plaats van consistente Foodlo-vensters.
- De mobiele hoofdnavigatie is beperkt tot vier bestemmingen; overige dagelijkse functies zitten verspreid in het menu.

## Aanpak

### 1. Eén Foodlo-ontwerpsysteem
- Leg semantische kleur-, typografie-, ruimte-, radius-, schaduw- en bewegingsregels vast in het bestaande designsysteem.
- Werk de bestaande knoppen, invoervelden, tabs, schakelaars, keuzelijsten, dialogen en sheets bij; geen parallelle componentenset.
- Voeg gedeelde patronen toe voor paginakop, primaire actie, sectiekop, recepttegel, lege toestand, skeleton, foutmelding en menselijk bevestigingsbericht.
- Houd tikdoelen minimaal 56px, contrast duidelijk, iconen altijd begrijpelijk en beweging subtiel met ondersteuning voor minder beweging.
- Behoud de alternatieve thema’s, maar laat de nieuwe eucalyptusrichting de standaardervaring bepalen.

### 2. Navigatie en algemene structuur
- Maak de mobiele onderbalk de vaste kern: **Start, Recepten, Weekmenu, Lijst**; bundel Wallet, Voorraad, Vrienden & gezin, Meldingen, Profiel en Instellingen onder een duidelijke **Meer**-bestemming zonder functies te verbergen.
- Vereenvoudig de desktopzijbalk volgens dezelfde hiërarchie.
- Geef iedere pagina één dominante actie; verplaats zeldzame acties naar een overflowmenu, sheet of uitklapbaar onderdeel.
- Behoud authenticatie, onboardingcontrole, realtime verversing, meetpunten en installatietip in de bestaande app-schil.
- Toon installatiehulp subtiel in Meer/Instellingen en alleen contextueel wanneer de app nog niet geïnstalleerd is.

### 3. Home — relevant voor vandaag
- Vervang de brede verzameling secties door een contextuele stroom:
  1. korte persoonlijke begroeting;
  2. **Wat eten we vandaag?** met foto en één actie;
  3. alleen relevante status voor weekmenu en boodschappen;
  4. één compacte rij recente of favoriete recepten.
- Toon passende lege varianten: week plannen, eerste recept bewaren of lijst starten.
- Verplaats internetinspiratie/AI naar een rustige secundaire ingang en verwijder technische credittekst van Home.
- Gebruik echte bestaande gebruikersdata; geen voorbeelddata of verzonnen status.

### 4. Recepten als referentie-ervaring
- Bouw het receptscherm op als: grote foto → titel → `30 min · 4 personen` → favoriet/delen → **Start koken** → tabs **Overzicht / Ingrediënten / Bereiding / Voeding**.
- **Overzicht:** korte beschrijving, kernmetadata en eventueel moeilijkheid; geen lange tekstblokken.
- **Ingrediënten:** één centrale portiekeuze, automatisch schalen, afvinken en één actie naar de boodschappenlijst.
- **Bereiding:** ruime genummerde stappen; gekoppelde hoeveelheden blijven zichtbaar; timers alleen waar relevant.
- **Voeding:** calorieën en macro’s compact, vitaminen/mineralen pas na openen; bestaande deterministische berekeningen blijven leidend.
- Verplaats bron, auteur, tags, notities, importinformatie, geschiedenis, bewerken en verwijderen naar **Meer** of een passend secundair onderdeel.
- Verwijder dubbele acties zonder mogelijkheden te verwijderen.

### 5. Recepten zoeken, toevoegen en importeren
- Zet zoeken centraal met alleen **Favorieten, Recent, Mijn recepten** als snelle keuzes; plaats categorie, tijd, moeilijkheid, type en score achter **Filters** met actieve teller.
- Maak fotogerichte recepttegels met alleen naam, tijd, porties en favorietstatus.
- Gebruik één rustige keuzestap voor **Link / Tekst / Foto / Zelf invoeren** bij toevoegen.
- Toon alleen velden die bij de gekozen methode nodig zijn; klap geavanceerde gegevens en handmatige stap-ingrediëntcorrecties standaard in.
- Behoud alle AI-creditcontroles, duplicaatdetectie, importstatussen, fotokeuze, versiegeschiedenis en bestaande queryverversing exact.

### 6. Dagelijkse kookreis
- **Weekmenu:** rustige weekstrook, per dag vooral foto, gerecht en maaltijdmoment; toevoegen als hoofdactie; snelle details in een mobiele sheet. Persoon/gezin blijft duidelijk en rechten blijven intact.
- **Boodschappen:** item, hoeveelheid en grote checkbox centraal; toevoegen als hoofdactie; lijstbeheer, delen, voorraadcontrole en wissen in secundaire menu’s. Vervang browservensters door toegankelijke Foodlo-dialogen.
- **Voorraad:** behoud de eenvoudige invoer + lijst, met vriendelijkere lege toestand en consistente feedback.
- **Kookstand:** volledig afleidingsvrij met één grote stap, relevante hoeveelheden, optionele timer en duidelijke volgende/vorige actie; rating blijft aan het einde.
- Behoud alle realtime kanalen, persoonlijke/gezinsfilters en bestaande query-sleutels zodat samenwerking direct blijft werken.

### 7. Wallet en samen koken
- **Wallet:** visuele kaarten, tik opent meteen de bestaande schermvullende kassamodus; toevoegen/bewerken/delen blijft secundair. Offline kaartopslag en privacyveilige scanmeting blijven behouden.
- **Vrienden & gezin:** één menselijke overzichtspagina met gezin, andere connecties, inkomende en uitgaande uitnodigingen; **Persoon toevoegen** is de hoofdactie.
- Persoonsdetail krijgt **Overzicht / Weekmenu / Recepten**; alleen expliciet gedeelde inhoud wordt getoond.
- Deelrechten blijven beschikbaar onder **Wat delen we?**, maar domineren het profiel niet.
- Hergebruik het bestaande shares/groepen-systeem en de bestaande realtime, uitnodigings- en serverrechten; geen nieuwe tabellen of parallel deelmodel.

### 8. Meldingen, instellingen en profiel
- Houd op Meldingen eerst één heldere aan/uit-status; toon de vijf soorten pas wanneer meldingen actief zijn.
- Maak browsertoestemming en persoonlijke voorkeuren begrijpelijk zonder technische uitleg, terwijl beide bestaande statussen behouden blijven.
- Deel Instellingen op in rustige groepen: **Profiel, Voorkeuren, Samen delen, Meldingen, App op je telefoon, Privacy & gegevens**.
- Toon account-, taal-, thema-, maaltijdmoment-, credits-, export-, juridische en beheerfuncties slechts in hun juiste groep.
- Behoud alle huidige feature flags, admincontrole en accountbeveiliging.

### 9. Onboarding en rondleiding
- Maak van de eerste kennismaking korte, visuele schermen met één idee per scherm: bewaren, plannen, boodschappen, samen koken.
- Zet gezin, wallet en meldingen als optionele vervolgstappen; alles kan worden overgeslagen.
- Laat de herstartbare rondleiding dezelfde inhoudsbron gebruiken, zodat uitleg niet opnieuw uiteenloopt.
- Synchroniseer de bestaande profiel- en lokale voortgang zonder nieuwe onboardingarchitectuur of verlies van bestaande status.

### 10. Microcopy, feedback en toestanden
- Kort alle consumententeksten in: warm, positief, concreet en volledig Nederlands.
- Gebruik compacte bevestiging zoals **Opgeslagen**, **Toegevoegd** en **Je lijst staat klaar**.
- Vervang losse laadteksten door stabiele skeletons waar inhoud verwacht wordt.
- Maak lege schermen actiegericht en foutmeldingen menselijk, met technische details alleen in het Control Center.
- Voeg een rustige offline-status toe zonder de bestaande PWA-cache of serviceworker te wijzigen.

### 11. Formulieren, sheets en toegankelijkheid
- Vervang losse `prompt`/`confirm`-vensters en handgemaakte overlays door de bestaande toegankelijke dialog-, alert- en sheetcomponenten.
- Houd formulieren kort; toon validatie naast het relevante veld en geavanceerde keuzes pas op aanvraag.
- Controleer toetsenbordbediening, focus, schermlezerlabels, tekstvergroting, contrast, veilige schermranden en bediening met één hand.
- Voorkom horizontale overloop en tekstafkapping op compacte telefoons.

### 12. Gefaseerde uitvoering en bescherming
1. Designsysteem, gedeelde toestanden en app-schil.
2. Home en receptenoverzicht.
3. Receptdetail, toevoegen/bewerken en kookstand.
4. Weekmenu, boodschappen en voorraad.
5. Wallet, vrienden/gezin en gedeelde profielen.
6. Meldingen, instellingen, onboarding en resterende consumentenschermen.
7. Integrale vereenvoudigingsronde.

Per fase blijven backend, authenticatie, database, RLS, AI, credits, realtime, analytics, PWA/offline en het Control Center functioneel. Het Control Center behoudt zijn eigen compacte beheerstijl; gedeelde basisonderdelen mogen zijn rechten, cijfers of navigatie niet veranderen.

## Technische waarborgen
- Geen database- of API-herbouw en geen tweede auth-, deel-, meldingen-, analytics- of designsysteem.
- Bestaande React Query-sleutels, invalidaties, realtime kanaalgedrag, permission checks en meetevents blijven behouden bij het opsplitsen van schermen.
- Nieuwe visuele onderdelen gebruiken bestaande gegevens en bestaande UI-bouwstenen.
- Route-URL’s en deep links blijven geldig.
- Alle consumentroutes behouden unieke Nederlandse metadata; beheerpagina’s blijven niet indexeerbaar.

## Verificatie
- Test de volledige reis: recept vinden → bewaren → terugvinden → weekmenu → boodschappen → supermarkt/wallet → koken → rating.
- Test persoonlijk én gezin: uitnodigen, accepteren, delen, rechten wijzigen, weekmenu en lijst realtime bijwerken.
- Test receptimport via link, tekst en foto, creditgrenzen, bewerken, geschiedenis en nutrition-schaalberekening.
- Test meldingen, offline/herverbinden, installatie, deep links en kassamodus.
- Controleer ieder hoofdscherm op mobiel en desktop met de 3-secondenvragen: locatie duidelijk, hoofdactie duidelijk, geen overbodige tekst of gelijkwaardige knoppen.
- Controleer focus, toetsenbord, schermlezerlabels, contrast, grote tekst, touch targets en `prefers-reduced-motion`.
- Controleer na elke fase typecontrole, actuele buildstatus, runtimefouten en gerichte browserflows; sluit af met een tweede volledige UX-review en nog één vereenvoudigingsronde.
