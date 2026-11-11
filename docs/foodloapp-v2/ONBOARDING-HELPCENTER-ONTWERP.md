# Smart Onboarding, Foodloapp Help Center en AI Content Manager: ontwerp

Stand 2026-11-11. **Ontwerp en roadmap. Er is niets gebouwd** dat een nieuwe tabel of een externe dienst vraagt. Dit is een vaste productvereiste (beslissing eigenaar, 2026-11-11).

**Harde regel:** AI publiceert **nooit** zelf iets als officiële uitleg. Alles wat AI maakt, is een **concept** tot een mens het controleert en publiceert. Elke publicatie komt in het beheerderslogboek.

## 1. Wat er al is (hergebruiken, niet opnieuw bouwen)
| Bestaat | Waar | Hergebruik |
|---|---|---|
| Rondleiding als laag over de echte app, 7 stappen (Vandaag, Week, Lijst, Keuken, Ontdek, Iets toevoegen, Meer) | `components/Rondleiding.tsx`, `lib/rondleiding.ts`, route `/rondleiding` | Basis voor Smart Onboarding |
| Rondleiding opnieuw starten vanuit Meer en Instellingen | `meer.tsx`, `instellingen.tsx` | "Opnieuw bekijken vanuit het profiel" bestaat al |
| Welkomstscherm (taal, kleuren, momenten) | `welkom.tsx` | Eerste stap van de introductie |
| Infopagina met teksten uit de databank, met `published`-vlag | `info.tsx`, tabel `site_content`, Beheer → Teksten | Voorbeeld van "alleen gepubliceerd is zichtbaar" |
| Feedback en support | `/feedback`, Beheer → Support | "Contact met support" |
| Gebruiksmetingen (`meet("kringloop.aangevuld")` …) | `lib/meten.ts` | Herkennen dat een oefening echt gedaan is |
| AI met maandbudget, rem en cache | Beheer → Kosten | Kosten van de assistent en de Content Manager begrenzen |
| Playwright met verzonnen demogegevens | `tests/e2e/` | Video's en schermafbeeldingen automatisch opnemen (§5) |

## 2. Smart Onboarding
**Doel:** een nieuwe gebruiker kookt in de eerste week minstens één keer met een gepland recept en een lijst. De kring: Vandaag → Week → Lijst → Koken.

**Verloop:**
1. **Welkom** (bestaat): taal, kleuren, momenten.
2. **Eén vraag: "Hoe ervaren ben je met kook-apps?"** Kies tussen "Nieuw hierin" en "Ik ken dit soort apps".
   - Beginners krijgen kleine stappen met oefeningen.
   - Ervaren gebruikers krijgen een korte rondgang en de oefeningen alleen als suggestie.
   - Je kan de keuze later wijzigen.
3. **Rondleiding per module**: dezelfde laag als nu, maar met **oefeningen** waarin je zelf de handeling doet.

| Module | Oefening | Herkend aan |
|---|---|---|
| Keuken | Een recept toevoegen (of het voorbeeldrecept bewaren) | recept aangemaakt |
| Week | Een gerecht op een dag zetten | `meal_plan`-rij |
| Lijst | "Zet op mijn lijst" en één product afvinken | `kringloop.aangevuld`, afgevinkt |
| Koken | De kookstand openen en één stap verder gaan | voortgang kookstand |
| Gezin (optioneel) | Iemand uitnodigen | uitnodiging verstuurd |

4. **Overslaan, pauzeren, hervatten:**
   - elke stap heeft "Later" en "Overslaan";
   - de voortgang wordt per account bewaard, dus ook op een ander toestel;
   - Vandaag toont een kleine kaart "Ga verder met de uitleg (2 van 5)", nooit een blokkerend venster.
5. **Opnieuw bekijken:** Instellingen → "Uitleg en rondleiding", per module of alles.
6. **Persoonlijke begeleiding:** tips op het juiste moment, gebaseerd op wat iemand nog níet deed. Bijvoorbeeld: na 3 dagen zonder weekmenu verschijnt op Vandaag "Plan je eerste avond?". Er gaat geen persoonlijke data naar AI.

**Veilig oefenen:** oefeningen gebruiken echte schermen. Elke actie heeft "Ongedaan maken", wat al bestaat in lijst en voorraad. Het voorbeeldrecept heet "Oefenrecept" en kan je met één tik verwijderen.

