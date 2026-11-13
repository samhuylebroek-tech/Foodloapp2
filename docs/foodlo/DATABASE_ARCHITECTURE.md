# Databankarchitectuur
**Bron van waarheid voor:**
- het schema;
- de nummering en volgorde van migraties;
- de opzet van 0004, 0004b en 0005.

**Put uit:**
- `MIGRATIE-VOORSTEL-BOODSCHAPPEN.md`;
- `MIGRATIE-VOORSTEL-ROLLEN-RLS.md`;
- `docs/foodloapp-v2/migratie-voorstel/`;
- `HUISHOUDEN-ONTWERP.md`;
- `STAGING-VOORSTELLEN.md`;
- `ARCHITECTUUR-VOORSTELLEN.md`.

## 1. Huidige stand (2026-11-13)
- **Tabellen:** de types in `src/integrations/supabase/types.ts` tellen 52 tabellen.
- **Migraties:** 13 in `supabase/migrations`, 50 in `drizzle/migrations`. Samen 50 `CREATE TABLE`.
- **Ontbreekt in de repo:** `inspiration_recipes` en `inspiration_ingredients`. De databank is dus niet volledig opnieuw op te bouwen uit git (BUG-011).
- **Live schema:** nog niet vergeleken met de repo (#4).
- **Regels:** RLS op alle gebruikerstabellen. Lokale controle met PGlite: `tests/rls/alles.mjs` slaagt 21/21 (zie `IMPLEMENTATION_STATUS.md`).

## 2. Nummering en volgorde van migratievoorstellen
Nummering gelijkgetrokken; tegenstrijdigheid T4.

| Nr | Inhoud | Soort | Stand | Volgorde en voorwaarde |
|---|---|---|---|---|
| — | **Baseline** (live schema als migratie, incl. `inspiration_*`) | niet destructief | te maken | 1. Na de schemavergelijking (#4). |
| 0002a | Basislijn recepten en foto's (RLS) | autorisatie | getest | 2. Alleen voor nieuwe omgevingen; live is al in orde. |
| 0002 | Rollen en RLS beheer, `is_admin`, feedback | autorisatie | getest | 3. Staging, daarna akkoord (#3). |
| 0003, 0003b | Bewaartermijnen (opruimfuncties) | **verwijdert oude gegevens volgens termijn** | getest | Na de keuze van de termijnen (#6, #12). Eerst een droge run op staging. |
| **0004** | Weekmenu (`profiles.weekmenu`) alleen voor jezelf | autorisatie, niet destructief | getest, app klaar | 4. Zie §3. |
| **0004b** | Persoonlijke voeding op het account (F1) | nieuw, niet destructief | **alleen ontwerp** (§4) | 5. Na akkoord op de opzet; zelfde patroon als 0004. |
| **0005** | Huishoudensleden: voorkeuren, allergieën per lid, mee-eters (F2) | nieuw, gezondheidsgegevens | **alleen ontwerp, niet aanmaken** (D-2026-11-13-1) | F2; na 0004, 0004b en akkoord. |
| 0006 | Feedback op voorstellen ("Niet voor mij") | nieuw | getest | F2 (#17). |
| 0007 | Houdbaarheid voorraad | nieuw | getest | F2 (#17). |
| 0008 | Help Center-tabellen (vroeger ook "0005" genoemd) | nieuw | idee | F2. |
| 0001 | Boodschappen v2 | groot | voorstel | Herbekijken na staging; niet nodig voor F1. |
| — | Collecties (vroeger ook "0004" genoemd) | nieuw | idee | F2. |
| — | Creators, zichtbaarheid, volgen, moderatie | nieuw | ontwerp (`ARCHITECTUUR-VOORSTELLEN` §3) | F2. |
| — | Abonnementen, betaalgebeurtenissen, grootboek | nieuw | ontwerp (BCC §10) | F3, na G5. |

**Regel voor elke migratie:**
- er is een `down`;
- een RLS- of PGlite-test, heen en terug;
- eerst staging, dan productie met akkoord (G1/G2);
- destructieve stappen alleen na een back-up (#33) en met apart akkoord.

## 3. Migratie 0004: technische controle (stap A/B, gedaan)
- **Inhoud:**
   - `eigen_weekmenu()` (security definer, alleen de eigen rij);
   - `REVOKE SELECT (weekmenu) ON profiles FROM authenticated`;
   - `down` zet het recht terug.
- **App klaar:**
   - `account-voorkeuren.ts` leest al via `eigen_weekmenu()`, met terugval bij fout 42501 (unittest);
   - lezers met de service-sleutel (AVG-export, beheer) werken door.
- **Test:** `rls-gezin-privacy.mjs` slaagt heen en terug (21/21).
- **Nog te doen vóór productie:**
   1. Live schema op functies, views en triggers controleren die `weekmenu` als `authenticated` lezen. Alleen lezen, met jouw akkoord voor de toegang.
   2. Uitvoeren op staging, de app-suite draaien en terugdraaien oefenen.
   3. Productie, alleen met jouw akkoord.

## 4. Voorstel 0004b: persoonlijke voeding op het account (F1, optie B)
Dit is een ontwerp. Het bestand komt pas na jouw akkoord op deze opzet.

```sql
-- Eén rij per gebruiker; nooit leesbaar voor anderen (ook niet voor gezinsleden).
create table public.persoonlijke_voeding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  allergieen text[] not null default '{}',      -- vaste codes (veiligheid.ts), geen vrije tekst
  intoleranties text[] not null default '{}',   -- vaste codes
  dieet text,                                   -- vaste code of null
  uitsluitingen text[] not null default '{}',   -- vaste keuzes + korte vrije termen (max. 20 × 40 tekens)
  toestemming_op timestamptz not null,          -- uitdrukkelijke toestemming (AVG art. 9.2.a)
  bijgewerkt_op timestamptz not null default now()
);
alter table public.persoonlijke_voeding enable row level security;
create policy eigen_lezen  on public.persoonlijke_voeding for select using (user_id = auth.uid());
create policy eigen_schrijven on public.persoonlijke_voeding for insert with check (user_id = auth.uid());
create policy eigen_wijzigen on public.persoonlijke_voeding for update using (user_id = auth.uid());
create policy eigen_wissen on public.persoonlijke_voeding for delete using (user_id = auth.uid());
-- Geen service-rol-lezers in AI-functies; export en verwijderen nemen de tabel mee.
```

- **Waarom een eigen tabel en geen kolom in `profiles`:** `profiles` is deels leesbaar voor gezin en vrienden (naam, handle). Een aparte tabel met alleen "eigen rij"-regels sluit lekken uit, zoals bij BUG-119.
- **App:**
   - de kennismaking en Instellingen schrijven hier;
   - de app migreert de bestaande `localStorage` bij de eerste keer, na toestemming;
   - de veiligheidsregels lezen hier, zowel op het toestel als op de server, voor filtering;
   - nooit in AI-aanvragen (AI-doc §2).
- **Tests:**
   - RLS: een ander lid of een vriend leest niets;
   - export bevat de rij, verwijderen wist hem;
   - E2E: allergie op toestel A, waarschuwing op toestel B.
- **Relatie met 0005 (F2):** 0005 voegt huishoudensleden met dezelfde velden toe, plus toestemming per lid en mee-eters per maaltijd. 0004b blijft de rij van de gebruiker zelf.

## 5. Opzet 0005 (F2, alleen beschrijving)
- **`huishouden_leden`:** naam, of koppeling aan een account, en een rol.
- **`lid_voeding`:** zelfde velden als 0004b, plus `toestemming_door` en `toestemming_op`.
- **`maaltijd_eters`:** wie eet mee per maaltijd.
- **Zichtbaarheid:**
   - wie plant, ziet alleen **of** een gerecht veilig is voor de mee-eters, niet waarom (welke allergie);
   - tenzij het lid toestemming gaf om dat te delen.
- **Voorwaarden:** 0004, 0004b, beslissing #30 (één huishoudmodel) en #7.
