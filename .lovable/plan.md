# Alles afwerken: sneller zoeken en beter controlecentrum

De foto's in het weekmenu en het bewaren van foto's bij gevonden recepten zijn al in orde.
Wat nu nog openstaat, werk ik in één keer af.

## 1. Zoeken naar gerechten merkbaar sneller

Nu duurt het zoeken lang omdat alles netjes na elkaar gebeurt en één trage website
de hele zoekopdracht ophoudt.

- De twee zoekbronnen tegelijk bevragen in plaats van de ene na de andere.
- Een wachttijd per website (ongeveer 6 seconden): reageert een site niet, dan valt
  die weg en gaan de andere gewoon door.
- Eerst de vijf beste resultaten nakijken; enkel als er te weinig overblijven,
  worden er nog extra bekeken.
- Resultaten die al eens gezocht werden, blijven uit het geheugen komen (zoals nu).
- De eerste drie gevonden recepten worden al op de achtergrond opgehaald terwijl je
  de lijst leest, zodat doorklikken direct gaat (dit staat er al in).
- Bij "meer informatie" en "laat Foodlo schrijven" komt het antwoord voortaan
  stukje per stukje binnen in plaats van in één lange stilte, zodat je meteen ziet
  dat er iets gebeurt en lange wachtbeurten niet meer op een fout uitdraaien.

## 2. Controlecentrum: e-mail en laatste aanmelding

- In het gebruikersoverzicht komt een kolom **E-mail** en een kolom
  **Laatste aanmelding**, naast de bestaande kolommen.
- Je kan ook op e-mailadres zoeken in dat overzicht.
- Op de detailpagina van een persoon staat de laatste aanmelding duidelijk bovenaan
  bij de naam en de e-mail.

## 3. Eindcontrole

- Volledige controle van de belangrijkste flows op gsm en desktop:
  recept toevoegen en zoeken, weekmenu voorstellen en inplannen, boodschappen,
  delen met gezin, controlecentrum.
- Bouw- en veiligheidscontrole opnieuw laten lopen en de takenlijst afvinken.
- Pas daarna publiceren.

## Technische details

- `src/lib/ai.functions.ts`: in `zoekReceptenOpWeb` de bronnen via `Promise.all`
  ophalen, `AbortSignal.timeout(6000)` op elke externe fetch (zoekpagina's en
  `leesReceptKop`), keuring in twee golven (top 5, daarna aanvullen tot 5 geldige).
  `askAI` krijgt `stream: true` met SSE-verwerking; model en `reasoning_effort: "low"`
  blijven ongewijzigd (`openai/gpt-6-astra`, `google/gemini-3.8-flash`).
- `src/lib/monitoring.functions.ts`: in de gebruikerstabel per persoon `email` en
  `last_sign_in_at` meegeven via `supabaseAdmin.auth.admin.listUsers` (gepagineerd,
  binnen de handler geladen, alleen voor beheerders).
- `src/routes/beheer.gebruikers.tsx`: twee kolommen toevoegen en de zoekfilter op
  naam én e-mail laten werken; `src/routes/beheer.gebruiker.$id.tsx` toont de
  laatste aanmelding in de kop.
- Geen nieuwe tabellen, geen tweede systeem, geen gegevens verwijderen.
