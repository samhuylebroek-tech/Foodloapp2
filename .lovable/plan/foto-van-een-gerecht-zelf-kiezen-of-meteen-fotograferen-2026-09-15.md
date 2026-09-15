# Foto van een gerecht zelf kiezen of meteen fotograferen

Vandaag staat er bij een gerecht één knop "Foto kiezen". Die knop vraagt de telefoon meteen om de camera te openen, waardoor je een bestaande foto uit je fotorolletje vaak niet kan kiezen. En op de pagina van het gerecht zelf kan je de foto niet vervangen: je moet eerst naar "Aanpassen".

## Wat er verandert

**1. Twee duidelijke knoppen in het bewerkscherm**

In plaats van één knop komen er twee grote knoppen naast de foto:

- "Foto nemen" — opent meteen de camera van je telefoon.
- "Foto kiezen" — opent je fotorolletje of bestanden (ook op de computer).

Staat er al een foto, dan heten ze "Nieuwe foto nemen" en "Andere foto kiezen", zodat duidelijk is dat de bestaande foto vervangen wordt. Het kruisje om de foto weg te halen en de knop "Stel een foto voor" blijven staan.

**2. Foto vervangen vanaf het gerecht zelf**

Op de pagina van een gerecht dat van jou is, komt er onderaan de foto een knopje "Foto vervangen". Eén tik toont dezelfde twee keuzes (nemen of kiezen). De nieuwe foto wordt meteen bewaard en je ziet ze direct staan — zonder eerst naar het bewerkscherm te gaan.

**3. Foto's die te groot zijn**

Foto's van een moderne telefoon zijn snel enkele megabytes. Voor het opslaan wordt de foto automatisch verkleind naar maximaal 1600 pixels en als JPEG bewaard. Dat gaat sneller, kost minder opslag, en de kwaliteit blijft ruim goed genoeg. Lukt het verkleinen niet, dan wordt gewoon de originele foto bewaard.

**4. Duidelijke meldingen**

- Tijdens het opslaan zie je een draaiend icoontje op de foto.
- Gelukt: "Foto bewaard".
- Mislukt: "De foto kon niet worden opgeslagen. Probeer het opnieuw." (geen technische tekst)
- Kies je per ongeluk iets dat geen afbeelding is, dan krijg je: "Kies een foto (jpg of png)".

## Wat hetzelfde blijft

- Foto's blijven privé opgeslagen; alleen jij en de mensen met wie je deelt zien ze via een tijdelijke link.
- De AI-functies (gerecht herkennen van een foto, schermafbeelding importeren, foto voorstellen) blijven ongewijzigd en kosten evenveel credits als nu.
- Foto's vervangen kost geen credits.

## Technische uitvoering

- `src/lib/photos.ts`: nieuwe helper `verkleinFoto(file)` (canvas, max 1600 px, JPEG kwaliteit 0,82, met fallback naar het origineel) en typecontrole op `image/*`. `uploadRecipePhoto` gebruikt die helper.
- `src/components/RecipeForm.tsx`: het fotoblok krijgt twee `<label>`-knoppen met een eigen verborgen `<input type="file" accept="image/*">` — één mét `capture="environment"`, één zonder. Beide roepen de bestaande `handlePhoto` aan; de tekst hangt af van of er al een foto staat.
- Nieuwe component `src/components/FotoKiezer.tsx` met die twee knoppen, hergebruikt in het formulier en op de detailpagina (props: `bezig`, `heeftFoto`, `onBestand`).
- `src/routes/recepten.$id.tsx`: bij `isOwner` een knop "Foto vervangen" onder de foto; uploadt via `uploadRecipePhoto`, doet daarna `supabase.from("recipes").update({ image_url: pad })` en invalideert de bestaande query van het recept zodat de nieuwe foto meteen verschijnt.
- Geen databasewijzigingen: `recipes.image_url` en de bucket `recipe-photos` blijven zoals ze zijn.
