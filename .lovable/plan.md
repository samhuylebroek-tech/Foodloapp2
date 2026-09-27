# Weekmenu → boodschappen: slimme verzameling en herkenning

Uit beide brieven (27 sep). Kernregel: **de gebruiker begrijpt altijd vóóraf wat Foodlo gaat toevoegen, en beslist zelf over alles wat al op de lijst staat.** Nooit stilletjes verdubbelen.

## Wat er al is (blijft behouden)
- Weekmenu opent op vandaag; "Vandaag" is duidelijk zichtbaar.
- Bij dubbele items verschijnt al één rustig overzicht met per ingrediënt de keuze "Nog eens toevoegen" / "Niet toevoegen".
- Alle bestaande functies: lijsten, categorieën, optellen, voorraad, winkelmodus, delen, undo, offline, geschiedenis, suggesties, recepten, import, meldingen, credits.

## Wat er nog komt

### 1. Vandaag wordt een actiepagina
- Duidelijke blok bovenaan: **"Vandaag — zondag 27 september"** met alle maaltijden van vandaag.
- Samenvatting in mensentaal: **"3 gerechten vandaag · 8 ingrediënten nodig"**.
- Grote knop **"Boodschappen voor vandaag"** — verzamelt in één keer alle ingrediënten van alle gerechten van vandaag, zonder elk gerecht te openen. Op mobiel eventueel plakkend onderaan.
- **"Boodschappen voor deze week"** blijft bestaan voor de hele week.
- Lege dag: "Nog niets gepland" met knop om een gerecht toe te voegen.
- Knop **"Vandaag"** brengt altijd terug naar de huidige dag.

### 2. Eén overzicht vóór het toevoegen (bottom sheet op mobiel)
Na "Boodschappen voor vandaag" één rustig overzicht, nooit een popup per ingrediënt:

```text
BOODSCHAPPEN VOOR VANDAAG
Je hebt 7 ingrediënten nodig. 2 staan al op je lijst.

AL OP JE LIJST
✓ Melk — 1 l
✓ Tomaten — 3 stuks

NIEUW
☐ Bloem — 500 g
☐ Eieren — 2 stuks
☐ Look — 1 bussel + 2 teentjes

[ Alleen nieuwe toevoegen ]   [ Alles toevoegen ]
```

- Per item uitvinken mogelijk; per bestaand item de keuze "Nog eens toevoegen" / "Niet toevoegen".
- Bij bestaande items zichtbaar: hoeveel er al op de lijst staat en waarvoor het nieuwe nodig is ("1 op je lijst + 2 voor Soep").
- Gerechten zonder recept ("Restjes", "Bij oma") blijven gewoon in het weekmenu; ze worden netjes vermeld ("Lasagne heeft nog geen recept") en blokkeren de rest niet. Nooit verzonnen ingrediënten.
- Tweede keer op "Boodschappen voor vandaag" tikken: "De boodschappen van vandaag staan al op je lijst." met [ Bekijk lijst ] / [ Opnieuw toevoegen ] — nooit stilletjes dupliceren.

### 3. Slimme herkenning van hetzelfde product
Uitbreiding van de bestaande herkenning (`src/lib/boodschappen.ts`, `src/lib/ingredienten.ts`) — géén tweede systeem, wél één centrale engine die overal hetzelfde werkt (recept, weekmenu, handmatig, voorraad, gedeelde lijst):
- **Synoniemen en meervouden**: look = knoflook = garlic, ajuin = ui, tomaat = tomaten, ei = eieren — ook niet-eten (toiletpapier = toilet papier). Meertalig (NL/FR/DE/EN), data-gedreven.
- **Veilig samenvoegen**: 500 g + 1 kg bloem → 1,5 kg; 1 l + 500 ml melk → 1,5 l; 1 ui + 2 uien → 3 stuks.
- **Niet blind omrekenen**: 1 bussel look + 2 teentjes look → één item "Look — 1 bussel + 2 teentjes", nooit een verzonnen gramwaarde.
- **Varianten blijven apart**: melk ≠ amandelmelk, tomaat ≠ kerstomaat, aardappel ≠ zoete aardappel, ui ≠ rode ui. Bij twijfel: apart houden — liever twee regels dan een foute samenvoeging.
- **Geen AI** voor gewone herkenning; deterministische regels eerst (bespaart credits, betrouwbaarder).

### 4. De gebruiker blijft baas
- Foute samenvoeging terugdraaien: "Apart houden".
- Handmatig toevoegen: "Je hebt al look op je lijst" met keuze samenvoegen of apart houden.
- Foodlo mag nooit zonder duidelijke actie een hoeveelheid verdubbelen of overschrijven.

### 5. Herkomst zichtbaar
- Tik op een boodschap → "Nodig voor: Lasagne, Soep" en sinds wanneer het op de lijst staat. Rustig in het detailscherm, niet in de hoofdlijst.

### 6. Beheer en monitoring
- Nieuwe tabellen voor canonieke producten en synoniemen, beheerbaar vanuit het Control Center zonder codewijziging (met startlijst NL/FR/DE/EN).
- Tellers in het Control Center: hoe vaak samengevoegd, apart gehouden, gecorrigeerd; welke producten vaak onduidelijk zijn.

## Technische aanpak
- Eén centrale normalisatie-engine in `src/lib/boodschappen.ts` (uitgebreid met canonieke sleutel + synoniemenlaag uit de database, met lokale basislijst als startpunt); alle toevoeg-punten gaan door dezelfde functie.
- Nieuwe tabellen `canonical_items` en `item_synonyms` (+ grants/RLS), beheerd via Control Center.
- `planner.tsx`: vandaag-blok, samenvatting, dagknop en review-sheet; `boodschappen.tsx`: merge-hint bij handmatig toevoegen en itemdetail met herkomst.
- Gebeurtenissen meten via de bestaande analytics (review getoond, dubbel toegevoegd/overgeslagen, samengevoegd/apart gehouden, correcties).
- Geen bestaande functionaliteit verwijderd; geen tweede systeem.

## Controle
- De eindflow uit de brief stap voor stap: openen → vandaag staat klaar → "Boodschappen voor vandaag" → review → toevoegen → winkelen. Plus randgevallen: geen maaltijd, maaltijd zonder recept, look/knoflook-varianten, botsende eenheden, melk/amandelmelk, twee keer dezelfde actie, gedeelde lijst, offline.
- Testen op telefoon (390×844) en desktop (1280×1800); bouw en typecontrole groen.
- Niet publiceren zonder jouw aparte keuze.
