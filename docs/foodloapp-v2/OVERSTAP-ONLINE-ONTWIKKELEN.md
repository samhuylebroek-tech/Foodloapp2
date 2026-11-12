# Overstap naar online ontwikkelen, met de echte schermen centraal

Stand 2026-11-12, `v2/dev`, lokaal. Niets gepusht, niets geactiveerd.

**Doel:**
- je computer niet meer belasten;
- de ontwikkeling volgen vanuit je browser;
- de echte app zien en bedienen;
- bij elke wijziging voor/na-beelden.

## 1. Wat elk hulpmiddel echt kan (gecontroleerd in de officiële documentatie)
| | Claude Code in de cloud (claude.ai/code) | Claude Code Desktop (app op je Mac) |
|---|---|---|
| Waar draait het werk | Op een virtuele machine van Anthropic (4 processors, 16 GB). Je Mac mag uit. | Op je Mac (lokaal), of in de cloud als je "Cloud" kiest |
| Volgen | In je browser of de Claude-app op je telefoon; je kan bijsturen en reageren op regels code | Zelfde, plus een venster op je Mac |
| De app zien | **Geen ingebouwd browservenster.** Claude kan wel zelf Chrome gebruiken (staat klaar) en schermafdrukken maken. Die komen in de pull request of in een downloadbare galerij. | **Wel:** een ingebouwd browservenster (Browser-paneel). Jij en Claude zien en bedienen dezelfde app. Claude maakt schermafdrukken, klikt en controleert na elke wijziging. |
| Belasting van je Mac | Geen | Alleen de demo-app (licht). De zware testsuite draait in de cloud. |
| Kosten | Binnen je huidige Claude-abonnement; geen aparte kosten voor de virtuele machine | Idem |
| Vereist | De code op GitHub (push) en de Claude GitHub-app op de repository | Niets extra; de cloudsessies vereisen hetzelfde als links |

**Besluit:** combineer de twee.
- **De cloud doet het zware werk:** bouwen, alle tests, schermafdrukken.
- **Desktop is je venster op de echte app:** je opent de demo in het Browser-paneel, klikt zelf rond en geeft feedback.
- **Later komt staging erbij** (beslissing 1). Dan krijg je een gewone webadres met verzonnen gegevens dat je op je telefoon opent, zonder je Mac.

