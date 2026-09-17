# Dubbel dagmenu op het beginscherm oplossen

Bevestigd in de database: op 17 september staat exact hetzelfde gerecht twee keer gepland — één keer persoonlijk en één keer als gezinsmaaltijd. Het beginscherm haalt alle maaltijden van vandaag op zonder onderscheid, dus beide verschijnen als aparte kaart. Dat is wat Sofie ziet.

Wat er verandert:
- Het beginscherm toont elk gerecht nog maar één keer per moment van de dag (ontbijt, middag, avond). Staat hetzelfde gerecht zowel persoonlijk als bij het gezin, dan blijft één kaart over.
- Die kaart krijgt een klein label "Gezin" wanneer de maaltijd enkel uit het gedeelde weekmenu komt, zodat duidelijk blijft waar het vandaan komt.
- Er wordt niets verwijderd uit de planning zelf; enkel de weergave wordt ontdubbeld. Het weekmenu blijft ongewijzigd.

## Technische details

- `src/routes/index.tsx`: dagmenu-query ontdubbelen op sleutel `meal_type + (recipe_id ?? custom_title)`, met voorrang voor de persoonlijke rij (`group_id is null`); `group_id` gebruiken voor het gezinslabel.
- Geen databasewijzigingen, geen wijziging aan de planner.

## Later (niet nu)

De duidelijkere installatiepopup ("Zet Foodlo op je beginscherm") staat op pauze tot je het vraagt.
