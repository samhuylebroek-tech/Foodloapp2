# Vier dingen terugbrengen en verbeteren

## 1. Suggesties voor de dag terug op het startscherm

Het blok met nieuwe kookideeën is bij het herontwerp van de startpagina verdwenen, maar de achterliggende functie bestaat nog volledig.

Terug, maar rustiger dan vroeger:
- Eén compact blok onderaan de start: "Zin in iets nieuws?" met knop "Zoek nieuwe ideeën".
- Pas na een tik worden ideeën opgehaald (nooit vanzelf, dus geen onnodige kosten).
- Resultaat: een horizontale rij van ideeënkaartjes met korte uitleg en de knop "Bewaar bij mijn recepten".
- Ideeën die je al in je recepten hebt, worden weggelaten.

## 2. "Start koken" ook bij de bereiding

De knop staat nu enkel bovenaan het recept. Er komt een tweede, identieke knop onderaan het tabblad Bereiding, zodat je vanaf de stappen meteen kan starten. Zelfde werking, geen dubbele logica.

## 3. Datum kiezen bij inplannen vanuit het weekmenu

Bij "inplannen" vanuit het weekmenu kan je nu enkel de zeven dagen van de getoonde week kiezen. Er komt bovenaan het keuzescherm een gewone datumkiezer, zodat je ook een dag in een andere week kan kiezen. De dagknoppen blijven bestaan als snelkeuze en de gekozen dag blijft altijd zichtbaar bovenaan ("Dinsdag 22 september").

## 4. Rondleiding die je echt door de app leidt

De rondleiding is nu een reeks tekstschermen. Ze wordt een echte begeleide tour:
- De app blijft zichtbaar; onderaan verschijnt een klein uitlegkaartje.
- Elke stap navigeert automatisch naar het juiste scherm (start, recepten, gerecht toevoegen, weekmenu, boodschappen, voorraad, kaarten, vrienden, meldingen, instellingen).
- Het element waarover het gaat krijgt een lichte markering met een pijl ernaar.
- Knoppen: Vorige, Volgende, Overslaan; voortgangsbalk blijft.
- Herstarten blijft mogelijk via Instellingen; de tour start automatisch bij een eerste aanmelding, precies zoals nu.
- Kan je de tour niet afmaken, dan sluit ze gewoon af zonder iets stuk te maken.

## Technisch

- Start: `src/routes/index.tsx` krijgt het suggestieblok terug op basis van `ontdekSuggesties` / `importRecipeFromText` uit `src/lib/ai.functions.ts`, met dezelfde query keys en credit-flow als voorheen; enkel bij expliciete tik.
- Recept: extra `Start koken`-knop in `TabsContent value="bereiding"` van `src/routes/recepten.$id.tsx`, dezelfde handler.
- Weekmenu: `ReceptKiezer` in `src/routes/planner.tsx` krijgt een `input type="date"` naast de dagchips; bij een datum buiten de week blijft `plan_toevoegen` ongewijzigd werken en wordt de planner naar die week gescrold.
- Rondleiding: `src/routes/rondleiding.tsx` wordt een overlay-component (`src/components/Rondleiding.tsx`) die in `AppShell` gerenderd wordt, met per stap een route en een `data-tour`-doelselector; `RONDLEIDING_SLEUTEL` in localStorage blijft dezelfde, zodat bestaande gebruikers niet opnieuw de tour krijgen. De bestaande route blijft bestaan en start de overlay.
- Geen databasewijzigingen, geen tweede systeem, bestaande functionaliteit blijft.
