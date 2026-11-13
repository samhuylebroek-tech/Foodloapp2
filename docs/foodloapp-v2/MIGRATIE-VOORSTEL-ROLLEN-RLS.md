# Migratievoorstel 0002: recepten, foto's, beheerrechten en feedback

> Samengevat in [`docs/foodlo/DATABASE_ARCHITECTURE.md`](../foodlo/DATABASE_ARCHITECTURE.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11. **Voorstel, niet uitgevoerd.** De SQL staat in `migratie-voorstel/` en **niet** in `supabase/migrations/`, zodat Lovable ze niet kan oppikken.
- Heen: [`0002_rollen_en_rls.up.sql`](migratie-voorstel/0002_rollen_en_rls.up.sql)
- Terug: [`0002_rollen_en_rls.down.sql`](migratie-voorstel/0002_rollen_en_rls.down.sql)
- Bewaartermijnen, apart: [`0003_bewaartermijnen.up.sql`](migratie-voorstel/0003_bewaartermijnen.up.sql) / [`.down.sql`](migratie-voorstel/0003_bewaartermijnen.down.sql)

## 1. Wat het oplost
| Bug | Probleem | Wijziging |
|---|---|---|
| BUG-105 | `recipes_select` = alleen `deleted_at IS NULL` | `deleted_at IS NULL AND has_share(user_id, auth.uid(), 'recipes_view')`. `has_share` omvat eigenaar, vrienden (`shares`) en actieve gezinsleden (`groep_recht`) |
| BUG-105 | `recipe_photos`: lezen als het recept bestaat | lezen als het recept **zichtbaar** is (zelfde regel) |
| BUG-106 | Storage: hele bucket voor elke ingelogde gebruiker, ook opsommen | `recipe_photos_read` weg; nieuw: eigen map **of** de foto hoort bij een recept of fotorij die je mag zien. De inspiratieregel blijft. Twee indexen voor snelheid |
| BUG-097 | 24 policies met `OR is_admin(...)` | Eigen rij blijft; "alleen beheer" weg. Het Control Center leest uitsluitend via serverfuncties met de service-sleutel achter `bewaker()`, dus één afdwingpunt |
| S8 | `feedback` FOR ALL | Indienen, lezen en verwijderen van het eigen ticket; status en notities alleen voor het beheer; het bericht aanpassen zolang het ticket "nieuw" is |
| S7 | `is_admin()` aanroepbaar door elke gebruiker | Alleen nog voor `service_role` en `postgres` |
| S6 | `claim_first_admin()` ongebruikt | Verwijderd (zie §4) |
| – | Rol `finance` | Enum-waarde toegevoegd (nodig voor het rollenontwerp §5; nog niet in gebruik) |

## 2. Bewijs: lokaal, reproduceerbaar
Lokale PostgreSQL (PGlite 0.5.12, buiten de repo geïnstalleerd), opgebouwd uit **alle 64 migraties** van de repo, plus een minimale Supabase-nabootsing (`tests/rls/supabase-nabootsing.sql`). Eén commando:
```
npm install --prefix /tmp/pglite @electric-sql/pglite@0.5.12
PGLITE_DIR=/tmp/pglite node tests/rls/alles.mjs      # 11/11 zoals verwacht, exitcode 0
```
| Test | Huidige migraties | Met 0002 | 0002 heen + terug |
|---|---|---|---|
| `rls-recepten.mjs` (5 rollen + anoniem, 9 metingen) | **15 afwijkingen**: lek bewezen | 0 | identiek aan nu |
| `rls-beheer.mjs` (analist met alleen-lezen, klant) | 12 afwijkingen | 0 | identiek aan nu |
| `rls-gezin.mjs` (eigenaar, andere, actief lid, uitgenodigd + rechten uit) | 0 | 0 (geen regressie) | identiek |
| Volledige vergelijking van policies, functie- en tabelrechten na heen + terug | – | – | **volledig identiek** |

**Wat dat wel en niet bewijst**
1. **Migraties:** `20260910213844` overschrijft de deelregel van `20260908074306`. PostgreSQL zelf rapporteert `recipes_select = (deleted_at IS NULL)` na alle migraties.
2. **Lokale PostgreSQL:**
   - een gebruiker zonder enige band (en een niet-actief uitgenodigde) leest het recept van een ander, inclusief titel, beschrijving, bereiding en bron-URL (de ingrediënten niet);
   - iedereen leest en somt alle foto's in de bucket op.
3. **Alleen productie kan bevestigen** of het daar ook zo staat. De volgorde waarin productie de migraties kreeg, is onbekend (BUG-011). Controle zonder iets te wijzigen: SECURITY-AUDIT §6 (`pg_policies`). **Niet door mij uitgevoerd:** er is geen productieverbinding.

## 3. Impact
- **Gebruikers:**
  - zien geen recepten en foto's meer van mensen met wie ze niets delen;
  - vrienden met deelrecht en actieve gezinsleden behouden hun toegang (getest);
  - eigen gegevens blijven leesbaar (getest).
- **App:**
  - geen enkel clientscherm leest beheerstabellen als beheerder (gecontroleerd: alleen eigen rijen en publieke inhoud);
  - het Control Center werkt via de service-sleutel en blijft ongewijzigd.
  - De tweede verdedigingslaag (`zichtbare-eigenaren.ts`) filtert al op dezelfde regel, dus de schermen veranderen niet.
- **Prestaties:** subqueries per object in de storage-regel. De nieuwe indexen op `recipes.image_url` en `recipe_photos.path` houden dat licht. Meten op staging met realistische aantallen.
- **Feedback:** gebruikers kunnen de status niet meer zelf wijzigen. De app doet dat nergens (gecontroleerd: alleen invoegen).

## 4. `claim_first_admin`: afhankelijkheden
Aangetoond in de lokale databank:
- uitvoerrecht alleen voor `postgres` en `service_role`;
- geen functie, policy of trigger verwijst ernaar;
- in de app alleen in de gegenereerde `types.ts`;
- de trigger `admin_users_only_owner` (0008) zou een tweede beheerder toch weigeren.

**Productie:** controleer vóór uitvoeren met de alleen-lezen query:
```sql
select p.proname from pg_proc p where p.prosrc ilike '%claim_first_admin%' and p.proname <> 'claim_first_admin';
```
Verwacht: 0 rijen. Na de migratie de types opnieuw genereren.

## 5. Rollenontwerp (vervolg, niet in 0002)
Vandaag staat de eigenaarvergrendeling op **twee** plaatsen:
- in de app (`EIGENAAR_ID` in `bewaker()`);
- in de databank (trigger `admin_users_only_owner`: alleen de eigenaar mag in `admin_users`).

Teamleden toelaten vraagt een **aparte** migratie (0004) **na** 0002 en **na** de 2FA-afdwinging:
1. De trigger vervangen door "eigenaar altijd; anderen alleen met `invited_by` = eigenaar, `mfa_required = true`, optioneel `geldig_tot`".
2. In `bewaker()`: vaste eigenaar **of** actieve rij met verplichte `aal2`.
3. Het menu en de rechten volgen de matrix hieronder (app-matrix `MATRIX` in `admin.functions.ts`).

| Recht | super_admin | admin | finance | support | content_manager | analyst |
|---|---|---|---|---|---|---|
| dashboard.view (algemene cijfers, geen geld) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| finance.view (omzet, kosten, credits, CSV) | ✓ | ✓ | ✓ | – | – | – |
| users.view (zoeken, profiel, activiteit) | ✓ | ✓ | – | ✓ | – | – |
| users.manage (blokkeren) | ✓ | ✓ | – | – | – | – |
| users.delete, privacy.manage (AVG-export, wissen) | ✓ | – | – | – | – | – |
| support.view / support.manage | ✓ | ✓ | – | ✓ | – | – |
| recipes.*, content.manage | ✓ | ✓ | – | – | ✓ | – |
| ai.view (verbruik zonder kost) | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| system.view | ✓ | ✓ | – | ✓ | – | ✓ |
| audit.view | ✓ | ✓ | ✓ | – | – | – |
| settings.manage, admins.manage | ✓ | – | – | – | – | – |
| private.view | alleen met de vlag `can_view_private_content`, altijd gelogd |  |  |  |  |  |

**Gegevens per rol:**
- **support:** profiel, activiteit en tickets van één gebruiker tegelijk; geen geld, geen privé-inhoud;
- **finance:** transacties en kosten, geen recepten of lijsten;
- **content_manager:** inhoud, recepten en labels, geen persoonsgegevens buiten de auteur;
- **analyst:** geaggregeerde cijfers, geen individuele gebruikers;
- **admin:** operationeel beheer, geen AVG-acties en geen instellingen.

## 6. Risico's
| Risico | Kans | Gevolg | Beperking |
|---|---|---|---|
| Productie wijkt af van de repo (BUG-011) | Middel | Een DROP of CREATE faalt of past niet | Eerst `pg_policies` vergelijken; uitvoeren op staging met een schemadump van productie |
| Een scherm las toch iets via `is_admin` | Laag (gecontroleerd) | Leeg scherm | Rooktest over alle 52 tabellen: geen fout. Op staging alle beheerschermen doorlopen |
| Storage-regel trager bij veel foto's | Laag | Trage lijsten | Indexen; meten op staging |
| Gedeelde inspiratiefoto's onzichtbaar | Laag | Foto ontbreekt | De inspiratieregel blijft; getest (M8) |

## 7. Volgorde (na toestemming)
1. Alleen-lezen controle van productie (SECURITY-AUDIT §6, en §4 hierboven) door de eigenaar.
2. Staging (G1/B6): schemadump van productie, synthetische gegevens, `up.sql`, de tests (de scripts in `tests/rls/` kunnen tegen staging draaien met een kleine aanpassing van `databank.mjs`), alle beheerschermen doorlopen, `down.sql`, opnieuw `up.sql`.
3. Akkoord, back-up (`pg_dump` van de schema's `public` en `storage`), productie, types opnieuw genereren.

## 8. Terugdraaien
- `down.sql` herstelt **exact** de huidige stand (bewezen: volledige vergelijking).
- Gegevens gaan niet verloren: 0002 wijzigt alleen rechten en indexen.
- Let op: terugdraaien heropent BUG-105, 106 en 097.
- De enumwaarde `finance` blijft bestaan; dat is onschadelijk.
