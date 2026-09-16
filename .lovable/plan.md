# Inplannen vanuit het weekmenu opnieuw ontworpen

Vandaag krijg je, zodra je op een dag tikt, één lange kale lijst met alle gerechten op alfabetische/recente volgorde — zonder foto's, zonder hulp bij het kiezen, en met de dag- en momentkeuze bovenaan door elkaar. Dat wordt één rustig kiesscherm dat je helpt kiezen in plaats van je een lijst voor te schotelen.

## Hoe het wordt

**1. Je tikt op een dag (of op "ontbijt/lunch/avondeten")**
Bovenaan het kiesscherm staat rustig en groot waar je mee bezig bent: "Woensdag 17 september · avondeten". Geen datumvelden meer op dit moment — die keuze heb je net gemaakt. Wil je toch wisselen, dan tik je op die regel en klapt de dag- en momentkeuze open.

**2. Je kiest een gerecht met hulp**
In plaats van één lange lijst zie je korte, duidelijke groepen, elk met een paar grote kaarten (foto, naam, bereidingstijd):
- **Voorgesteld voor deze dag** — wat je lang niet meer gemaakt hebt, en niet al deze week gepland staat
- **Favorieten**
- **Recent gemaakt**
- **Al je recepten** — alfabetisch, pas onderaan

Zoekbalk bovenaan; zodra je typt verdwijnen de groepen en zie je enkel de treffers.

**3. Bevestigen**
Tik je op een kaart, dan wordt het gerecht meteen ingepland voor die dag en dat moment (je hebt dat immers al gekozen) met een korte bevestiging en "Ongedaan maken". Daarna nog altijd de vraag of de ingrediënten op je boodschappenlijst mogen.

**4. Staat het er niet bij**
Onderaan blijft wat je nu hebt: "… enkel als tekst inplannen" en "Met AI invullen". Die verschijnen alleen als je iets typt dat niet bestaat.

## Wat blijft

De grote knop "Gerecht inplannen deze week" blijft, maar daar kies je eerst de dag (die stap heeft wél een dagkeuze nodig) en volgt daarna hetzelfde kiesscherm. Gezinsweekmenu, boodschappenintegratie, AI-recept, credits en alle data blijven ongewijzigd.

## Technisch

- Alles binnen `src/routes/planner.tsx`; `ReceptKiezer` wordt herschreven naar drie duidelijke states: `dagkeuze` (alleen bij de algemene knop), `gerechtkeuze`, en direct inplannen. De aparte "Wanneer eten we dit?"-stap verdwijnt wanneer de dag al bekend is.
- Groepen worden client-side afgeleid uit de bestaande `recipes`-query plus `favorites` en de bestaande `meal_plan`-data van de planner (laatst gepland = "recent"), geen nieuwe queries of tabellen, geen AI-credits.
- Kaarten hergebruiken `image_url` met fallback-initiaal; minimaal 56px raakvlak, `aria-pressed`/labels behouden.
- Bevestigingstoast met undo via de bestaande `verwijder`-actie; `LijstVraag` blijft ongewijzigd aangeroepen.
- Geen databasewijzigingen. Getest op 390px met de testbrowser.
