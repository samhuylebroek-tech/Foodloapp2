# Productblauwdruk Foodlo
**Bron van waarheid voor:** domeinen, modules, gebruikersreizen en de grenzen ertussen.

**Put uit:**
- `FOODLOAPP-V2-MASTERPLAN.md`;
- `PRODUCT-HERONTWERP.md`;
- `HERONTWERP-V2.md`;
- `HUISHOUDEN-ONTWERP.md`;
- `ARCHITECTUUR-VOORSTELLEN.md`.

**Detailstatus:** `COMPLETE_PRODUCT_INVENTORY.md`.

## 1. Domeinen en grenzen
```
┌──────────────────────── Foodlo-platform ────────────────────────┐
│ CONSUMENT (F1)           HUISHOUDEN (F1 basis, F2 per lid)      │
│  Vandaag · Week · Lijst   gezin, leden, gedeelde planning/lijst │
│  Winkelmodus · Kookstand  (F2: allergieën/voorkeuren per lid,   │
│  Recepten · Ontdek        mee-eters, verzamelingen)             │
│  Keuken (voorraad/restjes, optioneel) · Instellingen · Hulp     │
│                                                                 │
│ ASSISTENT (doorsnijdend): regels op het toestel + AI op server  │
│  via privacylaag → nooit allergieën/gezondheid naar externe AI  │
│                                                                 │
│ CREATOR (F2)             COMMERCIEEL (F3)                       │
│  profiel, publiceren,     BCC-partners, merken, campagnes,      │
│  volgen, moderatie,       gesponsorde inhoud (gelabeld),        │
│  statistieken             premium, betalingen (server-side)     │
│                                                                 │
│ BEHEER (F1): Control Center voor het Foodlo-team (bestaat)      │
└─────────────────────────────────────────────────────────────────┘
        AI GROWTH OS: apart product, deelt alleen infrastructuur
```

**Regels voor de grenzen:**
- **Consument tegenover commercieel:** commerciële functies hebben eigen routes en rechten. Ze staan nooit in de consumentennavigatie, behalve als duidelijk gelabelde inhoud.
- **Beheer:** het Control Center (`/beheer`) is voor het Foodlo-team. Het BCC voor partners (F3) wordt een **aparte omgeving**, met een eigen rollenmodel. Partners krijgen geen toegang tot beheer.
- **Huishouden:** gevoelige gegevens per persoon (allergieën, gezondheid) worden nooit automatisch gedeeld met andere leden. Delen gebeurt alleen met uitdrukkelijke toestemming per lid (F2).
- **Creator:** een creator is een gebruiker met een creatorprofiel, geen apart account. Publieke inhoud gaat langs moderatie.

## 2. Modules en hun verbindingen
| Module | Krijgt van | Geeft aan |
|---|---|---|
| Recepten (14 invoermanieren) | Ontdek, vrienden en gezin, web, foto, tekst, AI | Week, Lijst, Kookstand, Keuken |
| Week | Recepten, assistent (voorstellen), huishouden | Lijst (kringloop: past zich aan bij vervangen of verwijderen), Vandaag |
| Lijst | Week, Recepten, eigen invoer, Slim aanvullen | Winkelmodus, Voorraad ("Klaar met winkelen") |
| Winkelmodus | Lijst | Voorraad |
| Keuken (voorraad, restjes; optioneel, 3 standen) | Winkelmodus, Kookstand (aftrekken) | Assistent ("Wat kan ik koken?", "Gebruik eerst"), Slim aanvullen |
| Kookstand | Recept | Score, restjes, voorraad aftrekken |
| Vandaag | Week, Keuken, assistent, etenstijden | De handeling van het moment (één hoofdactie) |
| Instellingen en profiel | Gebruiker | Assistent (persoonlijke voorkeuren, allergieën: F1 op het account) |

## 3. Belangrijkste gebruikersreizen (F1)
1. **Recept toevoegen:**
   - kies hoe: typen, link, sociale media, tekst, foto, gerecht herkennen, zoeken, delen naar de app, Ontdek, van een vriend, vanuit het weekmenu, "Laat Foodlo kiezen", koppelen;
   - **altijd nakijken vóór bewaren** (R2: ook bij kopiëren en "Vul aan");
   - bewaren, terugvinden, aanpassen.
2. **Week plannen:** lege dag → voorstel met reden → plannen → "Slim aanvullen" → de lijst.
3. **Boodschappen:** lijst → "Ik ga winkelen" → per afdeling afvinken → "Klaar met winkelen" → (optioneel) voorraad.
4. **Koken:** Vandaag zegt wanneer je moet beginnen → Kookstand → score en restje.
5. **Zonder voorraad:** de volledige ervaring, met de lijst als bron. Er wordt niets aangenomen over wat je in huis hebt.
6. **Gezin (F1):** gezin maken, uitnodigen, samen plannen en een gezamenlijke lijst. Ieders eigen allergieën staan op ieders eigen account en worden niet gedeeld.
7. **Account:** registreren of aanmelden (e-mail of sociale login), export, verwijderen.

## 4. Persoonlijke voeding in F1 (optie B)
- **Bewaard per gebruiker op het account:**
  - allergieën en intoleranties (vaste lijst);
  - dieet;
  - uitsluitingen (vaste keuzes + vrij veld).
- **Nu:** dit staat alleen op het toestel (`kennismaking.ts`, `localStorage`), en het vrije veld "liever niet" zit in `profiles.weekmenu`.
- **Doel:**
  - alleen leesbaar voor de gebruiker zelf (zoals 0004);
  - nooit in AI-prompts of cachesleutels;
  - gebruikt door de veiligheidsregels op het toestel en op de server.
- **Opslag:** zie `DATABASE_ARCHITECTURE.md` §4 (voorstel 0004b, goedkeuring nodig).
- **In gezinsplanning (F1):** wie plant, ziet waarschuwingen op basis van **de eigen** allergieën. Rekening houden met de allergieën van andere leden komt in F2 (0005, met toestemming per lid). De app zegt dat ook duidelijk; ze doet nooit alsof.
