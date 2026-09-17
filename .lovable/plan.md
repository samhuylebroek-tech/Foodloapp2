# Zoeken: alleen echte recepten, met venster om na te kijken

Twee klachten: bij "pannenkoeken libelle" waren 2 van de 3 resultaten geen recept, en het venster om het recept na te kijken kwam niet.

## Wat er verandert

**1. Alleen echte recepten in de lijst**

Elk gevonden resultaat wordt eerst gecontroleerd voor het in de lijst komt: de pagina wordt opgehaald en enkel getoond als er echt receptgegevens op staan (naam, ingrediënten, bereiding). Categorie-pagina's, overzichten en homepages verdwijnen dus.

De titel komt voortaan uit de pagina zelf, niet uit de zoekresultatentekst. Dus "Pannenkoeken" van libelle-lekker.be heet ook zo, volledig en juist, met het aantal ingrediënten en de bereidingstijd eronder.

**2. Geen resultaten? Dan meteen het AI-voorstel**

Vindt de controle geen enkel echt recept, dan zie je één duidelijk blok: "We vonden geen betrouwbaar recept voor 'pannenkoeken libelle'." met een grote knop "Laat de AI dit recept uitschrijven". Dat is de bestaande AI-tekstmanier, met dezelfde credits als vandaag.

**3. Het venster verschijnt altijd**

Tik je een gevonden recept aan, dan opent het venster onmiddellijk — eerst met "Recept wordt opgehaald…", daarna gevuld met naam, ingrediënten en bereiding die je kan aanpassen. Lukt het ophalen toch niet, dan blijft het venster open met de uitleg en de knop om het met AI te laten uitschrijven; je kan altijd rechtsboven op X duwen.

## Technisch

- `zoekReceptenOpWeb` in `src/lib/ai.functions.ts`:
  - Na de huidige ranking worden de top ~8 kandidaten (parallel, met korte fetch) geverifieerd via een nieuwe helper `leesReceptKop(url)` in `src/lib/import.server.ts`: haalt de pagina op, leest JSON-LD (`@type: Recipe`, ook binnen `@graph`) of microdata; zonder naam + ingrediënten (≥2) wordt het resultaat weggegooid.
  - `WebResultaat` krijgt `titel` uit JSON-LD `name`, plus optionele `aantalIngredienten` en `minuten` (uit `totalTime`) voor het fragment. Geen afkapping meer op 140 tekens in de UI.
  - Max 5 geverifieerde resultaten; cache-sleutel blijft `web|<term>` (24 u), nog steeds zonder credits. De opgehaalde HTML van de winnende pagina hoeft niet bewaard te worden; de import doet dat straks opnieuw.
- `src/components/RecipeForm.tsx`:
  - `kiesWeb` zet eerst `setVoorbeeldBezig(true)` en opent de dialog vóór `importRecipeFromUrl`; bij fout blijft de dialog open met foutmelding + knop naar `receptVanNaam` (AI-tekst) i.p.v. enkel een toast.
  - Leeg zoekresultaat rendert een blok met uitleg en dezelfde AI-knop (hergebruik `handleIdeeen`/`receptVanNaam`), niet enkel een toast.
- Geen databasewijzigingen, geen tweede import- of zoeksysteem.
