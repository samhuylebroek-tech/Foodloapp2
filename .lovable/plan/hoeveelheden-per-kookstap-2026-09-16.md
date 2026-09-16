# Hoeveelheden per kookstap

Bij elke stap van de bereiding zie je meteen hoeveel je van welk ingrediënt nodig hebt, zodat je niet terug naar de ingrediëntenlijst moet.

## Wat de gebruiker ziet

Op de receptpagina, onder de tekst van elke stap, kleine labels:

```text
3   Bak de ui en de knoflook zacht in de olijfolie.
    [ 2 uien ]  [ 3 teentjes knoflook ]  [ 2 el olijfolie ]
```

In de kookstand staan dezelfde hoeveelheden groot onder de stap, goed leesbaar van op afstand.

De hoeveelheden volgen het aantal personen dat bovenaan het recept is ingesteld: zet je 6 personen, dan staat er 3 uien.

Stappen waarin geen ingrediënt herkend wordt, blijven gewoon zoals ze nu zijn — geen lege balk.

## Zelf bijsturen

Bij "Recept aanpassen" komt onder elke stap een rij met alle ingrediënten van het recept als aan/uit-knopjes. Automatisch herkende ingrediënten staan al aan; je kan er eentje uitzetten of een vergeten ingrediënt aanzetten. Zodra je zelf iets aanpast bij een stap, telt jouw keuze voor die stap en niet meer de automatische herkenning.

## Hoe de herkenning werkt

- De naam van elk ingrediënt wordt vergeleken met de woorden in de staptekst, ongevoelig voor hoofdletters, meervoud (ui/uien, tomaat/tomaten) en bijwoorden ("fijngesneden ui").
- Bij samengestelde namen ("gemalen zwarte peper") volstaat het kernwoord.
- Een ingrediënt wordt maar bij één stap getoond: de eerste stap waarin het voorkomt, tenzij de tekst duidelijk opnieuw naar de rest verwijst ("de overige tomaten").
- Alles gebeurt in de app zelf: geen AI, geen credits, geen extra verzoek.

## Technisch

- Nieuw `src/lib/stap-ingredienten.ts`: `normaliseer(naam)` (kleine letters, accenten weg, meervoud-suffixen -en/-s/-jes), `koppelStappen(stappen, ingredienten, handmatig)` → per stapindex een lijst ingrediënt-id's; gebruikt de bestaande naamnormalisatie uit `src/lib/voeding.ts`/`ingredienten.ts` waar mogelijk; eerste-voorkomen-regel; schaalt hoeveelheden met dezelfde factor als de ingrediëntenlijst.
- Nieuw `src/components/StapIngredienten.tsx`: rij met chips (`quantity × factor` + eenheid + naam), variant `compact` voor de receptpagina en `groot` voor de kookstand, design-tokens, minstens 44 px raakvlak.
- `src/routes/recepten.$id.tsx`: chips onder elke `<li>` in Bereiding en onder de staptekst in de kookstand, gevoed door `aantal`/`factor`.
- `src/components/RecipeForm.tsx`: stappen worden nu als één tekstveld bewerkt (`stappenTekst`); daaronder komt per regel een rij toggles met de ingrediënten van het formulier. Handmatige keuzes worden per stapindex bijgehouden en meebewaard.
- Migratie (additief, geen breaking change): nieuwe nullable kolom `recipes.step_ingredients jsonb` die per stapindex de handmatig gekozen ingrediëntnamen bewaart (namen, niet id's, zodat ze een herschrijving van ingrediënten overleven). Bestaande recepten blijven `null` = volledig automatisch. Daarna `types.ts` opnieuw genereren.
- Nederlandse teksten via de bestaande `t()`-vertaling; geen wijziging aan boodschappenlijst, planner of voedingswaarden.