**Toegankelijk:**
- werkt met het toetsenbord en de schermlezer: focus naar de uitlegkaart, Escape sluit, focus terug (`useFocusTerug`);
- geen tijdslimiet;
- `prefers-reduced-motion` respecteren;
- tekst tot 200 %.

## 3. Foodloapp Help Center (`/hulp`)
**Opbouw:**
- **Zoekveld bovenaan.** Zoekt in titel, tekst en synoniemen, met hetzelfde tikfoutvriendelijke zoeken als bij recepten (BUG-100).
- **Categorieën per module:** Vandaag, Weekmenu, Boodschappen en winkel, Keuken en voorraad, Koken, Gezin en delen, Account en privacy, Problemen oplossen.
- **Per artikel:**
  - korte uitleg;
  - stappen;
  - eventueel een video van maximaal 60 seconden met ondertitels en een uitgeschreven tekst;
  - de knop **"Doe het nu"**, die het juiste scherm opent met de oefening uit §2;
  - "Was dit nuttig? Ja/Nee".
- **Veelgestelde vragen** en **probleemoplossing**, zoals "Mijn lijst toont 'nog niet bewaard'" of "Ik krijg geen code voor 2FA".
- **Contact:** "Vraag het aan support" opent het bestaande feedbackformulier, met het artikel als context.
- **Contextueel:** elk scherm krijgt een "?" die het Help Center opent op de categorie van dat scherm.

**Contextuele AI-assistent ("Vraag het Foodlo"):**
- Antwoordt **alleen** op basis van **gepubliceerde** artikels en noemt altijd het artikel ("Uit: Je lijst delen").
- Vindt hij niets, dan zegt hij dat eerlijk en biedt hij support aan. Hij verzint geen functies.
- Hij krijgt de vraag en de naam van het scherm, maar géén recepten, lijsten of gezinsgegevens.
- **Kosten:** loopt via de bestaande AI-budgetrem en cache, met een limiet per gebruiker per dag.
- Antwoorden worden niet als officiële uitleg bewaard. Een vraag zonder goed artikel wordt een signaal voor de Content Manager.

## 4. AI Content Manager (in het Control Center, recht `content.manage`)
**Bron van waarheid: een functieregister in de code** (`src/lib/functies.ts`, nog te bouwen). Elke functie krijgt:
- een sleutel, bijvoorbeeld `lijst.aanvullen`;
- het scherm (route);
- de module;
- de knoppen of labels waaraan je haar herkent;
- de versie waarin ze kwam.

Elk artikel verwijst naar de functies die het uitlegt.

| Taak | Hoe | Resultaat |
|---|---|---|
| Nieuwe functies herkennen | Register vergelijken met de artikels: welke functie heeft nog geen artikel? | Lijst "Zonder uitleg" |
| Verouderde instructies signaleren | (a) een artikel verwijst naar een verdwenen functie; (b) een knop of label uit het artikel bestaat niet meer in de app (Playwright leest de labels van de demo-app); (c) veel "Niet nuttig"-stemmen | Status **verouderd** + reden |
| Handleidingen genereren | AI krijgt register, labels en schermafbeeldingen van de demo-app, nooit gebruikersgegevens | **Concept** met bron "AI" |
| Video- en ondertitelscripts | Scènes per stap, voice-over-tekst, WebVTT-ondertitels | Concept |
| Vertalingen voorbereiden | Per taal een concept, gemarkeerd "machinevertaling, na te lezen" | Concept per taal |

**Workflow:**
1. **Concept** (AI of mens).
2. **Ter controle.** De beoordelaar ziet naast elkaar: tekst, schermafbeelding van nu en de functies uit het register.
3. **Gepubliceerd.** Kan alleen door een mens, wordt gelogd en krijgt een versienummer.
4. **Verouderd.** Wordt automatisch gesignaleerd en blijft zichtbaar met een melding "wordt bijgewerkt", tot een mens beslist.

Er is geen knop "AI publiceert". De server weigert een publicatie zonder menselijke beoordelaar. Dat wordt een test.

## 5. Video's: kosten en haalbaarheid
**Aanbeveling:** maak de **oefeningen in de app** interactief, niet de video's. Video's zijn kort (maximaal 60 s), stil afspeelbaar, met ondertitels en een uitgeschreven tekst.

