# Foto van een gevonden gerecht wordt niet mee bewaard

## Wat er nu misgaat

Bij "Bewaar bij mijn recepten" in het voorbeeldvenster wordt het recept meteen opgeslagen. De gevonden foto wordt op dat moment wel in het scherm gezet, maar het bewaren gebruikt nog de oude (lege) fotowaarde. Daardoor komt het gerecht zonder foto in je recepten terecht, ook al stond er wel een foto bij het gevonden recept.

Bij de weg "Eerst aanpassen" en daarna zelf opslaan gaat het wel goed — daar zit tijd tussen.

## Wat ik ga doen

1. **Foto meegeven bij direct bewaren**
   Het directe bewaren krijgt de foto van het gevonden recept mee, in plaats van te vertrouwen op wat er net in het scherm gezet is. Zo wordt de foto altijd meegenomen, ook bij "Bewaar bij mijn recepten" en bij "Bewaar en plan meteen in".

2. **Foto van een website naar je eigen opslag kopiëren**
   Een gevonden foto is nu een link naar de website van de bron. Zulke links verdwijnen of worden geblokkeerd, waardoor de foto later alsnog weg is. Bij het bewaren haal ik de foto één keer op en zet ik ze in je eigen opslag van de app. Lukt dat niet (bijvoorbeeld een te grote of geblokkeerde afbeelding), dan valt hij terug op de link zoals nu, zodat bewaren nooit mislukt.

3. **Foto tonen in het voorbeeldvenster**
   In het venster waar je het gevonden recept nakijkt, komt de foto bovenaan te staan met een kruisje om ze te weigeren. Zo zie je vooraf wat er mee bewaard wordt.

4. **Controle**
   Zoeken op een gerecht met foto, bewaren via beide knoppen, en nakijken dat het gerecht in de lijst en op de receptpagina de foto toont. Ook controleren dat recepten zonder gevonden foto gewoon het potje-symbool houden.

## Technisch

- `src/components/RecipeForm.tsx`: `DirecteOpslag` krijgt een `imageUrl`-veld; `handleSave(over)` gebruikt `over.imageUrl ?? photoPath` in plaats van alleen de state; `bewaarVoorbeeld()` geeft `r.image_url` door. Zelfde aanpassing op het pad dat bewaart en meteen inplant.
- Nieuwe server-functie (in een bestaand `*.functions.ts`-bestand bij de import-logica) die een afbeeldings-URL ophaalt met de bestaande SSRF-controles, formaat en type valideert, en de bytes teruggeeft; de client zet die via de bestaande `uploadRecipePhoto`/`uploadDataUrl` in de bucket `recipe-photos`. Geen nieuwe tabel of tweede opslagsysteem.
- Geen wijziging aan `useSignedUrl`: externe `http`-paden blijven als terugval werken.
