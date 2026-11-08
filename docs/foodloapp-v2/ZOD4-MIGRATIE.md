# Zod 3 → 4: analyse en migratieplan (BUG-035)

## Wat de kwetsbaarheid echt is
- **CVE-2023-54404 / GHSA-mrhx-c7xc-m3w5** (hoog, 7,5), zod < 4.6.6: `$ZodArray` (zod-4-kern) verzamelt per fout element een foutobject, zonder grens. Een enorme lijst kan zo het geheugen van de server uitputten.
- De app gebruikt de **v3-API** (`import { z } from "zod"`, pakket 3.25.76). Het geadviseerde codepad (`$ZodArray`) wordt dus waarschijnlijk niet rechtstreeks geraakt.
- **Maar:** een eigen test toont dat **zod 3 hetzelfde gedrag heeft**. 100 000 ongeldige items geven 100 001 foutobjecten, *ook met* `.max()`. Hetzelfde risico bestond dus in de huidige code.

## Al gedaan (zonder zod te upgraden)
- `src/lib/zod-hulp.ts` → `begrensdeLijst(item, max, min?)`: controleert **eerst** de lengte (fataal) en valideert pas daarna de elementen.
- Alle 12 arrays in serverschema's gebruiken die helper (o.a. 5 lijsten zonder grens in beheer/monitoring, die vóór de rechtencontrole werden gevalideerd).
- `src/lib/zod-grenzen.test.ts`: geen kale `z.array(` meer in `*.functions.ts`/`*-schema.ts`; 100 000 items → < 10 fouten.
- **Ook relevant voor de live app.** Kandidaat voor een tweede, losse beveiligingsrelease (applicatiecode, geen afhankelijkheid).

## Migratieplan naar zod 4.6.7 (ruim 24 u oud)
| Stap | Inhoud | Risico | Test |
|------|--------|--------|------|
| 1 | `zod@4.6.7` installeren; alle imports tijdelijk naar `"zod/v3"` (compatibele laag) | Laag: zelfde API | 363 unit- + E2E-tests |
| 2 | Per bestand naar `"zod"` (v4) migreren, kleinste eerst (`meldingen-schema`, `vertaal`, `gezin`, `vrienden`, `account`, `credits`) | Middel | Per bestand: bestaande + nieuwe schematests |
| 3 | `admin`, `monitoring`, `user-intelligence`, `ai` (grootste) | Middel | Idem + E2E |
| 4 | `"zod/v3"` verwijderen; `bun audit` zonder zod-meldingen | Laag | Volledige suite |

**Gedragsverschillen om per stap te controleren**
- `.default()` (47×): in v4 kortgesloten (de standaard wordt niet meer door het schema gevalideerd) en geldt ook binnen `.optional()`. Controleren in `wieSchema`/`periodeSchema` (default op objectniveau).
- `.uuid()` (28×): v4 is strenger (RFC 9562-variantbits). Supabase `gen_random_uuid()` (v4) blijft geldig; de testdata zijn RFC-conform. Testen met echte id-vormen.
- `z.record(sleutel, waarde)`: 1× en al met twee argumenten. In orde.
- Foutobjecten: in de app wordt nergens `.issues`, `.errors`, `.flatten()` of `.format()` gebruikt, dus geen UI-impact.
- `@hookform/resolvers` wordt niet met zod gebruikt; `@tanstack/router-generator` heeft zijn eigen zod (bouwtijd).

**Rollback:** per stap één commit. `package.json` en `bun.lock` terugzetten herstelt zod 3.
