# Maaltijd toevoegen vanuit het Weekmenu volledig herwerken

## Doel
De stroom **Weekmenu → Toevoegen → Kies een maaltijd** wordt een rustige mobiele taak waarin iemand eerst kiest *wanneer* en daarna *waar de maaltijd vandaan komt*. Alle huidige mogelijkheden, gegevens, rechten, credits en boodschappenintegratie blijven behouden.

## Bevestigde problemen
- De huidige maaltijdkiezer zet zoeken, AI-inspiratie, webzoeken, voorgestelde recepten, favorieten, recente recepten en alle recepten in één lange schuiflaag.
- Hetzelfde recept kan in meerdere groepen terugkomen, waardoor de lijst langer en onrustiger wordt.
- De algemene toevoegknop toont een technische datumweergave en veel dagknoppen tegelijk.
- Inspiratie en een eigen recept kiezen zijn visueel even dominant, terwijl dit verschillende taken zijn.
- De handgemaakte schermvullende vensters sluiten niet aan op de toegankelijke mobiele schuiflagen van de rest van Foodlo.

## Nieuwe mobiele stroom

### 1. Wanneer kiezen
- Tikken op een leeg maaltijdmoment opent de maaltijdkiezer meteen; de dag en het moment zijn dan al bekend.
- De algemene knop **Toevoegen** opent eerst één compact scherm met een horizontale weekstrook en, indien nodig, ontbijt/lunch/avondeten.
- Toon datums consequent in het Nederlands; de volledige kalender zit achter één kalenderknop.
- Eén vaste hoofdknop **Verder naar maaltijd** vervangt de huidige brede verzameling datumkeuzes.

### 2. Eén duidelijke maaltijdkiezer
De bovenkant toont compact **Maandag 21 september · avondeten**, met **Wijzigen** als ondergeschikte actie. Daaronder staat de zoekbalk en één keuzebalk met drie duidelijke weergaven:

1. **Mijn recepten**
   - Start met passende recepten voor deze dag.
   - Compacte filters **Voor jou**, **Favorieten**, **Recent** en **Alles** vervangen de vier lange groepen.
   - Ieder recept verschijnt maximaal één keer, als scanbare rij met foto, titel, tijd, soort en eigenaar indien gedeeld.
   - Zoeken filtert onmiddellijk op de bestaande recepten zonder de overige functies in beeld te houden.

2. **Inspiratie**
   - Twee rustige keuzes: **Laat Foodlo voorstellen** en **Zoek op het web**.
   - Credits worden vóór een Foodlo-actie duidelijk maar compact vermeld; webzoeken blijft als gratis bron herkenbaar.
   - Resultaten verschijnen in dezelfde receptregels en niet als extra blok boven een tweede receptenlijst.

3. **Nieuw**
   - Een zelf getypte naam kan **alleen als naam** worden ingepland.
   - **Maak er een volledig recept van** gebruikt de bestaande AI-stroom en toont eerst het bestaande controlescherm.
   - Deze opties verschijnen pas wanneer iemand hiervoor kiest of een niet-bestaande naam invoert.

### 3. Selecteren en bevestigen
- Tikken op een bestaand recept plant het direct op de gekozen dag en het gekozen moment.
- Daarna blijft de bestaande vraag om ingrediënten op een boodschappenlijst te zetten intact.
- AI- en webrecepten behouden de inhoudscontrole vóór bewaren en inplannen.
- Terug gaat altijd één stap terug binnen de taak; sluiten brengt de gebruiker terug naar dezelfde week en scrollpositie.

## Rust en toegankelijkheid
- Gebruik de bestaande toegankelijke **Sheet**, **Dialog** en **AlertDialog** in plaats van handgemaakte schermvullende vensters.
- Alleen de actieve weergave wordt getoond; geen verborgen lange receptlijst achter inspiratie of nieuw toevoegen.
- Vaste kop en zoekveld, onafhankelijk schuivende resultaten en een veilige onderrand boven de mobiele navigatie.
- Tikdoelen blijven minimaal 56px; toetsenbord, zichtbare focus, Escape, focusherstel, schermlezerlabels en grotere tekst blijven ondersteund.
- Voeg rustige laad-, lege- en fouttoestanden met **Opnieuw proberen** toe.

## Behoud van bestaande werking
- Behoud eigen, gedeelde en favoriete recepten, recente planning, uitsluiting van reeds geplande gerechten, AI-ideeën, webzoeken, tekstplanning en volledig recept genereren.
- Behoud persoonlijke en gezinsplanning, dagdelen, instellingen, creditcontroles, receptbewaring, boodschappenlijstkeuze en realtime verversing.
- Geen nieuwe tabellen, gegevensmigraties of parallelle toevoegstroom.

## Technische uitvoering
- Splits de bestaande maaltijdkiezer intern op in de stappen **Wanneer**, **Mijn recepten**, **Inspiratie**, **Nieuw** en **Controle**.
- Leid filters en unieke resultaten af uit de bestaande recepten-, favorieten- en planningsgegevens.
- Hergebruik de bestaande functies voor plannen, AI, webimport, receptbewaring en boodschappen; alleen presentatie en bediening veranderen.
- Laat de actieve stap, gekozen datum, maaltijdmoment en zoekterm tijdens de open taak behouden blijven.

## Controle
- Test op 390×844: algemene toevoegknop, leeg maaltijdmoment, datum/moment wijzigen, zoeken, filters, eigen/gedeeld recept, favoriet, Foodlo-idee, webrecept en alleen-naamplanning.
- Test recept selecteren → inplannen → boodschappenvraag en terugkeren naar exact dezelfde week.
- Test geen recepten, veel recepten, dubbele groepskandidaten, laadfout en mislukte foto.
- Controleer toetsenbord, grotere tekst, focus, Escape, schermlezerlabels, veilige schermranden en geen horizontale uitloop.
- Herhaal de kernstroom op tablet en desktop en controleer actuele bouw- en runtimefouten.
- Niet publiceren zonder een aparte expliciete publicatiekeuze.
