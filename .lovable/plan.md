# Demo-modus: de app verkennen zonder account

## Probleem
Je zit vast op de aanmeldpagina: de app stuurt iedereen zonder account meteen terug naar /aanmelden (AppShell regel 61). Daardoor kun je in de preview niet doorklikken en feedback geven.

## Oplossing: "Verken zonder account"
Eén knop op de aanmeldpagina opent de volledige app met voorbeeldgegevens. Je kunt dan alles bekijken en doorklikken alsof je aangemeld bent — zonder account, zonder dat er iets in de database wordt bewaard.

### 1. Demo-knop op de aanmeldpagina
- Opvallende knop **"Verken zonder account"** onder de aanmeldknoppen.
- Eén tik en je bent in de app. Geen e-mail, geen wachtwoord.

### 2. Voorbeeldgegevens (alles zichtbaar, niets echt bewaard)
Een nieuw bestand met realistische Nederlandse voorbeelddata:
- **6 voorbeeldrecepten** met foto's, ingrediënten (Belgische maten), bereidingsstappen, tijden en categorieën (bv. Spaghetti bolognaise, Ovenpannenkoek, Tomatensoep, Lasagne, Stamppot, Tiramisu).
- **Weekmenu** voor deze week met enkele ingevulde dagen.
- **Boodschappenlijst** met een tiental items in categorieën.
- **Favorieten** en een voorbeeldprofiel ("Demo").

### 3. Werking in demo-modus
- Alle vijf tabbladen (Start, Recepten, Weekmenu, Lijst, Meer) en receptdetails en de kookstand werken en zijn klikbaar.
- Bovenaan een rustige, niet-blokkerende balk: **"Je bekijkt een voorbeeld"** met knoppen **"Account maken"** en **"Stop voorbeeld"**.
- Acties die iets zouden bewaren (recept toevoegen, afvinken, plannen, AI-functies) tonen een vriendelijke melding: *"Maak een gratis account om dit te bewaren."* — de app crasht niet en er wordt niets weggeschreven.
- Pagina's die echt persoonlijk zijn (vrienden, gezin, meldingen, instellingen, kaarten) tonen een nette uitlegpagina met "Zo werkt dit" en een knop om een account te maken.

### 4. Technische aanpak
- Nieuw: `src/lib/demo.ts` — demo-vlag in localStorage (`foodlo-demo`), voorbeelddata, hulpfuncties `isDemo()`, `startDemo()`, `stopDemo()`.
- `AppShell.tsx`: bij demo-vlag géén doorverwijzing naar /aanmelden; demo-balk tonen.
- `aanmelden.tsx`: demo-knop.
- `index.tsx`, `gerechten.tsx`, `recepten.$id.tsx`, `planner.tsx`, `boodschappen.tsx`: bij demo-vlag voorbeelddata tonen i.p.v. databasevragen; schrijfacties afvangen met de vriendelijke melding.
- Geen database-wijzigingen, geen nieuwe tabellen, geen invloed op echte gebruikers.

### 5. Daarna: resterende wensen A-Z
Zodra de demo-modus werkt, ga ik verder met de openstaande punten uit de roadmap:
- Recept toevoegen/bewerken/importeren verder vereenvoudigen (kortere schermen, controlescherm na import).
- Eindcontrole boodschappen met twee gebruikers (gedeelde lijst) en grote tekst.
- Alles testen op telefoon en desktop.

### Controle
- Test op telefoonformaat (390×844) en desktop: doorklikken door alle tabbladen, recept openen, kookstand starten, demo stoppen.
- Bouw- en typecontrole groen.
- Niet publiceren zonder jouw aparte keuze.
