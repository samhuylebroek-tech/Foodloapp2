# Foodloapp V2 — Designsysteem (mobile-first)

Stand 2026-11-09. Dit document is bindend voor elk nieuw of herwerkt scherm. Regels die in code afgedwongen worden, staan erbij met hun bestand.

## 1. Principes
1. **Telefoon eerst.** Elk scherm wordt ontworpen op 390 px en gecontroleerd op 320 px. Tablet en desktop krijgen daarna een eigen indeling; ze zijn geen vergrote telefoon.
2. **Eén taak per scherm, de inhoud bovenaan.** De dagelijkse taak (de lijst, de dag, de stap) staat boven de vouw. Hulpmiddelen staan erna of in "…".
3. **De inhoud bepaalt de vorm.** Tekst krimpt niet om een fout te verbergen. Kaders groeien mee. Afkappen mag alleen bewust, met de volledige tekst één tik verder (zie §4).
4. **Duim en zicht.** De hoofdactie staat binnen duimbereik (onderaan of in de kop). Aanraakdoelen zijn ≥ 48 px; ≥ 44 px is de ondergrens.
5. **Alles met woorden.** Een pictogram zonder tekst mag alleen in de kop en in rijen waar het label al ernaast staat, en altijd met `aria-label`.
6. **Elke actie is terug te draaien.** Een melding met "Ongedaan maken" in plaats van een bevestigingsvraag, behalve bij echt onomkeerbare acties.

## 2. Breekpunten en indelingen
| Breedte | Indeling | Navigatie |
|---|---|---|
| < 400 px | Smalle telefoon: kopknoppen alleen met pictogram (met `aria-label`) | Onderbalk |
| 400–767 px | Telefoon | Onderbalk (5 plekken, altijd met tekst) |
| 768–1023 px | Tablet | Zijbalk (5 plekken met tekst) |
| 1024–1279 px | Kleine laptop / liggende tablet: weekmenu als week\|dag (`useTablet`) | Hoofdmenu bovenaan |
| ≥ 1280 px | Desktop: weekraster met 7 kolommen, rasters met 6–7 kolommen | Hoofdmenu bovenaan |

Rasters met veel kolommen (weekraster, collecties, weekstrook) pas vanaf `xl` (1280 px). Op 1024 px kapten ze dagnamen en titels af (audit 2026-11-09).

## 3. Typografie (`src/styles.css`)
| Niveau | Gebruik | Regels |
|---|---|---|
| `text-paginatitel` | Eén per scherm (h1) | Vloeiend `clamp(1.8rem … 2.15rem)`; woordafbreking met koppelteken voor woorden ≥ 9 tekens; `text-wrap: balance` |
| `text-sectietitel` | Sectiekoppen (h2) | Zelfde afbreekregels |
| `text-heldentitel` | Uitgelichte titel (Nu-kaart, recept) | Vloeiend, met afbreking |
| `text-kaarttitel` | Kaarten | Met afbreking |
| Body 18 px (`html`) | Lopende tekst | Nooit kleiner dan 15,2 px (0,95rem) voor informatie |

- **Globaal:** `body { overflow-wrap: break-word }`. Een woord dat niet in zijn kader past, breekt in plaats van eruit te lopen. Gewone tekst verandert niet.
- **Verboden:** `break-all` en `overflow-wrap: anywhere` op lopende tekst (die breken ook korte woorden middenin), en tekst kleiner zetten om een lay-out te redden.

## 4. Afkappen
- **Mag**, met ellips en één regel:
  - een productnaam in een lijstrij (de volledige naam staat in "aanpassen" en in de winkelmodus);
  - een recepttitel in een compacte rij (de volledige titel staat op het recept);
  - een notitie onder een product.
- **Mag niet:**
  - knoppen: een knop groeit naar twee regels;
  - paginatitels;
  - foutmeldingen;
  - hoeveelheden;
  - tekst in de kookmodus.
- De audit meldt elke ellips als "afgekapt (ellips)", zodat bewust en onbewust zichtbaar blijven.

## 5. Componenten
| Component | Regel | Bestand |
|---|---|---|
| Knop | `min-h-14` (sm: `min-h-12`), afronding volledig, tekst mag naar twee regels (`whitespace-normal`, `leading-tight`). Eén gevulde hoofdknop per scherm | `components/ui/button.tsx` |
| Pictogramknop | 48 × 48 px, krimpt nooit (`shrink-0`) | idem |
| Kop (AppShell) | Links woordmerk of "Terug"; rechts "Nieuw" en "Meer". Onder 400 px alleen pictogrammen (met `aria-label`) | `components/AppShell.tsx` |
| Onderbalk | 5 plekken, pictogram en tekst, actieve plek in een donkere pil, veilige zone onderaan | idem |
| Zijbalk (tablet) | Zelfde 5 plekken, verticaal | idem |
| Paneel / kaart | `paneel`: afronding 1,25–1,5rem, rand en zachte schaduw; groeit met de inhoud (geen vaste hoogte) | `styles.css` |
| Onderblad (sheet) | Voor keuzes en details op de telefoon; titel als h2, sluiten met Escape en ✕, maximaal 90dvh met scroll | `components/ui/sheet.tsx` |
| Lijstrij | Tikbare rij ≥ 64 px: aanvinken links, tekst in het midden (één regel naam plus één subregel), actie rechts | Lijst, voorraad |
| Melding (toast) | Bovenaan, met "Ongedaan maken" waar mogelijk | `sonner` |
| Lege toestand | Pictogram, één zin, één actie. Nooit "Geen resultaten" zonder vervolgstap | `EmptyState` |
| Laden | Skeletten in de vorm van de inhoud, geen schermvullende spinner | `PageSkeleton` |

## 6. Ruimte en kleur
- **Ruimte:** schaal van 4 px. Binnen een kaart 16 px, tussen kaarten 12–20 px, tussen secties 40–48 px. Zijmarge 16 px op de telefoon, 24 px vanaf `sm`.
- **Kleur:** inkt (donkergroen) voor hoofdkaarten, honing als accent en voor "nu", primair groen voor acties. Een kleur betekent nooit iets alleen: er staat altijd tekst of een pictogram bij.

## 7. Wat de webapp kan en wat een native app pas zou oplossen
| Kan nu (web/PWA) | Pas native |
|---|---|
| Veilige zones (`env(safe-area-inset-*)`), onderbalk, onderbladen, scherm aan houden (Wake Lock, waar ondersteund), installeerbaar | Echte systeemovergangen tussen schermen, terugvegen van iOS met animatie, haptische feedback op iOS |
| Offline wachtrij voor afvinken | Betrouwbare achtergrondsynchronisatie, widgets, Siri/Assistent-snelkoppelingen |
| Pushmeldingen (Web Push, iOS ≥ 16.4 alleen als geïnstalleerde PWA) | Rijke meldingen met acties, kritieke timers in de kookmodus op een vergrendeld scherm |
| Camera via de browser | Snellere barcodescanner, volledig scherm zonder browserbalk in Safari |
