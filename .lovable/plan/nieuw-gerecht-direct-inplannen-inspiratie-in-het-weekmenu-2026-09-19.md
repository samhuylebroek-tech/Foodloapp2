# Nieuw gerecht direct inplannen + inspiratie in het weekmenu

## Doel
Twee omslachtige stappen weghalen:
1. Na het toevoegen van een nieuw gerecht kan je het meteen op een dag zetten, zonder eerst naar het weekmenu te moeten.
2. Als je in het weekmenu een dag wil vullen maar geen inspiratie hebt, krijg je ter plaatse ideeën (AI en echte recepten van het web) zonder naar de receptenpagina te moeten.

## Wat je straks kan

### In het weekmenu ("Gerecht inplannen")
- De bestaande kiezer ("Wat eten we?") krijgt een extra deel **"Geen inspiratie?"** met drie grote knoppen:
  - **AI-ideeën voor vandaag** — drie passende voorstellen (houdt rekening met je weekvoorkeuren: vlees/vis/vega, kooktijd, vermijden). Tik op een voorstel om het als volledig recept te bekijken; met één tik bewaar je het én staat het meteen op de gekozen dag.
  - **Zoek echte recepten op het web** — tik een naam (bv. "balletjes tomatensaus Jeroen Meus") en krijg geverifieerde recepten van echte sites met bronvermelding; voorbeeld bekijken, overnemen en direct inplannen.
  - **Enkel als tekst inplannen** — bestaat al, blijft.
- Alles gebeurt in hetzelfde scherm; je verlaat het weekmenu nooit.

### Bij een nieuw recept
- Na "Bewaar recept" verschijnt de vraag **"Meteen inplannen?"** met de keuze van dag en dagdeel.
  - **Ja, plan in** — het gerecht staat meteen in je weekmenu en je gaat daarnaartoe.
  - **Nu niet** — je gaat gewoon naar het recept zoals nu.
- Zelfde vraag bij "Bewaar bij mijn recepten" in het voorbeeldvenster van webrecepten.

## Technisch
- `src/routes/planner.tsx` — `ReceptKiezer` uitbreiden met een inspiratieblok: AI-ideeën via bestaande `gerechtVoorstellen`, webzoeken via bestaande `zoekReceptenOpWeb` + bestaand voorbeeldvenster ("overnemen" plant direct op `datum`/`moment` via bestaande `nieuw_gerecht`/`plan_toevoegen`).
- `src/components/RecipeForm.tsx` / `src/routes/recepten.nieuw.tsx` — na geslaagde save een optionele `onOpgeslagen(id, titel)`-flow: kleine "Meteen inplannen?"-dialoog (dag + dagdeel) die in `meal_plan` invoegt via dezelfde insert als de planner; geen nieuwe tabel, geen nieuw systeem.
- Web-overnemen blijft het bestaande credits- en verificatiepad volgen; AI-ideeën gebruiken bestaande functies en creditsregels. Alles in het Nederlands, grote knoppen, mobiel eerst.
- Bestaande gedragingen (zoeken in eigen recepten, tekst-only, dag/moment wijzigen) blijven ongewijzigd.

## Controle
- Typecheck en build groen; ingelogde Playwright-test: dag openen → AI-idee kiezen → gerecht staat op de dag; nieuw recept opslaan → "Meteen inplannen" → zichtbaar in weekmenu.
