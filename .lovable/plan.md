# Negen verbeteringen uit de feedback

## 1. Weekmenu naar eigen smaak instellen

Bovenaan het weekmenu komt een klein tandwieltje. Daar zet je alles voor deze module:

- **Weergave**: lijst onder elkaar (huidige), week naast elkaar met vegen per dag, of compact rooster.
- **Dagdelen**: ontbijt / middageten / avondeten, of één blok "maaltijd" (de bestaande keuze verhuist mee hierheen en blijft ook in Instellingen staan).
- **Welke dagen**: bv. enkel weekdagen, of het weekend weglaten.
- **Startdag van de week**: maandag of zondag.

Alles wordt bij je account bewaard, dus het staat ook goed op je andere toestel.

## 2. Zoeken in jouw taal

Het zoeken op het web gebruikt nu automatisch je ingestelde taal en land: Nederlands zoekt eerst op Belgische en Nederlandse receptsites, Frans op Franse, enzovoort. De zoekopdracht krijgt het juiste woord voor "recept" mee en de taalvoorkeur van je browser.

## 3. AI-inspiratie eerst bekijken

Bij "Zin in iets nieuws?" tik je voortaan op een idee om het te openen: je ziet de beschrijving, de ingrediënten en de bereiding in een venster. Pas dan kies je "Bewaar bij mijn recepten", of je sluit het met de X.

## 4. Zoeken in je eigen recepten werkt weer juist

Nu mist de zoekfunctie treffers omdat op labels hoofdlettergevoelig en op hele woorden wordt vergeleken. Het wordt: losse woorden, accenten en hoofdletters negeren, en zoeken in titel, beschrijving, labels, soort én ingrediënten. Typ je twee woorden, dan moeten ze allebei ergens voorkomen. De beste treffers (titel) staan bovenaan.

## 5. Boodschappen per categorie

De lijst wordt gegroepeerd in duidelijke kopjes: Groenten & fruit, Vlees & vis, Zuivel & eieren, Brood & bakkerij, Voorraadkast, Diepvries, Dranken, Non-food en Overige. De categorie wordt automatisch herkend uit de naam van het product; klopt het niet, dan pas je het per lijn aan.

## 6. Dezelfde ingrediënten worden opgeteld

Hetzelfde product uit twee recepten komt één keer op de lijst met de som erbij (bv. "300 g ui"). Ook schrijfvarianten (enkelvoud/meervoud, "uien"/"ui", hoofdletters) worden herkend als hetzelfde. Verschillende eenheden worden omgerekend waar dat kan (g/kg, ml/l), anders staan ze netjes naast elkaar.

## 7. Vinkje: staat al op je boodschappen

Bij een recept zie je meteen of het al op een boodschappenlijst staat. Klik je toch opnieuw op toevoegen, dan komt er eerst: "Dit recept staat al op je lijst. Wil je de ingrediënten nog eens toevoegen?" met "Toch toevoegen" of "Annuleren".

## 8. Voorraadkast-producten apart

Zaken die je normaal thuis hebt — zout, peper, olijfolie, water, suiker, bloem, azijn, kruiden, boter — komen onder het kopje "Heb je waarschijnlijk al" te staan, standaard ingeklapt en niet afgevinkt als boodschap. Staat iets echt in je voorraadkast (de bestaande Voorraad-pagina), dan wordt dat ook zo getoond. Met één tik verplaats je zo'n lijn alsnog naar de echte boodschappenlijst.

## 9. "Voor hoeveel personen?" eenvoudiger

De vraag wordt begrijpelijker gemaakt in plaats van moeilijker:

- Nieuwe verwoording: "Deze hoeveelheden zijn genoeg voor ... personen" met grote - en + knoppen en standaard 4.
- Eronder: "Weet je het niet zeker? Laat het zo staan — je kan de hoeveelheden later altijd omrekenen."
- Bij een gevonden of geïmporteerd recept wordt het aantal overgenomen van de bron; ontbreekt dat, dan schatten we het uit de hoeveelheden (bv. 500 g pasta ≈ 4 personen) en tonen we "geschat" bij het getal.

## 10. Minder herhaling bij de kookstappen

Bij een stap komen enkel nog de ingrediënten die je op dát moment echt nodig hebt, en gebruikt een stap niets, dan staat er ook niets. Nu worden er te veel ingrediënten aan een stap gehangen omdat de herkenning te los is, wat lang scrollen geeft. De herkenning wordt strenger: alleen een echte woordtreffer telt, en per stap tonen we maximaal de vier belangrijkste. Zelf ingrediënten bij een stap zetten blijft mogelijk.

## Technisch

- **Weekmenu-instellingen**: migratie voegt `profiles.weekmenu jsonb` toe (weergave, dagdelen, dagen, startdag) met bestaande defaults; uitgelezen en bewaard via `src/lib/voorkeuren.tsx` (zelfde patroon als `taal`/`thema`/`momenten`). `src/routes/planner.tsx` krijgt een tandwiel-dialoog en drie weergaven; de bestaande plan-/gezinslogica blijft ongewijzigd.
- **Zoektaal**: in `zoekReceptenOpWeb` (`src/lib/ai.functions.ts`) wordt de taal als parameter meegegeven; het zoekwoord ("recept"/"recette"/"rezept"/"recipe"), de `Accept-Language`-kop en de domeinbonus in `scoreVan` volgen die taal. Cachesleutel wordt `web|<taal>|<term>`.
- **AI-inspiratie**: `NieuweSuggesties.tsx` haalt bij aantikken het recept op via de bestaande `importRecipeFromText` en toont het in een voorbeeldvenster (zelfde patroon als het voorbeeldvenster in `RecipeForm.tsx`); bewaren gebruikt de bestaande insert.
- **Recepten zoeken**: nieuwe helper `src/lib/zoeken.ts` met normalisatie (lowercase, accenten weg) en woord-voor-woord-matching; `src/routes/gerechten.tsx` gebruikt die in `zichtbaar` en sorteert op trefferscore. De bestaande `ilike`-query op ingrediënten blijft.
- **Boodschappen**: nieuwe `src/lib/categorie.ts` met woordenlijsten per categorie plus een `VOORRAADKAST`-lijst; `boodschappen.tsx` groepeert items en toont het voorraadkast-blok ingeklapt, gecombineerd met de rijen uit `pantry_items`. Geen nieuwe kolom nodig: de categorie wordt afgeleid uit de naam; een handmatige correctie wordt bewaard als prefix-vrije mapping in `shopping_items.unit`-onafhankelijke lokale voorkeur per gebruiker (localStorage), zodat er geen schemawijziging nodig is voor lijst-items.
- **Optellen**: `voegToeAanLijst` in `src/lib/boodschappen.ts` krijgt een sterkere sleutel (genormaliseerde naam met enkelvoud/meervoud, eenheden omgerekend naar basis g/ml) zodat dubbels samensmelten; bestaande items worden bijgeteld zoals nu.
- **Vinkje + bevestiging**: in `src/routes/recepten.$id.tsx` een query op `shopping_items` met `recipe_id = r.id`; bij hergebruik een `AlertDialog` voor de bevestiging.
- **Porties**: label- en hulptekstwijziging in `RecipeForm.tsx`, plus schatfunctie in `src/lib/porties.ts` die alleen gebruikt wordt als de bron geen `servings` geeft.
- Geen tweede systeem: alle wijzigingen bouwen voort op bestaande tabellen, importpipeline en credits.
