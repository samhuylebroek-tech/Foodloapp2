# Weekmenu → boodschappen + Inspiratiebibliotheek

Uit drie brieven (27 sep). Kernregel: **de gebruiker begrijpt altijd vóóraf wat Foodlo gaat doen, en beslist zelf over alles wat al bestaat.** Nooit stilletjes verdubbelen, geen onnodige AI-kosten.

## Deel A — Weekmenu → boodschappen

### Wat er al is (blijft behouden)
- Weekmenu opent op vandaag; "Vandaag" is duidelijk zichtbaar.
- Bij dubbele items verschijnt al één rustig overzicht met per ingrediënt de keuze "Nog eens toevoegen" / "Niet toevoegen".
- Alle bestaande functies blijven werken (lijsten, categorieën, voorraad, winkelmodus, delen, undo, offline, recepten, import, meldingen, credits).

### A1. Vandaag wordt een actiepagina
- Duidelijke blok bovenaan: **"Vandaag — zondag 27 september"** met alle maaltijden van vandaag.
- Samenvatting in mensentaal: **"3 gerechten vandaag · 8 ingrediënten nodig"**.
- Grote knop **"Boodschappen voor vandaag"** — verzamelt in één keer alle ingrediënten van alle gerechten van vandaag. Op mobiel plakkend onderaan.
- **"Boodschappen voor deze week"** blijft bestaan.
- Lege dag: "Nog niets gepland" met knop om een gerecht toe te voegen; knop **"Vandaag"** brengt altijd terug.

### A2. Eén overzicht vóór het toevoegen (bottom sheet op mobiel)
Nooit een popup per ingrediënt, wel één rustig overzicht:

```text
BOODSCHAPPEN VOOR VANDAAG
Je hebt 7 ingrediënten nodig. 2 staan al op je lijst.

AL OP JE LIJST
✓ Melk — 1 l
✓ Tomaten — 3 stuks

NIEUW
☐ Bloem — 500 g
☐ Look — 1 bussel + 2 teentjes

[ Alleen nieuwe toevoegen ]   [ Alles toevoegen ]
```

- Per item uitvinken; per bestaand item "Nog eens toevoegen" / "Niet toevoegen".
- Bij bestaande items zichtbaar: hoeveel er al staat en waarvoor het nieuwe nodig is ("1 op je lijst + 2 voor Soep").
- Gerechten zonder recept ("Restjes", "Bij oma") blijven geldig; ze worden netjes vermeld en blokkeren de rest niet. Nooit verzonnen ingrediënten.
- Tweede keer tikken: "De boodschappen van vandaag staan al op je lijst." met [ Bekijk lijst ] / [ Opnieuw toevoegen ] — nooit stilletjes dupliceren.

### A3. Slimme herkenning van hetzelfde product
Uitbreiding van de bestaande herkenning (`src/lib/boodschappen.ts`, `src/lib/ingredienten.ts`) — géén tweede systeem, één centrale engine voor recept, weekmenu, handmatig, voorraad en gedeelde lijsten:
- **Synoniemen en meervouden**: look = knoflook = garlic, ajuin = ui, tomaat = tomaten — ook niet-eten (toiletpapier = toilet papier). Meertalig (NL/FR/DE/EN), data-gedreven.
- **Veilig samenvoegen**: 500 g + 1 kg bloem → 1,5 kg; 1 ui + 2 uien → 3 stuks.
- **Niet blind omrekenen**: 1 bussel look + 2 teentjes → één item "Look — 1 bussel + 2 teentjes".
- **Varianten blijven apart**: melk ≠ amandelmelk, tomaat ≠ kerstomaat, ui ≠ rode ui. Bij twijfel: apart houden.
- **Geen AI** voor gewone herkenning; deterministische regels eerst.

### A4. De gebruiker blijft baas
- Foute samenvoeging terugdraaien: "Apart houden".
- Handmatig toevoegen: "Je hebt al look op je lijst" met keuze samenvoegen of apart houden.
- Nooit zonder duidelijke actie een hoeveelheid verdubbelen of overschrijven.

### A5. Herkomst zichtbaar
- Tik op een boodschap → "Nodig voor: Lasagne, Soep" en sinds wanneer het erop staat. Rustig in het detailscherm.

