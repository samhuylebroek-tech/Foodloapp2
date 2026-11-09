# Mobiel-eerst herontwerp — statusmatrix (stand 2026-11-09, branch `v2/dev`)

Alles hieronder draait **lokaal tegen een nep-Supabase met verzonnen gegevens**. Niets is gepubliceerd, niets raakt productie.
"Getest" betekent: automatische browsertests in Chromium met telefoonformaat. **Geen echte toestellen**, geen echte gebruikers.

## 1. Eén ontwerpsysteem voor de hele app

| Onderdeel | Was | Nu |
|---|---|---|
| Knoppen | Afgeronde rechthoek, schaduw `sm` | **Pil** (`rounded-full`), 56 px hoog (klein: 48 px), varianten `default`, `inkt`, `zacht`, `outline`, `secondary`, `ghost`, `destructive`; indrukeffect |
| Invoervelden, keuzelijsten | Dunne rand, 36–56 px | 56 px, **dikke rand** (2 px), groene rand bij focus, 18 px tekst |
| Panelen | `border + shadow` per scherm verschillend | Eén `paneel`-stijl (20 px hoeken, zachte schaduw, fijne rand) |
| Lijsten en instellingen | Losse kaarten met eigen opmaak | **Gegroepeerde lijsten** zoals iOS/Android: kop · rijen met gekleurd icoon · uitleg eronder (`components/mobiel/Lijst.tsx`) |
| Vensters (dialog, sheet, alert) | Onderaan, gewone titel | **Bodemvenster met greep**, ronde hoeken 28 px, serif-titel, veilige zone onderaan; op groter scherm gecentreerd |
| Tabs / segmenten | Rechthoekig | Pilvormige segmentknop |
| Vinkjes | 28 px vierkant | 28 px (boodschappen: **32 px rond**), dik vinkje |
| Schakelaars | 20×36 px (te klein) | **32×56 px** met extra raakvlak |
| Menu's | 14 px tekst, 32 px rijen | 18 px tekst, 48 px rijen |
| Lege staat / laden | Grijze tekst | Paneel met rond icoon en volgende stap / grijze vormen in de vorm van de echte inhoud |
| Avatars | Vierkant | Rond |
| Kleur | — | Terracotta iets donkerder (tekst op lichte terracotta ≥ 4.5:1) |

## 2. Statusmatrix per scherm

Legenda implementatie: ✅ herbouwd · 🟡 aangepast via gedeelde componenten · ⏳ later.
Test: **B** = alle 6 telefoonbreedtes (360/375/390/393/412/430): geen zijwaarts scrollen, raakdoelen ≥ 24 px · **A** = axe zonder ernstige meldingen (390 px) · **E** = functionele E2E-test · **S** = schermafdruk 360/390/430.

