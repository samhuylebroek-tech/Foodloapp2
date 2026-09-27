# Winkelideeën: nieuwe naam + keuzevenster bij toevoegen

## 1. "Door de winkel" heet voortaan "Winkelideeën"
- De knop onder het invulveld en de titel van het scherm dat opent krijgen de naam **"Winkelideeën"**.
- De uitleg eronder blijft: loop de afdelingen langs en tik op wat je nodig hebt.

## 2. Keuzevenster bij het aanvinken van een product
Tik je in Winkelideeën op een product, dan verschijnt er een klein, rustig venster (in plaats van meteen toevoegen) met:

- **De productnaam** bovenaan (bv. "Bananen").
- **Hoeveelheid**: een getalveld plus een eenheid-keuze (stuks, g, kg, ml, cl, l, zak, pak, fles…, Belgische maten). Mag leeg blijven.
- **Nota**: een kort vrij veld (bv. "de biologische" of "voor oma"), max. 100 tekens. Mag leeg blijven.
- **Categorie**: automatisch ingevuld op basis van de afdeling waar je het product vond (bv. iets uit "Groenten & fruit" krijgt die categorie). Je kunt die wijzigen via een eenvoudige keuzelijst met alle bestaande categorieën. Kies je zelf een andere categorie, dan onthoudt de app dat voor dit product (zoals dat nu al werkt bij het bewerken op de lijst).
- Twee grote knoppen: **"Zet op mijn lijst"** en **"Terug"**.

Pas na "Zet op mijn lijst" komt het product op je lijst, met hoeveelheid, nota en categorie. De teller onderaan ("3 toegevoegd") telt zoals nu. De terug-pijl bovenaan de lijst kan ook deze toevoeging ongedaan maken.

## 3. Nota zichtbaar op de lijst
- De nota verschijnt in kleine, rustige tekst onder de productnaam op je lijst.
- Bij het bewerken van een boodschap (het bestaande bewerkvenster) kun je de nota ook aanpassen of weghalen.

## Behoud
Afdelingen, vaak-gekocht-sterretjes, zoeken in de winkel, vinkjes bij wat al op je lijst staat, de teller, offline werken en alles op de boodschappenpagina blijven zoals ze zijn. Er wordt geen AI gebruikt en het kost geen credits.

## Technisch
- Migratie: `ALTER TABLE shopping_items ADD COLUMN note text` (bestaande tabel, geen nieuwe grants nodig); daarna types verversen.
- `src/lib/winkel-afdelingen.ts`: elke afdeling krijgt een koppeling naar de bestaande `CategorieId` uit `src/lib/categorie.ts` (de afdelingen sluiten er al op aan; "snoep & koek" en "baby & dier" vallen onder "overige"/"non-food").
- `WinkelIdeeen.tsx`: tik opent een Dialog met naam, hoeveelheid + eenheid (bestaande maat-helper), nota (gevalideerd, max. 100 tekens) en categorie (vooraf ingevuld, wijzigbaar; bij afwijkende keuze `bewaarCorrectie`). Bevestigen roept de bestaande toevoegfunctie aan met quantity/unit/note.
- `boodschappen.tsx`: `voegMeerdereToe` en `NieuwItem` krijgen `note`; nota tonen onder de naam en bewerkbaar in het bestaande bewerkvenster; undo-stack dekt de toevoeging zoals nu.
- Controle: typecheck, build, Playwright op 390×844 en 1280×1800 (openen Winkelideeën, product tikken, venster invullen, op lijst zien, bewerken, terug-pijl). Niet publiceren zonder aparte toestemming.
