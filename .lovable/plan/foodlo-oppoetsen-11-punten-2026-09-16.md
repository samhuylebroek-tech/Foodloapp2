# Foodlo oppoetsen: 11 punten

## 1. "Zet Foodlo op je telefoon" blijft vindbaar
Nu verschijnt de tip één keer en daarna nooit meer. Er komt een vaste, rustige ingang:
- In **Instellingen** een blijvende regel "Foodlo op je telefoon zetten" die naar de bestaande uitlegpagina gaat.
- Ook in het zijmenu onderaan een klein, onopvallend item.
- De pop-uptip zelf blijft zoals hij is (eenmalig, wegklikbaar).

## 2. Gedeeld weekmenu en boodschappenlijst van een vriend
Gecontroleerd in de database: het gezin "Ons gezin" heeft twee leden met kijkrechten, maar alles wat jij plande staat op je **persoonlijke** menu; slechts één maaltijd staat op het **gezinsmenu**. De vriendpagina toont enkel het persoonlijke menu van die ander — dat is bij haar leeg, dus je ziet niets. Bij haar is jouw persoonlijke menu wél zichtbaar (de rechten staan open).
Aanpassing op de vriend-/gezinslidpagina:
- Toon zowel het gedeelde gezinsmenu en de gezinslijst als het persoonlijke menu/lijst van die persoon, met een duidelijk label erbij ("Gezinsmenu" / "Menu van X").
- Toon een verklarende regel wanneer er niets gepland staat in plaats van een kale lege lijst.
- In de planner duidelijker maken of je in "Mijn weekmenu" of "Weekmenu gezin" plant, zodat gedeelde planning ook echt in het gezinsmenu belandt.

## 3. Rondleiding bij de eerste keer inloggen
- Na de instelstappen start een korte rondleiding door de app: startscherm, recepten toevoegen/importeren, weekmenu, boodschappen, voorraadkast, klantenkaarten, vrienden & gezin, kookstand, meldingen.
- Per stap: grote titel, korte zin, afbeelding/icoon, knoppen "Volgende" / "Overslaan".
- In **Instellingen** de knop "Rondleiding opnieuw bekijken".

## 4. Uitgenodigde vrienden zichtbaar en aanvaarden dat werkt
In de database staat één uitnodiging met status "in afwachting" en géén enkele aanvaarde vriendenverbinding — het aanvaarden loopt vast (de melding verwijst naar een ander kenmerk dan waarmee het aanvaarden werkt).
- Het aanvaarden koppelen aan de juiste uitnodiging, zodat "Aanvaarden" altijd lukt.
- Blok "Uitnodigingen die jij verstuurde" duidelijk tonen met naam, status (in afwachting / aanvaard / geweigerd) en een knop "Intrekken".
- Na aanvaarden verschijnt de persoon meteen bij beide mensen in de lijst.

## 5. Tab "Toevoegen" weg uit de onderste balk
Onderaan blijven: Start, Recepten, Weekmenu, Lijst. Toevoegen blijft bereikbaar via het menu en de knop op de receptenpagina.

## 6. Gerecht aanpassen werkt weer
Eerst reproduceren (bewerkscherm openen en bewaren) om de echte oorzaak vast te stellen — die is nu niet bevestigd; de bewaarknop of het laden van het formulier faalt. Daarna herstellen en de foutmelding op het scherm bruikbaar maken ("Opslaan lukte niet omdat …") in plaats van een algemene melding.

## 7. Sterren vragen na het koken
Aan het einde van de kookstand een vriendelijk scherm: "Hoe was het? Geef sterren" met de bestaande sterrenkiezer en "Later". De score gaat naar de bestaande beoordelingen.

## 8. Meldingen komen niet aan
Er staan twee toestellen geregistreerd, maar er is nog nooit één melding weggeschreven. Eerst nagaan waar het stokt (draait de kwartiertaak, lukt het versturen, zijn de sleutels aanwezig), daarna herstellen. Extra: in Instellingen een knop "Testmelding sturen" zodat je meteen ziet of het werkt op je toestel.

## 9. Voor- en achternaam bij aanmelden
Twee velden ("Voornaam", "Achternaam"), samen opgeslagen als weergavenaam. Bestaande accounts blijven ongewijzigd.

## 10. Controlecentrum: personen kiezen
Op het dashboard een keuzeblok "Wie tel ik mee": iedereen, één persoon, meerdere personen, of iedereen behalve gekozen personen (bv. jezelf uitsluiten). De keuze werkt door op cijfers, grafieken en kosten, naast de bestaande dag/week/maand/jaar-keuze.

## Technisch
- Nieuwe rondleidingcomponent + `profiles`-veld of voorkeurssleutel om te onthouden dat ze gezien is.
- `vrienden.$id.tsx`: extra query op gezinsmenu (`meal_plan.group_id`) en gezinslijst (`shopping_lists.group_id`), duidelijke labels.
- `vrienden.functions.ts`: aanvaarden op basis van de uitnodiging-id i.p.v. enkel token; deeplink in de melding meesturen.
- `AppShell.tsx`: TABS inkorten, menu-item "Op je telefoon zetten".
- `RecipeForm.tsx` / `recepten.$id.bewerken.tsx`: oorzaak opsporen, foutmelding tonen.
- Kookstand in `recepten.$id.tsx`: afsluitscherm met `SterrenKiezer`.
- Meldingen: cron-eindpunt handmatig testen, VAPID-sleutels controleren, testmelding-serverfunctie.
- Controlecentrum: personenfilter door `admin.functions.ts` (parameter: lijst met id's + modus in/uit).
