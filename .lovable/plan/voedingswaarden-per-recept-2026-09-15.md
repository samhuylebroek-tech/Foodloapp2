# Voedingswaarden per recept

Elk recept krijgt onderaan — onder ingrediënten en bereiding — een ingeklapte sectie "Voedingswaarden", berekend uit de ingrediënten zelf. Geen credits, geen internet nodig.

## Wat de gebruiker ziet

Ingeklapt, één regel:

```text
Voedingswaarden
620 kcal · 38 g eiwit · 52 g koolhydraten · 24 g vet   [ Bekijken v ]
```

Uitgeklapt:
- "Per portie" met het aantal personen dat bovenaan het recept al is ingesteld — dezelfde knoppen (+/−) sturen deze cijfers; er komt geen tweede keuze bij.
- Calorieën, eiwit, koolhydraten, vet, vezels, suikers, verzadigd vet, zout — met % van de dagelijkse referentie waar dat zinvol is.
- Een tweede uitklapper "Vitamines & mineralen" met enkel de waarden die echt bekend zijn.
- Een zinnetje "Geschat" wanneer van sommige ingrediënten de hoeveelheid of de gegevens ontbreken, met vermelding hoeveel ingrediënten meetellen.
- Kleine disclaimer: waarden zijn schattingen, informatief, geen medisch of voedingsadvies.

Op de bewerkpagina verandert het overzicht mee zodra je een ingrediënt toevoegt, verwijdert of een hoeveelheid aanpast.

## Hoe de berekening werkt

1. Ingrediëntnaam wordt genormaliseerd naar een canonieke naam (tomaat/tomaten/tomato → TOMAAT), met de bestaande naamsherkenning als basis.
2. Hoeveelheid wordt omgezet naar gram: g/kg/ml/l rechtstreeks, el/tl/snuf/stuk(s)/teen(tjes) via vaste standaardgewichten.
3. Per canoniek ingrediënt wordt de voedingswaarde per 100 g opgezocht in een ingebouwde tabel.
4. Alles opgeteld, gedeeld door het aantal porties.

Ingrediënten zonder hoeveelheid of zonder match tellen niet mee en worden geteld als "ontbrekend", zodat er nooit schijnprecisie ontstaat. Staat minder dan de helft van het gewicht in de tabel, dan tonen we geen cijfers maar de melding dat er te weinig gegevens zijn.

Geen AI, geen extra serververzoek: alles gebeurt in de app zelf op basis van de ingrediënten die al geladen zijn.

## Technisch

- Nieuw `src/lib/voeding.ts`: type `Voeding` (kcal, eiwit, koolhydraten, suikers, vet, verzadigd, vezels, zout/natrium + vitamines A/B1/B2/B3/B6/B9/B12/C/D/E/K en mineralen calcium, ijzer, magnesium, fosfor, kalium, zink, selenium), canonieke ingrediëntentabel per 100 g (~120 courante ingrediënten: vlees, vis, zuivel, granen, groenten, fruit, noten, olie, kruiden), aliassen, standaardgewichten per eenheid, `naarGram()`, `berekenVoeding(ingredienten, porties)` met dekkingspercentage en lijst van ontbrekende namen.
- EU-referentie-innames (RI) in dezelfde module; `%RI` alleen voor energie, vet, verzadigd vet, koolhydraten, suikers, eiwit, zout en de micronutriënten met een officiële RI.
- Nieuw `src/components/Voedingswaarden.tsx`: compacte kaart met twee niveaus uitklappen (details-achtig, toetsenbord- en schermlezervriendelijk, knoppen minstens 56 px hoog, grote tekst), in de bestaande stijl met design-tokens.
- `src/routes/recepten.$id.tsx`: component onderaan plaatsen, na Bereiding, met het al bestaande `aantal` (personen) als portieaantal.
- `src/components/RecipeForm.tsx`: hetzelfde component onder de ingrediëntenlijst, live gevoed door de ingrediënten in het formulier.
- Nederlandse teksten, via de bestaande `t()`-vertaling.

Geen databasewijziging nodig: de tabel is statische, versiebeheerde code die offline werkt en niets kost. Uitbreidbaar door ingrediënten aan de tabel toe te voegen.
