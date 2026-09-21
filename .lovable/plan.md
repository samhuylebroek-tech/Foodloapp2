# Weekmenu volledig herontwerpen

## Doel
Het Weekmenu wordt een rustige mobiele weekplanner waarin de geplande gerechten meteen zichtbaar zijn. De gekozen richting is een **compacte verticale weeklijn** in de bestaande Foodlo-stijl: eucalyptus/citroen, Sora voor titels en Manrope voor tekst.

Alle bestaande functies en gegevens blijven behouden. Alleen de indeling, visuele hiërarchie, benamingen en bediening veranderen.

## Nieuwe schermopbouw

### 1. Compacte context bovenaan
- Vervang de twee grote knoppen **Mijn weekmenu / Weekmenu gezin** door één compacte keuzeknop met de actieve planning, bijvoorbeeld **Mijn planning** of de gezinsnaam.
- Combineer weeknummer, datumbereik, vorige/volgende week, datum kiezen en instellingen in één compacte kop.
- Vervang de vier grote weekknoppen door een horizontale weekstrook met korte labels zoals **Nu**, **Volgende**, **+2** en **+3**.
- Toon **Terug naar deze week** alleen wanneer dat nodig is, als kleine contextuele actie.

### 2. Planning eerst
- Plaats de echte weekplanning direct onder de weekstrook, zodat de eerste geplande dag al in beeld staat zonder scrollen.
- Bouw de dagen als één verticale tijdlijn:
  - compacte datumtegel met weekdag en dagnummer;
  - daaronder de maaltijdmomenten als scanbare rijen;
  - foto, maaltijdtype, gerechtnaam en kooktijd in één duidelijke regel;
  - lege momenten als rustige **Maaltijd toevoegen**-rij;
  - vandaag krijgt een subtiel citroengeel accent.
- Behoud de bestaande lijst- en swipeweergave als gebruikersinstelling, maar vertaal beide naar dezelfde compacte visuele taal.

### 3. Minder grote acties
- Vervang **Gerecht inplannen**, **Maak een weekmenu** en **Boodschappen voor deze week** door een compacte actierij direct boven de planning:
  - **Toevoegen**;
  - **Laat Foodlo kiezen**;
  - **Naar boodschappen**.
- Elke actie behoudt dezelfde bestaande werking, controles, credits en vervolgvensters.
- Verplaats minder frequente opties zoals de hele week op een lijst zetten en lijstkeuze naar een passende onderste schuiflaag.

### 4. Rustigere maaltijdacties
- Maak de volledige maaltijdregel aanklikbaar om het recept te openen.
- Bundel boodschappen toevoegen en verwijderen in een contextmenu per gerecht, in plaats van twee losse pictogrammen naast elke maaltijd.
- Behoud zichtbaarheid van wie een gezinsgerecht plande.
- Behoud de vraag om gekoppelde ingrediënten mee te verwijderen en de selectie om na een voorstel meerdere gerechten tegelijk aan boodschappen toe te voegen.

### 5. Helderdere taal
- **Mijn weekmenu** wordt **Mijn planning**.
- **Weekmenu gezin** wordt de gezinsnaam of **Gezinsplanning**.
- **Maak een weekmenu** wordt **Laat Foodlo kiezen**.
- **Gerecht inplannen** wordt **Maaltijd toevoegen**.
- Lange toelichtingen verdwijnen uit het hoofdscherm en verschijnen alleen waar een keuze uitleg nodig heeft.

### 6. Bestaande vervolgflows visueel laten aansluiten
- Geef de receptkiezer, dagkeuze, Foodlo-voorstel, weekinstellingen, boodschappenkeuze en verwijderbevestiging dezelfde compacte koppen, datumtegels en actierijen.
- Vervang de nog handgemaakte schermvullende vensters in deze route door de bestaande toegankelijke Sheet/Dialog/AlertDialog-patronen.
- Behoud zoeken, favorieten, recente recepten, eigen recepten, webresultaten, AI-ideeën, per-dagvoorkeuren, bronkeuze, kooktijd, maaltijdsoort en overslaan.

## Technische uitvoering
- Herstructureer alleen de presentatie en interactie in het bestaande Weekmenu; bestaande queries, opslag, rechten, realtime samenwerking en mutaties blijven intact.
- Splits de grote schermweergave op in kleine interne onderdelen voor de weekkop, actierij, dagtijdlijn en maaltijdregel.
- Gebruik uitsluitend bestaande semantische kleur- en typografietokens; geen nieuwe visuele stijl naast Foodlo.
- Tikdoelen blijven minimaal 56px, ook wanneer onderdelen visueel compacter worden.
- Behoud toetsenbordbediening, zichtbare focus, schermlezerlabels, veilige schermranden en teruggedrag.

## Controle
- Test op 390×844 dat planning en minstens één dag in de eerste schermhoogte zichtbaar zijn, zonder horizontale uitloop.
- Test persoonlijk en gezin, week wisselen, datum kiezen, instellingen, maaltijd toevoegen, Foodlo laten kiezen, recept openen, boodschappen toevoegen en verwijderen met ingrediëntenvraag.
- Test lege, gedeeltelijk gevulde en volledig geplande weken.
- Controleer daarna tablet/desktop, grotere tekst, toetsenbordbediening, runtimefouten en actuele bouwstatus.
- Niet publiceren zonder een aparte expliciete publicatiekeuze.
