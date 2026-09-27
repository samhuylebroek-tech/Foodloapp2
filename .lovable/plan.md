# Foodlo: volledig herontwerp

Alle functies en gegevens blijven zoals ze zijn. Wat verandert is hoe elk scherm eruitziet en hoe je erdoor navigeert.

## Jouw keuzes (vast)
- Kleuren: warm papier `#FAF6EF`, witte vlakken `#FFFFFF`, kruidengroen `#2F6B4F` voor de hoofdknop, honinggeel `#E8A53B` alleen om "vandaag" en keuzes aan te duiden, tekst `#1F2A24`.
- Letters: Outfit voor titels, Figtree voor gewone tekst, basisgrootte 18px.
- Opbouw: één kolom met grote blokken, op elk scherm. Geen rasters vol kleine tegels.
- Licht thema is de standaard. Donker blijft kiesbaar in Instellingen, met dezelfde opbouw.

## Wat er nu misloopt (samen met jou vastgesteld)
- Weekmenu: "Mijn planning", het tandwiel, Toevoegen, Laat kiezen en Boodschappen zijn vijf gelijkwaardige knoppen. Er staan geen datums bij "Deze week". Op zondag zie je maar één dag.
- Je ziet niet in één oogopslag waar je bent en wat de belangrijkste actie is.
- Kaarten, randen, pilletjes en kleine grijze tekstjes verschillen van scherm tot scherm.
- Het donkere thema staat aan, terwijl de rustige lichte stijl voor 65+ duidelijker is.

## Vaste regels voor elk scherm
1. Bovenaan: één grote titel en één korte zin ("Dit eten we vandaag").
2. Eén groene hoofdknop over de volle breedte. Al de rest is een rustige tweede knop of een tekstlink.
3. Iconen staan altijd samen met tekst. Tikvlakken zijn minstens 56px.
4. Eén soort kaart: wit vlak, dunne rand, geen schaduw, foto links of bovenaan.
5. Geen kleine grijze tekst onder 15px en geen technische gegevens.
6. Lege, ladende en foutschermen zien er overal hetzelfde uit: een zin, wat je nu kunt doen, en één knop.

## Schermen, in deze volgorde

**Fase 1: basis en navigatie**
- Nieuwe kleuren en letters, één knopstijl, één kaartstijl, één stijl voor invulvelden en lijsten.
- Onderaan vijf tabs met tekst: Start, Recepten, Weekmenu, Boodschappen, Meer.

**Fase 2: Weekmenu (eerst, want dit is het grootste probleem)**
- Het scherm opent altijd op vandaag. Bovenaan een weekstrook Ma–Zo van de volledige week, met vandaag in honinggeel.
- Daaronder de grote dag: "Zondag 27 september", met Ontbijt, Lunch en Avond als grote blokken (foto en naam, of "Gerecht toevoegen").
- Hoofdknop: "Boodschappen voor deze week".
- Tweede knoppen: "Gerecht toevoegen" en "Laat Foodlo kiezen". De lijstkeuze en instellingen verhuizen naar één knop "Opties".
- Voorbije dagen blijven bereikbaar via de strook, maar staan niet meer in de weg.

**Fase 3: Start**
- "Goedenavond, Sam", daarna "Vandaag op het menu" met de maaltijden van vandaag.
- Daaronder "Boodschappen" (met hoeveel er nog te kopen is) en "Weekmenu bekijken". Meer niet.

**Fase 4: Recepten en Ideeën**
- Eén scherm Recepten met een grote zoekbalk en twee duidelijke tabs: "Mijn recepten" en "Ideeën".
- Grote receptkaarten, één per rij.
- Een idee opent met foto, titel, soort en tijd, ingrediënten en bereiding. Onderaan blijft altijd een knop "Toevoegen aan mijn recepten" staan.

**Fase 5: Recept toevoegen en receptdetail**
- "Wat wil je doen?" met vijf grote keuzes, elk met icoon, titel en één regel uitleg: zelf maken, van website, van sociale media, foto of scan, ideeën bekijken.
- Receptpagina: foto, naam, soort en tijd, ingrediënten, bereiding. Voedingswaarden zitten achter "Toon voedingswaarden". Onderaan staat een vaste knop "Start koken".

**Fase 6: Boodschappen en kookstand**
- Boodschappen: gewone lijst per afdeling met grote vinkvakken (minstens 56px). Bovenaan "+ Toevoegen". Winkelideeën, Vaak gekocht en In je kar blijven, maar staan rustiger.
- Kookstand: nog grotere tekst, één stap per scherm, vaste knoppen Vorige en Volgende.

**Fase 7: Meer, klantenkaarten, gezin en vrienden, instellingen, welkomstappen**
- Meer: één lijst met grote rijen en een korte uitleg per rij.
- Alle overige schermen, vensters en lege schermen krijgen dezelfde opbouw.

## Controle na elke fase
- Elk scherm op telefoon en computer nalopen met screenshots, in licht en donker.
- De 3-secondentest per scherm: waar ben ik, wat kan ik hier doen, wat is de hoofdknop?
- De hoofdtaken doorklikken: recept vinden, recept toevoegen, gerecht plannen, boodschappen afvinken, koken.
- Foutmeldingen nakijken en de veiligheidscontrole opnieuw draaien.

## Technische details
- Design tokens in `src/styles.css` (licht als standaard in `:root`), Outfit en Figtree via `<link>` in `__root.tsx`.
- Gedeelde onderdelen: `PageHeader`, `PrimaryAction`, `ItemCard`, `EmptyState` en `Section`, gebruikt in alle routes in plaats van losse stijlen.
- `planner.tsx`: een dagweergave met `geselecteerdeDag` (standaard vandaag) en een weekstrook. De huidige filter `getoondeDagen` wordt vervangen. Alle bestaande queries en mutaties blijven.
- Recepten en Ideeën als tabs binnen `/gerechten`. De route `/inspiratie` blijft werken.
- Geen databasewijzigingen, geen nieuwe AI-oproepen, geen nepgegevens.
