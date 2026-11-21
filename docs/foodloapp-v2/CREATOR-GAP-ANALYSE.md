# Food creators en verdienmodel: gap-analyse

> Samengevat in [`docs/foodlo/COMMERCIAL_ROADMAP.md`](../foodlo/COMMERCIAL_ROADMAP.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11. Getest als persona C (food creator, 1280 px) in de lokale demo; zie PERSONA-TESTVERSLAG-2026-11.md. Er is **niets** commercieels geactiveerd of gebouwd.

**Conclusie in één zin:** Foodloapp is vandaag een persoonlijke en gezinsapp. Er bestaat geen enkele creatorfunctie. Een creator kan recepten maken en per link delen, en verder niets.

## Wat bestaat (getest)
| Functie | Status | Bewijs |
|---|---|---|
| Recept zelf invoeren (titel, ingrediënten, stappen, foto) | ✅ | C-02: bewaard, detailpagina netjes, ook met een titel van 100 tekens en 35 ingrediënten (F-01) |
| Recept delen via link of systeemdeelmenu | ✅ | C-04 |
| Import via link, tekst of foto | 🔒 | Vraagt AI. In de demo: nette foutmelding "De pagina kon niet worden opgehaald (status 404)" |
| Weergavenaam en "Foodlo-naam" (@handle) | ✅ | In Meer → profiel |
| Vrienden: elkaars recepten bekijken (met rechten) | ✅ | Privé-deelmodel, niet publiek |
| Ontdek | 👁 | Samengesteld door de Foodlo-keuken (`inspiration_recipes`). In de code staat letterlijk "Bron: later de food creator (naam en profiel)". Geen creatornaam zichtbaar (A-04) |

## Gap per onderdeel
| Onderdeel | Nodig voor een creator | Vandaag | Inspanning | Afhankelijk van |
|---|---|---|---|---|
| Registratie en verificatie | Creatoraanvraag, controle (identiteit; KYC bij uitbetalingen), badge | ❌ | M | Betaalprovider (KYC via Connect) |
| Publiek profiel | Pagina `/@naam` met bio, foto, links, recepten, collecties en volgers | ❌ (geen bio-veld, C-01) | M | Nieuwe tabel `creators` + publieke RLS |
| Publicatie | Recept "openbaar", concept en gepland, versies, eigenaarschap van foto's | ❌ (C-03) | M | Kolom `zichtbaarheid`; moderatie |
| Collecties | Eigen mappen, publiek of privé, volgorde, omslag | ❌ (collecties zijn automatisch afgeleid; zelf maken kan niet) | S–M | Tabel `collections` |
| Volgen en feed | Volgen, feed met nieuwe recepten, meldingen | ❌ | M | |
| Sociale interactie | Bewaren door anderen, "gekookt"-telling, reacties of beoordelingen | ❌ (A-10) | M–L | Moderatie (DSA) |
| Exclusieve content | Recept alleen zichtbaar voor leden; voorbeeld voor niet-leden | ❌ | M | RLS op lidmaatschap |
| Gratis versus betalende volgers | Twee niveaus | ❌ | M | Memberships |
| Memberships en abonnementen | Maand- of jaarplan per creator, proefperiode, opzeggen, herroepen | ❌ | L | Stripe Connect / Mollie, juridisch |
| Betalingen en commissies | Platformcommissie (bv. 10–20 %), betaalkosten, btw | ❌ | L | Betaalprovider; btw-rol (zie BCC-audit §5) |
| Uitbetalingen | Maandelijks, drempel, overzicht, nooit dubbel | ❌ | L | Connect |
| Creatorstatistieken | Weergaven, bewaard, gekookt, volgers, omzet, uitbetaald | ❌ (C-07) | M | Gebeurtenissen per recept (`usage_events` bestaat, niet per creator) |
| Beheer en moderatie | Meldknop, wachtrij, verbergen, motivering, beroep | ❌ | M | DSA |
| Consumentenrechten | Herroeping (14 d, digitale inhoud), herroepingsknop (Richtlijn 2023/2673), terugbetaling, eenvoudig opzeggen | ❌ | M | Juridisch |
| Privacy en beveiliging | Publiek versus privé gescheiden; geen e-mail of naam van leden voor de creator tenzij nodig; DAC7-gegevens alleen voor de financiële rol | ❌ | M | |

S = dagen, M = 1–2 weken, L = meerdere weken (één ontwikkelaar, ruwe schatting).

## Wat een creator nu ervaart (persona C, kritisch)
- **Positief:** een recept invoeren is snel en ziet er professioneel uit (grote serif-titel, duidelijke acties, foto kiezen of nemen). Delen werkt.
- **Negatief:**
  - Er is geen plek waar een publiek mij kan vinden, volgen of betalen.
  - Mijn profiel heeft geen bio.
  - Ik weet niet hoe vaak mijn gedeelde recept geopend is.
  - Een influencer zou na 10 minuten afhaken: de app helpt bij koken voor jezelf, niet bij publiek opbouwen.
- **Score functionele volledigheid voor creators: 1/10.**

## Aanbevolen volgorde (na akkoord)
1. **Zonder geld**, om eerst vraag te bewijzen:
   - publiek profiel met bio;
   - recept openbaar;
   - eigen collecties;
   - volgen;
   - eenvoudige statistieken (weergaven, bewaard);
   - meldknop met moderatiewachtrij.
2. Creators echt laten publiceren in Ontdek, met naam (de plek staat al in de code).
3. **Pas daarna geld:** Foodlo-abonnement (Stripe Billing), dan creator memberships (Connect), met juridisch advies over de btw-rol en DAC7.

Er worden geen betalingen geactiveerd en geen commerciële infrastructuur gebouwd zonder afzonderlijke toestemming.
