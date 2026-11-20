# Audit tegenover de mastervisie (2026-11-18, bijgewerkt 2026-11-20 na P6, fase 3 en fase 4; branch claude/sleepy-euler-eghoc3)

Gemeten in de code, niet uit documenten. "Werkt" = de handeling bewaart en is getest met E2E tegen de nep-databank.

## 1. Wat er is en hoe ver
| Domein | Stand | Bewijs in de code |
|---|---|---|
| Wijziging maaltijd → lijst | **Werkt**: menu + lijst in één actie, half-mislukt wordt teruggedraaid, één keer ongedaan maken | `kringloop-db.ts` `wijzigMenu`, `planVervang/planVerplaats/planWeg` |
| Kosten/budget na wijziging | **Werkt** (P1/P2): herberekend na elke wijziging; budget stuurt "Stel mijn week samen" en "Maak je week goedkoper"; geschiedenis per week (voorstel 0014, demo tot migratie) | `budget.ts`, `planner/engine.ts`, kwaliteit-20 test 15/16 |
| Veiligheid (allergie/dieet, wie eet mee) | **Werkt** overal gelijk; hard/zacht; privacy van redenen | `veiligheid.ts`, `gezin-veiligheid.ts`, `voorstel-eters.ts` |
| Voorstellen (vanavond, vul aan, weekvoorstel) | **Werkt**, met redenen, "niet nu", restjes, gebruik-eerst, seizoen, weer | `intelligentie/*` |
| Ingrediënten | **Werkt (P2)**: synoniemen als data, omrekening (stuk↔g alleen met gekend stukgewicht), optellen, gangbare verpakking, nodig/in huis/te kopen op lijst en Slim aanvullen | `src/lib/ingredient/` |
| Voorraad | **Werkt**: 3 niveaus (P1); basisvoorraad = "heb je meestal", niet op de lijst (P2) | `planner/profiel.ts`, `kringloop.ts` |
| Recepten, import, editor, kookstand, assistent | **Werkt**; fase 2 (alle bronnen, video, delen) is in bouw | RecipeForm, kookstand, `assistent/*` |
| Gezin, realtime | **Werkt**: realtime op planner, lijst, gezin | `postgres_changes` in 3 schermen |
| Makers, community, partners, premium | **Werkt in demo**, live na migraties 0008/0011/0012 (+ 0021 voor fase 4) | eigen routes |
| Feed "Volgend", videorecepten van makers (fase 4) | **Gebouwd**: feed op Ontdek + melding bij de bel; video-link met tijden per stap | fase4-makers.spec, makers-feed.test, video-tijden.test |
| Maker-abonnement (fase 4) | **Gebouwd in TESTMODUS**: plan, exclusieve recepten/collecties via heeftRecht, abonneren/opzeggen met testterugbetaling, btw als tekst; geen provider, geen echte betaling | fase4-makers.spec, maker-abonnement.test, tests/rls/makers-abonnement.mjs |
| Community (fase 4) | **Gebouwd**: reacties, "Ik heb het gemaakt" met foto, melden → moderatie (met foto), blokkeren; voorstel 0021 | fase4-community.spec, community.test |
| Keukenapparatuur | **Gebouwd (P1)**: Mijn keuken (oven, airfryer …), voorstellen houden er rekening mee; op het account na migratie 0013 | `mijn-keuken.tsx`, slimme-planner.spec |
| Kookervaring (beginner/ervaren) | **Gebouwd (P1)** in het planprofiel en de engine | `planner/profiel.ts`, `engine.ts` |
| Weekcontext per dag (weinig tijd, niet thuis, feestelijk, restjesdag) | **Gebouwd (P1)** in "Stel je week samen" | slimme-planner.spec, kwaliteit-20 test 1 |
| Alternatieven "goedkoper / sneller / past beter" | **Gebouwd (P1)**: per dag in het voorstel + "Maak je week goedkoper" | slimme-planner.spec, kwaliteit-20 test 16 |
| Menu genereren met budget als stuurfactor | **Gebouwd (P1)** (schatting, vaste richtprijzen) | `engine.ts` |
| Ontbijt/lunch/tussendoor plannen | **Werkt** voor ontbijt/middag/avond (momentfilter in de engine, BUG-159); tussendoortjes niet apart | `engine.ts` |
| Meerdere weken vooruit genereren | **Gedeeltelijk**: engine rekent per 7 dagen; scherm plant week per week | `engine.ts` |
| Na het koken: restjes en voorraad bijwerken met bevestiging | **Gebouwd (P3)**: "Klaar met koken" met restjes en voorraad op vraag (BUG-157) | na-het-koken.spec, restjes.spec |
| Assistent die acties op planning/lijst voorstelt en na bevestiging uitvoert | **Gebouwd (P4)**: /assistent met "Doe maar" en ongedaan maken, zonder AI (regels/testmodus) | week-assistent.spec |
| Proactieve suggesties met aan/uit per soort | **Gebouwd (P4)**: Instellingen › Suggesties (voorstel 0016) | suggesties.spec |
| Gelijktijdige wijzigingen: waarschuwen i.p.v. overschrijven | **Gebouwd (P5, 2026-11-19)**: inhoudscontrole vlak vóór het schrijven (weekmenu via `wijzigMenu`, lijst-item), keuze "Houd die van Jan / Zet de mijne / Bekijk allebei", één ongedaan maken; aanwezigheid "Jan is de lijst aan het bewerken" | samenwerking.spec, conflict.test |
| Offline (Week, Lijst, Vandaag) | **Gebouwd (P6)**: melding op elk scherm, laatst bekende gegevens ook na herladen, wachtrij voor afvinken en toevoegen, eerlijke melding bij herstel | `offline-cache.ts`, `OfflineBand.tsx`, kwaliteit-20 test 20 |
| De 20 verplichte testen | **Gebouwd (P6)**: `kwaliteit-20.spec.ts`, elk met controle in de nep-databank; 5 projecten (telefoon, desktop, 360, 768, groot + Extra duidelijk) | kwaliteit-20.spec |
| Restjes op het account, verspilling, assistent (fase 3) | **Gebouwd**: account + gezin (voorstel 0019, tot dan toestel), opgegeten/weggegooid, overzicht per maand, "wat kan ik met mijn restjes?" | fase3-keuken.spec, tests/rls/restjes.mjs |
| Voorraadscherm, "Heb ik al", Klaar met winkelen met vinkjes (fase 3) | **Gebouwd**: zoeken, plek (0020, tot dan toestel), aanpassen, bijna op → lijst, fout/offline; "Na het winkelen" altijd/vragen/nooit | fase3-beheer.spec |
| Collecties beheren (fase 3) | **Gebouwd**: maken, Ontdek → Bewaar in, herschikken (pijlen/slepen/toetsenbord), eruit + ongedaan, delen als openbaar, inplannen via assistent met veiligheid | fase3-beheer.spec, acties.test |
| Echte prijzen, echte winkels, echt weer | **Extern** (testadapters, duidelijk gelabeld) | `supermarkt/`, `weer.ts` |

