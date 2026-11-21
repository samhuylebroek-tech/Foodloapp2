# Security-audit Foodloapp V2: toegang, rollen en RLS

> Samengevat in [`docs/foodlo/PRIVACY_AND_SECURITY.md`](../foodlo/PRIVACY_AND_SECURITY.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11, branch `v2/dev`. Fase 1 (inventaris) vanaf `01f85e0`; **fase 2 (verificatie, §7)** daarna. Er is geen databank gewijzigd en geen productieverbinding gemaakt.

## 0. Methode en grenzen
- **Serverlaag:**
  - alle 111 serverfuncties (`createServerFn`) automatisch geïnventariseerd: middleware, `bewaker()`-recht, gebruik van de service-sleutel;
  - de enige API-route (`/api/public/meldingen/run`) gelezen.
- **Databanklaag:**
  - de 132 `CREATE POLICY`- en 25 `DROP POLICY`-statements uit `supabase/migrations` (13) en `drizzle/migrations` (51) samengevoegd tot de **uiteindelijke** policy per tabel;
  - aanname: eerst `supabase/` in volgorde, dan `drizzle/`. De werkelijke volgorde in productie is onbekend (schema-drift, BUG-011).
- **Niet gedaan:**
  - geen productie-, staging- of echte Supabase-test;
  - de nep-Supabase bootst **geen** RLS na, dus alle databankbevindingen zijn **code-analyse**, niet bewezen gedrag.
  - Wat wel bewezen is (serverlaag) staat er telkens bij.

## 1. Samenvatting: belangrijkste bevindingen
| # | Ernst | Bevinding | Bewijs | Status |
|---|---|---|---|---|
| **S1** | **Kritiek (te verifiëren)** | `recipes_select` = `USING (deleted_at IS NULL)` (migratie `20260910213844`). Dat overschrijft de deelcontrole van `20260908074306` (`has_share(…, 'recipes_view')`). **Elke ingelogde gebruiker leest alle niet-verwijderde recepten van iedereen.** `recipe_photos` ("Zichtbare receptfotos lezen" = recept bestaat) volgt daaruit. Keuken (`gerechten.tsx`), `OntdekLeeg` en de eigen export (`recipe_ingredients select *`) filteren niet op eigenaar en vertrouwen op RLS. In productie zou een gebruiker dus andermans recepten onder "Alles" en "Vrienden" zien | Code-analyse (migratievolgorde + app-queries) | **BUG-105**, open. Eerst alleen-lezen verifiëren (§6) |
| **S2** | **Hoog** | Storage: `recipe_photos_read` = `bucket_id = 'recipe-photos'` (elke ingelogde gebruiker, hele bucket, ook **opsommen** via `list()`; mapnaam = user-id). Migratie 0046 wilde inspiratiefoto's beperken tot actieve gebruikers, maar permissieve policies worden ge-OR'd: **die beperking werkt niet** | Code-analyse | **BUG-106**, open |
| S3 | Hoog (latent) | 2FA (`mfa_required`) alleen als banner; de server levert de gegevens bij `aal1`. `getClaims` geeft `aal` mee, dus afdwingen is technisch eenvoudig | Bewezen in de demo (Y-09) | BUG-095, open |
| S4 | Hoog (latent) | 15 RLS-policies geven **elke** actieve rij in `admin_users` leesrecht (via `is_admin`) op `ai_usage`, `ai_cache`, `ai_events`, `aankopen`, `credit_transactions`, `user_credits`, `user_sessions`, `usage_events`, `app_errors`, `daily_*_stats`, `admin_audit_log`, `admin_sessions`, `admin_messages(+recipients)`, `model_prices`, `loyalty_scan_events`, `notification_log`, `platform_settings`. Rol, alleen-lezen en eigenaarvergrendeling spelen daar geen rol | Code-analyse | BUG-097, open |
| S5 | Medium | Rollen onbruikbaar door de vaste `EIGENAAR_ID`; geen rol `finance`; enum `admin_role` kent `finance` niet; `has_admin_role()` bestaat maar wordt in geen enkele policy gebruikt | Bewezen in de demo (Y-02) | BUG-096, open |
| S6 | **Correctie** | `claim_first_admin()`: in `drizzle/0001` ingetrokken voor `anon` en `authenticated` en daarna niet opnieuw vrijgegeven. **Volgens de repo niet aanroepbaar door gebruikers.** Mijn eerdere beschrijving in BUG-097 ("laat de eerste gebruiker beheerder worden") was te stellig. Wel: de functie bestaat nog, wordt nergens gebruikt, en een fout bij het opnieuw toekennen zou haar openzetten | Code-analyse | Voorstel: `DROP FUNCTION` |
| S7 | Laag | `is_admin(uuid)` is aanroepbaar door elke ingelogde gebruiker (RPC): je kunt per user-id nagaan of iemand beheerder is | Code-analyse | Voorstel |
| S8 | Laag | `feedback`: policy `FOR ALL` op eigen rij, dus een gebruiker kan op zijn eigen ticket ook `status`, `admin_note` en `assigned_to` wijzigen | Code-analyse | Voorstel: alleen INSERT/SELECT voor de gebruiker |
| S9 | Laag | IP in het auditlog uit `x-forwarded-for` (eerste waarde kan door de client gekozen zijn). Limiet per bezoeker bij vertalen idem; het plafond per uur begrenst de kost | Code-analyse | Voorstel: `cf-connecting-ip` |
| S10 | Info | Een access-token blijft geldig tot het verloopt, ook na afmelden of blokkeren (Supabase-eigenschap; `getClaims` controleert handtekening en `exp`, niet de sessie) | Documentatie Supabase | Geaccepteerd; korte JWT-duur op staging controleren |

**Wat goed is (bewezen of duidelijk in de code)**
- Elke beheerfunctie gaat door `bewaker()`:
  - vaste eigenaar, actieve rij, recht per rol, alleen-lezen, 120 acties per minuut;
  - auditlog dat niet te wijzigen is (`block_audit_mutation`).
- `finance.view`, meldingenbeheer en CSV-beveiliging: zie BUG-090 t/m 094. Getest, en de tests falen op de oude code.
- Alle 50 tabellen hebben RLS aan. Clientschrijven op `admin_users`, credits, berichten en `group_members` is geblokkeerd met RESTRICTIVE-policies.
- Gezinsfuncties `in_groep` en `samen_in_groep` controleren (sinds 0024) dat **beide** leden `actief` zijn. Een openstaande uitnodiging geeft geen toegang. *(De opmerking in MIGRATIE-VOORSTEL-BOODSCHAPPEN §4 dat `samen_in_groep` de status negeert, is verouderd.)*
- De cron-route controleert een geheim in constante tijd.
- `translateTexts` is bewust publiek, met cache, een limiet per bezoeker en een plafond per uur (BUG-061).
- Auth: `getClaims` controleert handtekening en vervaldatum. Een verlopen of vervalst token wordt geweigerd. `claims.aal` is beschikbaar.

## 2. Serverfuncties (111)
| Groep | Aantal | Toegang |
|---|---|---|
| Beheer (`admin`, `monitoring`, `user-intelligence`, `finance`, `meldingen-admin`) | 79 | `requireSupabaseAuth` + `bewaker(recht)`; `mijnAdminProfiel` geeft alleen het eigen profiel |
| Gebruiker (AI, meldingen, credits, gezin, vrienden, export, account, welkom-mail) | 30 | `requireSupabaseAuth`; werken op `context.userId`. Functies met de service-sleutel (`verwijderMijnAccount`, `creditOverzicht`, `vraagCredits`, `mijnCreditAanvraag`, `meldNieuweGebruiker`) filteren op `context.userId` |
| Publiek | 2 | `vapidSleutel` (publieke sleutel, bedoeld); `translateTexts` (kostenrem) |

**Directe aanroepen:** een serverfunctie is een gewone POST- of GET-route.
- Zonder `Authorization` geeft `requireSupabaseAuth` "Unauthorized".
- Met een geldig token maar zonder recht weigert `bewaker()`.
- **In de demo bewezen:** gewone gebruiker, tweede beheerder en drie rollen (`beheer-rechten.spec.ts`, `audit-persona-az`).
- **Nog niet als aparte test:** een rechtstreekse HTTP-aanroep van de serverfunctie zonder de UI. Die volgt in fase 2.

## 3. Rollenmodel (voorstel)
| Recht | super_admin | admin | finance | support | content_manager | analyst |
|---|---|---|---|---|---|---|
| dashboard.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| finance.view | ✓ | ✓ | ✓ | – | – | – |
| finance.export | ✓ | – | ✓ | – | – | – |
| users.view (zoeken, detail zonder inhoud) | ✓ | ✓ | – | ✓ | – | – |
| users.manage (blokkeren) | ✓ | ✓ | – | – | – | – |
| users.delete / privacy.manage (AVG) | ✓ | – | – | – | – | – |
| support.view / support.manage | ✓ | ✓ | – | ✓ | – | – |
| recipes.view / recipes.manage / content.manage | ✓ | ✓ | – | – | ✓ | – |
| ai.view (verbruik, niet de kost) | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| system.view | ✓ | ✓ | – | ✓ | – | ✓ |
| audit.view | ✓ | ✓ | ✓ | – | – | – |
| settings.manage | ✓ | – | – | – | – | – |
| admins.manage | ✓ | – | – | – | – | – |
| private.view | alleen met de vlag `can_view_private_content` | idem | – | idem | – | – |

**Afwijkingen van vandaag:**
- `admin` verliest `privacy.manage` en `settings.manage` (alleen de eigenaar);
- `support` verliest `dashboard`-kosten;
- `analyst` ziet geen geld;
- nieuwe rol `finance`;
- **2FA verplicht** voor elke rol behalve analyst (of voor alle rollen).

**Eigenaarvergrendeling vervangen door:**
- de eigenaar (vaste ID, blijft altijd binnen, ook als `admin_users` faalt), **plus**
- toegelaten teamleden in `admin_users`, met `active`, rol, 2FA en een optionele vervaldatum (`expires_at`).

## 4. Databank: wat de policies moeten worden (voorstel)
| Tabel | Nu (repo) | Voorstel |
|---|---|---|
| `recipes` SELECT | `deleted_at IS NULL` | `deleted_at IS NULL AND (has_share(user_id, auth.uid(), 'recipes_view') OR <gezinsrecht>)` |
| `recipe_photos` SELECT | recept bestaat | recept zichtbaar (volgt uit de vorige rij) |
| `storage.objects` recipe-photos SELECT | hele bucket | eigen map **of** de foto hoort bij een recept dat je mag zien **of** bij een inspiratierecept (actieve gebruiker) |
| beheerstabellen (S4) | `is_admin` | `has_admin_role(auth.uid(), …)` per tabel en per rol; financiële tabellen alleen voor super_admin, admin en finance |
| `feedback` | FOR ALL eigen | INSERT + SELECT eigen; UPDATE alleen `message` zolang `status = 'nieuw'` |
| `is_admin` / `claim_first_admin` | aanroepbaar / bestaat | `is_admin` alleen voor `service_role`; `claim_first_admin` verwijderen |

De migratie zelf (SQL heen en terug, impact en terugdraaiplan) volgt in fase 2 als `migratie-voorstel/0002_rollen_en_rls.{up,down}.sql`. **Niet uitvoeren.**

## 5. Testplan (fase 2)
| Scenario | Laag | Hoe | Lokaal? |
|---|---|---|---|
| Geen login | server | rechtstreekse HTTP naar een beheer- en gebruikersfunctie zonder token → 401 of "Unauthorized" | ✓ demo |
| Verlopen sessie | server | token met `exp` in het verleden → geweigerd | ✓ (nep-auth moet `exp` controleren: aanpassen) |
| Geen voltooide 2FA | server | `mfa_required` + `aal1` → geweigerd; `aal2` → toegelaten | ✓ na de fix |
| Onjuiste rol | server | matrix §3 per rol × functie (unit + E2E) | ✓ |
| Directe API | server | idem zonder UI | ✓ |
| Financiële toegang | server | support, analyst en content_manager → geen finance-functie, geen financiële CSV | ✓ (al gedeeltelijk) |
| Gegevens van andere gezinnen | **databank** | RLS met twee gezinnen en vier rollen (eigenaar, actief lid, uitgenodigd, vreemde) | **PGlite lokaal** (PostgreSQL in WebAssembly, gratis npm-pakket, buiten de repo), daarna staging |
| Recepten en foto's van anderen (S1/S2) | databank | idem | PGlite lokaal (alleen databank; Storage alleen op staging) |
| CSV-export | server | injectie + rechten (bestaat) | ✓ |
| Account verwijderen en foto's | server + Storage | nep-Storage met list/remove | ✓ gedeeltelijk; echte bucket op staging |
| Financiële totalen en valuta | unit | zuivere rekenfunctie met vaste testtransacties | ✓ |

## 6. Wat de eigenaar nu al kan doen (alleen-lezen, geen wijziging)
De werkelijke policies in productie bekijken in de Supabase SQL-editor, **alleen SELECT**:
```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
  and tablename in ('recipes','recipe_photos','recipe_ingredients','objects')
order by tablename, policyname;
```
Toont `recipes_select` alleen `(deleted_at IS NULL)`? Dan is S1 **live** en verdient het voorrang op al het andere.

## 7. Fase 2: verificatie op een lokale PostgreSQL (2026-11-11)
Testomgeving: PGlite 0.5.12 (PostgreSQL in WebAssembly, buiten de repo), opgebouwd uit **alle 64 migraties** (0 fouten), met een minimale Supabase-nabootsing (`tests/rls/supabase-nabootsing.sql`: rollen, `auth.uid()`, `storage.objects`, `storage.foldername`, `pgcrypto`, stubs voor cron en net, en de twee inspiratietabellen zonder `CREATE TABLE`, BUG-011).

Commando: `PGLITE_DIR=<map> node tests/rls/alles.mjs` geeft 11/11 zoals verwacht.

| Bevinding | Migraties tonen | Lokale PostgreSQL toont | Alleen productie kan bevestigen |
|---|---|---|---|
| **S1 / BUG-105** | `recipes_select` wordt `deleted_at IS NULL` | **Bewezen:** een gebruiker zonder band en een niet-actief uitgenodigde lezen het recept (titel, bereiding, bron) en de fotorij van een ander. Ingrediënten niet (eigen regel met `has_share`). Ook via de app: zonder het nieuwe filter toonden Keuken, Vandaag, de kiezer en de detailpagina zo'n recept (`recepten-zichtbaarheid.spec.ts` faalt op de oude code) | of productie dezelfde regel heeft |
| **S2 / BUG-106** | `recipe_photos_read` = hele bucket | **Bewezen:** iedereen leest en somt alle objecten op, ook losse foto's. De beperking van 0046 wordt opgeheven door de OR met de brede regel | idem; plus of de bucket privé is |
| **S4 / BUG-097** | 24 policies met `is_admin` (niet 15) | **Latent:** de trigger `admin_users_only_owner` (0008) weigert elke tweede beheerder, dus vandaag is alleen de eigenaar `is_admin`. Bewezen in het toekomstscenario (trigger uit, analist met alleen-lezen): die leest rechtstreeks AI-gebruik, credits, aankopen, sessies, gebeurtenissen, fouten, dagstatistieken, meldingen en het auditlog van anderen | of productie de trigger heeft |
| S6 `claim_first_admin` | ingetrokken voor gebruikers | **Bewezen:** alleen `postgres` en `service_role`; geen afhankelijkheden | of productie dezelfde rechten heeft |
| S7 `is_admin` | aanroepbaar door `authenticated` | **Bewezen** | – |
| S8 `feedback` | FOR ALL eigen rij | **Bewezen:** een klant zet zijn eigen ticket op "opgelost" | – |
| Gezinsrechten | `in_groep`, `samen_in_groep`, `groep_recht` controleren `actief` | **Correct:** uitgenodigd ziet niets; actief lid volgens de rechten per lid; rechten uitzetten werkt. **Ontwerpkeuze:** de voorraad (en het profiel) blijven zichtbaar voor actieve gezinsleden, ook als het deelrecht uit staat (`samen_in_groep`, niet per recht) | – |

**Migratievoorstel 0002** (MIGRATIE-VOORSTEL-ROLLEN-RLS.md):
- dicht S1, S2, S4, S6, S7 en S8;
- 0 afwijkingen in alle drie de tests;
- gezinsrechten ongewijzigd;
- heen + terug geeft een stand die **volledig identiek** is aan nu (policies, functie- en tabelrechten).

**Directe API (serverlaag, demo):** een opgenomen Finance-aanroep, opnieuw afgespeeld:
- zonder token, als gewone gebruiker, met een verlopen token en met een vervalst token: **geweigerd**;
- met een eigenaarstoken en `aal2`: **toegelaten**;
- met `aal1` terwijl 2FA verplicht is: **toegelaten**. Dat is BUG-095, vastgelegd als `test.fail`.

**Tweede verdedigingslaag (app):**
- `zichtbare-eigenaren.ts` past dezelfde regel als `has_share` toe in Keuken, Vandaag, Week (kiezer, plan, voorstel), Ontdek, de duplicaatcontrole en de detailpagina;
- de detailpagina toont "Dit recept is niet beschikbaar" in plaats van eindeloos te laden.
- **RLS blijft de grens:** dit vangt alleen een te ruime regel op.

**Rollenmatrix en team:** MIGRATIE-VOORSTEL-ROLLEN-RLS §5. **2FA:** 2FA-HERSTELPLAN.md.

## 8. Live controle door de eigenaar (2026-11-11, alleen-lezen, Lovable Cloud → Database → Policies)
| Onderdeel | Live (productie) | Repo-migraties (lokaal) |
|---|---|---|
| `recipes_select` | `(deleted_at IS NULL) AND has_share(user_id, auth.uid(), 'recipes_view')`: **in orde** | `deleted_at IS NULL`: te ruim |
| Storage SELECT `recipe_photos_read` | eigen map OF gedeeld recept via `has_share`: **in orde** | hele bucket: te ruim |
| Storage SELECT `recipe_photos_read_inspiratie` | actieve gebruiker + inspiratiefoto | idem |
| Bucket `recipe-photos` | **Private** | n.v.t. |

**Gevolgen:**
- BUG-105 en BUG-106 bestaan live **niet**.
- De repo beschrijft productie **niet** volledig (BUG-011 bevestigd).
- Voorstel 0002 is gesplitst. `0002a` brengt alleen **nieuwe** omgevingen op het live niveau (nooit op productie). `0002` raakt recepten en foto's niet meer.
- **Nog niet live gecontroleerd:**
  - de 24 policies met `is_admin`;
  - `feedback`;
  - de rechten op `claim_first_admin`;
  - de trigger `admin_users_only_owner`.

  Dezelfde alleen-lezen weg kan dat tonen (Policies, filter Tables).
