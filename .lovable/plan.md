# Demo-modus verwijderen + weekmenu → boodschappen flow

## Deel 1: Demo-modus volledig verwijderen
De demo-modus was bedoeld om in Lovable rond te klikken, maar dat is niet meer nodig — alles gaat eruit, alsof het nooit bestaan heeft.

- **Verwijderen:** `src/lib/demo.ts` (hele bestand).
- **`src/routes/aanmelden.tsx`:** knop "Verken zonder account" weg.
- **`src/components/AppShell.tsx`:** demo-balk weg; aanmeld-doorverwijzing weer exact zoals voorheen (zonder demo-uitzondering).
- **`src/routes/index.tsx`, `gerechten.tsx`, `recepten.$id.tsx`, `planner.tsx`, `boodschappen.tsx`:** alle demo-gegevens en demo-meldingen weg; de pagina's werken weer uitsluitend met echte gegevens.
- Geen database-wijzigingen nodig (de demo schreef toch niets weg).

## Deel 2: Weekmenu → boodschappen flow herwerken
Uit je brief: de gebruiker moet zelf de controle houden, zonder pop-up per ingrediënt.

- **Weekmenu opent altijd op vandaag** (niet op maandag van de week).
- **Geen stil samenvoegen meer:** als je een gerecht opnieuw vanuit het weekmenu op de lijst zet, worden ingrediënten die er al staan niet automatisch opgeteld.
- **Eén slimme controle:** bij overlappende ingrediënten verschijnt één rustig overzicht dat toont wat al op de lijst staat. Per ingredient of in één keer kies je: **Nog eens toevoegen** of **Niet toevoegen**. Nieuwe ingrediënten gaan er gewoon bij.
- De rest van de flow (lijstkeuze, porties, ongedaan maken) blijft zoals nu.

## Controle
- Typecontrole en bouw groen.
- Test op telefoon (390×844) en desktop: aanmelden zonder demo-knop, weekmenu opent op vandaag, gerecht op lijst zetten met en zonder overlap.
- Niet publiceren zonder jouw aparte keuze.
