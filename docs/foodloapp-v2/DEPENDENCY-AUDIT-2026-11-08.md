# Afhankelijkheden en `bun.lock` — onderzoek 2026-11-08

## 1. Waarom `bun.lock` veranderd is (rechtzetting)
In het eerste rapport stond "lockfile ongewijzigd". Dat klopte **alleen voor de eerste installatie** (`bun install --frozen-lockfile`). Daarna heb ik bewust dev-dependencies toegevoegd, wat `bun.lock` wél wijzigde:

| Commit | Toegevoegd (alle `devDependencies`, exacte versies) |
|--------|-----------------------------------------------------|
| `8668ea3` | `vitest@5.0.5`, `jsdom@29.1.1`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2`, `@testing-library/user-event@14.6.8`, `axe-core@4.14.0` |
| `aa8ba97` | `@playwright/test@1.64.1`, `@axe-core/playwright@4.14.0` |

Dat had duidelijker gemeld moeten worden.

### Bewijs: bestaande pakketten zijn niet gewijzigd
Vergelijking `origin/v2/claude-code-ready` → `v2/dev` (vóór de beveiligingsupgrade hieronder):
- 735 → 817 pakketsleutels: **84 toegevoegd, 2 verwijderd, 4 met een andere versie op de topsleutel.**
- Die 4 (`lru-cache`, `magic-string`, `ansi-styles`, `@jridgewell/sourcemap-codec`) zijn **hoisting-verschuivingen**: een nieuwe testtool heeft een nieuwere versie nodig, die nu bovenaan staat; de oude versie staat genest onder de oorspronkelijke gebruikers.
- Voor **elk** bestaand pakket is nagerekend naar welke versie zijn afhankelijkheden resolven (bun-resolutie van binnen naar buiten): **1 263 relaties, 0 gewijzigd** voor bestaande pakketten. De enige verschillen zijn de afhankelijkheden van de nieuwe topversies zelf.
- Workspace: alleen de 8 nieuwe devDependencies; `overrides` ongewijzigd.
- **Reproduceerbaar:** schone map met alleen `package.json`, `bun.lock`, `bunfig.toml` → `bun install --frozen-lockfile` → `bun.lock` byte-voor-byte identiek.
- **Geen nieuwe kwetsbaarheden:** `bun audit` op de basis en op `v2/dev`: identiek (36), 0 nieuw.
- De 24-uurs supply-chain-bescherming (`minimumReleaseAge`) is niet omzeild; alle gekozen versies waren weken oud.

**Conclusie:** behouden. De wijziging is bedoeld, reproduceerbaar, raakt geen productie-afhankelijkheden en introduceert geen kwetsbaarheden.

## 2. Bestaande kwetsbaarheden in productie (ook op `main`/live)
`bun audit` vond in de **basis** (dus ook de live app) 36 meldingen: 4 kritiek, 18 hoog.

Runtime-relevant (draait in de live app):
| Pakket | Probleem | Ernst | Opgelost vanaf |
|--------|----------|-------|----------------|
| `@tanstack/react-start` 1.168.32 / `start-server-core` 1.169.17 | Ongeauthenticeerde reflected XSS in serverfunctie-antwoorden (GHSA-qx66-fv34-fjm8) | Kritiek | 1.168.60 / 1.169.39 |
| `seroval` 1.5.6 (via `router-core`) | Deserialisatie roept door aanvaller gekozen functies aan; geheugenuitputting (GHSA-p6vx-979v-rg4c e.a.) | Kritiek/hoog | 1.6.10 |
| `zod` 3.25.76 | Geheugenuitputting bij te grote begrensde collecties (GHSA-mrhx-c7xc-m3w5) | Hoog | 4.6.6 (major-upgrade) |

### Uitgevoerd op `v2/dev` (niet in productie)
- `@tanstack/react-start` 1.168.32 → **1.168.61**, `@tanstack/react-router` 1.170.18 → **1.170.42**, `@tanstack/router-plugin` 1.168.23 → **1.168.43** (zelfde releasedag, 10 okt).
  - Bewust **niet** 1.169.x: daar is `.inputValidator` hernoemd naar `.validator` (83 serverfuncties in door Lovable beheerde bestanden). 1.168.61 is de kleinste gepatchte versie met dezelfde API.
  - Resultaat: `start-server-core` 1.169.40, `router-core` 1.171.35, `seroval` 1.7.10.
  - Eén typewijziging: `errorComponent` krijgt `error: unknown` → `__root.tsx` aangepast (gedrag ongewijzigd).
- `vite` 8.1.5 → **8.1.6** (patch; 5 dev-server-meldingen opgelost).
- Na de upgrade: **23 meldingen (1 kritiek, 13 hoog)**, alle kritiek/hoog in **ontwikkel-/buildtools** (`shell-quote`/`launch-editor` via TanStack-devtools, `brace-expansion`/`minimatch` via eslint, `js-yaml`, `nanoid`/`source-map-js` via postcss) **behalve `zod`**.
- Verificatie: typecheck 0 fouten, 283 unit/component-tests, build, 34 E2E-tests groen.

### Owner-actie (approval gate G3/G4)
De **live app blijft kwetsbaar** tot deze versies in productie staan. Aanbeveling: deze upgrade als eerste, losse wijziging naar productie brengen (na review), los van de rest van V2. Rollback: `package.json` + `bun.lock` van commit vóór de upgrade terugzetten.

### Nog open
- **zod 3 → 4**: aparte migratie (API-verschillen in o.a. `.default()`, foutobjecten). Tot dan: request-bodies blijven klein (Cloudflare-limieten) en alle arrays hebben `.max()`; restrisico gedocumenteerd.
- Dev-only kwetsbaarheden: lossen zich op bij een update van `@lovable.dev/vite-tanstack-config` en eslint; niet bereikbaar via gebruikersinvoer.
