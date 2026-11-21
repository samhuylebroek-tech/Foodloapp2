# Ontwerpen van de nog niet gebouwde modules

Stand: 2026-11-14 (ronde 3).

**Wat dit document is.** Dit is de bron van waarheid voor de UX, de werking, de afhankelijkheden en de planning van elke module die nog niet in code bestaat.

**Waarom dit document bestaat.** De eigenaar vroeg dat deze onderdelen "niet verdwijnen of gereduceerd worden tot alleen documentatie". Elke module hieronder heeft daarom drie dingen:
- een bouwplan in rondes, opgenomen in `DEVELOPMENT_ROADMAP.md`;
- acceptatiecriteria waarop we kunnen testen;
- een eerste zichtbare stap die we kunnen bouwen zodra de voorwaarden vervuld zijn.

**Wat altijd geldt.** Overal gelden het designsysteem (`docs/foodloapp-v2/DESIGNSYSTEEM.md`) en de regels AC-1 tot AC-7 uit `FUNCTIONAL_REQUIREMENTS.md`:
- grote tekst;
- woorden bij knoppen;
- één hoofdactie;
- AI alleen via de privacylaag;
- allergieën zijn harde regels.

| # | Module | Fase | Eerste zichtbare stap | Wacht op |
|---|---|---|---|---|
| 1 | Persoonlijke voeding op het account | F1 | Instellingen › "Mijn allergieën en voorkeuren" | Akkoord op de opzet van 0004b (N-1), staging |
| 2 | Native meldingen | F1 (aanbevolen) | Toestemmingsscherm na de eerste geplande week | #18/#23, iOS-project, sleutels FCM/APNs (eigenaar) |
| 3 | Eigen verzamelingen | F2 | "Bewaar in…" op het recept | Migratie collecties (G1/G2) |
| 4 | Gezin: allergieën per lid, mee-eters | F2 | "Wie eet mee?" bij inplannen | 0004, 0004b, ontwerp 0005, #7, #30 |
| 5 | Creators en foodinfluencers | F2 | Creatorprofiel en publieke receptpagina | Moderatie (C1), migraties creators, #28 |
| 6 | Community | F2 | "Ik heb dit gekookt" met foto | Creators C1–C4, moderatie |
| 7 | Assistent: gesprek, substituties, aanpassen, agents | F2 | "Vervang een ingrediënt" op het recept | Privacylaag ✅, AI-budget #19, #10 |
| 8 | Lokale producten, weer, budget | F2 | Weerreden in "Waarom nu" | #15/#16 (weer), #21 (budget) |
| 9 | Supermarktintegratie (uitbreiding) | F2/F3 | Producten per winkel in de winkelmodus | Partnerafspraken, F3-BCC |
| 10 | Business Control Center voor partners en merken | F3 | Partnerportaal (apart), alleen lezen | F2-creators, juridisch kader, #32 |
| 11 | Premium en verdienmodellen | F3 | Prijzenpagina zonder betalen ("binnenkort") | G5, B5 (#29), jurist |

---

## 1. Persoonlijke voeding op het account (F1)
**Waarom:**
- Allergieën en dieet staan nu alleen op het toestel. Op een tweede toestel weet Foodlo ze niet.
- Optie B (D-2026-11-13-1) zet dit in F1.

**UX:**
```
Instellingen › Maaltijden › Mijn allergieën en voorkeuren
┌──────────────────────────────────────────┐
│ Mijn allergieën en voorkeuren            │
│ Alleen voor jou. Nooit naar de AI,        │
│ nooit zichtbaar voor je gezin.            │
│ Allergieën   [Gluten] [Noten] [+ meer]    │  ← grote keuzeknoppen (14 EU-allergenen)
│ Intoleranties [Lactose] [Fructose] …      │
│ Dieet        (•) Geen  ( ) Vegetarisch …  │
│ Liever niet  [bloemkool ×] [+ toevoegen]  │  ← korte termen, geen vrije lap tekst
│ [ Bewaren ]                               │
└──────────────────────────────────────────┘
```

**Toestemming:**
- Eerst de vraag "Mogen we dit bewaren op je account?". Ja bewaart, Nee houdt het op het toestel, zoals nu.
- De toestemming staat bovenaan, met de datum.

**Migratie:**
- Bij de eerste keer haalt de app de bestaande toestelgegevens op, na toestemming.
- Er staat een melding bij met "Ongedaan maken".

**Werking:**
- De veiligheidsregels (`veiligheid.ts`) lezen deze gegevens, op het toestel en op de server.
- AI-aanroepen gaan door `voorAI()`; deze velden zitten er nooit in.

**Acceptatie:**
1. Allergie gezet op toestel A → waarschuwing op toestel B.
2. Een gezinslid of vriend kan het niet lezen (RLS-test).
3. Export bevat de gegevens, verwijderen wist ze.
4. Een E2E onderschept de AI-aanvragen en vindt geen allergeenterm.

**Data:** tabel `persoonlijke_voeding` (DATABASE_ARCHITECTURE §4, voorstel 0004b).

**Planning:**
- Ronde 4: app en tests tegen de nep-databank.
- Staging: migratie heen en terug.
- Productie: met akkoord.

**Inschatting:** ± 3 dagen werk na akkoord.

## 2. Native meldingen (F1, aanbevolen)
**Waarom:**
- Een dagelijkse gewoonte ("Begin om 15:40").
- Het helpt bij Apple-richtlijn 4.2.
- Web push werkt al; native push ontbreekt.

**UX:**
- Na de eerste geplande week verschijnt één scherm: "Zal Foodlo je herinneren wanneer je moet beginnen met koken? Hooguit één melding per dag." De knoppen zijn "Ja, graag" en "Nu niet".
- In Instellingen › Meldingen kies je per soort (koken, boodschappen, weekmenu) en een stil uur.
- Een melding opent het juiste scherm (deep link).

**Werking:**
- Plug-in `@capacitor/push-notifications` (pakket toevoegen = wijziging van `bun.lock`, zie §Installatie).
- Het token gaat naar `push_subscriptions` met het platform (`web`, `ios`, `android`).
- De bestaande cron (`api/public/meldingen.run.ts`) verstuurt via FCM (Android) en APNs (iOS), achter dezelfde verzendfunctie als web push.

**Acceptatie:**
1. Opt-in: niets zonder ja.
2. Hooguit één melding per dag.
3. Uitzetten werkt meteen.
4. Een tik opent het juiste scherm.
5. Getest op 2 iPhones en 2 Android-toestellen.

**Afhankelijkheden:**
- iOS-project (M1);
- Firebase- en Apple-sleutels (eigenaar, geheim, nooit in de code);
- `#18`, `#23`;
- migratie: een kolom `platform` (G1).

**Planning:** ronde 5, na het iOS-project.

**Inschatting:** ± 3–4 dagen plus de toesteltest.

**Installatie:** een nieuw pakket vraagt een nieuwe `bun.lock`. Dat doe ik op een eigen commit en de eigenaar keurt goed, want Lovable leest `bun.lock`.

## 3. Eigen verzamelingen (F2)
**UX:**
- Op het recept staat de knop "Bewaar in…". In het blad dat opent, vink je verzamelingen aan of maak je er een nieuwe, bijvoorbeeld "Zondag", "Kinderen" of "Kerst".
- In Keuken › Recepten staan de verzamelingen als rij met kaarten. De omslag is een collage of typografisch (designsysteem §5.1).
- Een verzameling kan je delen met een vriend of je gezin (alleen lezen of samen).

**Acceptatie:**
1. Een recept kan in meerdere verzamelingen zitten.
2. Een verzameling verwijderen laat de recepten staan (met "Ongedaan maken").
3. Werkt bij 200 % tekst.

**Data:** `collections` en `collection_recipes`. Die zijn ook herbruikbaar voor creatorcollecties (§5).

**Planning:** F2-ronde 1.

**Inschatting:** ± 3 dagen.

## 4. Gezin: allergieën per lid, mee-eters, uitgebreide planning (F2)
**UX:**
```
Inplannen: "Wie eet mee?"  [Marie ✓] [Jan ✓] [Lotte ✓] [Gast +1]
Recept:    ⚠ "Niet veilig voor Lotte" (zonder te zeggen waarom, tenzij Lotte dat toestaat)
Week:      kleine gezichtjes per maaltijd; "Jan eet woensdag niet mee"
```
- Elk lid beheert zijn eigen voeding (zoals §1). Kinderen zonder account beheert de ouder.
- Wie plant, ziet alleen of het veilig is, niet welke allergie, tenzij het lid "delen met mijn gezin" aanzette.
- Porties volgen automatisch het aantal mee-eters.

**Acceptatie:**
1. Een gerecht met een allergeen van een mee-eter krijgt een waarschuwing en wordt nooit voorgesteld.
2. Een lid ziet de reden van een ander niet zonder toestemming.
3. De kringloop (de lijst die meebeweegt) werkt ook voor het gezinsplan.

**Data:** 0005 (alleen opzet, DATABASE_ARCHITECTURE §5). **Niet aanmaken zonder akkoord.**

**Afhankelijkheden:** 0004, 0004b, #7, #30 (één huishoudmodel in plaats van gezin plus vrienden).

**Planning:** F2-ronde 2.

**Inschatting:** ± 6–8 dagen.

## 5. Creators en foodinfluencers (F2)
**UX:**
- **Profiel `/@naam`:**
  - omslagbeeld, profielfoto, naam, specialisaties;
  - knoppen "Volgen" en "Delen";
  - tabbladen Recepten, Collecties, Video's.
- **Publiceren:** in de editor een stap "Zichtbaarheid": Privé · Vrienden en gezin · Openbaar (later: Volgers · Abonnees). Daarbij een voorbeeld van de publieke pagina (zoals de voorbeeldweergave uit ronde 3).
- **Contentbeheer (`/maker`):**
  - lijst met de status per recept: concept, gepland, gepubliceerd;
  - statistieken: bekeken, bewaard, gekookt;
  - meldingen van de moderatie.
- **Video's:** korte kookvideo's of een link (YouTube, TikTok) per recept of per stap. Eigen opslag pas na een kostenraming.
- **In Ontdek:** de rij "Van makers die je volgt". De bronregel wordt de echte maker in plaats van "Foodlo-keuken".

**Acceptatie:**
1. Niets wordt openbaar zonder uitdrukkelijke keuze en moderatie.
2. Allergie- en dieetregels gelden ook voor creatorrecepten.
3. Een maker ziet alleen geaggregeerde cijfers.

**Data:** `creators`, kolom `zichtbaarheid` op `recipes`, `follows`, `content_reports`, `recept_statistiek` (ARCHITECTUUR-VOORSTELLEN §3).

**Volgorde:**
1. C1 moderatie;
2. C2 profiel;
3. C3 zichtbaarheid;
4. C4 publiceren;
5. C5 volgen en feed;
6. C6 collecties (= §3);
7. C7 statistieken;
8. C8 bronvermelding.

**Inschatting:** ± 4–6 weken voor C1–C8.

## 6. Community (F2)
**UX:**
- Op een openbaar recept staat "Ik heb dit gekookt": een foto, sterren en één zin.
- Daaronder komt een rustige rij "Zo kookten anderen het".
- Je kan de maker een vraag stellen.
- Er zijn meldknoppen voor ongepaste inhoud. De moderatiewachtrij zit in het Control Center.

**Grenzen:**
- geen tijdlijn met eindeloos scrollen;
- geen ranglijsten die mensen onder druk zetten;
- de "gezien"-teller is privé.

**Acceptatie:**
1. Elke bijdrage is te melden.
2. Moderatie binnen de afgesproken termijn (DSA).
3. Een bijdrage verwijderen kan zelf, met "Ongedaan maken".

**Afhankelijkheden:** creators C1–C4.

**Inschatting:** ± 2–3 weken.

## 7. Assistent: gesprek, substituties, aanpassen, agents (F2)
**UX:**
- **Op het recept (eerste stap):**
  - "Vervang een ingrediënt": tik op een ingrediënt en kies uit voorstellen met reden, bijvoorbeeld "room → Griekse yoghurt (lichter)";
  - "Pas aan": "vegetarisch", "sneller", "voor 2 personen".
  - Het resultaat is altijd een voorstel om na te kijken (AC-6), nooit een stille wijziging.
- **Gesprek:** een knop "Vraag het Foodlo" op Vandaag en het recept. De korte antwoorden bevatten acties ("Zet op mijn lijst"). Hooguit een vast aantal vragen per dag (#10).
- **Agents:** voorbeelden zijn "Plan mijn week en vul mijn lijst aan" en "Kook op wat er nog in huis is". Een agent stelt een stappenplan voor en de gebruiker keurt elke stap goed.

**Werking:**
1. Eerst regels: een vervangingslijst, zoals de winkelmodus die al heeft.
2. Daarna AI via `voorAI()` en `metCredits`.
3. De substitutie wordt achteraf op het toestel getoetst aan de allergieën.

**Acceptatie:**
1. Geen allergeen of dieetfout in een substitutie.
2. Een E2E-test zonder AI toont de terugval op regels.
3. Elke actie van een agent is terug te draaien.

**Afhankelijkheden:** privacylaag ✅, AI-budget (#19), #10.

**Inschatting:** substituties ± 1 week; gesprek ± 2 weken; agents daarna.

## 8. Lokale producten, weer en budget (F2)
**Lokaal:** de bestaande seizoenskalender (`seizoen-producten.ts`) wordt uitgebreid met "uit België / de buurt". In "Waarom nu" verschijnt dat als reden "Belgisch seizoensproduct".

**Weer:**
- Een serverproxy vraagt het weer op per gemeente, zonder GPS (#16).
- De motor heeft het weersignaal al.
- In "Waarom nu" staat dan bijvoorbeeld "Koud en nat: iets warms".
- Licentie: Open-Meteo, commercieel (#15).

**Budget:**
- In Instellingen › Maaltijden kies je €, €€ of €€€.
- Voorstellen en Week houden er rekening mee.
- Er is geen prijs-API (#21). De prijsindicatie per recept vul je zelf in of wordt geschat.

**Acceptatie:**
1. Zonder weer of budget werkt alles zoals nu.
2. De reden staat er altijd bij.

**Inschatting:** weer ± 2 dagen na de licentie; budget ± 3 dagen.

## 9. Supermarktintegratie, uitbreiding (F2/F3)
**Behouden:** winkelvolgorde, afdelingen, klantenkaarten en de winkelmodus (bestaan al).

**UX (F2):** in de winkelmodus komt een keuze "In welke winkel?". De afdelingsvolgorde volgt dan per winkel (BUG-087, nu per toestel).

**UX (F3):**
- productvoorstellen per ingrediënt van partners, duidelijk gelabeld (COMMERCIAL_ROADMAP §1);
- later bestellen via een partner (afrekenen gebeurt bij de partner, niet bij Foodlo).

**Architectuur:** een `WinkelAanbieder`-adapter, zodat nieuwe winkels geen code in de schermen vragen.

**Afhankelijkheden:** partnerafspraken, F3-BCC.

## 10. Business Control Center voor partners en merken (F3)
**UX:**
- Een **apart portaal** (`/partner`, eigen shell en kleuraccent) voor merken, producenten, retail en restaurants.
- Tabbladen: Overzicht, Producten, Campagnes, Gesponsorde recepten, Rapportage, Team.
- De rapportage toont alleen geaggregeerde cijfers, nooit individuele gebruikers.

**Consumentenkant:** gesponsorde inhoud heeft altijd het label "Gesponsord" of "In samenwerking met …". Er zijn vaste, gelabelde plekken en geen verborgen sturing (COMMERCIAL_ROADMAP §1).

**Acceptatie:**
1. Een partner ziet nooit persoonsgegevens.
2. Allergieregels gelden ook voor gesponsorde recepten.
3. Rollen per organisatie.

**Afhankelijkheden:** creators (F2), juridisch kader, #32. Het team-Control Center bestaat al en blijft apart.

## 11. Premium en verdienmodellen (F3)
**UX:**
- Een prijzenpagina met "Gratis" en "Premium", eerst met "binnenkort" en zonder betalen.
- Later betaal je met een gehoste checkout van de provider.
- Annuleren kan in 2 tikken, in Instellingen › Account.

**Modellen:**
- premium (meer AI-hulp, onbeperkt recepten, extra functies);
- creatorabonnementen en premium collecties;
- creditpakketten.

**Werking:** zie COMMERCIAL_ROADMAP §4:
- de server beslist over toegang (`entitlements`);
- de betaalpoort op de server bestaat al (BUG-143).

**Afhankelijkheden:** G5, B5 (#29), jurist (herroeping, btw/OSS, DAC7).

**Eerste veilige stap:** de prijzenpagina zonder betaalknop, om de interesse te meten.
