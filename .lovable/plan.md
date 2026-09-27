# Recepten toevoegen, bewerken, importeren en gerechten plannen herwerken

## Doel
Van "een groot formulier invullen" naar "ik wil dit bewaren" of "ik wil dit dinsdag eten". Foodlo vult de rest aan. Niets van de huidige werking verdwijnt: import (website, Instagram/TikTok/YouTube/Pinterest, delen naar de app), foto/scan, AI-hulp, webzoeken, stap-ingrediënten, tekst opschonen, voedingswaarden, geschiedenis, delen, credits en boodschappen blijven.

## Kernregel: gerecht plannen is iets anders dan recept bewaren
- In het weekmenu kan je gewoon "Lasagne", "Restjes", "Uit eten" of "Later bepalen" zetten, zonder recept. Dit kan technisch al (een geplande maaltijd mag een naam zonder recept hebben); we maken het nu de hoofdweg in plaats van een uitzondering.
- Een gepland gerecht zonder recept krijgt in het weekmenu een rustige detailweergave met: **Recept koppelen** (uit mijn recepten, met gelijkaardige namen bovenaan), **Nieuw recept maken** (naam al ingevuld), **Recept importeren** (link of foto), naam wijzigen, verplaatsen, dupliceren, herhalen, verwijderen.
- Na koppelen of aanmaken wordt de geplande maaltijd automatisch aan het recept gelinkt; boodschappen werken dan zoals nu.

## 1. Recept toevoegen: één keuzescherm
Bij **+ Recept toevoegen** (Recepten, Weekmenu, Boodschappen, delen naar de app) eerst een korte keuze:
- Zelf invoeren
- Van een website of social (plakken van link)
- Foto of scan
- Met AI helpen (beschrijf wat je wil)

## 2. Recept-bouwer in plaats van lang formulier
- **Start:** enkel "Hoe heet dit gerecht?", daarna optioneel foto en korte omschrijving.
- **Daarna een overzicht met onderdelen** die je in elke volgorde kan openen: Ingrediënten, Bereiding, Tijd & personen, Extra (soort, labels, moeilijkheid, bron, voedingswaarden). Elk onderdeel toont rustig ✓ ingevuld of ○ nog leeg; geen rode waarschuwingen.
- **Automatisch bewaren** vanaf het moment dat er een naam is, met subtiel "Automatisch bewaard". Een vaste knop **Klaar** blijft altijd onderaan zichtbaar; klaar mag ook als niet alles ingevuld is.
- **Concepten:** onvolledige recepten verschijnen in Recepten onder een filter **Concepten** ("Nog 2 onderdelen"). Bij terugkomen: "Je was bezig met Lasagne — Verdergaan".
- **Ingrediënten:** één veld per regel of een hele lijst plakken; "500 g gehakt", "2 uien" wordt direct herkend met Belgische maten en is corrigeerbaar.
- **Bereiding:** een geplakte tekst wordt zonder AI in stappen verdeeld ("Ik heb je bereiding in 3 stappen verdeeld"), aanpasbaar. Tijden in de tekst ("10 minuten") worden voorgesteld, nooit verzonnen.
- **Ingrediënten per stap:** alleen koppelen wat letterlijk in die stap staat (geen "peper" bij "paprika", geen losse gokken). Per stap een lijst vinkjes om zelf te koppelen of los te koppelen. Een stap zonder ingrediënten mag.

## 3. Bewerken
Bewerken opent dezelfde bouwer met het overzicht, zodat je meteen naar het onderdeel gaat dat je wil aanpassen. De bestaande snelle aanpassingen op de receptpagina blijven.

## 4. Importeren met rustige controle
Na elke import (link, social, foto/scan, AI) een controlescherm: naam, foto, en per onderdeel ✓ gevonden / ○ niet gevonden, met **Bewaren**, **Bekijken en aanpassen** (opent de bouwer) en, vanuit het weekmenu, **Bewaren en inplannen**. Dubbeldetectie ("dit recept heb je al") blijft.

## 5. Weekmenu: "Wat wil je eten?"
- De bestaande kiezer krijgt bovenaan één groot veld **Wat wil je eten?** met directe suggesties uit eigen recepten, recente en favoriete gerechten.
- Onder de resultaten altijd (geen doodlopend spoor): **"Lasagne" inplannen zonder recept**, **Nieuw recept maken**, **Importeren**, **Inspiratie**.
- Snelle keuzes: Restjes, Uit eten, Later bepalen.
- Vanuit een recept of favoriet: **Inplannen** blijft; vanuit een gepland gerecht: dupliceren naar een andere dag, herhalen volgende week, verplaatsen naar een andere dag (via een keuzemenu, geen verplicht slepen).
- Boodschappen vanuit het weekmenu: gerechten zonder recept worden overgeslagen met een duidelijke vermelding ("Lasagne heeft nog geen recept — voeg een recept toe of zet zelf iets op de lijst").

## Wat niet verandert
Bestaande recepten, planningen, rechten, gezinsplanning, realtime, credits en importkanalen. Betalingen blijven uit. Niet publiceren zonder aparte keuze.

## Uitvoering in fasen
1. Weekmenu: "Wat wil je eten?", plannen zonder recept, detail met koppelen/maken/importeren, dupliceren/herhalen/verplaatsen.
2. Keuzescherm "Recept toevoegen" en recept-bouwer met overzicht, automatisch bewaren en concepten.
3. Ingrediënten- en bereidingsinvoer: lijst plakken, stappen verdelen, strikte stapkoppeling met vinkjes, tijden herkennen.
4. Import-controlescherm voor alle kanalen; bewerken via dezelfde bouwer.
5. Eindcontrole op telefoon en desktop.

## Technische details
- **Eén kleine, toevoegende databasewijziging:** kolom `is_concept boolean NOT NULL DEFAULT false` op `recipes` (concepten) en optionele kolom `soort text` op `meal_plan` (bv. `restjes`, `uit_eten`, `later`). Bestaande rijen blijven ongewijzigd; geen nieuwe tabellen.
- Concepten worden standaard uit weekmenuvoorstellen, suggesties en de recepten-limiet-telling gehouden waar dat logisch is; gedeelde vrienden zien concepten niet.
- Autosave: debounced update (±800 ms) op het bestaande recept; eerste bewaring maakt het recept aan met `is_concept = true`; **Klaar** zet het op `false`.
- `RecipeForm.tsx` (1.735 regels) wordt opgesplitst in bouwer-onderdelen (Start, Overzicht, Ingrediënten, Bereiding, Extra, ImportControle), met hergebruik van bestaande import-, AI-, OCR-, foto- en webzoekfuncties. De URL van delen naar de app (`/recepten/nieuw?title&text&url`) blijft werken.
- Stapkoppeling in `stap-ingredienten.ts` wordt strenger: volledige woordmatch op genormaliseerde naam/stam, geen deelwoord-treffers; handmatige koppelingen blijven voorrang houden.
- Stappen verdelen en tijden herkennen gebeurt lokaal (zinsgrenzen, "Stap 1", nummering, "x minuten"); AI enkel bij expliciete tik.
- Weekmenu-kiezer in `planner.tsx` wordt uitgebreid, geen parallelle stroom; koppelen = update `recipe_id` op de bestaande geplande rij.
- Controle: tsgo, bouwlog, Playwright op 390×844 en 1280×1800 voor elke reis (zelf invoeren, concept verlaten/hervatten, website/social/foto-import, AI, bewerken, plannen zonder recept, later recept koppelen/maken/importeren, restjes, dupliceren/herhalen/verplaatsen, weekmenu → boodschappen), plus toetsenbord, focus en grotere tekst.
