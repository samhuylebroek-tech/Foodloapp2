# Foodlo — volledig UX/UI-herontwerp voor rust en duidelijkheid

Doel: iemand van 20 en iemand van 65–80 snapt elk scherm meteen: waar ben ik, wat kan ik hier, wat is de volgende stap. Er verdwijnt geen enkele functie, data, AI-functie of account; dit herontwerp brengt geen extra AI-kosten mee.

Opmerking: de brief verwijst naar screenshots ter inspiratie, maar die zaten niet bij je bericht. Het plan volgt de beschreven principes; stuur ze gerust nog mee.

## Fase 0 — Controle van alle schermen (eerst)
- Elk hoofdscherm fotograferen op telefoon (390px) en computer.
- Per scherm noteren: te veel knoppen, kaders, badges, kleuren, kleine grijze tekst, knoppen met alleen een icoon, dubbele titels, meer dan één hoofdknop.
- Resultaat: een korte lijst met knelpunten per scherm in de roadmap.

## Fase 1 — Eén Foodlo-ontwerpsysteem
- **Kleuren**: warme neutrale achtergrond, donkere tekst, één groene hoofdkleur (het logo blijft), één kleur voor gelukt, één voor opgelet en één voor fout. De gele accentkleur verdwijnt als losse versiering. Status wordt nooit alleen met kleur getoond: altijd ook tekst of een icoon.
- **Letters**: één lettertype voor alles (Manrope). Het tweede koptekstlettertype verdwijnt. Vaste maten: paginatitel, sectietitel, gewone tekst (min. 17px), hulptekst (min. 15px, goed leesbaar).
- **Vormen**: één afronding voor kaarten, knoppen en invoervelden. Geen "bubbels" en minder pillen, schaduwen en randen.
- **Vaste bouwstenen** die elk scherm gebruikt: bovenbalk, hoofdknop / tweede knop / stille knop, lijstrij, kaart (alleen waar nodig), sectiekop, onderpaneel, zoekveld, filterrij, lege-staat-blok, foutblok, laadblok, bevestigingsmelding.
- Knoppen: minstens 56px hoog, altijd icoon + tekst, maximaal één hoofdknop per scherm.

## Fase 2 — Navigatie en bovenbalk
- Onderbalk blijft bij 5 vaste items met groter label: Start, Recepten, Weekmenu, Boodschappen (in plaats van "Lijst"), Meer. De geselecteerde tab krijgt een duidelijke vlak-achtergrond plus vet label.
- Vaste bovenbalk op elk scherm: links Terug (met het woord "Terug" op subschermen), in het midden de paginatitel, rechts maximaal één actie met tekst (bv. "+ Toevoegen").
- De pagina "Meer" wordt een rustige lijst met grote rijen, in groepen: Samen (Gezin, Vrienden), Mijn spullen (Klantenkaarten, Voorraad), App (Instellingen, Installeren, Feedback, Hulp).

## Fase 3 — Schermen herwerken (in deze volgorde)
1. **Start**: groet + "Vandaag op het menu" (ontbijt / lunch / avond) met één hoofdknop. Daaronder maximaal drie gewone acties: Boodschappen, Weekmenu, Inspiratie. Geen dashboardtegels, tellers of meldingenmix meer.
2. **Recepten**: zoekveld bovenaan, één filterrij, rustig raster met foto + naam + kooktijd. "+ Recept toevoegen" als enige hoofdknop.
3. **Recept toevoegen**: drie duidelijke keuzes (Zelf schrijven, Uit link of foto halen, Uit Inspiratie kiezen), daarna de bestaande stappenbouwer in de nieuwe stijl.
4. **Inspiratie**: dezelfde opbouw als Recepten, zodat je het meteen herkent; "Verras mij" wordt een stille knop.
5. **Receptdetail**: foto, naam, drie feiten (tijd, porties, soort), dan één hoofdknop "Start koken". Ingrediënten en stappen als gewone lijsten; minder belangrijke acties (delen, bewerken, geschiedenis) in één "Meer"-menu met tekst.
6. **Weekmenu**: bovenaan duidelijk welke week, met Vorige/Volgende. Per dag een rij met de gerechten. Eén hoofdknop "Boodschappen voor deze week". Voorstellen en instellingen blijven, maar achter stille knoppen.
7. **Boodschappen**: nog te kopen staat bovenaan in groepen, invoerveld altijd zichtbaar, "In je kar" onderaan. Winkelideeën en Vaak gekocht worden rustige inklapbare secties. De Terug-pijl krijgt het woord "Ongedaan maken".
8. **Kookstand**: extra grote tekst, één stap per scherm, grote knoppen Vorige/Volgende onderaan (werking blijft zoals net hersteld).
9. **Klantenkaarten, Gezin/Vrienden, Instellingen, Welkomstappen**: overzetten naar dezelfde lijstrijen, bovenbalk en knoppen.

## Fase 4 — Lege schermen, fouten en bevestigingen
- Elk leeg scherm zegt: wat hoort hier, waarom is het leeg en welke ene knop helpt je verder.
- Foutmeldingen in gewone taal, met een "Opnieuw proberen"-knop.
- Bevestigingen altijd op dezelfde plek, met dezelfde stijl.

## Fase 5 — Testen
- "65-jaar-test" en "3-secondentest" per scherm met schermafbeeldingen op telefoon en computer.
- Controleren dat aanmelden, offline gebruik, installeren als app, gedeelde lijsten en bestaande data nog werken.
- De acceptatiecriteria uit de brief afvinken in de roadmap.

## Buiten dit plan
- Control Center (beheer) blijft zoals het is: dat is alleen voor jou.
- Oude thema's (warm, fris, contrast) blijven kiesbaar, maar krijgen de nieuwe vormen en letters.

## Technische details
- Tokens in `src/styles.css`: kleurvariabelen herijken, `--success`/`--warning` toevoegen, één `--radius`, typografieschaal via `@utility` (bv. `text-titel`, `text-sectie`, `text-body`), en `font-display` gelijk zetten aan Manrope.
- Nieuwe gedeelde componenten in `src/components/ui-foodlo/`: `TopBar`, `PageHeader`, `ListRow`, `Section`, `EmptyState` (bestaande uitbreiden), `ErrorState`, `ActionButton`-varianten via cva op de bestaande shadcn-`Button` (`size="xl"` met min-h-14).
- `AppShell.tsx`: bovenbalk met tekstuele terugknop en rechter-actieslot; tab-label "Boodschappen"; actieve tabstijl.
- Pagina's zijn groot (planner ~124k, boodschappen ~66k, RecipeForm ~69k). Daarom alleen de presentatie herschrijven en de logica en data-aanroepen onaangeroerd laten. Per pagina in aparte beurten, zodat de build na elke stap groen blijft.
- Geen databasewijzigingen, geen wijzigingen aan server-functies of AI.