**Dubbel (opgelost in P2):** `kostrem.ts` bleek een AI-kostenrem, geen prijsschatter; de echte dubbeling zat tussen budgetkaart en planner (andere schaalregel). Nu één bron: `budget.ts`, ook voor lijst en winkelmodus; budgetgeschiedenis per week (voorstel 0014).

## 2. De A-tot-Z-stroom, als scenario
**Gezin Peeters**: Marie en Jan, Lotte (12, notenallergie, deelt het niet), opa Gust (vegetarisch, woensdag en zondag). Weekbudget € 120, winkel "testwinkel", Marie heeft door de week 30 minuten, dinsdag is niemand thuis, vrijdag mag het feestelijk, er staat nog pompoen en halve room in de koelkast, er is een oven en een airfryer, geen slowcooker.

1. **Kennismaking (2 min, overslaan mag)**: naam, gezin (4), wie heeft allergieën (hard), wie eet vegetarisch (dieet), wat lust je niet (zacht), apparaten (vinkjes), budget (optioneel), voorraad: "niet bijhouden / alleen basis / alles". Niets is verplicht; alles later aan te vullen in Instellingen › Jouw Foodlo.
2. **"Wat eten we deze week?"** op Vandaag of Week → **Weekcontext** (één scherm): per dag wie eet mee (standaard het gezin; Gust wo + zo), snel-chips "Weinig tijd", "Niet thuis", "Feestelijk", "Restjes". Budget en winkel staan er al ingevuld.
3. **Engine** (vaste logica, geen AI): harde filters (allergie, dieet per eter, apparaat, tijd) → kandidaten → score (smaak, seizoen, voorraad en restjes eerst, variatie over de week, overlap van ingrediënten, kost t.o.v. budget) → porties per maaltijd uit het aantal eters → kost per dag en week → controle tegen budget. Uitkomst: per dag één gerecht met "Waarom" (bv. "gebruikt je pompoen", "klaar in 25 min", "past voor Gust").
4. **Nakijken**: per dag "Goedkoper / Sneller / Past beter" (alle drie door dezelfde veiligheidscontrole); "Bewaar dit menu". Bestaande maaltijden worden niet overschreven zonder vraag.
5. **Boodschappen**: één actie zet het tekort op de lijst: behoefte (uit porties) − voorraad (alleen wat geregistreerd is) = te kopen, met een voorgestelde verpakking ("1 zak 500 g; je hebt 350 g nodig"). Per afdeling, per recept of samen. Kost: "schatting" of "winkelprijs" (alleen bij een echte bron).
6. **Wijziging woensdag** (pasta → ovenschotel): `wijzigMenu` past menu, porties, lijst en kost tegelijk aan; melding "lijst: 3 erbij, 2 eraf · week € 4 duurder" met Ongedaan maken.
7. **Winkelen**: winkelmodus per afdeling, afvinken realtime gedeeld; na "Klaar met winkelen" vraagt Foodlo (volgens instelling) of gekochte producten in de voorraad mogen.
8. **Koken**: kookstand met waarschuwing voor wie meeeet, timers, assistent; na "Klaar": "Bleef er iets over?" → restje met bewaardatum (geen veiligheidsbelofte) → komt terug in voorstellen. *Stand P3 (marathon): gebouwd — "Klaar met koken" (ook via "Gekookt" op Vandaag/Week), restje met richtwaarde, voorraad bijwerken na bevestiging, notitie, "Gebruik eerst"-kaart; gekookt/notities op het account na voorstel 0015.*
9. **Leren**: sterren, "niet nu", "niet voor mij" sturen de volgende voorstellen; alles zichtbaar en uit te zetten. *Stand P3: sterren, "Niet nu" en "Niet voor mij" op het Klaar-scherm (laatste twee nog op het toestel tot 0006); receptversies bewaren het origineel bij elke aanpassing.*
**Fouten/ontbrekend**: geen recepten genoeg → zeg welke filter het krapst is en bied versoepelen aan (nooit allergie); geen prijs → "prijs onbekend", niet meetellen als € 0; geen netwerk → laatst bekende planning en lijst, wijzigingen in de wachtrij.

