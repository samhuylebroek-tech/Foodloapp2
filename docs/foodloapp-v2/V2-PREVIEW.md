# Foodloapp V2 bekijken

De V2-preview draait **op je eigen Mac** met verzonnen demodata. Ze praat met een nagemaakte Supabase op `127.0.0.1` en kan productie of echte klantgegevens dus **niet** raken.

## Starten (± 1 minuut)
1. Open **Terminal**.
2. Plak:
   ```
   cd ~/Documents/GitHub/dinner-dialogue-hub-v2 && npx --yes bun@1.4.3 run demo
   ```
3. Wacht tot je `Foodlo V2-demo: http://127.0.0.1:4319` ziet.
4. Open **http://127.0.0.1:4319** in Chrome of Safari en meld aan met
   **demo@foodlo.be** / **demo1234**.
5. Stoppen: in Terminal **Ctrl + C**.

> De demodata (8 recepten, een weekmenu, een boodschappenlijst) worden bij elke start opnieuw klaargezet. Wat je wijzigt, verdwijnt bij het stoppen.

**Op je telefoon bekijken:** in Chrome op de Mac *Weergave → Ontwikkelaar → Ontwikkelaarstools* → het telefoonicoon (apparaatmodus) en kies bv. 390 × 844.

## Wat er nieuw is
| Scherm | Wat te bekijken |
|--------|-----------------|
| **Overal** | Nieuwe titels (Fraunces), warmere kleuren, zachte schaduwen; recepten zonder foto krijgen een warme omslag per soort gerecht; onderste balk past op elke telefoon ("Lijst"); meldingen groter en beter leesbaar |
| **Start** | Uitgelicht gerecht van vandaag, strook "Deze week" (7 dagen), favorieten, grote knop **Recept toevoegen**; op desktop twee kolommen |
| **Recepten** | Nieuwe kaarten: omslag, hartje óp de foto, soortlabel, gelijke hoogtes, "1 persoon" |
| **Recept** | Naam als titel, kenmerk-chips, geen dubbele fotoknoppen meer, knoppen lopen niet meer over |
| **Kookstand** | Voortgangsbalk; **timers** uit de stap (bv. stoofvlees stap 6: "Timer 2 uur 30 min"); pijltjestoetsen; herlaad halverwege → **"Verder koken bij stap …"** |
| **Weekmenu / Boodschappen** | Zelfde omslagen en stijl; toegankelijke vensters |

**Tip voor de kookstand:** open *Zalm met citroen en dille* → Start koken → naar stap 4 → **Timer 12 min**. Ga een stap terug: de timer blijft lopen.

## Schermafbeeldingen voor/na (optioneel)
```
SCHERMEN=1 SCHERM_MAP=na npx playwright test schermen --project=mobiel-390 --project=desktop
```
De afbeeldingen komen in `docs/foodloapp-v2/schermen/` (niet in git).

## Wat nog niet in deze preview zit
- Echte foto's: in de demo hebben recepten geen foto, dus je ziet de omslagen.
- Realtime samenwerken (gezinslijst met twee personen tegelijk) wordt in de demo niet nagebootst.
- AI-functies (link inlezen, foto genereren) zijn in de demo uitgeschakeld (geen sleutel).
- Creatorfuncties en betalingen (fase 3–4).
