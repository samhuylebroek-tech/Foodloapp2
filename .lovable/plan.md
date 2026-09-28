# Recept toevoegen en inplannen rustiger maken

## Wat er nu gebeurt
- Na het bewaren van een nieuw recept opent meteen het venster "Meteen inplannen?" — dat moet weg.
- Op het formulier voor een nieuw recept staat de bewaar-knop ("Klaar") enkel onderaan; wie bovenin zit ziet hem niet.
- Op de receptpagina staat "Inplannen" verstopt in het Overzicht-tabblad en in het menu met de drie puntjes — niet zichtbaar bovenaan.

## Wijzigingen

### 1. Geen inplanvraag meer na bewaren
- In `src/components/RecipeForm.tsx`: het venster "Meteen inplannen?" (netOpgeslagen) en de optie `vraagInplannen` verdwijnen.
- Na "Klaar" gaat de app meteen naar de bewaarde receptpagina. Daar staat Inplannen voortaan zichtbaar bovenaan, dus inplannen kan daarna gewoon in één tik.

### 2. Bewaren bovenaan bij een nieuw recept
- Op `/recepten/nieuw` komt er bovenaan een vaste balk met dezelfde knop "Klaar" (bij koppelen: "Klaar en koppelen").
- De balk blijft bovenin zichtbaar tijdens het scrollen; de onderaan-knop blijft ook bestaan. Beide doen hetzelfde: eerst het controlevenster "Klopt alles?" openen, daarna bewaren.

### 3. Inplannen bovenaan de receptpagina
- In `src/routes/recepten.$id.tsx`: "Inplannen" komt naast "Voeg toe aan boodschappenlijst" te staan, bovenaan onder de foto/titel — bijvoorbeeld twee knoppen naast elkaar: "Inplannen" (kruidengroen) en "Boodschappenlijst" (secondair).
- De oude Inplannen-knop in het Overzicht-tabblad verdwijnt; het item in het drie-puntjesmenu blijft als extra weg.
- Inplannen opent nog steeds de bestaande dag-/momentkiezer.

## Testen
- Nieuw recept aanmaken: controlevenster pas bij "Klaar", daarna direct op de receptpagina, geen inplanvenster.
- Receptpagina: Inplannen en Boodschappenlijst zichtbaar bovenaan, plankeuze werkt.
- Playwright-controle op mobiel van de hele flow.
