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

## Technisch

- **Opslag**: uitbreiding van de bestaande `profiles.weekmenu` jsonb en `WeekmenuInstelling` in `src/lib/voorkeuren.tsx` met `vlees`, `vis`, `vega`, `maxMinuten`, `vermijd`, `bron`. Geen nieuwe tabel, geen migratie nodig.
- **Eigen recepten (gratis)**: nieuwe helper `src/lib/weekmenu-voorstel.ts` kiest deterministisch uit de eigen + gezinsrecepten op basis van `category` (`src/lib/soort.ts`), tags, kooktijd, vermijd-woorden en variatie (niet twee keer hetzelfde binnen de week, recent geplande gerechten krijgen lagere score). Geen AI, geen credits.
- **Ook extern**: als de gebruiker dat kiest of er te weinig eigen recepten passen, vult een nieuwe serverfunctie `weekmenuVoorstel` in `src/lib/ai.functions.ts` de rest aan. Ze draait via de bestaande `metCredits`-wrapper (nieuwe feature-sleutel `weekmenu`, met cache op week + voorkeuren) en het standaardmodel `openai/gpt-6-astra`. Kiest de gebruiker zo'n voorstel, dan loopt het via de bestaande importweg (`receptVanNaam`) zodat er een echt recept bij komt.
- **Wegschrijven**: één `insert` in `meal_plan` per gekozen dag/moment, exact zoals de bestaande handmatige planning, met undo-toast. Geen tweede planningssysteem.
- **UI**: `src/routes/planner.tsx` (fotorij, knop, voorstelscherm) en de bestaande `WeekmenuInstellingen`-dialoog in hetzelfde bestand.
- Credits-kost van de externe variant wordt vooraf in het scherm getoond; de eigen-recepten-variant vermeldt duidelijk "gratis".
