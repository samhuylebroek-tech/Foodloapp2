# Slim de soort van een gerecht herkennen

Vandaag krijgt bijna elk nieuw gerecht "hoofdgerecht", ook als het duidelijk een soep, salade of dessert is. De soort moet automatisch goed gekozen worden en met één tik aanpasbaar zijn.

## Wat er verandert

1. **Automatische herkenning**
   Bij elk recept dat je toevoegt (zelf getypt, van een link, van tekst, via zoeken of via AI) kijken we naar de naam, de labels en de ingrediënten en kiezen we zelf de juiste soort: voorgerecht, hoofdgerecht, nagerecht, soep, salade, ontbijt, bijgerecht, drank of snack.
   Voorbeelden: "tomatensoep" wordt soep, "chocolademousse" wordt nagerecht, "griekse salade" wordt salade, "smoothie" wordt drank, "pannenkoeken" wordt ontbijt.
   Dit gebeurt lokaal in de app, dus het kost geen credits.

2. **Makkelijk aanpassen**
   In het receptformulier vervangen we het kleine keuzelijstje door grote knopjes met alle soorten naast elkaar; de automatisch gekozen soort staat aangeduid, één tik zet hem anders.

3. **Ook in het venster bij zoeken**
   Het venster waarin je een gevonden recept nakijkt vóór je het bewaart, toont dezelfde knopjes, zodat je de soort meteen kan corrigeren voor je opslaat.

4. **Bestaande recepten blijven zoals ze zijn**
   We veranderen niets aan wat je al bewaard hebt; de herkenning geldt voor nieuwe recepten en voor recepten waarvan de bron geen soort meegaf.

## Technisch

- Nieuw bestand `src/lib/soort.ts` met `raadSoort(titel, tags, ingredienten)`: woordenlijsten per categorie uit `CATEGORIES`, scoring op titel (zwaarst), tags en ingrediëntnamen, met `"hoofdgerecht"` als laatste terugval. Opgezet zoals het bestaande `src/lib/dieet.ts`.
- `src/components/RecipeForm.tsx`: `vulIn()` en de import-/zoekpaden gebruiken de bron-categorie enkel wanneer die in `CATEGORIES` zit; anders `raadSoort(...)`. Bij handmatig typen wordt de soort voorgesteld zodra er een titel en ingrediënten zijn, tenzij de gebruiker de soort zelf al aanpaste (bijhouden met een `soortHandmatig`-vlag).
- De `<select id="category">` wordt een rij toggle-knoppen (min. 48px hoog, `aria-pressed`), zelfde stijl als de bestaande filterchips.
- Het voorbeeldvenster krijgt dezelfde knoppenrij; de gekozen waarde gaat mee in de payload van `bevestigVoorbeeld`.
- Serverkant: in `src/lib/ai.functions.ts` blijft `recipeCategory` uit de bron leidend; de harde `?? "hoofdgerecht"`-terugvallen laten we ongemoeid, de app corrigeert bij het invullen.
- Geen databasewijzigingen, geen extra AI-oproepen.
