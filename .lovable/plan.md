# Boodschappenlijst scherper + weekmenu doorlopen

## 1. Boodschappenlijst: overzicht per categorie

- Elke categorie wordt een compacte kaart met een kopje, het aantal open items en een pijltje om de categorie samen te vouwen. Zo zie je in één blik hoeveel er nog per afdeling ligt.
- Bovenaan een rustige balk: aantal open boodschappen, een voortgangsstreepje (bv. "7 van 12 klaar") en één knop "Opruimen".
- Afgevinkte items schuiven meteen naar onderen in het uitklapbare blok "Afgevinkt", zodat het overzicht schoon blijft.
- Regels worden korter: naam links, hoeveelheid rechts in het klein, alles blijft aantikbaar met minstens 48 px hoogte.

## 2. Snel bewerken en verwijderen

- Tik op de naam = direct bewerken (naam, hoeveelheid, eenheid) in hetzelfde venster als nu.
- Per regel een veegbeweging naar links op gsm: verwijderen; naar rechts: afvinken. Met daarnaast altijd de zichtbare knoppen, zodat het ook zonder vegen werkt.
- Per categorie een knopje "Alles in deze afdeling afvinken".
- Verwijderen krijgt "Ongedaan maken" in de melding, zodat een misklik geen schade doet.
- Meerdere items tegelijk kiezen (lang indrukken of "Selecteren") om ze samen te verwijderen of te verplaatsen naar een andere lijst.

## 3. Winkelmodus

- Nieuwe knop "Ik sta in de winkel" opent een schermvullende weergave:
  - extra grote regels, één categorie per keer in volgorde van de winkel,
  - afgevinkte items verdwijnen meteen met een korte animatie,
  - teller "nog 6 te gaan" en een knop om terug te keren,
  - scherm blijft aan tijdens het winkelen (waar de telefoon dat toelaat).
- Alles blijft dezelfde lijst en dezelfde gegevens; enkel de weergave verschilt.

## 4. Delen via een link

- Knop "Lijst delen" krijgt twee keuzes: "Stuur als tekst" (zoals nu, netjes per categorie) en "Deel met een link".
- De link gebruikt het bestaande uitnodigingssysteem van Foodlo (Vrienden & Gezin), maar dan meteen ingesteld op enkel boodschappen mogen zien en aanpassen.
- Wie de link opent en nog geen account heeft, maakt eerst een Foodlo-account aan; daarna staat de gedeelde lijst automatisch in zijn app en kunnen jullie samen aanvinken.
- Op de lijst zelf zie je wie meekijkt en kan je iemand weer verwijderen.

## 5. Weekmenu doorlopen en fijnslijpen

Ik loop de volledige flow na op gsm en desktop en herstel wat hapert:
- een dag kiezen en het voorstel van Foodlo krijgen,
- "Ik wil iets anders": eigen gerecht zoeken of een nieuw idee vragen,
- de foto van het recept en de kooktijd die per dag aanpasbaar is,
- de pijlen naar de volgende en vorige week, inclusief dat voorbije dagen niet meer worden voorgesteld.

## 6. Weekmenu en boodschappen samen

- Haal je een gerecht uit je weekmenu en staan de ingrediënten al op een lijst, dan vraagt Foodlo: "Ook de ingrediënten van dit gerecht van je boodschappenlijst halen?" met de items erbij. Al afgevinkte of zelf toegevoegde items blijven staan.
- Aan het einde van het weekmenu-voorstel komt een extra stap "Alles op je boodschappenlijst": je vinkt aan voor welke gerechten je de ingrediënten wilt, kiest de lijst en zet ze in één keer klaar — met optelling van dubbele ingrediënten zoals nu.

## Technisch

- Alles in `src/routes/boodschappen.tsx` plus kleine helpers in `src/lib/boodschappen.ts` / `src/lib/categorie.ts`; geen tweede boodschappensysteem.
- Winkelmodus is een extra weergave binnen dezelfde route (geen aparte tabel, geen aparte gegevens).
- Delen hergebruikt de bestaande `shares`-tabel met `shopping_view`/`shopping_edit` en de bestaande `/uitnodiging`-pagina; geen nieuwe tabellen of migraties.
- Weekmenu: herstelwerk in `src/routes/planner.tsx` en `src/lib/weekmenu-voorstel.ts` op basis van wat de doorloop toont.
- Koppeling weekmenu ↔ boodschappen via de bestaande `recipe_id` op `shopping_items`; toevoegen loopt via de bestaande `voegToeAanLijst`-logica, geen nieuwe tabellen.
- Na afloop: bouw- en veiligheidscontrole groen, daarna pas publiceren.
