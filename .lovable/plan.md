# Weekmenu laten voorstellen + foto's in het weekmenu

## 1. Foto bij een ingepland gerecht

In het weekmenu staat nu alleen de naam van het gerecht. Elke regel krijgt links een kleine ronde foto van het recept (dezelfde foto als op de receptpagina). Heeft een recept nog geen foto, dan komt er een rustig vervangbeeld met een pot-icoon. Zelf getypte maaltijden (zonder recept) houden hun huidige weergave.

Ook in de kaartenweergave (naast elkaar, swipen) staat de foto mee.

## 2. "Laat Foodlo een weekmenu voorstellen"

Boven in het weekmenu komt een tweede knop: **Weekmenu laten voorstellen**. Die opent één rustig scherm met drie vragen:

1. **Voor welke dagen?** — de dagen van de getoonde week, standaard alle dagen die je zichtbaar hebt gezet.
2. **Welke momenten?** — bv. alleen avondeten, standaard je ingestelde dagdelen.
3. **Waaruit mag Foodlo kiezen?**
   - Alleen mijn eigen recepten (gratis, geen credits)
   - Ook nieuwe ideeën van buiten mijn recepten (kost credits, wordt getoond)

Daarna zie je het voorstel: per dag één gerecht met foto en naam. Je kan per dag **wisselen** (ander voorstel) of een dag **overslaan**, en daarna op **Zet in mijn weekmenu** duwen. Dagen waar al iets ingepland staat worden niet overschreven; die worden getoond als "al ingepland".

## 3. Instellingen: waar houdt Foodlo rekening mee

Achter het tandwiel van het weekmenu komt een extra blok **Wat wil je eten in een week?**:

- Hoeveel keer **vlees**, **vis**, **vegetarisch** per week (0–7 per soort)
- **Hoeveel tijd** mag koken doorsnee duren (bv. max 30 / 45 / 60 min, of maakt niet uit)
- **Wat je liever niet eet** (vrij tekstveld, bv. "geen champignons, geen pikant")
- **Standaardbron**: alleen eigen recepten of ook nieuwe ideeën

Deze keuzes worden bewaard bij je account en worden automatisch meegenomen zodra je een voorstel vraagt.

## 4. Per dag anders (slim en snel)

De instellingen hierboven zijn je standaard. In het voorstelscherm staat bij elke dag een klein lijntje zoals "max 30 min · vlees" waar je op tikt om die dag apart te regelen:

- **Hoeveel tijd heb je die dag?** — snelle keuzes: "snel (max 20 min)", "gewoon (max 45 min)", "rustig koken", of "maakt niet uit"
- **Wat wil je die dag?** — vlees, vis, vegetarisch of laat Foodlo kiezen
- **Overslaan** — bv. je eet die dag niet thuis

Inventief: het aanpassen werkt voor één dag én voor een reeks. Hou je op een dag langer vast (of kies je "ook voor..."), dan kan je dezelfde keuze in één tik op meerdere dagen zetten — handig voor "doordeweeks snel, weekend rustig". Foodlo onthoudt bovendien per weekdag wat je meestal kiest (bv. altijd snel op woensdag) en vult die dag de volgende keer alvast zo in; dat staat erbij als "zoals je meestal doet" en je kan het met één tik terugzetten naar je standaard.

Wat je per dag instelt, telt meteen mee in het voorstel: wijzig je een dag, dan wordt alleen die dag opnieuw voorgesteld, de rest blijft staan. De weekdoelen (bv. 2x vis) worden herberekend over de dagen die nog vrij zijn.

## Technisch

- **Opslag**: uitbreiding van de bestaande `profiles.weekmenu` jsonb en `WeekmenuInstelling` in `src/lib/voorkeuren.tsx` met `vlees`, `vis`, `vega`, `maxMinuten`, `vermijd`, `bron`. Geen nieuwe tabel, geen migratie nodig.
- **Eigen recepten (gratis)**: nieuwe helper `src/lib/weekmenu-voorstel.ts` kiest deterministisch uit de eigen + gezinsrecepten op basis van `category` (`src/lib/soort.ts`), tags, kooktijd, vermijd-woorden en variatie (niet twee keer hetzelfde binnen de week, recent geplande gerechten krijgen lagere score). Geen AI, geen credits.
- **Ook extern**: als de gebruiker dat kiest of er te weinig eigen recepten passen, vult een nieuwe serverfunctie `weekmenuVoorstel` in `src/lib/ai.functions.ts` de rest aan. Ze draait via de bestaande `metCredits`-wrapper (nieuwe feature-sleutel `weekmenu`, met cache op week + voorkeuren) en het standaardmodel `openai/gpt-6-astra`. Kiest de gebruiker zo'n voorstel, dan loopt het via de bestaande importweg (`receptVanNaam`) zodat er een echt recept bij komt.
- **Wegschrijven**: één `insert` in `meal_plan` per gekozen dag/moment, exact zoals de bestaande handmatige planning, met undo-toast. Geen tweede planningssysteem.
- **UI**: `src/routes/planner.tsx` (fotorij, knop, voorstelscherm) en de bestaande `WeekmenuInstellingen`-dialoog in hetzelfde bestand.
- Credits-kost van de externe variant wordt vooraf in het scherm getoond; de eigen-recepten-variant vermeldt duidelijk "gratis".
