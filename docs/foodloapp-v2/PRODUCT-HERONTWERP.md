# Foodloapp V2 — product opnieuw doordacht (2026-11-09)

Status: voorstel + eerste klikbaar prototype in de lokale demo (`v2/dev`, nep-Supabase). Niets is gepubliceerd.

---

## 1. Diagnose: wat is er vandaag mis met de *werking* (niet de pixels)

De app heeft veel functies, maar ze **praten niet met elkaar**. Elke functie is een eiland met een eigen scherm, eigen knoppen en eigen geheugen.

| # | Bevinding (uit code en demo) | Gevolg voor de gebruiker |
|---|---|---|
| D1 | **Voorraad weet niets van planning of boodschappen.** `pantry_items` wordt alleen gelezen op `/voorraad` en door één optie in "Meer opties" van Boodschappen. | De weeklijst bevat dingen die al in de kast staan. Gekochte spullen komen nooit in de voorraad. Na het koken blijft de voorraad staan zoals hij was. De voorraad veroudert dus meteen en wordt waardeloos. |
| D2 | **Weekmenu → lijst is een handmatige export.** "Boodschappen voor deze week" neemt ook voorbije dagen mee, kijkt niet naar de voorraad en toont pas achteraf wat er gebeurde. | Minstens 3 tikken plus een controlevenster. Daarna nog zelf schrappen wat je al hebt. |
| D3 | **Twee rechtensystemen met dezelfde zes vinkjes**: `shares` (vrienden) en `group_members` (gezin). | Twee schermen ("Vrienden en gezin", "Mijn gezin") die bijna hetzelfde doen. Mensen weten niet waar ze iemand moeten uitnodigen. |
| D4 | **Twee weekmenu's**: "Mijn planning" en "Gezin" (`meal_plan.group_id`). Ook twee soorten lijsten. | In een gezin is niet duidelijk welk menu "het echte" is. Iets kan dubbel of nergens gepland staan. |
| D5 | **Voorraad heeft geen houdbaarheid, plek of eigenaar** (enkel naam, hoeveelheid, eenheid, per gebruiker). | Geen "eet dit eerst op", geen restjes, geen gedeelde koelkast in een gezin. |
| D6 | **Koken eindigt in een doodlopende straat**: score geven, en dan niets. | Geen restjes bewaren, geen voorraad bijwerken, geen "volgende keer anders". |
| D7 | **Instellingen in plaats van ervaring**: momenten, rechten, meldingen en thema zijn formulieren. | Mensen moeten het systeem leren in plaats van gewoon te koken. |
| D8 | **"Meer" bevat 10 bestemmingen**, sommige dubbel (Voorraad, Instellingen, Over Foodlo/Info, Privacy). | Zoekwerk. Persona A (70) vindt functies niet terug. |
| D9 | **Recepten ontdekken staat los van je eigen kookboek** (`/inspiratie` als tweede wereld). Er zijn geen collecties van gebruikers en geen creators. | Persona B (20) kan zich nergens profileren of volgen. |
| D10 | **Realtime alleen op 5 plekken**, en enkel als "vernieuw de lijst". | Er is geen gevoel van samen: je ziet niet dat je partner net iets afvinkte. |

**Kernconclusie:** de grootste winst zit niet in nieuwe schermen, maar in **één gesloten kringloop**:

```
  ontdekken/vastleggen ─► plannen ─► lijst (min voorraad) ─► kopen ─► voorraad ─► koken ─► restjes/voorraad bijgewerkt
           ▲                                                                                        │
           └──────────────────────── suggesties op basis van voorraad, smaak, gezin ◄───────────────┘
```

---

## 2. Nieuwe productstructuur

### 2.1 Vijf plekken in plaats van vijf tabs + Nieuw + tien keer Meer

