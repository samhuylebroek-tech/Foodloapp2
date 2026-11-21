# Foodloapp V2 — herontwerp (stand 2026-11-08)

> Samengevat in [`docs/foodlo/MASTER_PRODUCT_BLUEPRINT.md`](../foodlo/MASTER_PRODUCT_BLUEPRINT.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

## 1. Herbeoordeling van de vorige V2
De vorige versie was **grotendeels cosmetisch**: nieuw lettertype, nieuwe kleuren, schaduwen en omslagen, maar dezelfde informatiearchitectuur en schermopbouw als het origineel.
- Dezelfde 5 tabs + zijbalk, en op elke pagina een kopblok van ±130 px voor alleen een titel.
- Receptdetail: ingrediënten en bereiding achter **tabbladen**. Je moest klikken om te zien wat je nodig hebt.
- Weekmenu: op desktop één dag tegelijk, terwijl er plaats is voor de hele week.
- "Toevoegen" stond verspreid over vier schermen.

## 2. Twee richtingen, één keuze
| | A. Redactioneel kookmagazine | B. Rustige keukenassistent |
|---|---|---|
| Beeld | Inktgroene banden, grote serif, foto's in de hoofdrol | Grote gekleurde tegels, app-raster |
| Persona A (70) | Goed, mits strakke structuur | Zeer goed |
| Persona B (20) | Herkenbaar, deelbaar, premium | Generiek, "productiviteitsapp" |
| Merk | Onderscheidend | Inwisselbaar |

**Gekozen: A**, met de structuurregels van B: grote tekst, altijd een label bij een icoon, één vaste plek om iets toe te voegen, geen verborgen hoofdacties.

## 3. Wat er structureel veranderd is
| Onderdeel | Oud | Nieuw |
|-----------|-----|-------|
| Navigatie mobiel | Start · Recepten · Weekmenu · Boodschappen · Meer | **Vandaag · Recepten · ➕ Nieuw · Week · Lijst**; "Meer" rechtsboven |
| Navigatie desktop | Zijbalk | Horizontale topbalk: Vandaag · Recepten · Weekmenu · Boodschappen · **Voorraad** + **Nieuw** + Meer |
| Toevoegen | Per pagina, verspreid | **Eén paneel "Wat wil je doen?"**: recept · inplannen · op de lijst · in de voorraad |
| Paginakop | Plakkende balk met logo + titel | Titel in de pagina; Vandaag krijgt een eigen redactionele band |
| Vandaag | Kaart + lijst + favorieten | Inktband: datum, groet, **"Avondeten vandaag"** met foto, **Start koken** (opent meteen de kookstand), week, boodschappen/voorraad, magazine-indeling favorieten |
| Recepten | Zoeken → segmenten → filters → raster | Groot zoekveld → **Collecties** (Favorieten, Snel klaar, Vlees/Vis/Vegetarisch, per soort) → raster |
| Receptdetail | Foto → knoppen → **tabs** | Foto + acties naast elkaar; **ingrediënten (blijven in beeld) naast genummerde stappen**, geen tabs; voeding uitklapbaar; "Jouw recept" onderaan |
| Weekmenu desktop | Eén dag of lange lijst | **7-dagenraster** (dagen × maaltijden), vandaag in inkt, toevoegen per vak |
| Weekmenu mobiel | Ongewijzigd (één dag tegelijk) | Bewust behouden: rustig voor persona A |
| Kleur | Salie + terracotta | + **inktgroen** (`--inkt`) voor banden en actieve navigatie; diepere flessengroene hoofdkleur |

## 4. Bestaande functies: waar zitten ze nu? (niets verwijderd)
| Functie | Waar nu |
|---------|---------|
| Knop "Toevoegen" op Recepten | "Nieuw" (overal) → Recept toevoegen |
| "Per dag / Hele week" op desktop | Vervangen door het weekraster (op mobiel behouden) |
| Dag-tabs op desktop | Kolommen van het raster |
| Tab "Overzicht" (beschrijving, score, bron, snel aanpassen, foto vervangen) | Beschrijving bovenaan; score/bron/aanpassen/foto's in "Jouw recept" |
| Tabs "Ingrediënten", "Bereiding" | Altijd zichtbaar |
| Tab "Voeding" | Uitklapbaar blok "Voedingswaarden" |
| Tweede porties-keuze bovenaan het recept | Eén keuze bij de ingrediënten (dubbel verwijderd) |
| Tweede lijstknop bij ingrediënten | Eén knop bij de acties bovenaan (dubbel verwijderd) |
| Zijbalk-menu (desktop) | Topbalk; Voorraad nu hoofdbestemming |
| Meer (profiel, gezin, instellingen, klantenkaarten…) | "Meer" rechtsboven (met tekst) |
| Actiemenu per geplande maaltijd | Zelfde menu (gedeelde code) in lijst én raster |

## 5. Gesimuleerde persona-walkthroughs
**Gesimuleerd** met geautomatiseerde browsertests (`tests/e2e/personas.spec.ts`). Er hebben **geen echte deelnemers** getest. "Stappen" = tikken of typen tot het resultaat in de (nep)database staat.

**Persona A — moeder van 70, telefoon 390 px**
| # | Taak | Gelukt | Stappen | Opmerking |
|---|------|--------|---------|-----------|
| A1 | Recept vinden | ✅ | 3 | Recepten → typen → tikken |
| A2 | Als favoriet bewaren | ✅ | +1 | Hartje bij de titel |
| A3 | Op een dag inplannen | ✅ | 2 | "Inplannen" → "Zet in planning" (vandaag en avondeten staan klaar) |
| A4 | Lijst openen en afvinken | ✅ | 2 | Tab "Lijst" → vakje |
| A5 | Voorraad vinden | ✅ | 2 | "Nieuw" → "Iets in de voorraad" |
| A6 | Koken + timer zetten | ✅ | 8 | Vandaag → **Start koken** (opent meteen de kookstand) → Begin → 5× Volgende → Timer |
| A7 | Vergissing herstellen | ✅ | 2 | Verwijderen → "Ongedaan maken" |

**Persona B — foodcreator van 20, desktop 1280 px**
| # | Taak | Gelukt | Stappen | Opmerking |
|---|------|--------|---------|-----------|
| B1 | Bij recept-import komen | ✅ | 2 | Nieuw → Recept toevoegen → "Link plakken" staat klaar. Echt inlezen vraagt AI, en die staat in de demo uit. |
| B2 | Collecties gebruiken | ✅ | 2 | Recepten → "Snel klaar" |
| B3 | Andere creators ontdekken | ❌ niet gebouwd | — | Fase 3 (creatorprofielen, volgen) |
| B4 | Recept delen | ✅ | 1 | "Delen" (link gekopieerd, of het deelmenu van het toestel) |
| B5 | Weekmenu opbouwen | ✅ | 4 | Weekmenu → vak "ontbijt" → recept → "Nee, bedankt" |
| B6 | Premium-creatorfuncties begrijpen | ❌ niet gebouwd | — | Fase 3–4; alleen architectuur gedocumenteerd |
| B7 | Eigen food-identiteit tonen | ❌ niet gebouwd | — | Creatorprofiel ontbreekt |

**Gevonden en opgelost dankzij de walkthroughs**
- Nep-Supabase crashte op zoektermen met `%` (de demo kon daardoor stoppen).
- Kookstand: voortgang werd pas gewist na het bewaren van de score via het netwerk (race).
- Plankiezer: standaarddatum was UTC ("gisteren" tussen middernacht en 1-2 u); idem in boodschappen en vrienden.
- Stappen: "2,5 uur" werd "2, 5 uur" en "18:30" werd "18: 30".
- Recepten: titel brak af als "Recepte / n" op 390 px; collectiestrook startte verschoven.
- Axe-meting gaf vals contrastalarm tijdens het invliegen van een melding (test wacht nu op animaties).

## 6. Bekende beperkingen
- Creatorprofielen, volgen, collecties door gebruikers zelf gemaakt, premium-inhoud: nog niet gebouwd.
- Onboarding (`/welkom`), gezin/vrienden, instellingen, boodschappen en voorraad: nieuwe navigatie en tokens, maar nog geen eigen redactioneel herontwerp.
- Weekmenu: verslepen tussen dagen nog niet (verplaatsen gaat via het actiemenu).
- Demo: 2 echte foto's (CC0); de rest toont omslagen. AI en realtime staan uit.
- Niet getest: Safari/WebKit, echte VoiceOver/TalkBack, echte Supabase/RLS.
