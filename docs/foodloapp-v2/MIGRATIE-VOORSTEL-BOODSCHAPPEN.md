# Migratievoorstel boodschappen V2 — sjablonen, winkels, merken, varianten, foto's

Stand 2026-11-10. **Voorstel, niet uitgevoerd.** Er is niets gewijzigd aan een databank, bucket of Lovable-instelling. De SQL staat bewust in `docs/foodloapp-v2/migratie-voorstel/` en **niet** in `supabase/migrations/`. Zo kan Lovable haar niet oppikken of automatisch toepassen.

- SQL heen: [`0001_boodschappen_v2.up.sql`](migratie-voorstel/0001_boodschappen_v2.up.sql)
- SQL terug: [`0001_boodschappen_v2.down.sql`](migratie-voorstel/0001_boodschappen_v2.down.sql)

## 1. Waarom
| Wens (masterplan fase 5) | Nu | Nodig |
|---|---|---|
| **Sjablonen** ("Basis", "Weekend", "Barbecue") | Alleen `shopping_staples`: één vaste lijst per persoon, zonder naam | Benoemde sjablonen met regels, ook voor het huishouden |
| **Meerdere winkels** | `loyalty_stores` is een vaste beheerlijst voor klantenkaarten. De afdelingsvolgorde staat **per toestel** in `localStorage` (`src/lib/winkelvolgorde.ts`) | Eigen winkels per persoon of huishouden, elk met een eigen afdelingsvolgorde, gedeeld over toestellen |
| **Merken en varianten** | Alleen in de vrije notitie (`shopping_items.note`) | Aparte velden, zodat "halfvolle melk van merk X" herkend en onthouden wordt |
| **Productfoto's** ("zo ziet onze yoghurt eruit") | Niet mogelijk | Privé-foto per product, zichtbaar voor huisgenoten |
| **Wie kocht wat** (gedeelde lijst) | Alleen `checked` | `checked_by`, `checked_at` |

## 2. Wijzigingen (samengevat)
**Nieuwe tabellen**
- `stores` (`user_id`, optioneel `group_id`, `naam`, optioneel koppeling met `loyalty_stores.slug`, `kleur`, `categorie_volgorde text[]`, `positie`). De afdelingsvolgorde zit als array in de winkelrij. Een aparte koppeltabel levert hier niets op en kost een extra join.
- `shopping_templates` en `shopping_template_items` (naam, hoeveelheid, eenheid, merk, variant, winkel, positie).
- `product_voorkeuren` (`user_id` + `product_sleutel` = genormaliseerde naam → merk, variant, foto, winkel). Dit maakt "onthoud ons merk" mogelijk.

**Nieuwe kolommen, allemaal nullable**
- `shopping_items`: `merk`, `variant`, `photo_path`, `store_id`, `checked_by`, `checked_at`.
- `shopping_history`: `merk`, `store_id`. Prijsregistratie hoort hier niet bij (zie §8).

**Opslag**
- Privé-bucket `product-fotos`: maximaal 2 MB, alleen JPEG/WebP, map = id van de eigenaar.
- De app verkleint vooraf tot ±200–300 kB. Lezen gaat via ondertekende URL's.

**Grenzen in de databank**
- `CHECK` op lengte (namen ≤ 60/120, merk/variant ≤ 80), hoeveelheid > 0 en kleur als hexcode.
- Maximaal 30 afdelingen per winkel.
- Een fout in de app kan zo geen grote of ongeldige waarden wegschrijven.

## 3. Impact op bestaande gegevens
- **Geen enkele bestaande rij verandert.** Alleen nieuwe tabellen en nullable kolommen zonder standaardwaarde. In Postgres 11+ is dat een metadatawijziging: geen herschrijving van de tabel, geen langdurige vergrendeling.
- **V1 en de Lovable-productie blijven werken.**
  - Bestaande queries selecteren benoemde kolommen of `*`; extra kolommen schaden niet.
  - Inserts zonder de nieuwe velden blijven geldig.
  - De gegenereerde types (`src/integrations/supabase/types.ts`) worden pas na de migratie bijgewerkt. Tot dan gebruikt V2 de velden niet.
- **Overname van de huidige toestand**
  - **Winkelvolgorde:** de eerste keer dat V2 een account zonder winkel ziet, wordt de `localStorage`-volgorde van dat toestel één winkel "Mijn winkel". Niets gaat verloren; staat er niets lokaal, dan wordt de standaardvolgorde gebruikt.
  - **`shopping_staples`** blijft bestaan en blijft "Vaste producten". Een latere, aparte stap kan er een sjabloon van maken. Daarvoor wordt hier niets gemigreerd.
  - **Merken in notities** worden **niet** automatisch overgezet. Raden uit vrije tekst geeft fouten. De gebruiker kan het per product aanvullen.
- **Account verwijderen:** de tabellen hebben `ON DELETE CASCADE` op `auth.users`. Foto's in de bucket blijven echter staan, net als in de bestaande fout **BUG-025**. De opruimfunctie moet `product-fotos/<uid>/` mee wissen. Dat is een voorwaarde voor de release (AVG).

## 4. Beveiliging (RLS)
- Zelfde model als `shopping_lists`/`shopping_items` (migratie `0024_gezin_gedeeld`):
  - eigen rijen (`user_id = auth.uid()`);
  - rijen van het huishouden (`group_id` + `in_groep`).