## 2. Zo ziet een werkdag eruit
1. Jij schrijft een opdracht in claude.ai/code, op je computer of je telefoon. Bijvoorbeeld: "Maak de Keuken leesbaar met grote tekst."
2. Claude maakt in de cloud een eigen branch (`v2/<onderwerp>`):
   - eerst de **voor**-rondgang (9 schermen, 2 thema's);
   - dan de wijziging;
   - Claude bekijkt de beelden zelf en verbetert wat het ziet;
   - daarna de **na**-rondgang.
3. Claude opent een pull request naar `v2/dev` (nooit naar `main`). Je ziet er:
   - wat de gebruiker merkt;
   - de voor/na-beelden;
   - de tests.

   GitHub Actions maakt er ook een downloadbare galerij "schermen" bij.
4. Jij bekijkt de beelden op je telefoon. Wil je zelf klikken, dan open je in Desktop de demo in het Browser-paneel.
5. Je reageert in de sessie of op de beelden. Claude past aan. Jij zegt "goed", en de wijziging gaat naar `v2/dev`.

## 3. Klaargezet (lokaal, getest)
| Wat | Bestand | Getest |
|---|---|---|
| Visuele rondgang: 9 schermen in het lichte thema en in "Extra duidelijk" met grote tekst | `tests/e2e/rondgang.spec.ts`, `npm run schermen` | 2/2, ± 50 s; 18 beelden, 2,5 MB |
| Galerij met voor/na naast elkaar (GitHub en browser) | `scripts/schermen-galerij.mjs` | ✓ |
| Desktop-preview: de demo start in het Browser-paneel | `.claude/launch.json` | Configuratie volgens de documentatie; te proberen in Desktop |
| Cloudstart: installeert alles automatisch, alleen in de cloud | `.claude/settings.json`, `scripts/cloud-start.sh` | Lokaal doet het niets (gecontroleerd); in de cloud pas na de push |
| Playwright gebruikt de Chrome die in de cloud klaarstaat | `playwright.config.ts` (`CHROME_PATH`) | Lokaal ongewijzigd |
| Verboden acties, ook voor Claude in de cloud: force-push, push naar `main`, databankmigraties, `.env` lezen | `.claude/settings.json` | — |
| Werkregels voor Claude in de cloud: branch `v2/dev`, visuele werkwijze | `CLAUDE.md` | — |
| CI zuiniger | `.github/workflows/ci.yml` | De zware E2E (5 × ± 20 min) en de rondgang draaien alleen bij pull requests of met de hand. Een privérepository heeft beperkte gratis minuten (GitHub Free: 2 000 per maand). |
| Controle vóór de push | `npm run controle-voor-push` | Geslaagd op geheimen, `.env`, grootte en vooruitspoeling. De enige ✗ was de nog niet vastgelegde wijziging. |
| **Reservekopie van alle commits** | `~/Documents/Foodloapp-reservekopie/foodloapp-alle-branches-2026-11-12.bundle` (7,2 MB) | `git bundle verify` geslaagd. Alle 8 branches zijn identiek. Een proefherstel geeft exact dezelfde `v2/dev`. |

## 4. Commits veilig overzetten (niets verloren, origineel onaangeroerd)
**Vaststellingen:**
- V2 is een *worktree* van dezelfde repository. Pushen vanuit de V2-map verandert niets aan de map, de branch of de niet-vastgelegde wijzigingen van de originele repository (`chore/secure-env-files`).
- `origin/v2/dev` heeft niets wat lokaal ontbreekt. De push is dus een gewone vooruitspoeling (124+ commits), zonder force-push.
- `main` wordt niet aangeraakt, dus Lovable merkt niets.

**Stappen** (pas na je schriftelijke akkoord):
1. `npm run controle-voor-push`: alles moet ✓ zijn.
2. Een nieuwe reservekopie (bundel) van die dag.
3. `git push origin v2/dev`: één commando, alleen deze branch.
4. Controle: `git rev-parse v2/dev` = `git rev-parse origin/v2/dev`, en de originele map is ongewijzigd (`git status`).
5. Op GitHub draaien typecheck, unittests, lint, build en RLS; die moeten groen zijn.
6. Jij installeert de Claude GitHub-app op de repository (github.com/apps/claude) en kiest **alleen deze repository**. In claude.ai/code maak je een omgeving aan:
   - netwerk **Beperkt** (Limited) met pakketbeheerders;
   - geen omgevingsvariabelen;
   - geen geheimen.
7. Eerste cloudsessie, als proef: "draai `npm run schermen` en toon de galerij".

**Terugdraaien:** de push voegt alleen commits toe aan `v2/dev`. Er wordt niets overschreven. De bundel blijft als vangnet.

**Privacy:**
- De code bevat geen echte geheimen (scan van 2026-11-12).
- In de cloud draait de app alleen tegen de nep-databank. Er komen geen echte sleutels in de cloud.
- In een gedeelde sessie of pull request kunnen wel stukken code staan. Hou sessies daarom **privé** (standaard).

## 5. Beslissingen voor jou
| # | Vraag | Aanbevolen | Gevolg |
|---|---|---|---|
| O1 | Akkoord om `v2/dev` te pushen (stappen hierboven) | Ja | Zonder push kan de cloud de code niet zien |
| O2 | Claude GitHub-app installeren op alleen deze repository | Ja | Nodig voor cloudsessies en pull requests |
| O3 | Cloudomgeving met netwerk "Beperkt" | Ja | De app in de cloud kan productie niet bereiken |
| O4 | Staging (beslissing 1): je eigen adres om op je telefoon rond te klikken | Ja, deze week | Zonder staging zie je de app live alleen via Desktop of de beelden |

## 6. De eerste visuele ronde (gevonden met de rondgang van vandaag)
| # | Scherm | Wat je ziet | Stand |
|---|---|---|---|
| V1 | Lijst, grote tekst | Productnamen afgekapt ("b.", "do…", "run…"); "Klantenkaarte/n" afgebroken | **Opgelost** (voor/na in de galerij) |
| V2 | Keuken, grote tekst | Voorraadnamen afgekapt ("pom…", "rund…", "olijf…") | Volgende |
| V3 | Recept, grote tekst | De knop "Op mijn lijst" is te krap. De ingrediëntlabels in de stappen breken lelijk af ("1 verse / bos dille"). | Volgende |
| V4 | Vandaag, grote tekst | De "Daarna"-rijen breken woord per woord af | Volgende |
| V5 | Alle schermen, normaal | Een rustiger ritme. Bovenaan wat nu telt, de rest inklapbaar. Meer foto's van gerechten. | Ontwerpvoorstel, met beelden |
