# Echte receptresultaten bij "Zoeken"

Vandaag geeft "Zoeken" bij een nieuw gerecht alleen ideeën die de AI zelf bedenkt. Typ je "Balletjes in tomatensaus Jeroen Meus", dan krijg je varianten, maar niet het échte recept van Jeroen Meus.

## Wat er verandert

Bij "Zoeken" krijg je voortaan drie blokken, in deze volgorde:

1. **Al in je app** — je eigen recepten en die van je gezin (ongewijzigd, gratis).
2. **Gevonden op het web** — echte receptpagina's met titel, site (bv. dagelijksekost.een.be, 15gram.be, ah.nl) en een kort fragment. Tik je er een aan, dan wordt dat recept opgehaald via de bestaande importfunctie, dus mét bronvermelding, ingrediënten en stappen zoals ze er echt staan.
3. **Nieuwe ideeën** — de huidige AI-varianten, nu als laatste blok voor als het web niets bruikbaars geeft.

Nederlandstalige en Belgische receptsites krijgen voorrang in de volgorde. Levert het web niets op, dan zie je gewoon de AI-ideeën met een korte uitleg.

## Kosten

Het zoeken op het web zelf kost geen credits. Pas wanneer je een gevonden recept aantikt, loopt het door de bestaande import (structuurdata eerst, AI alleen als de pagina geen nette receptdata heeft) — precies zoals bij het plakken van een link vandaag.

## Technisch

- Nieuwe serverfunctie `zoekReceptenOpWeb` in `src/lib/ai.functions.ts` (of `src/lib/zoek.functions.ts`), met `requireSupabaseAuth`.
  - Query wordt aangevuld met "recept" en uitgevoerd tegen een sleutelloze zoek-endpoint (DuckDuckGo HTML) server-side; resultaten worden geparsed naar `{ titel, url, site, fragment }`.
  - Filtert social/video-only ruis eruit, dedupe op domein + canonical URL, max 6 resultaten, ranking met bonus voor `.be`/`.nl`-domeinen en bekende receptsites.
  - Elke URL gaat door de bestaande `veiligeUrl`/`canoniekeUrl`-helpers (SSRF-bescherming) voordat hij teruggegeven wordt.
  - Resultaten 24 u gecached in `ai_cache` met sleutel `web|<term>`; geen credits, geen `ai_usage`-registratie (wel een `usage_events`-meetpunt `recept.webzoek`).
- `src/components/RecipeForm.tsx`: zoekmodus krijgt het extra blok "Gevonden op het web"; aantikken roept de bestaande `importRecipeFromUrl` aan en vult het formulier zoals de linkimport dat nu al doet, inclusief `source_url`.
- Geen databasewijzigingen, geen tweede import- of AI-systeem; bestaande link/tekst-import en AI-ideeën blijven ongewijzigd.