| Tab | Vraag die het beantwoordt | Bevat (bestaande functies) |
|---|---|---|
| **Vandaag** | "Wat eten we en wat moet ik nu doen?" | Maaltijd van vandaag + Start koken, eén **volgende-actie-kaart** (zie 2.3), wat bijna vervalt, wie mee-eet |
| **Week** | "Wat eten we deze week?" | Weekmenu (één menu per huishouden), slim aanvullen, Laat Foodlo kiezen |
| **Lijst** | "Wat moet ik halen?" | Boodschappen, winkelmodus, eerder gekocht, klantenkaarten (in de winkel nodig) |
| **Keuken** *(nieuw: voorraad + recepten samen)* | "Wat heb ik en wat kan ik ermee?" | Mijn recepten, collecties, voorraad (koelkast/kast/diepvries), restjes, "Wat kan ik koken" |
| **Ontdek** *(vervangt Inspiratie)* | "Wat is nieuw/lekker?" | Ideeën, creators volgen, collecties van anderen (fase 3) |

- **Nieuw (+)** blijft één vaste knop. Hij wordt contextueel: in Lijst eerst "Product", in Keuken eerst "Recept/Voorraad".
- **Profiel** (avatar rechtsboven) vervangt "Meer". Daarin: huishouden, vrienden, meldingen, credits, instellingen, hulp. Er zijn maar 4 groepen in plaats van 10 losse rijen.

Behoud: elke huidige route blijft bestaan (redirects waar een plek verhuist). Niets wordt zonder akkoord verwijderd.

### 2.2 Eén huishouden in plaats van "gezin" en "vrienden"

| Begrip | Betekenis | Data (zie §6) |
|---|---|---|
| **Huishouden** | Wie samen eet en boodschappen doet. Deelt standaard: weekmenu, lijst, voorraad. | `groups` (+ type `huishouden`) |
| **Lid** | Rol: *beheerder* of *lid*. Alleen de beheerder nodigt uit of verwijdert. | `group_members.rol` (bestaat) |
| **Mee-eter** *(nieuw)* | Iemand zonder account (kind, oma) met voorkeuren: "geen vis", "vegetarisch". Telt mee voor porties en suggesties. | nieuwe tabel `huishouden_eters` |
| **Vriend** | Iemand buiten het huishouden. Je deelt **per recept of collectie**, niet met zes vinkjes. | `shares` vereenvoudigd |

De zes rechten-vinkjes verdwijnen voor gewone mensen. Binnen het huishouden mag iedereen alles. Naar buiten deel je dingen, geen rechten.

### 2.3 Volgende-actie-kaart op Vandaag
Eén kaart, steeds de belangrijkste stap. Voorbeelden, in volgorde van urgentie:
1. "Je kookt over 45 min: Stoofvlees. **Start koken**"
2. "3 dingen voor morgen ontbreken. **Zet op de lijst**"
3. "Spinazie vervalt morgen. **2 recepten met spinazie**"
4. "Je week is half gepland. **Vul aan met 3 voorstellen**"

Geen lijst met tien taken. Altijd één knop.

---

## 3. Functionele specificaties per domein

### 3.1 Voorraad (Keuken)
- **Toevoegen zonder typen:** vanuit de lijst. Afgevinkte boodschappen gaan bij "Klaar met winkelen" in één tik naar de voorraad (vooraf aangevinkt, basisproducten zoals zout niet).
- **Toevoegen met typen:** één veld ("500 g bloem") of snelle chips. Later ook kassabon- en barcodescan (fase 3).
- **Hoeveelheid:** − en + (gebouwd). Naar 0 = op.
- **Houdbaarheid** *(nieuw veld)*: optioneel. Voorgesteld per productsoort (melk 7 d, gehakt 2 d). Wordt getoond als "vervalt morgen" in plaats van een datum.
- **Plek** *(nieuw veld)*: koelkast · kast · diepvries. Dat zijn drie tabbladen in plaats van één lange lijst.
- **Restjes** *(nieuw)*: na het koken: "Restjes bewaard? 2 porties" → voorraaditem met link naar het recept en een houdbaarheid van 3 dagen.
- **Na het koken:** "Haal dit uit je voorraad" met de gebruikte ingrediënten vooraf aangevinkt. Eén tik.
- **Gedeeld:** in een huishouden is er één voorraad.