| Scherm | Vorige vorm | Problemen op mobiel | Nieuw mobiel ontwerp | Interactie gewijzigd | Impl. | Test |
|---|---|---|---|---|---|---|
| Vandaag `/` | Inktband + lijsten (V2-ronde 1) | — | Ongewijzigd ontwerp, nieuwe knoppen/panelen | — | 🟡 | B A E S |
| Recepten `/gerechten` | Zoeken, collecties, kaarten | Segment en filters rechthoekig | Pilsegmenten, filterkeuzes in nieuwe vorm, concepten als paneel | — | 🟡 | B A E S |
| Receptdetail | Foto + acties, ingrediënten naast stappen | — | Nieuwe knoppen en panelen | — | 🟡 | B A E S |
| **Kookstand** | Kop + tekst + knoppen onderaan | Knoppen scrolden mee, voortgang één balk, per ongeluk weg | **Vaste kop** met blokje per stap, stapnummer groot, stap in 30–34 px, **vaste knoppen** onderaan (Volgende ×2 breed) | **Stoppen vraagt bevestiging**; ook terugknop/link wordt tegengehouden (voortgang blijft bewaard) | ✅ | B A E S |
| Recept toevoegen / bewerken | Vastlegkaarten | Kleine knoppen, rechthoekige keuzes | Pilkeuzes, grotere raakdoelen | — | 🟡 | B A E S |
| **Weekmenu (mobiel)** | 7 daktegels + per dag | Geen overzicht van de week in één oogopslag | Dagtegels tonen **per maaltijd een streepje** (gevuld = gepland), vandaag in honing, gekozen dag in inkt | **Vegen** links/rechts = vorige/volgende dag | ✅ | B A E S |
| Weekmenu (desktop) | 7-dagenraster | — | Ongewijzigd | — | 🟡 | E |
| **Boodschappen** | Grote voortgangskaart, losse "Ongedaan maken", invoer bovenaan | Invoer ver van de duim, kleine vinkjes, tekst tikken = bewerken | Compacte kop met ↶ en ⋯, voortgangsbalk, **vaste invoerbalk onderaan** (telefoon), drie hulptegels, "Vaak gekocht" als veegrij, afdelingen als panelen, **32 px ronde vinkjes** | **Hele rij tikken = afvinken**; potlood = bewerken | ✅ | B A E S |
| **Winkelmodus** | Lijst per afdeling | Geen voortgang, geen snelle afdelingskeuze | Inktkop met aantal en voortgang, **afdelingschips**, items 96 px hoog in 26 px tekst | Escape sluit; dialoogrol | ✅ | B S |
| **Voorraad** | Lijst + snelle keuzes | Hoeveelheid aanpassen kon niet | Eén paneel met rijen, **− / +** per product (stap volgens eenheid) | Naar 0 = verwijderen met "Ongedaan maken" | ✅ | B A E S |
| **Meer** | Kaartgroepen met hoofdletters | Rommelig, geen identiteit | **Profielkaart** (initialen, naam, @naam) + gegroepeerde lijsten met gekleurde iconen | — | ✅ | B A S |
| **Instellingen** | Accordeon "Profiel en beveiliging" | Alles verstopt, inconsistente kaarten | Groepen: Profiel · Weergave (kleurstalen) · Weekmenu (schakelaars) · Jouw Foodlo · Beveiliging · Delen · Gegevens · Account | Afmelden en account verwijderen als rode rijen | ✅ | B A E S |
| **Gezin** | Gecentreerde lege staat + accordeons | Leden als losse kaarten, rechten verstopt | Inktkop met naam en avatars, "Wie hoort erbij", "Wacht op antwoord", uitnodigen (zoeken + QR + delen), "Wat deel ik" met schakelaars | Lid tikken = hun gerechten; verwijderen via prullenbak met bevestiging | ✅ | B A S |
| **Vrienden** | Kaarten + accordeon | — | Nieuwe panelen, uitnodigingen in honing, gezin als rij, rechtenvenster als echt dialoogvenster met greep | — | ✅ | B A S |
| **Vriend** `/vrienden/$id` | Kaart + lijsten | — | Inktkop met wat gedeeld wordt (chips), gerechten als fotoraster, weekmenu en lijst als gegroepeerde lijsten | — | ✅ | S (geen demodata) |
| **Klantenkaarten** | Rij per kaart | — | **Kaarten zoals in je portefeuille** (winkelkleur, nummer, "Tonen"), toevoegvenster als bodemvenster | — | ✅ | B A S |
| **Kaart** `/kaarten/$id` | Barcode + formulier | — | Witte barcodekaart, grote "Tonen aan de kassa", instellingen als lijst | — | ✅ | S |
| **Meldingen** | Accordeon met blokken | — | Statuskaart (aan = inkt), herinneringen als rijen met icoon en schakelaar, tijd/dag inline, "Hoelang vooraf" als segment | — | ✅ | B A S |
| **Credits** | Gecentreerd getal | Laadde eindeloos in de demo | Inktkaart met groot saldo, kosten als lijst, recente boekingen | — | ✅ | B A S |
| Feedback | Formulier in paneel | Rechthoekige keuzes | Pilkeuzes, ronde sterren | — | 🟡 | B A S |
| **Over Foodlo** `/info` | "Nog geen informatie" | Leeg scherm | Lege staat + links (privacy, feedback, rondleiding) | — | ✅ | B A S |
| Inspiratie | Zoeken + raster | Rechthoekige knoppen/kaarten | Pilsegmenten, panelen | — | 🟡 | B A S |
| **Aanmelden** | Kaart midden op het scherm | Op de telefoon een kaart in een kaart | Telefoon: **merkband bovenaan, formulier schermvullend**; groter scherm: kaart | — | ✅ | E S |
| Welkom, Rondleiding, Installeren, Privacy | Eigen opmaak | — | Nieuwe knoppen/velden via gedeelde componenten | — | 🟡 | S |
| Beheer (`/beheer/*`, 43 schermen) | Eigen dichte opmaak | — | Erft de nieuwe basiscomponenten; geen eigen herontwerp (bewust dichter) | — | ⏳ | — |
| Creator, abonnementen | Bestaan niet | — | Alleen architectuur (zie V2-plan) | — | ⏳ | — |

## 3. Automatische mobiele controle (nieuw: `tests/e2e/mobiel-breedtes.spec.ts`)
18 schermen × 6 breedtes = 108 metingen. Resultaat op 2026-11-09: **alles geslaagd** na twee contrastcorrecties (badge "Gezin", tekst op klantenkaarten).
Raakdoelen tussen 24 en 44 px (gelogd, geen fout): de sterren onder receptkaarten (31 px breed) en de dagtegels van het weekmenu (41 px breed bij 390 px).

## 4. Wat (nog) niet kan of niet getest is
- Geen echte iPhone/Android: Safari/WebKit, toetsenbord dat de vaste invoerbalk bedekt (iOS), echte veilige zones (notch) en VoiceOver/TalkBack zijn **niet** getest.
- Vegen tussen dagen en de "terug"-blokkering in de kookstand zijn alleen met de muis/klik-simulatie gecontroleerd.
- Beheer heeft geen eigen mobiel herontwerp.
