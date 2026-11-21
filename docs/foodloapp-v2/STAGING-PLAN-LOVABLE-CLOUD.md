# Staging via Lovable Cloud: concreet stappenplan

> Samengevat in [`docs/foodlo/RELEASE_PLAN.md`](../foodlo/RELEASE_PLAN.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11. **Niet uitgevoerd.** Er is geen project aangemaakt, niets gekoppeld en niets gemigreerd. Dit plan gebruikt **nooit productiegegevens**.

## 1. Wat Lovable vandaag biedt (en wat niet)
- **Test en Live** (een aparte testdatabank per project) bestaat niet meer.
  - Volgens de [Lovable-changelog](https://docs.lovable.dev/changelog) en [deze samenvatting](https://viberaven.dev/lovable-test-and-live-environments-retired): sinds 24 maart 2026 niet meer voor nieuwe projecten, daarna volledig stopgezet.
  - De losgekoppelde testdatabanken worden gewist. Over de datum verschillen de bronnen (begin november of 1 december 2026).
  - **Controleer in je project** of daar nog een testomgeving aan hangt. Staan er gegevens in die je wil houden, dan moet je die vóór die datum veiligstellen.
- **Drafts** (een kladversie van het project met eigen voorbeeld) **delen de databank met live**. Een draft is dus géén staging: testgegevens en migraties komen in de echte app terecht.
- **Gevolg:** een veilige staging is een **apart Lovable-project met een eigen Lovable Cloud-backend**.

## 2. Opzet
| | Live (bestaat) | Staging (nieuw) |
|---|---|---|
| Lovable-project | het huidige project | nieuw project "Foodlo Staging" |
| Databank | Lovable Cloud van live | eigen Lovable Cloud, **leeg**, alleen verzonnen testgegevens |
| Code | branch `main` | dezelfde repo, branch `staging` (vanaf `v2/dev`) |
| Gebruikers | echte mensen | alleen testaccounts (`…@voorbeeld.test`) |
| Geheimen (AI-sleutel, mail) | echt | **geen**, of een aparte sleutel met een laag maandbudget |
| Betalingen | geen | geen |

**Opgelet: Git-koppeling.** Lovable koppelt een project aan één branch.
- Het huidige project mag zijn branch niet verliezen. Koppel dus het **nieuwe** project aan `staging`.
- Pushen naar `staging` raakt live niet.
- Ik push pas als jij het zegt.

## 3. Stappen
| # | Wie | Wat | Controle | Stop als |
|---|---|---|---|---|
| 1 | Jij | Kijken of je Lovable-plan een extra project met Cloud toelaat **zonder extra kosten**. Is er een kost, dan beslis jij. | Prijs gezien | Er een kost is waar jij niet mee akkoord gaat |
| 2 | Jij | Nieuw, leeg Lovable-project aanmaken met Lovable Cloud aan. Geen remix van live: een remix kan instellingen of bestanden meenemen. | Leeg project met eigen Cloud | Het project live-gegevens toont |
| 3 | Ik (na akkoord) | Branch `staging` maken vanaf `v2/dev` en pushen. | `git log` gelijk aan `v2/dev` | — |
| 4 | Jij | Het stagingproject koppelen aan GitHub, branch `staging`. | Lovable toont de V2-code | Lovable live aan `staging` koppelt |
| 5 | Lovable/ik | Schema opbouwen: de repo-migraties, daarna `0002a` (basislijn recepten en foto's, die live al heeft). | `tests/rls/alles.mjs` tegen staging: zelfde uitkomst als lokaal | Eén afwijking: stoppen en vergelijken |
| 6 | Jij | Het schema van **live** opvragen (alleen de structuur, geen inhoud) en aan mij geven, zodat ik het met staging vergelijk (BUG-011). | Lijst verschillen | Een verschil dat niet te verklaren is |
| 7 | Ik | Voorstellen `0002` (beheer), `0003` (bewaartermijnen) en `0004` (privé-voorkeuren) uitvoeren op staging, telkens met `.down.sql` getest. | RLS-tests 18/18 | Afwijking → terugdraaien |
| 8 | Ik | Testgegevens zaaien: verzonnen gezin, recepten zonder echte foto's. Script naar het model van `tests/e2e/demo-data.mjs`. | Demo-gebruikers kunnen aanmelden | Er staat een echt e-mailadres in |
| 9 | Ik | Volledige Playwright-suite tegen de stagingadres (alleen lezen en schrijven in staging). | Zelfde resultaat als lokaal | Een kernflow faalt |
| 10 | Jij en ik | 2FA-oefening (2FA-STAPPENPLAN stappen 2–7) | Checklist afgevinkt | Buitengesloten zonder herstel |
| 11 | Jij en ik | Echte iPhone en Android, twee toestellen op één lijst (PRAKTIJKTEST-TOESTELLEN) | Script afgewerkt | Kernflow onbruikbaar |

## 4. Afspraken die staging veilig houden
- Nooit een kopie van de live-databank, ook niet "even".
- Geen echte e-mailadressen. Mails van staging gaan nergens heen (geen mailsleutel ingesteld).
- De AI-sleutel ontbreekt of heeft een eigen klein budget. De AI-budgetrem staat aan.
- Staging is niet openbaar: alleen testaccounts, en geen link delen buiten de testers.
- Na de test: staging leegmaken of het project verwijderen.

## 5. Waarom geen andere opties
- **Draft:** deelt de live-databank (zie §1).
- **Aparte Supabase-gratisversie buiten Lovable:** kan ook gratis, maar dan zit staging niet in Lovable Cloud en verschilt de opzet van live. Dat is minder representatief. Het is wel een reserveplan als §3 stap 1 een kost oplevert.