### 3.2 Weekplanning (Week)
- **Eén menu per huishouden**, met per maaltijd wie mee-eet (standaard iedereen). Porties volgen daaruit. Het "Gezin / Mijn planning"-wisselknopje verdwijnt.
- **Slim aanvullen** *(prototype gebouwd)*: per week één knop. Die berekent wat nodig is voor de **komende** maaltijden, trekt af wat in de voorraad of al op de lijst staat, en zet de rest er met één tik op. Je ziet altijd waarom ("voor Stoofvlees, Wo").
- **Voorstellen:** "Laat Foodlo kiezen" houdt rekening met voorraad (wat vervalt eerst), mee-eters (geen vis) en variatie. Uitleg in vier woorden per voorstel: "gebruikt je spinazie".
- **Wijzigen:** slepen of vegen. Er is een **"Ruil"-knop** op elke maaltijd met drie alternatieven die dezelfde ingrediënten gebruiken. Een maaltijd overslaan ("uit eten") haalt de bijbehorende items weer van de lijst (na bevestiging).

### 3.3 Boodschappen (Lijst)
- **Automatisch gevuld** door Slim aanvullen. Handmatig blijft kunnen (vaste balk onderaan, gebouwd).
- **Gegroepeerd per winkelafdeling** (bestaat), volgorde per winkel te onthouden (fase 2).
- **Samen:** realtime afvinken met naam ("Lotte vinkte melk af"). Iemand die in de winkel is ziet "Jan is aan het winkelen" en nieuwe items lichten op.
- **Klaar met winkelen** → één scherm: "8 dingen gekocht → in je voorraad?" Daarmee is de kringloop rond.

### 3.4 Recepten (Keuken + Ontdek)
- **Vastleggen** blijft het vlaggenschip: link, foto, tekst, zoeken (bestaat). Na het bewaren meteen de vraag: "Wanneer wil je dit maken?" met datumchips.
- **Organiseren:** collecties die gebruikers zelf maken ("Snelle weekdag", "Kerst"). Automatische collecties bestaan al.
- **Aanpassen:** "Mijn versie" bij een recept van iemand anders (kopie met link naar het origineel).
- **Delen:** recept of collectie via een link. Wie geen account heeft, ziet een leesversie.

### 3.5 Koken
- **Bestaat:** stap voor stap, timers, voortgang, bevestiging bij verlaten, voortgang bewaard (gebouwd).
- **Handsfree** *(fase 2)*: "Volgende" zeggen (Web Speech API waar beschikbaar) en grote veegzones links/rechts.
- **Onderbrekingen:** timers lopen door en geven een melding, ook buiten de kookstand (fase 2: vaste timerbalk in de hele app).
- **Afsluiten:** score → restjes → voorraad bijwerken → "Volgende keer anders?"-notitie. Elke stap kan je overslaan.

### 3.6 Profielen, vrienden, creators, betaalde inhoud (fase 3–4)
- Publiek profiel met @naam (bestaat als `handle`), publieke collecties, volgen.
- Creator-collecties kunnen later betaald worden (abonnement of eenmalig). Dat zit achter goedkeuringspoort **G5** (betalingen) en wordt nu niet gebouwd.

---

## 4. Kritische beoordeling — wat we **niet** doen

| Voorstel | Oordeel | Waarom |
|---|---|---|
| Elk scherm een nieuwe stijl geven | ❌ verworpen | Gebeurd. Meer pixels lossen D1–D10 niet op. |
| Rechtenmatrix met zes vinkjes behouden voor het gezin | ❌ verworpen | Niemand in een huishouden wil rechten beheren. Delen naar buiten gebeurt per ding. |
| Aparte "Restjes"-pagina | ❌ verworpen | Restjes zijn voorraad met een label. Dat is één lijst, geen nieuwe plek. |
| AI-chat als hoofdingang | ❌ voorlopig niet | Kost credits, is traag voor persona A, en vervangt de kringloop niet. Wel AI-uitleg per voorstel. |
| Vervaldatum verplicht maken | ❌ verworpen | Te veel typwerk. Optioneel, met voorstel per soort. |
| Slim aanvullen | ✅ eerst | Raakt D1, D2 en D4 en vraagt geen databankwijziging. |
| Gekocht → voorraad, gekookt → uit voorraad | ✅ eerst | Houdt de voorraad automatisch juist. Zonder dit is elke voorraadfunctie nutteloos. |
| Eén huishouden | ✅ fase 2 | Vereist datamigratie (G1/G2). Eerst ontwerp en staging. |

---