- Bij aanmaken met een `group_id` wordt ook gecontroleerd dat je lid bent van dat huishouden. Zo kun je niets in een vreemd huishouden zetten.
- `shopping_template_items` erft de rechten van het sjabloon. De subquery valt zelf onder RLS.
- `product_voorkeuren` is alleen voor jezelf.
- `anon` krijgt geen rechten. `(SELECT auth.uid())` wordt één keer per query geëvalueerd (Supabase-advies voor snelheid).
- **Foto's:**
  - lezen mag voor jezelf en voor **actieve** huisgenoten;
  - schrijven en wissen alleen in je eigen map.

  Er zitten bewust twee keuzes in:
  - Geen `samen_in_groep`. *Correctie 2026-11-11:* die controleert sinds migratie 0024 wél dat beide leden `actief` zijn (SECURITY-AUDIT §1). De expliciete join blijft bruikbaar, maar `samen_in_groep` zou ook volstaan.
  - Geen `::uuid`-cast op de mapnaam, omdat één ongeldige naam de hele query laat falen.
- **Eerst op staging controleren (G1, schema-drift BUG-011):**
  1. Welke versie van `in_groep` draait in productie? Er bestaan twee definities in `drizzle/migrations`; controleer of die van productie op `status = 'actief'` test.
  2. Laat de RLS op `group_members` toe dat een lid de andere leden van zijn huishouden ziet? De fotopolicy heeft dat nodig.
  3. Test met pgTAP of met de RLS-tests via de REST-API, met vier rollen:
     - eigenaar;
     - actieve huisgenoot;
     - uitgenodigd maar niet actief;
     - vreemde.

## 5. Volgorde van uitvoeren (na toestemming)
1. **G1 eerst:** de schema-drift ophelderen (STAGING-VOORSTELLEN §1). Zonder een betrouwbare uitgangstoestand is elke nieuwe migratie een gok.
2. Staging-project (gratis tier), alleen schema en synthetische testgegevens.
3. `up.sql` op staging, RLS-tests met vier rollen, dan `down.sql` en daarna opnieuw `up.sql` (de terugdraaitest).
4. V2-code achter een vlag (`boodschappen_v2_velden`) die alleen aangaat als de kolommen bestaan.
5. Akkoord van de eigenaar → back-up → productie → types opnieuw genereren → vlag aan.

## 6. Terugdraaien
- `down.sql` verwijdert alles wat `up.sql` toevoegde.
- Vóór gebruikers iets invullen, verlies je niets.
- **Nadat gebruikers merken, winkels, sjablonen of foto's invulden, gaan die verloren.** Vooraf exporteren:
  `COPY (SELECT ...) TO` of `supabase db dump --data-only -t public.stores -t public.shopping_templates -t public.shopping_template_items -t public.product_voorkeuren`, plus de nieuwe kolommen van `shopping_items`.
- Bestanden in de bucket wis je via de Storage-API. Een `DELETE` op `storage.objects` laat de bestanden zelf staan.
- **Veiliger alternatief voor terugdraaien:** de vlag uitzetten. De kolommen blijven bestaan, maar de app gebruikt ze niet meer. Dat is altijd verliesvrij.
- **Back-up vóór productie:**
  - Supabase maakt dagelijkse back-ups op betaalde plannen.
  - Point-in-time recovery is een **betaalde** add-on. Die activeer ik niet.
  - Zonder een betaald plan: vooraf zelf een `pg_dump` van de betrokken tabellen maken.

## 7. Kosten
- **Geen nieuwe dienst.** Alles valt binnen het bestaande Supabase-project.
- **Databank:** verwaarloosbaar. Een paar honderd bytes per rij; 1 000 actieve huishoudens met 5 winkels en 10 sjablonen is < 5 MB.
- **Opslag:** foto's zijn de enige echte kostenpost.
  - Schatting: 300 kB × 30 foto's × 1 000 gebruikers ≈ 9 GB.
  - De gratis tier van Supabase bevat 1 GB opslag; Pro bevat 100 GB.
  - Niet geverifieerd: welk plan het project nu heeft, en de actuele prijzen. Controleer dat vóór het akkoord.
  - **Beperken:**
    - verkleinen in de app;
    - maximaal 1 foto per product;
    - geen foto's voor producten uit de catalogus (die hebben al een beeldje);
    - eventueel een limiet per huishouden.
- **Egress:** de foto's worden alleen in de winkelmodus en in "aanpassen" geladen, als miniatuur en met cache.
- **Werk:** ±1 dag migratie en RLS-tests op staging, plus ±2–3 dagen app-code (sjablonen, winkelbeheer, merk/variant in "aanpassen", fotokiezer met verkleinen, voorkeuren onthouden).

## 8. Bewust niet in dit voorstel
- Prijzen en budget per winkel (privacygevoelig, vraagt een eigen ontwerp).
- Een gedeelde, publieke merkendatabank of barcodes (OpenFoodFacts): externe dienst, licentie en kwaliteit.
- `shopping_staples` omzetten naar sjablonen.
- Een kolom "vervangt" (product A vervangen door B). Vervangen in de winkelmodus (`src/lib/vervangen.ts`, `Winkelmodus.tsx`) past nu de naam van de rij aan en houdt de koppeling met het recept. Een aparte kolom komt er pas als blijkt dat de oorspronkelijke naam nodig is (bv. voor statistiek).
