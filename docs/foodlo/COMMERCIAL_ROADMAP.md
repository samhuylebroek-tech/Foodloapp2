# Commerciële roadmap
**Bron van waarheid voor:**
- creators en food influencers;
- partners en het Business Control Center (BCC);
- betalingen en premium.

**Put uit:**
- `CREATOR-GAP-ANALYSE.md`;
- `BUSINESS-CONTROL-CENTER-AUDIT.md`;
- `FOODLOAPP-V2-MASTERPLAN.md` §6–7 en WP13–14;
- `ARCHITECTUUR-VOORSTELLEN.md` §3.

**Stand:** er bestaat nog geen creator-, partner- of betaalfunctie in de code. Alles hieronder blijft in de visie. Niets wordt geactiveerd zonder expliciet akkoord. Voor betalingen geldt bovendien G5 en een juridische beoordeling.

## 1. Grondregels
1. **Commerciële inhoud is altijd herkenbaar.** Een vast label "Gesponsord" of "In samenwerking met …", dat ook voor schermlezers leesbaar is.
2. **Geen verborgen sturing.** Commerciële belangen veranderen de volgorde of de keuze van persoonlijke voorstellen nooit onzichtbaar. Gesponsorde plekken zijn aparte, gelabelde plekken.
3. **Veiligheid gaat voor.** Allergie- en dieetregels gelden ook voor gesponsorde en creatorrecepten.
4. **Aparte omgevingen.** Het partner-BCC is een aparte omgeving met eigen rollen. Het team-Control Center blijft van het Foodlo-team.
5. **Betalingen alleen op de server.** De server controleert altijd het recht om te betalen of te leveren:
   - provider achter een adapter;
   - webhooks met verificatie;
   - idempotentie;
   - nooit kaartgegevens bij ons.

   De interface volgt de server (BUG-143).

## 2. F2: creators
| Stap | Inhoud | Voorwaarde |
|---|---|---|
| C1 | Moderatie (meldknop, wachtrij, DSA-verplichtingen) | Vóór elke publieke inhoud |
| C2 | Creatorprofiel (`/@naam`, bio, omslag, specialisaties, badge na verificatie) | Tabellen (G1/G2) |
| C3 | Zichtbaarheid per recept: privé, gedeeld, publiek (later: volgers, betaald) | Migratie (G1/G2) |
| C4 | Publiceren: concept, voorbeeld, gepland, versies | C3 |
| C5 | Volgen, feed, creators ontdekken in Ontdek | C2 |
| C6 | Collecties van creators (dezelfde tabel als eigen collecties) | Collecties (F2) |
| C7 | Statistieken per recept (bekeken, bewaard, gekookt), zonder persoonsgegevens van volgers | C4 |
| C8 | Bronvermelding: "Foodlo-keuken" wordt de echte maker | C2 |

## 3. F3: commercieel platform (BCC voor partners)
| Onderdeel | Inhoud |
|---|---|
| Bedrijfsprofielen | merk, producent, retail, restaurant; verificatie |
| Producten en diensten | catalogus, koppeling ingrediënt ↔ product (lijst, winkelmodus) |
| Campagnes en gesponsorde inhoud | gelabelde plekken, looptijd, doelgroep zonder gevoelige gegevens (nooit allergie of gezondheid) |
| Rapportage en dashboards | geaggregeerd, AVG-proof, geen individuele gebruikers |
| Rollen en rechten | per organisatie: eigenaar, beheerder, analist, finance |
| Integraties | productfeeds, retail-API's, later CRM |
| AI-ondersteuning | campagneteksten, inzichten (zelfde AI-laag, eigen budget) |

## 4. F3: betalingen en verdienmodellen
| Model | Stand | Voorwaarde |
|---|---|---|
| Gratis consumentenervaring met limiet (100 gerechten) | bestaat | — |
| AI-credits (gratis toegekend, aanvragen) | bestaat | — |
| Creditpakketten kopen | klaar in de interface, staat uit | G5, provider |
| Premium-abonnement | ontwerp | B5 (#29), G5, jurist (herroeping, btw) |
| Creatorabonnementen, premium collecties | ontwerp | C1–C7, Connect/KYC, DAC7 |
| Affiliate, merksamenwerkingen | nog niet ontworpen | jurist (reclameregels), labels |
| Zakelijke abonnementen (partner-BCC) | ontwerp | §3 |

**Provider:** Stripe (Billing en Connect Express) of Mollie. Kiezen na:
- geografie;
- kosten;
- uitbetalingen via een marktplaats;
- btw en OSS (#29).

**Datamodel (ontwerp, BCC-audit §10):**
- `subscriptions`;
- `payment_events`;
- `ledger_entries`;
- `entitlements` (wie mag wat zien).

## 5. Fase 6: indeling gratis / premium (voorstel aan de eigenaar)

Eén centrale lijst: `src/lib/betalen/rechten.ts` (rechten en niveaus) en `src/lib/betalen/prijzen.ts`
(alle prijsvoorstellen en btw). De server controleert met `vereisRecht`; de UI toont "Dit hoort bij
Premium" met uitleg.

- **Altijd gratis (kern):** allergie- en dieetcontrole, boodschappenlijst, weekmenu plannen, recepten
  bewaren/importeren/koken, voorraad, gezin en delen, kookstand, je gegevens exporteren. Een unit-test
  bewaakt dat geen premiumrecht hieraan raakt.
- **Premium (voorstel € 4,99/maand of € 49,90/jaar, 14 dagen proef):** weekmenu-sjablonen,
  seizoenskalender. Beide vaste inhoud zonder AI-kosten.
- **Maker (`maker:<id>`):** exclusieve recepten en collecties van die maker (fase 4).
- **Partner Basis / Plus:** producten koppelen; campagnes en rapportage (fase 5).
- **AI-limieten:** voor iedereen gelijk (20 slimme vragen per dag); Premium koopt geen extra AI,
  zodat de kosten voorspelbaar blijven. Aan te passen in `AI_LIMIETEN` na beslissing.
- Betaalprovider: geen keuze; eisen en criteria in `BETAALPROVIDER-EISEN.md`.
