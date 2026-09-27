# Weekmenu → boodschappen: slimme verzameling en herkenning

## Wat er al is (blijft behouden)
- Weekmenu opent op vandaag en "Vandaag" is duidelijk zichtbaar.
- Bij dubbele items verschijnt één rustig overzicht ("Dit staat al op je lijst") met per ingrediënt de keuze "Nog eens toevoegen" / "Niet toevoegen".
- Bestaande functies: lijsten, categorieën, optellen, voorraad, winkelmodus, delen, undo, offline, geschiedenis en suggesties.

## Wat er nog komt

### 1. Vandaag wordt een actiepagina
- Bovenaan het weekmenu een duidelijke blok **"Vandaag — zondag 27 september"** met alle maaltijden van vandaag.
- Samenvatting in mensentaal: **"3 gerechten vandaag · 8 ingrediënten nodig"**.
- Grote knop **"Boodschappen voor vandaag"** — verzamelt in één keer alle ingrediënten van alle gerechten van vandaag, zonder elk gerecht te openen.
- Naast de bestaande weekknop blijft **"Boodschappen voor deze week"** werken.
- Lege dag: "Nog niets gepland" met knop om een gerecht toe te voegen (geen leeg scherm).

### 2. Eén overzicht vóór het toevoegen
- Na "Boodschappen voor vandaag" eerst een eenvoudig overzicht, gegroepeerd per winkelschap (groenten, zuivel, …), met vinkjes om iets weg te laten.
- Gerechten zonder recept worden netjes vermeld ("Voor Lasagne is nog geen ingrediëntenlijst") — geen foutmelding, geen verzonnen ingrediënten.
- Alles wat al op de lijst staat, is herkend en gemarkeerd vóór het toevoegen.

### 3. Slimme herkenning van hetzelfde product
De bestaande herkenning (in `src/lib/boodschappen.ts` en `src/lib/ingredienten.ts`) wordt uitgebreid — géén tweede systeem:
- **Synoniemen en meervouden**: look = knoflook = garlic, ajuin = ui, tomaat = tomaten, ei = eieren — ook voor niet-eten (toiletpapier = toilet papier).
- **Meertalig** (NL/FR/DE/EN) en data-gedreven: één centrale lijst met synoniemen, geen losse regels verspreid door de app.
- **Hoeveelheden veilig samenvoegen**: 500 g + 1 kg bloem → 1,5 kg; 1 l + 500 ml melk → 1,5 l.
- **Niet blind omrekenen**: 1 bussel look + 1 teentje look → één item "Look — 1 bussel + 1 teentje" (nooit een verzonnen gramwaarde).
- **Varianten blijven apart**: melk ≠ amandelmelk, tomaat ≠ kerstomaat, aardappel ≠ zoete aardappel. Bij twijfel: apart houden — liever twee regels dan een foute samenvoeging.
- **Zelfde regels overal**: handmatig toevoegen, vanuit recept, vanuit weekmenu en voorraad gebruiken allemaal dezelfde herkenning.

### 4. De gebruiker blijft baas
- In het overzicht kan een foute samenvoeging worden teruggedraaid ("Apart houden").
- Bij handmatig toevoegen: "Je hebt al look op je lijst" met de keuze om samen te voegen of apart te houden.

### 5. Herkomst zichtbaar
- Tik op een boodschap → "Nodig voor: Pasta, Salade" en sinds wanneer het op de lijst staat. Rustig weggestopt in het detailscherm, niet in de hoofdlijst.

### 6. Beheer en monitoring
- Nieuwe tabellen voor synoniemen en herkenningsregels, beheerbaar vanuit het Control Center zonder codewijziging.
- Tellers: hoe vaak samengevoegd, apart gehouden, of door de gebruiker gecorrigeerd — zo zie je waar de herkenning fouten maakt.

## Technische aanpak
- Uitbreiding van `src/lib/boodschappen.ts` (sleutel/samenvoeging) en `src/lib/ingredienten.ts` (eenheden) met een canonieke sleutel + synoniemenlaag; alle toevoeg-punten (weekmenu, recept, handmatig, voorraad) gaan door dezelfde functie.
- Nieuwe tabellen `canonical_items`, `item_synonyms` (+ grants/RLS), beheerd via Control Center; seed met NL/FR/DE/EN-basislijst.
- `planner.tsx`: vandaag-blok, dagactie en review-scherm; `boodschappen.tsx`: merge-hint bij handmatig toevoegen en itemdetail met herkomst.
- Geen AI voor gewone herkenning (deterministisch eerst); geen bestaande functionaliteit verwijderd.

## Controle
- De eindflow uit de brief stap voor stap testen (openen → vandaag → boodschappen voor vandaag → review → toevoegen → winkelen), inclusief randgevallen: geen maaltijd, maaltijd zonder recept, synoniemen, meervouden, botsende eenheden, niet-eten, gedeelde lijst, offline.
- Testen op telefoon (390×844) en desktop (1280×1800); bouw en typecontrole groen.
- Niet publiceren zonder jouw aparte keuze.
