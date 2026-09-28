# Recepten, kookstand en boodschappen duidelijker maken

## 1. Recepten en ideeën

- De knop **+ Toevoegen** blijft altijd rechtsboven zichtbaar, zowel bij **Mijn recepten** als bij **Ideeën om te koken**.
- Alle receptfilters gebruiken overal dezelfde drie eetstijlen: **Vegetarisch**, **Vlees** en **Vis**.
- Bij **Type gerecht** wordt **Slaatje** zichtbaar toegevoegd. Bestaande recepten met de interne waarde “salade” blijven gewoon werken en verschijnen als “Slaatje”.
- Dezelfde benamingen en keuzes worden hergebruikt op recepten, ideeën, zoeken en het toevoegen/bewerken van een recept.

## 2. Een recept toevoegen

- De startkeuzes worden hernoemd naar:
  - **Zelf invoeren**
  - **Van tekst of link**
  - **Foto toevoegen**
  - **Zoeken**
- Verwijzingen naar “schermafbeelding”, “AI foto” en “Zoeken of AI” verdwijnen uit de zichtbare knoppen en teksten. Een gewone foto, scan of schermafbeelding kan nog steeds technisch worden gebruikt.
- Zodra er voldoende receptinformatie is ingelezen of ingevuld, verschijnt eerst een klein controlevenster met:
  - **Soort gerecht**
  - **Eetstijl: Vegetarisch, Vlees of Vis**
  - **Moeilijkheid**
- Deze keuzes worden daarna ingevuld in het recept en blijven aanpasbaar vóór het definitieve bewaren.
- Bij de bereidingsstappen worden standaard alleen automatisch herkende of handmatig gekoppelde ingrediënten getoond. De volledige ingrediëntenlijst staat niet meer voortdurend onder iedere stap.
- Per stap komt een duidelijke actie **Ingrediënt koppelen** waarmee de volledige lijst tijdelijk opent als iemand een koppeling wil corrigeren.

## 3. Kookstand: scherm blijft aan

- De huidige webfunctie blijft behouden voor gebruik in de browser en als geïnstalleerde web-app.
- De Android- en iOS-app krijgen daarnaast een echte telefoonfunctie om het scherm wakker te houden zolang de kookstand openstaat.
- Bij terugkeren naar de app wordt de schermblokkering opnieuw aangevraagd; bij sluiten van de kookstand wordt ze altijd vrijgegeven.
- Als een toestel dit toch weigert, krijgt de gebruiker een korte, begrijpelijke melding in plaats van een stille mislukking.

## 4. Boodschappen uit gerechten

- Het blok met gerechten uit het weekmenu staat niet meer boven de boodschappenlijst.
- Bovenaan komen duidelijke tabbladen:
  - **Mijn lijst** — de gewone boodschappen en snelle toevoeging.
  - **Uit gerechten** — gerechten uit het weekmenu waarvan ingrediënten kunnen worden toegevoegd.
- Een gerecht waarvan ingrediënten al op de actieve lijst staan, toont **Al toegevoegd** en kan niet onbedoeld dubbel worden toegevoegd.
- Ook na afvinken en opruimen herkent Foodlo via de echte koopgeschiedenis dat het gerecht al verwerkt is. Bij bewust verwijderen kan het opnieuw worden toegevoegd.
- De bestaande bescherming tegen dubbele losse producten blijft werken.

## 5. Meerdere foto’s per gerecht

- De bestaande hoofdfoto blijft de foto die op receptkaarten, in het weekmenu en bovenaan het gerecht verschijnt.
- De eigenaar kan die hoofdfoto altijd vervangen.
- Onder het gerecht komt een fotogalerij waarin meerdere extra foto’s kunnen worden toegevoegd, bekeken en verwijderd.
- Een extra foto kan als nieuwe hoofdfoto worden ingesteld zonder de andere foto’s kwijt te raken.
- Automatisch voorgestelde foto’s blijven alleen aangemaakt worden wanneer een recept nog helemaal geen foto heeft; zelfgekozen foto’s worden nooit overschreven.

## 6. Controle

- Test de volledige flow op mobiel en desktop: recept toevoegen via alle vier startkeuzes, controlevenster, stap-ingrediënten, filters, ideeën en fotogalerij.
- Test de kookstand in browser en Android-app, inclusief weggaan en terugkeren naar de app.
- Test boodschappen met toevoegen, dubbel toevoegen, afvinken, opruimen, bewust verwijderen en wisselen tussen lijsten.
- Controleer leesbaarheid, minimaal 56 px grote hoofdacties, toetsenbordbediening en foutmeldingen.

## Technisch

- Eén gedeelde bron voor eetstijl- en soortlabels; “Slaatje” wordt als zichtbaar label gekoppeld aan de bestaande waarde `salade`.
- De ingrediëntenkoppeling in `RecipeForm` krijgt een ingeklapte picker per stap in plaats van alle ingrediënten direct te renderen.
- Wake lock gebruikt de Screen Wake Lock API plus een Capacitor keep-awake-oplossing voor native Android/iOS.
- Nieuwe tabel voor extra receptfoto’s met eigenaar-/deelrechten, expliciete toegangsrechten en privéopslag. `recipes.image_url` blijft de hoofdfoto zodat bestaande schermen stabiel blijven.
- De status “Al toegevoegd” combineert actuele `shopping_items.recipe_id` met echte `shopping_history.recipe_id`; verwijderen en opnieuw toevoegen krijgen een expliciete statusovergang.
