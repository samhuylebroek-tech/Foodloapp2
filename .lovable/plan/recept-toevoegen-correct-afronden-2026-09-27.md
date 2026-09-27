# Recept toevoegen correct afronden

## Doel
Zorgen dat een gerecht nooit ongemerkt rechtstreeks wordt toegevoegd en dat een toegevoegd gerecht onmiddellijk uit Ideeën om te koken verdwijnt.

## Aanpak
1. Bij toevoegen vanuit Ideeën om te koken eerst een duidelijk controlevenster tonen met naam, categorie, moeilijkheid, personen, tijden, ingrediënten en bereidingsstappen.
2. Pas na “Bewaren” het recept aanmaken; “Nog iets aanpassen” houdt het venster open en alle velden blijven wijzigbaar.
3. De aangepaste gegevens uit dit venster bewaren in Mijn recepten, zonder dubbele recepten te maken.
4. Na bewaren zowel Mijn recepten als de lijst met eigen recepttitels onmiddellijk verversen, zodat het gerecht direct uit Ideeën verdwijnt.
5. Ook de bestaande receptbouwer dezelfde verversing laten uitvoeren na bewaren.
6. De volledige flow op telefoonformaat testen: idee openen, aanpassen, bewaren, terugkeren en controleren dat het niet meer bij Ideeën staat.

## Technisch
- De bestaande centrale kopieerfunctie voor inspiratie-recepten uitbreiden met gecontroleerde overschrijvingen.
- React Query-caches voor `recipes` en `eigen-recept-titels` tegelijk verversen.
- Bestaande foto’s blijven behouden; er wordt alleen een foto gemaakt als het bewaarde recept geen foto heeft.
