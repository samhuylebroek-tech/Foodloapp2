# Boodschappen herwerkt: zonder uitleg bruikbaar voor 20 en 80 jaar

Eén moderne boodschappenervaring (geen aparte seniorenstand). Alle bestaande functies blijven: meerdere lijsten, categorieën, optellen van dubbels, voorraadkast, winkelmodus, delen/gezinslijst, recept en weekmenu naar lijst, ongedaan maken, selecteren, opruimen.

## 1. Rustige startweergave
Bovenaan alleen:
- "12 dingen nog te kopen" in grote letters, met de naam van de lijst (tik = andere lijst kiezen).
- Grote hoofdknop **Ik ga boodschappen doen** (opent de winkelmodus).
- Groot invoerveld **+ Iets toevoegen**.

Daaronder, pas als er iets zinnigs te tonen is (nooit verzonnen):
- **Misschien heb je dit weer nodig** — max. 3–5 producten uit je eigen geschiedenis, elk met een korte reden ("vaak gekocht", "3 weken geleden") en een knop **+ Toevoegen**. Nooit automatisch toegevoegd.
- **Uit je weekmenu** — geplande gerechten waarvan de ingrediënten nog niet op de lijst staan, met **Zet op lijst**.

Daarna de lijst zelf. Extra opties (vorige boodschappen, vaste boodschappen, delen, lijsten beheren) zitten achter één zichtbare knop **Meer opties** met tekst, niet achter "...".

## 2. Toevoegen zonder nadenken
- Typen "2 liter melk", "6 eieren", "wasmiddel" wordt lokaal herkend (hoeveelheid, Belgische maat, categorie) — geen AI, geen credits.
- Tijdens het typen verschijnen suggesties uit je eigen geschiedenis; Enter voegt altijd gewoon toe wat je typte.
- Staat het product er al, dan meldt Foodlo "Melk staat al op je lijst — hoeveelheid opgeteld" met **Ongedaan maken**.
- Niet-voeding (wasmiddel, keukenrol…) werkt exact hetzelfde en krijgt een eigen afdeling.

## 3. De lijst zelf
- Per afdeling een kop met tekst + aantal; categorieën automatisch maar met tik aanpasbaar.
- Elke regel: grote aanvinkknop (min. 56px) met tekst "Gekocht" voor schermlezers, naam groot, hoeveelheid rechts. Afgevinkt = doorgestreept én vinkje én onderaan in **Al gekocht (4)** — nooit alleen kleur.
- Tik op de naam opent een eenvoudig venster: naam, hoeveelheid, afdeling, **Verwijderen**, **Opslaan**, plus welk recept het item toevoegde.
- Vegen blijft als extra, maar elke actie heeft ook een zichtbare knop.
- Elke verwijder- of afvinkactie krijgt **Ongedaan maken**; "Alles wissen" vraagt eerst bevestiging.

## 4. Winkelmodus en "klaar"
- Extra grote regels per afdeling, teller "nog 6 te gaan", scherm blijft aan.
- Als alles gekocht is: duidelijk scherm **Klaar! Alles gekocht** met twee keuzes: **Lijst leegmaken** (gekochte items gaan naar je geschiedenis) of **Nog iets vergeten**.

## 5. Geheugen: vorige boodschappen, vaak gekocht, vaste boodschappen
- **Vorige boodschappen**: per winkelbeurt (datum) wat je kocht, met **Alles opnieuw op de lijst** of per product **+**.
- **Wat koop ik vaak?**: je top-producten op basis van echte aankopen.
- **Vaste boodschappen**: producten die je als vast markeert (ster), in één tik allemaal op de lijst.
- Alles gebaseerd op je eigen echte aankopen; bij een nieuwe gebruiker staan deze blokken er gewoon niet (geen nepvoorbeelden), wel één korte uitleg hoe ze vanzelf vullen.

## 6. Recepten, weekmenu, voorraad, delen
- Bestaande "Voeg toe aan boodschappenlijst" vanuit recept en weekmenu blijft; items tonen voor welk gerecht ze zijn.
- Voorraadkast-items krijgen de vraag "Heb je dit nog thuis?" in plaats van stil weggelaten te worden.
- Delen: één knop **Lijst delen** met **Stuur als tekst** of **Samen gebruiken** (bestaande uitnodigingen); zichtbaar wie meekijkt.

## 7. Taal, fouten, offline
- Geen technische woorden; fouten menselijk ("Het lukte niet om op te slaan. Probeer het opnieuw.").
- Offline: afvinken en toevoegen blijven zichtbaar werken en worden later bewaard; rustige melding "Je bent offline — we bewaren het straks".

## Controle
Testen op telefoon (390×844) en desktop: grote tekst, touch, toetsenbord, schermlezerlabels, offline, gedeelde lijst met twee gebruikers, geschiedenis, opnieuw kopen, suggesties, recept- en weekmenukoppeling, niet-voeding, dubbels, ongedaan maken, winkelmodus en alle bestaande functies. Daarna een laatste pass met de vraag: "Kan iemand van 80 dit zonder uitleg?" Niet publiceren zonder jouw aparte keuze.

## Technische details
- Hoofdwerk in `src/routes/boodschappen.tsx`, opgesplitst in kleine componenten (Startkop, Toevoegveld, Lijst, Itemvenster, Winkelmodus, Geheugen-sheet). Helpers in `src/lib/boodschappen.ts`, `src/lib/categorie.ts`, `src/lib/ingredienten.ts` (hergebruik `parseIngredientLine` + `belgischeMaat` voor vrije invoer).
- **Eén nieuwe tabel is nodig** voor echte geschiedenis, want gekochte items worden nu definitief verwijderd: `shopping_history` (user_id, list_id, group_id, name, quantity, unit, categorie, gekocht_op, recipe_id) met GRANTs en RLS (eigen rijen + gezinsleden via bestaande `in_groep`). Vaste boodschappen als kolom `vast boolean` in dezelfde context of een klein `shopping_staples`-tabelletje, ook met RLS. Geen bestaande data of tabellen wijzigen.
- Bij "Lijst leegmaken"/"Afgevinkte opruimen" worden gekochte items eerst naar de geschiedenis geschreven, daarna verwijderd.
- Suggesties = lokale berekening op geschiedenis (frequentie + tijd sinds laatste aankoop + samen-gekocht), geen AI.
- Offline: bestaande service worker + lokale wachtrij in localStorage voor toevoegen/afvinken, geleegd bij terug online.
- Realtime voor gedeelde lijsten blijft zoals nu.