**Waarom:** een oefening in de echte app veroudert nooit en kost niets. Een "interactieve video" (klikbare punten in de video) moet bij elke schermwijziging opnieuw gemaakt worden.

| Onderdeel | Haalbaar | Kost |
|---|---|---|
| Opnemen | **Automatisch met Playwright** op de demo-app (opname-functie bestaat). Script per artikel, opnieuw te draaien na een schermwijziging. | € 0 (lokaal) |
| Ondertitels | WebVTT uit het script (Content Manager), standaard `<track>` in HTML5-video | € 0 |
| Voice-over (optioneel) | Eigen stem of later een TTS-dienst | € 0 eigen stem; TTS = betaalde dienst, jouw beslissing |
| Bestanden | MP4 (H.264, 720p, ±1–3 MB per 30 s), bij de app of in de bestaande opslag | Binnen de huidige hosting; meten op staging |
| Videoplatform (alleen bij veel kijkers) | Bijvoorbeeld Cloudflare Stream: richtprijs ± $5 per 1 000 minuten opslag en $1 per 1 000 bekeken minuten ([vergelijking](https://apicostcalc.com/mux-vs-cloudflare-stream-vs-bunny-stream-cost-calculator.html), officiële prijs eerst nakijken). 20 video's van 1 min en 5 000 bekeken minuten per maand ≈ $5 per maand. | Niet nodig voor de start. **Niet aangemaakt.** |
| Commerciële interactieve-videoplatformen | Werken meestal met een maandabonnement | Niet aanbevolen |

**Toegankelijk:** geen automatisch afspelen, ondertitels standaard aan, een uitgeschreven tekst onder elke video, en bedienbaar met het toetsenbord.

## 6. Gegevensmodel (voorstel `0005`, niet geschreven of uitgevoerd)
- `help_articles` (id, slug, taal, module, titel, inhoud, niveau `beginner|ervaren|alle`, status `concept|ter_controle|gepubliceerd|verouderd`, bron `mens|ai`, functie_sleutels text[], versie, gecontroleerd_door, gecontroleerd_op, verouderd_reden).
  - **RLS:** iedereen leest alleen `gepubliceerd`. Schrijven alleen via de beheerserver (`bewaker`, `content.manage`).
  - **Controle:** naar `gepubliceerd` kan alleen met een gevulde `gecontroleerd_door`.
- `help_media` (article_id, soort, pad, ondertitels_pad, duur_s, transcript).
- `help_feedback` (article_id, nuttig bool, dag). Zonder user_id, dus anoniem.
- `onboarding_voortgang` (user_id, stap, status `gedaan|overgeslagen|later`, bijgewerkt). Komt in de AVG-export en wordt gewist bij verwijdering.

## 7. Roadmap
| Fase | Wat | Afhankelijk van | Inspanning |
|---|---|---|---|
| H0 | Functieregister in de code + test "elke route staat erin" | geen | ½ dag |
| H1 | Help Center met artikels **in de code** (Markdown in de repo), zoeken, categorieën, "?" per scherm, "Doe het nu", support | H0 | 2–3 dagen |
| H2 | Onboarding: niveauvraag, oefeningen, voortgang (eerst lokaal op het toestel), "Ga verder"-kaart | H0 | 3 dagen |
| H3 | Automatische video's en ondertitels met Playwright (lokaal), 5 kernartikels | H1 | 2 dagen |
| H4 | Tabellen `0005` op staging: artikels in de databank, voortgang per account, workflow concept → gepubliceerd | staging, jouw akkoord | 3 dagen |
| H5 | AI Content Manager: signaleren (zonder AI) → concepten (met AI, binnen budget) | H4 | 3–4 dagen |
| H6 | Contextuele AI-assistent op gepubliceerde artikels | H4, budget | 2–3 dagen |
| H7 | Vertalingen (concepten, menselijke nalezing) | H4 | doorlopend |

H0 tot en met H3 vragen geen databankwijziging en geen betaalde dienst. Die kan ik lokaal bouwen zodra jij akkoord geeft.

## 8. Jouw keuzes
1. Akkoord op de volgorde H0 → H3 (lokaal, gratis) vóór de tabellen.
2. Video's: eigen stem, geen stem (alleen ondertitels), of later een betaalde TTS?
3. Assistent: per gebruiker hoeveel vragen per dag (voorstel: 10)?
