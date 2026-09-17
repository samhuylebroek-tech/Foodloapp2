# Kortere start, slimmere popups en gerecht zoeken

Vier aanpassingen. Geen nieuwe systemen: de bestaande welkomstflow, installatiehulp, meldingen en het receptformulier worden aangepast.

## 1. Aanmelden wordt één kort scherm

Vandaag zijn het zes stappen (taal, kleuren, momenten, uitleg, telefoon, meldingen).

Nieuw: één scherm met taal, kleuren en momenten onder elkaar, een grote knop "Klaar" en rechtsboven een X om meteen over te slaan. Zowel X als "Klaar" bewaren je keuzes en markeren de start als afgerond, zodat je hem niet opnieuw krijgt. De uitleg over de app en over meldingen verdwijnt hier (de rondleiding blijft gewoon bestaan via instellingen).

## 2. Popup "Zet Foodlo op je telefoon"

Verschijnt op het startscherm, alleen als de app nog niet op het beginscherm staat, telkens opnieuw bij het aanmelden tot je zelf kiest om te stoppen.

- Herkent je toestel en toont de juiste stappen: iPhone (Safari: Delen → Zet op beginscherm; Chrome op iPhone: eerst de drie puntjes rechtsonder → Delen → Zet op beginscherm), Android (installeerknop of menu met drie puntjes → App installeren), computer.
- Knoppen: "Installeren" wanneer de telefoon dat toelaat, "Toon mij hoe" (naar de bestaande uitlegpagina), "Later" en "Ik heb dit gedaan / niet meer tonen".
- Sluiten met X of "Later" betekent: volgende keer opnieuw. Alleen "niet meer tonen" (of de app die echt geïnstalleerd is) zet hem definitief uit.

## 3. Popup over meldingen, om de 10 aanmeldingen

- Wordt geteld per aanmelding; bij de 10e, 20e, ... verschijnt een korte vraag: "Wil je een seintje krijgen?" met twee duidelijke keuzes: "Ja, zet aan" en "Nee, houd ze uit".
- Zodra je één keer kiest (aan of uit), komt hij nooit meer terug.
- Onderaan staat ook "Toon me dit niet meer".
- Gebruikt de bestaande meldingenlogica; er komt geen tweede meldingensysteem.

De twee popups botsen niet: de installatiepopup krijgt voorrang, de meldingenvraag komt dan de volgende keer.

## 4. Een gerecht zoeken bij "Recept toevoegen"

Nieuwe manier "Zoeken" naast AI link / AI tekst / AI foto / Zelf typen.

Je typt bijvoorbeeld "Balletjes in tomatensaus" en krijgt een keuzelijst in twee groepjes:

1. **Al in je app** — jouw recepten en die van je gezin met dezelfde naam. Kiezen opent dat recept meteen; kost niets.
2. **Nieuwe ideeën** — enkele varianten (naam + korte beschrijving + bereidingstijd). Kies je er één, dan wordt het volledige recept uitgeschreven en in het formulier gezet, dat je daarna nakijkt en bewaart.

De nieuwe ideeën kosten een klein beetje credits, net als de andere AI-manieren; dat staat er duidelijk bij. Als je niets typt of er niets past, verandert er niets aan de bestaande manieren.

## Technisch

- `src/routes/welkom.tsx`: stappen vervangen door één sectie; `klaar()` blijft `profiles.onboarding_klaar` zetten; X roept dezelfde `klaar()` aan en gaat naar `/`.
- `src/components/InstallatieTip.tsx`: omgebouwd tot een dialoog met platformdetectie (iOS Safari / iOS Chrome / Android / desktop); sleutel `installatie-tip-weg` blijft, maar wordt alleen gezet bij "niet meer tonen".
- Nieuw `src/components/MeldingVraag.tsx`: leest een aanmeldteller in localStorage (opgehoogd bij nieuwe sessie in `src/lib/meten.ts` of `AppShell`), toont om de 10 keer; keuze via bestaande `zetMeldingenAan()` / `zetMeldingenUit()` uit `src/lib/meldingen.ts`; keuze bewaard in localStorage én afleidbaar uit de bestaande `notification_preferences`.
- Beide popups gerenderd via de bestaande plek in `AppShell.tsx`, met voorrangsregel.
- Nieuwe server-functie `gerechtVoorstellen` in `src/lib/ai.functions.ts` (JSON-array met titel/beschrijving/minuten) via `metCredits` met caching op de zoekterm, plus hergebruik van de bestaande tekst-naar-recept-stap voor het uitschrijven. Eigen/gezinsrecepten via een gewone `ilike`-zoekopdracht — zonder credits.
- Nieuwe manier `zoek` in `src/components/RecipeForm.tsx`, zelfde patroon als de bestaande manieren.
- Geen databasewijzigingen.
