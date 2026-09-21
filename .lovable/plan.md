# Kookmodus: geen ingrediënt meer missen, en altijd terug kunnen

## 1. Ontbrekende ingrediënten bij een stap

Nu wordt een ingrediënt soms niet getoond bij een stap waarin het wél in de tekst staat. Dat komt door drie regels in de huidige herkenning:

- alleen woorden van minstens 4 letters tellen mee (dus "ei", "ui", "rijst" met andere schrijfwijze vallen weg);
- er worden maximaal 4 ingrediënten per stap getoond, de rest verdwijnt;
- een ingrediënt mag maar bij één stap staan, dus als het later opnieuw genoemd wordt, zie je het daar niet.

Wat er verandert:

- Een ingrediënt dat letterlijk in de staptekst genoemd wordt, wordt **altijd** getoond — geen maximum, geen minimumlengte meer.
- Wordt hetzelfde ingrediënt in meerdere stappen genoemd, dan verschijnt het bij elke stap die het noemt. Bij de tweede en volgende keer staat er "(rest)" bij, zodat je niet twee keer de volle hoeveelheid gebruikt.
- Ook meerwoordige namen ("gemalen zwarte peper", "olijfolie extra vierge") worden herkend als de tekst het kernwoord noemt, en samengestelde woorden in de tekst ("uienringen", "tomatensaus" bij ingrediënt "tomaat") tellen mee.
- Onderaan elke stap in de kookmodus komt een discrete regel "Alle ingrediënten bekijken" die de volledige lijst opent, zodat je nooit vastzit als de herkenning iets mist.
- Zelf een ingrediënt aan een stap koppelen (bij "Recept aanpassen") blijft werken en gaat altijd voor.

## 2. Terug kunnen vanaf het laatste scherm

Het scherm "Smakelijk gegeten? / hoeveel sterren" heeft nu enkel "Later". Daar komt een knop **"Terug naar de stappen"** bij, die je terugzet op de laatste stap; vanaf daar werkt "Vorige" gewoon weer. De scoreknoppen en "Later" blijven zoals ze zijn.

## Technisch

- `src/lib/stap-ingredienten.ts`: `komtVoor` wordt een score-vrije match op stam met substring-treffer in samengestelde woorden; minimumlengte-gate en `MAX_PER_STAP` vervallen voor echte woordtreffers. `koppelStappen` geeft per stap alle treffers terug plus een vlag `herhaling` voor stappen na de eerste vermelding; handmatige koppelingen blijven voorrang houden.
- `src/components/StapIngredienten.tsx`: toont het label "(rest)" bij een herhaling; verder ongewijzigde styling.
- `src/routes/recepten.$id.tsx`: in de kookstand een uitklap met de volledige ingrediëntenlijst onder de stapchips; in het `klaarVragen`-scherm een extra knop die `setKlaarVragen(false)` doet en `stap` op de laatste index zet (kookstand blijft open).
- Geen database- of schemawijziging.
