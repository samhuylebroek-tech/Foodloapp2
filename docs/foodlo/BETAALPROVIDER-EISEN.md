# Eisen aan een echte betaalprovider (fase 6, voorstel — geen keuze gemaakt)

Vandaag praat Foodlo uitsluitend met `TestBetaalProvider` (`src/lib/betalen/test-provider.ts`)
via de interface `BetaalProvider` (`src/lib/betalen/types.ts`) en `kiesBetaalProvider()`
(`src/lib/betalen/provider.ts`), die alles behalve de testmodus weigert zolang
`BETAALPROVIDER_GEKOPPELD = false`. Er wordt niets aangerekend, teruggestort of uitbetaald.

## Wat de interface vraagt

| Functie | Doel | Test vandaag |
| --- | --- | --- |
| `startCheckout` | Gehoste betaalpagina; Foodlo ziet nooit kaartgegevens | lokaal pad, geen netwerk |
| `verwerkWebhook` | Ondertekende gebeurtenis → genormaliseerd `BetaalEvent`, idempotent op event-id | vaste testhandtekening (bewust onveilig) |
| `haalStatus` / `annuleer` | Status opvragen, opzeggen aan het einde van de periode | statusmachine |
| `terugbetaal` | (Gedeeltelijke) terugbetaling, o.a. herroeping binnen 14 dagen | `test_terugbetaald` |
| `startUitbetaling` | Uitbetaling aan makers (marketplace) | `zou_uitbetaald_worden` |

## Harde eisen (een provider die één hiervan mist, valt af)

1. **PCI DSS via gehoste checkout of betaal-elementen** (SAQ A): geen kaartgegevens op Foodlo-servers of in logs.
2. **Ondertekende webhooks** met geheim per omgeving, herhaalbescherming en vaste event-id's.
3. **Abonnementen**: proefperiode, maand en jaar, pro rata bij overstap, opzeggen tegen periode-einde, mislukte betaling met automatische herpogingen (genadeperiode).
4. **Terugbetalingen** volledig en gedeeltelijk via API, met creditnota-gegevens.
5. **Btw/OSS**: btw per land van de klant (EU One-Stop-Shop), correcte facturen of factuurgegevens, Belgische notatie; tarieven configureerbaar (nu 21 % als voorbeeld in `prijzen.ts`).
6. **Marketplace-uitbetalingen** aan makers met **KYC/KYB** door de provider, uitbetalingsschema, inhoudingen (platformfee, betaalkosten) en jaaroverzichten.
7. **Chargebacks/geschillen**: meldingen via webhook, bewijs kunnen indienen, rechten automatisch intrekken bij verloren geschil.
8. **SCA/3-D Secure** (PSD2) en lokale methodes (Bancontact, Payconiq/Wero, SEPA-domiciliëring).
9. **Testomgeving** die gelijk is aan productie (testkaarten, testwebhooks).
10. **Gegevens in de EU** of passende waarborgen (AVG), verwerkersovereenkomst.

## Vergelijkingscriteria (wegen na juridische en fiscale review)

- Kosten per transactie (kaart, Bancontact, SEPA), vaste kosten, kosten per uitbetaling en per geschil.
- Ondersteuning van makers in andere landen (uitbetaling, valuta, belastingformulieren).
- Hoeveel van de btw/OSS-administratie de provider overneemt (merchant of record of niet).
- Kwaliteit van de API: idempotentie, webhooks, SDK zonder vendor lock-in, export van gegevens.
- Fraudebeheer, limieten voor nieuwe makers, uitbetalingsvertraging.
- Toegankelijkheid van de gehoste checkout (WCAG 2.2 AA, grote tekst, Nederlands).
- Overstapbaarheid: abonnementen en klantreferenties exporteerbaar.

## Wat er moet gebeuren vóór een echte koppeling (gate G5)

1. Juridische review (algemene voorwaarden, herroepingsrecht digitale inhoud, makercontract).
2. Fiscale review (OSS, facturatie, rol van Foodlo als platform).
3. Veiligheidsreview van webhooks, geheimen en rechten (`entitlements` blijft alleen door de server te schrijven, voorstel 0012/0023).
4. Een aparte migratie die `modus = 'live'` toelaat; daarna pas `BETAALPROVIDER_GEKOPPELD = true`.