## 5. Gebruikersstromen (A tot Z)

**S1 — Week rond in één minuut** *(gebouwd, verfijnd)*
0. Meestal hoef je niet eens naar dit scherm: Vandaag en de Lijst tonen één kaart "12 dingen ontbreken voor je komende maaltijden" met één knop **Zet op mijn lijst**.
1. Week → **Slim aanvullen** (of vanuit Lijst: "Uit je weekmenu").
2. Scherm toont drie groepen:
   - **Nog kopen** (aangevinkt);
   - **Heb je al** (uit voorraad, niet aangevinkt);
   - **Staat al op je lijst**.
   Bij elk item staat voor welk gerecht het is.
3. Eén tik op een item verplaatst het: "toch kopen" of "heb ik".
4. **Zet 7 dingen op mijn lijst.** Melding met "Ongedaan maken".
- Uitzonderingen:
  - Geen gerechten gepland → lege staat met "Plan je week".
  - Maaltijd zonder recept → aparte melding "zelf toevoegen".
  - Alles al in huis → "Je hebt alles. Smakelijk!"

**S2 — Klaar met winkelen** *(gebouwd, verfijnd)*
1. Tik op **Klaar met winkelen** (in de lijst of aan het einde van de winkelmodus).
2. Foodlo zet de afgevinkte items in de voorraad. Bestaande producten worden opgeteld (500 g bij 1 kg). Zout en dergelijke tellen niet. Daarna wordt de lijst opgeruimd.
3. De melding zegt "8 dingen in je voorraad gezet" met **Ongedaan maken**. Dat zet lijst én voorraad terug.
- Er komt geen tussenvraag: de eerste versie vroeg per item een bevestiging, en dat is geschrapt.

**S3 — Gekookt → voorraad bijgewerkt** *(gebouwd, verfijnd)*
1. Klaar met koken → score (of "Later").
2. Foodlo trekt de gebruikte hoeveelheden af, aangepast aan het aantal personen. Voorbeelden: 2 el van 1 l olie wordt 0,97 l; 1 kg van 1 kg rundvlees betekent "op".
3. Wat niet zeker te rekenen is (geen hoeveelheid, of "takjes" tegenover "bos") laat Foodlo staan, in plaats van te gokken.
4. De melding zegt "Voorraad bijgewerkt: rundvlees op, uien minder" met **Ongedaan maken**.
- Er komt geen tussenscherm meer: de eerste versie vroeg "Wat heb je opgebruikt?", en dat is geschrapt.

**S4 — Iemand bij het huishouden halen** *(ontwerp, fase 2)*
1. Profiel → Huishouden → **Iemand toevoegen**.
2. Deel een link of QR-code. De ander tikt erop en ziet "Kom bij *Thuis*?" → Ja.
3. Daarna delen jullie meteen menu, lijst en voorraad. Er is geen enkel vinkje nodig.
4. Mee-eter zonder account: naam plus één tik op een voorkeur (vegetarisch, geen vis, kind).

**S5 — Wat eten we vanavond (niets gepland)** *(ontwerp)*
1. Vandaag toont "Nog niets voor vanavond" met drie voorstellen uit de voorraad ("je hebt 5 van 6").
2. Tik → recept → **Kook dit vanavond** plant het meteen en zet ontbrekende dingen op de lijst.

---

## 6. Datamodel en architectuur

| Wijziging | Soort | Fase | Poort |
|---|---|---|---|
| Slim aanvullen, gekocht→voorraad, gekookt→voorraad | **Geen schemawijziging** (gebruikt `meal_plan`, `recipe_ingredients`, `pantry_items`, `shopping_items`) | 1 (nu) | — |
| `pantry_items` + `vervalt_op date null`, `plek text default 'kast'`, `bron_recept_id uuid null` (restjes), `group_id uuid null` | Additieve migratie | 2 | G1 (staging eerst) |
| `huishouden_eters` (group_id, naam, voorkeuren text[]) | Nieuwe tabel + RLS | 2 | G1, G2 |
| `meal_plan` + `eters uuid[] null` (wie eet mee) | Additief | 2 | G1 |
| Gezin- en persoonlijke plannen samenvoegen | Datamigratie (kopie, nooit wissen) | 2 | G1, G7 |
| `shares` → delen per recept/collectie | Nieuwe kolommen `soort`, `doel_id`; oude rechten blijven werken | 3 | G2 |
| `collecties` + `collectie_recepten` | Nieuwe tabellen | 3 | G1 |
| Realtime: aanwezigheid ("Jan winkelt") | Supabase Realtime presence, geen schema | 2 | — |