## 3. Bouwvolgorde (na fase 2 "recepten alle bronnen")
- **P1 Slimme planner**: profiel-uitbreiding (apparaten, kookervaring, voorraadniveau), weekcontext per dag, centrale generator `src/lib/planner/` (één engine voor vanavond, vul aan, weekvoorstel), alternatieven goedkoper/sneller/past beter, budget als stuurfactor, porties uit eters, variatie, meerdere weken, ontbijt/lunch optioneel.
- **P2 Ingrediënten & lijst**: synoniemen, eenheden-omrekening, verpakkingsmaten, behoefte/voorraad/te kopen apart, één kostenbron (kostrem + budget samen), budget op account + geschiedenis, basisvoorraad.
- **P3 Na het koken**: restjes en voorraad bijwerken met bevestiging, receptversies (origineel bewaard bij aanpassen).
- **P4 Assistent met acties**: "Maak mijn week goedkoper", "Vervang woensdag", "Ik heb morgen 15 min" → voorstel met verschillen → bevestigen → uitvoeren via wijzigMenu; regels eerst, AI optioneel; proactieve suggesties met één instellingenpagina. **Gebouwd (2026-11-19)**: `/assistent` (opdrachten zonder AI, voorstel met verschillen, Doe maar/Nee, één ongedaan maken), Instellingen › Suggesties (voorstel 0016, niet uitgevoerd), hooguit één kaart op Vandaag, "Laat Foodlo kiezen" via de engine. Open: echte AI-terugval (alleen testmodus), migratie 0016.
- **P5 Samenwerking**: conflictmelding bij gelijktijdige wijziging, lijst verdelen, meldingen. **Gebouwd (2026-11-19)**: conflictkeuze in gezinsweekmenu en eigen menu (via `wijzigMenu`) en bij een lijst-item; gezinslijst verdelen (wie haalt wat, winkel, "Mijn deel", winkelmodus, rollen kijker/kind); bel met meldingen in de app (gezin, toegewezen, klaar met winkelen, restje, conflict), per soort aan/uit in Instellingen › Suggesties en meldingen; "Wie veranderde wat" op Week (gezin). Voorstel 0017 (niet uitgevoerd) + tests/rls/samenwerking.mjs. Open: migratie 0017, aanwezigheid alleen echt te testen met Supabase Realtime (niet in de nep-databank), geen push naar buiten.
- **P6 Kwaliteit**: de 20 verplichte tests als één E2E-reeks, schermen voor/na, toegankelijkheid, offline.
- **Fase 4 (2026-11-20)**: gebouwd zoals hierboven; voorstel 0021 niet uitgevoerd. Open: account-opruimen voor community-foto's (BUG-179), ingeplande exclusieve recepten na opzeggen (BUG-180), echte betaalprovider pas na G5.
- **Daarna** fases 3–9 uit FASES.md (keuken/collecties, creators/video, BCC, premium, privacy, afwerking).
