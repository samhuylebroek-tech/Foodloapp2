# Beveiligingsrelease — klaar voor review

**Branch:** `security/tanstack-seroval` (lokaal, niet gepusht)
**Werkmap:** `~/Documents/GitHub/dinner-dialogue-hub-security`
**Basis:** `main` @ `2883de1` (= live) · **Commit:** `39bd303`

## Wat er verandert (exact 3 bestanden)
| Bestand | Wijziging |
|---------|-----------|
| `package.json` | `@tanstack/react-start` 1.168.32 → 1.168.61 · `@tanstack/react-router` 1.170.18 → 1.170.42 · `@tanstack/router-plugin` 1.168.23 → 1.168.43 · `vite` 8.1.5 → 8.1.6 |
| `bun.lock` | Alleen TanStack-, seroval- en vite-pakketten + verschuivingen die daaruit volgen (Babel-types, picomatch voor de buildtools). Geen andere pakketten. |
| `src/routes/__root.tsx` | 1 regel: `error: Error` → `error: unknown` (strenger type in de gepatchte router; zelfde gedrag) |

## Opgeloste CVE's in de live app
| Ernst | CVE | Pakket | Probleem |
|-------|-----|--------|----------|
| Kritiek 9,3 | CVE-2026-102989 | TanStack Start (`start-server-core` 1.169.17 → 1.169.40) | Ongeauthenticeerde reflected XSS in serverfunctie-antwoorden |
| Kritiek 9,8 | CVE-2026-104846 | seroval 1.5.6 → 1.7.10 | Deserialisatie roept door aanvaller gekozen functies aan |
| Hoog 7,5 | CVE-2026-104845, -116581, -116584 | seroval | Geheugenuitputting / DoS bij deserialisatie |
| Hoog 7,3 | CVE-2026-116580 | seroval | Deserialisatie roept functies aan (AsyncIterator) |
| Matig 4,7 | CVE-2026-116582 | seroval | Scriptinjectie via RegExp |
| Hoog–laag | CVE-2026-112942 … 112946 | vite | Alleen de ontwikkelserver (niet live) |

## Verificatie (uitgevoerd)
| Controle | Resultaat |
|----------|-----------|
| `git diff --stat 2883de1 39bd303` | 3 bestanden, +98 −35 |
| `bun install --frozen-lockfile` in een schone clone | ✅, lockfile byte-identiek |
| `tsc --noEmit` | ✅ 0 fouten |
| `vite build` (productie, Cloudflare/nitro) | ✅ |
| `bun audit` | 36 → 23 meldingen; de 7 runtime-advisories (TanStack/seroval) zijn **weg**. Over: alleen ontwikkel-/buildtools + zod 3 |
| Rooktest ingelogd (kopie **zonder `.env`**, nep-Supabase): Start, Recepten, Nieuw recept, Weekmenu, Boodschappen, Meldingen, Instellingen | ✅ 12/12 serverfunctie-oproepen HTTP 200, 0 paginafouten; identiek aan `main` |

## Wat jij doet (approval gates G3/G4)
1. **Push** de branch: in GitHub Desktop *File → Add Local Repository* → `~/Documents/GitHub/dinner-dialogue-hub-security` → **Publish branch**.
2. Open een **pull request** `security/tanstack-seroval` → `main` en bekijk de diff. Het moeten exact 3 bestanden zijn en `.env` mag er niet tussen staan.
3. **Lovable-preview testen vóór het publiceren** (± 10 min):
   - [ ] Aanmelden met e-mail, en met Google (als je dat gebruikt)
   - [ ] Startpagina laadt; "Vandaag op het menu" klopt
   - [ ] Recept openen → **Start koken** → door de stappen
   - [ ] Nieuw recept via **link inlezen** (serverfunctie + AI)
   - [ ] Weekmenu: gerecht inplannen → **op boodschappenlijst** zetten
   - [ ] Boodschappen: item afvinken en terugzetten
   - [ ] Instellingen → Meldingen openen; testmelding sturen
   - [ ] Control Center (beheer) openen
   - [ ] Geen rode foutschermen ("Deze pagina kon niet laden")
4. **Noteer vóór het publiceren** de huidige gepubliceerde versie in Lovable (versiegeschiedenis) en de git-SHA `2883de1`.
5. **Merge** naar `main` en **publiceer** op een rustig moment (tabbladen die al openstaan moeten na de update één keer herladen).
6. **Na het publiceren:** de checklist uit stap 3 op de live app; Control Center → Fouten 30 min in het oog houden. Controleer dat `package.json` op `main` de nieuwe versies houdt (Lovable mag ze niet terugzetten).

## Terugrollen
- **Wanneer:** aanmelden mislukt, serverfuncties geven 500, pagina's blijven leeg, of het foutpercentage stijgt duidelijk.
- **Snelst:** in Lovable de genoteerde vorige versie herstellen en opnieuw publiceren.
- **Via git:** `git revert <merge-commit>` op `main`: een nieuwe commit, geen force-push. Daarna opnieuw publiceren.
- **Let op:** terugrollen brengt de kritieke kwetsbaarheden terug. Doe het alleen tijdelijk.
- **Geen data-rollback nodig:** er zijn geen databasewijzigingen.

## Kandidaat voor een tweede beveiligingsrelease (nog niet op deze branch)
Op `v2/dev` zitten fixes die ook voor de live app belangrijk zijn, maar applicatiecode raken (dus aparte review):
- SSRF-bescherming bij link-import en foto ophalen (BUG-001/002/003), push-endpoints (BUG-007).
- Lijsten in serverschema's eerst op lengte controleren (BUG-049).
- Invoervalidatie meldingen/uitnodigingen (BUG-006/008), rechten-booleans (BUG-015).