**Principes:**
- Alleen additief; bestaande kolommen blijven tot een gemigreerd model in staging getest is.
- Logica komt in pure functies (`src/lib/kringloop.ts`) met unit-tests, los van schermen.
- Bestaande schermen blijven werken tot hun opvolger goedgekeurd is.

---

## 7. Acceptatiecriteria en testscenario's (fase 1)

| ID | Criterium | Test |
|---|---|---|
| K1 | Slim aanvullen telt alleen maaltijden vanaf vandaag, schaalt naar het aantal personen en voegt gelijke producten samen | unit `kringloop.test.ts` |
| K2 | Wat in de voorraad zit, staat niet aangevinkt; wat al (niet afgevinkt) op de lijst staat, wordt niet opnieuw toegevoegd | unit + E2E |
| K3 | Basisproducten (zout, peper, water) worden nooit voorgesteld | unit |
| K4 | Eén tik zet precies de aangevinkte items op de lijst | E2E (nep-database gecontroleerd) |
| K5 | Klaar met winkelen: afgevinkte items komen in de voorraad (bestaande worden opgeteld) en de lijst wordt opgeruimd | E2E |
| K6 | Na het koken: aangevinkte gebruikte ingrediënten verdwijnen uit de voorraad; overslaan wijzigt niets | E2E |
| K7 | Alle nieuwe vensters: dialoogrol, focus, Escape, raakdoelen ≥ 44 px, geen zijscroll op 360 px | E2E + axe |

---

## 8. Verfijning na kritische herbeoordeling (2026-11-09)

| Probleem in de eerste versie | Waarom fout | Nu |
|---|---|---|
| Voorraad telde alleen op naam: 200 g bloem in huis = "heb je al", ook als je 500 g nodig hebt | Je komt thuis zonder genoeg | Hoeveelheden met eenheden (g/kg, ml/cl/dl/l/el/tl, stuks). Alleen het tekort gaat op de lijst, met "je hebt al 200 g" |
| Een tekort bij iets dat al op de lijst stond, werd een tweede regel | Dubbels op de lijst | Wordt bijgeteld bij de bestaande regel |
| Twee keer aanvullen, of twee gezinsleden tegelijk | Dubbels | Foodlo rekent vlak vóór het schrijven opnieuw. De tweede keer krijg je "Alles staat al op je lijst" |
| Gerecht uit het menu gehaald, boodschappen bleven op de lijst | Onnodig kopen | "3 op je lijst: gerecht niet meer gepland → Haal weg" |
| Aanvullen vroeg een apart scherm met 22 regels | Te veel lezen | Eén kaart op Vandaag en de Lijst. Het detailscherm is gegroepeerd per winkelafdeling, met korte regels en "in huis" als chips |
| Klaar met winkelen en Na het koken vroegen telkens een bevestiging | Onnodige keuzes | Gebeurt meteen. De melding zegt wat er gebeurde, met één "Ongedaan maken" |
| Na het koken alles uit de voorraad halen wat in het recept staat | Een fles olie verdwijnt na 2 eetlepels | Alleen aftrekken wat zeker te rekenen is |
| Nep-databank vulde de aankoopdatum niet in → lijstscherm crashte na opruimen | Demo onbetrouwbaar | Hersteld (net als de echte databank: standaard "nu") |

Getest van begin tot einde (`tests/e2e/kringloop.spec.ts`):
1. Vandaag → aanvullen.
2. Alles afvinken → klaar met winkelen → voorraad.
3. Koken → voorraad bijgewerkt → ongedaan maken.

Daarnaast getest: dubbel aanvullen vanuit twee vensters, en ongedaan maken van "klaar met winkelen". De randgevallen staan in de unit-tests `src/lib/kringloop.test.ts`: gedeeltelijke voorraad, eenheden, overlappende ingrediënten, niet meer geplande gerechten en verbruik.
