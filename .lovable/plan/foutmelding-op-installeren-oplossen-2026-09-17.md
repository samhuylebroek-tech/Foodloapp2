# Foutmelding op /installeren oplossen

## Wat er gebeurt

Eén gebruiker kreeg een foutmelding op de installatiepagina. De oorzaak zit in de offline-hulp van de app: die bewaart bezochte pagina's zodat ze zonder internet blijven werken. Vandaag bewaart ze een pagina al terwijl die nog aan het binnenkomen is. Valt de verbinding op dat moment weg (of is ze traag), dan blijft er een halve pagina in het geheugen staan. Bij een volgend bezoek wordt die halve pagina getoond en loopt de app vast op precies deze fout.

Dezelfde bewaarde pagina kan ook verouderd raken na een nieuwe versie van de app, met dezelfde foutmelding tot gevolg.

## Wat ik ga doen

1. Een pagina pas bewaren wanneer ze volledig en foutloos is binnengekomen. Halve pagina's worden nooit meer opgeslagen.
2. Bij het openen van een pagina altijd eerst de verse versie van internet proberen; het bewaarde exemplaar dient enkel als noodoplossing zonder verbinding.
3. De offline-opslag één keer vernieuwen, zodat alle bestaande halve of verouderde pagina's bij iedereen automatisch verdwijnen.
4. De installatiepagina zelf nakijken op 390px en op een gewoon scherm, zodat ze in alle gevallen netjes laadt.

Alles wat vandaag werkt blijft werken: meldingen, offline klantenkaarten en de rest van de app raken niet aangepast.

## Technisch

- `public/sw.js`: in de `fetch`-handler alleen cachen na het volledig uitlezen van een gekloond antwoord (`await kopie.arrayBuffer()`), waarna een nieuwe `Response` met dezelfde status/headers in de cache gaat. Een afgebroken stream gooit dan en wordt niet bewaard.
- Navigaties (`req.mode === "navigate"`) blijven network-first; de cache-fallback blijft alleen voor de offline-situatie.
- `CACHE` verhogen naar `foodlo-offline-v5`; de bestaande `activate`-opruiming wist daardoor alle oude inhoud.
- Geen wijzigingen aan `src/routes/installeren.tsx`, aan de database of aan de meldingenlogica.
