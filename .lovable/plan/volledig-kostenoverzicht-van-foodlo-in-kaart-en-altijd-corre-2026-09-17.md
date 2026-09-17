# Volledig kostenoverzicht van Foodlo — in kaart en altijd correct

Doel: één scherm in het Control Center waar je op elk moment ziet wat Foodlo je werkelijk kost: vandaag, deze maand, per soort actie en per gebruiker — in euro, niet in abstracte eenheden.

## Antwoord op je vraag vooraf

Ja: **alles loopt via Lovable-credits**, uit één pot. Er zijn drie soorten verbruik:

1. **Bouwen** — jouw berichten aan mij (bouwmodus en planmodus). Dit stopt zodra je niet meer bouwt.
2. **AI in de app** — foto's genereren, recepten importeren, suggesties. Dit schaalt mee met je gebruikers.
3. **Online houden** — database, functies, dataverkeer. Bij jou nu ~0,3 credits/dag en volledig gedekt door het gratis maandtegoed van 20 credits.

Buiten credits betaal je enkel je domeinnaam (foodloapp.com, jaarlijks bij de registrar) en je Pro-abonnement zelf.

## Het probleem vandaag

De kostenberekening in het Control Center toont **€0** voor alle recente AI. De prijslijst bevat alleen oude modelnamen, terwijl de app `google/gemini-3.8-flash` en `google/gemini-3.1-flash-lite-image` gebruikt. Daardoor wordt bij elke AI-actie €0 weggeschreven en klopt elk kostencijfer in het hele Control Center niet.

Ook wordt bij foto's genereren geen beeldtelling of tokentelling bewaard bij een deel van de oproepen, waardoor die achteraf niet exact te herberekenen zijn.

## Wat ik bouw

### 1. Prijslijst kloppend maken
De modellen die de app echt gebruikt komen in de prijslijst, met de reële tarieven per miljoen tokens in/uit en per gegenereerd beeld. De prijslijst blijft bewerkbaar in het Control Center, zodat je hem kan bijstellen als tarieven wijzigen.

### 2. Historische kosten herberekenen
Alle bestaande AI-oproepen krijgen alsnog hun kost in euro toegekend op basis van de opgeslagen tokens en beelden. Waar de meting ontbreekt (oudere oproepen zonder tokentelling) wordt dat eerlijk getoond als "niet gemeten" in plaats van als €0.

### 3. Nieuw scherm "Kosten" in het Control Center
Met een periodekiezer (vandaag / gisteren / 7 / 30 dagen / eigen periode):

- **Bovenaan**: totale kost in de periode, opgesplitst in AI, hosting en bouwen; kost per actieve gebruiker; kost per dag.
- **Per actie**: een tabel met elke AI-functie (sfeerfoto, gerecht herkennen, recept uit link/tekst/foto, suggesties, ingrediënten herkennen, vertalen) met aantal keren gebruikt, gemiddelde kost per keer in euro, totale kost, en hoeveel app-credits je gebruikers ervoor betaalden. Zo zie je meteen of je creditprijs je werkelijke kost dekt.
- **Per gebruiker**: top-verbruikers met hun kost, doorklikbaar naar hun profiel.
- **Grafiek per dag** van de kost, zodat uitschieters opvallen.
- **Hosting apart**: wat de app kost om online te blijven, met hoeveel er nog binnen het gratis maandtegoed valt.

### 4. Kostensimulator op hetzelfde scherm
Je vult in: aantal gebruikers, AI-foto's per gebruiker per week, imports per week, suggesties per week. Je krijgt direct de verwachte kost per dag en per maand, plus wat je per gebruiker per maand moet vragen om break-even te draaien. De simulator rekent met je échte gemeten kosten, niet met schattingen.

### 5. Kostenrem
Een duidelijke waarschuwingsdrempel: als de kost van vandaag boven een door jou ingesteld bedrag uitkomt, zie je dat bovenaan het Control Center staan. De bestaande daglimieten per functie blijven de harde rem.

## Wat ongewijzigd blijft

Het creditsysteem voor je gebruikers, de bestaande limieten, alle bestaande Control Center-schermen, en de app zelf. Er komt geen tweede meetsysteem: alles leest uit de bestaande metingen.

## Technisch

- `model_prices` aanvullen met `google/gemini-3.8-flash` en `google/gemini-3.1-flash-lite-image` (tokentarieven + tarief per beeld); migratie, additief.
- Eenmalige herberekening van `ai_usage.kost_eur` via de bestaande `berekenKost`-logica; rijen zonder tokens/beelden krijgen `kost_eur = null` in plaats van 0, zodat "niet gemeten" onderscheiden blijft van "gratis".
- `src/lib/ai.functions.ts`: bij de beeldoproep de `beelden`-teller en tokengebruik consequent in de meter zetten, zodat nieuwe oproepen altijd exact te berekenen zijn.
- Nieuwe serverfuncties in `src/lib/monitoring.functions.ts` (kost per periode, per functie, per gebruiker, per dag; hostingdeel) — geen nieuwe tabellen.
- Nieuwe route `src/routes/beheer.kosten.tsx` met `AdminShell`, de bestaande periodekiezer en kaarten, plus menu-ingang in `AdminShell.tsx`.
- Simulator volledig client-side op de opgehaalde gemiddelde kosten per functie.
- Hostingkost: handmatig instelbare credits-per-dag in `platform_settings` (de cloudverbruikscijfers zijn niet via de app opvraagbaar), met duidelijke labeling als "ingesteld, niet gemeten".

## Buiten scope

Automatisch ophalen van je Lovable-factuur of -creditsaldo in de app, en betalingen door gebruikers.