### A6. Beheer en monitoring
- Nieuwe tabellen `canonical_items` en `item_synonyms` (+ grants/RLS), beheerbaar via het Control Center, met startlijst NL/FR/DE/EN.
- Tellers: samengevoegd, apart gehouden, gecorrigeerd; welke producten vaak onduidelijk zijn.

## Deel B — Inspiratiebibliotheek bij "Recept toevoegen"

### B1. Plaatsing
- Nieuw onderdeel **Inspiratie** binnen Recepten → + Recept toevoegen, naast Zelf maken / Importeren. Geen losse pagina, geen tweede receptenlijst.

### B2. Wat je ziet
- Opent meteen met recepten — geen filterformulier eerst. Zoekbalk ("Waar heb je zin in?"), snelle filters (Hoofdgerecht, Pasta, Vegetarisch, ≤30 min) en rustige receptkaarten met foto, soort, tijd.
- Slimme secties uit echte data (Snel klaar, Vegetarisch, …) en een knop **"Verras mij"** die één passend recept toont binnen de actieve filters.
- Filters in een bottom sheet, combineerbaar, met "Filters wissen" en "Toon 24 recepten". Lege resultaten: vriendelijke melding met wisknop.

### B3. Recept openen en toevoegen
- Detail toont foto, beschrijving, tijd, porties, ingrediënten, bereiding (uitklapbaar), voedingswaarden indien beschikbaar.
- Grote hoofdknop **[ + Toevoegen aan mijn recepten ]** (plakkend onderaan op mobiel). Daarna: "Toegevoegd" met [ Open recept ] / [ Aan weekmenu toevoegen ] / [ Verder bekijken ].
- Staat het recept al bij je? Dan "Dit recept staat al in je recepten" met [ Open mijn recept ] — nooit stilletjes een dubbel.
- Een toegevoegd inspiratie-recept is daarna een volledig normaal recept: favorieten, weekmenu, boodschappen, kookmodus, delen, offline — alles werkt.

### B4. Techniek
- Inspiratie gebruikt de recepten die Foodlo al kent (geïmporteerde/bestaande receptdata), anoniem getoond — geen gebruikersnamen of broninfo.
- **Geen AI-kosten**: openen, zoeken, filteren en toevoegen gebruiken bestaande gestructureerde data; geen heranalyse of opnieuw scrapen.
- Centrale ontdubbeling: hetzelfde recept dat meerdere gebruikers importeerden verschijnt één keer (via genormaliseerde titel + ingrediënten-vingerafdruk).
- Snel bij grote aantallen: compacte kaartdata, bladeren/lazy loading, volledige receptdata pas bij openen.
- Control Center krijgt een onderdeel Inspiratie: aantallen, mogelijke duplicaten, recepten zonder foto/categorie/tijd, veelbekeken en veel toegevoegde recepten (geen nepdata).

## Technische aanpak
- Eén centrale normalisatie-engine in `src/lib/boodschappen.ts` met canonieke sleutel + synoniemenlaag uit de database; alle toevoeg-punten gebruiken dezelfde functie.
- Nieuwe tabellen: `canonical_items`, `item_synonyms` (Deel A) en `inspiration_recipes` (centrale, ontdubbelde recepten, gevuld vanuit bestaande receptdata) — allemaal met grants/RLS en Control Center-beheer.
- `planner.tsx`: vandaag-blok, samenvatting, dagknop, review-sheet. `boodschappen.tsx`: merge-hint en itemdetail met herkomst. `recepten.nieuw.tsx`: Inspiratie-keuze; nieuwe routes voor inspiratie-lijst en -detail.
- Gebeurtenissen meten via de bestaande analytics. Geen bestaande functionaliteit verwijderd; geen tweede systemen.

## Controle
- Eindflow weekmenu → boodschappen stap voor stap, plus randgevallen: geen maaltijd, maaltijd zonder recept, look/knoflook-varianten, botsende eenheden, melk/amandelmelk, twee keer dezelfde actie, gedeelde lijst, offline.
- Inspiratie: zoeken, filters combineren, openen, toevoegen, dubbeldetectie, weekmenu-koppeling.
- Testen op telefoon (390×844) en desktop (1280×1800); bouw en typecontrole groen.
- Niet publiceren zonder jouw aparte keuze.
