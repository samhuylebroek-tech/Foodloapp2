# Ontwerpvoorstel: restjes en "Niet voor mij" op je account, en gedeeld in het gezin

Stand 2026-11-12. **Alleen een ontwerp, ter goedkeuring.**
- Er is geen SQL uitgevoerd, er is geen migratie gebeurd en er is niets gepusht.
- Na je akkoord schrijf ik de SQL en test ik ze lokaal met PGlite, zoals 0006 en 0007. Uitvoeren kan pas op staging (beslissing 1).

## 1. Waarom
| Vandaag (lokaal gebouwd) | Beperking |
|---|---|
| Restjes staan op het toestel (`foodlo:restjes:<id>`) | Niet zichtbaar op een tweede toestel of voor je gezin; weg bij het wissen van de browser; niet in je gegevensexport |
| "Niet nu" staat op het toestel (7 dagen) | Idem |
| "Niet voor mij" bestaat niet | Je kan niet blijvend zeggen "dit nooit meer" |

## 2. Restjes: twee mogelijkheden
| | A. Eigen tabel `restjes` (**aanbevolen**) | B. Kenmerk in de voorraad (`pantry_items.soort = 'restje'`) |
|---|---|---|
| Lijst en voorstellen | Raakt de voorraadlogica niet | Elke voorraadberekening (Slim aanvullen, Voor morgen, Gebruik eerst, Wat kan ik koken?) moet restjes uitsluiten; één vergeten plek = "spaghetti in huis" |
| Gezin | Eigen deelregel (zie §3) | Volgt de voorraadregel (BUG-112) |
| Bewaartermijn | Eigen, kort (7 dagen) | Zelfde als de voorraad |
| Risico | Nieuwe tabel (klein) | Gegevensfout in de lijst |

### 2.1 Voorstel 0008 (schets, nog niet geschreven of getest)
```sql
create table public.restjes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  group_id    uuid null references public.groups(id) on delete set null,   -- gedeeld met het huishouden
  recept_id   uuid null references public.recipes(id) on delete set null,
  titel       text not null check (char_length(titel) between 1 and 120),
  porties     smallint not null check (porties between 1 and 12),
  gekookt_op  timestamptz not null default now(),
  gepland_op  date null,
  created_at  timestamptz not null default now()
);
-- Zoals 0006: eerst alles intrekken (Supabase geeft standaard alles aan anon/authenticated).
revoke all on public.restjes from public, anon, authenticated;
grant select, insert, update, delete on public.restjes to authenticated;
alter table public.restjes enable row level security;
-- Eigen restjes; restjes van het huishouden alleen voor actieve leden (bestaande functie).
create policy restjes_eigen on public.restjes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy restjes_gezin on public.restjes for select to authenticated
  using (group_id is not null and public.samen_in_groep(user_id, auth.uid()));
-- Opruimen na 7 dagen (cron, zoals 0006).
```
- **Gezin mag zien, alleen de maker mag wijzigen.** "Is op" door een ander gezinslid kan pas met een extra beleid. Ik stel dat uit tot het huishouden (B3/0005) er is.
- **Gegevensexport en accountverwijdering:** opnemen in `avg-export` en in de opruimfunctie (cascade).
- **Overstap:**
  - na de migratie zet de app restjes van dit toestel één keer op het account, met een melding, en wist ze daarna lokaal;
  - geen gezondheidsgegevens, alleen een gerechtnaam, porties en datums.

## 3. "Niet nu" en "Niet voor mij" op het account
- **Tabel:** 0006 (`aanbeveling_feedback`) bestaat al als voorstel en is lokaal getest. Ze heeft `signaal in ('niet_nu','niet_voor_mij','gekozen')`, een `recept_id` of een `onderwerp` (bv. `curry`), alleen eigen rijen en opruiming na 12 maanden.
- **Gedrag:**

  | Signaal | Effect |
  |---|---|
  | **Niet nu** | Zoals nu: 7 dagen niet tonen, maar op elk toestel. |
  | **Niet voor mij (recept)** | Harde regel: nooit meer voorgesteld, tot je het terugzet. |
  | **Niet voor mij (onderwerp)** | Na 2 à 3 keer op hetzelfde onderwerp (bv. curry) zakt het, maar het is geen verbod. De reden is zichtbaar. |
- **Waar:**
  - een knop "Niet voor mij" naast "Niet nu" (Vandaag, Week);
  - Instellingen toont "Je zei nee tegen: …", met "Terugzetten".
- **Gezin:** niet gedeeld (persoonlijke smaak). Met 0005 kunnen mee-eters later hun eigen "niet voor mij" krijgen, dat alleen meetelt als zij mee-eten.
- **Motor:** `Invoer.nietVoorMij = { recepten, onderwerpen }` wordt een extra harde regel in `toegelaten`. Voor onderwerpen komt er een lagere score met de reden.

## 4. Samenwerking met de rest van Foodloapp Intelligence
- **Restjes:** blijven voorrang krijgen in Week en op Vandaag. Met 0005 tellen ook de allergieën van wie mee-eet: de unie van alle allergieën is de harde regel.
- **Feedback:** werkt in alle drie de voorraadsituaties (§9 van de architectuur). Ze vraagt geen voorraad.

## 5. Tests (na akkoord)
- **PGlite, apart en gecombineerd met 0002–0007:**
  - eigen restjes lezen en schrijven;
  - gezinslid leest alleen gedeelde restjes;
  - ex-lid en anon lezen niets;
  - opruiming na 7 dagen;
  - heen en terug (down).
- **Unittests:** de overstap van toestel naar account en de motorregels "niet voor mij".
- **E2E:**
  - Vandaag, Week en Keuken met restjes van het account;
  - een tweede toestel ziet hetzelfde;
  - "Niet voor mij" met terugzetten;
  - allergie en dieet blijven gelden.

## 6. Beslissingen voor jou
| # | Vraag | Aanbevolen |
|---|---|---|
| R1 | Restjes in een eigen tabel (A) | Ja |
| R2 | Restjes standaard delen met je huishouden | Ja, want het zijn fysieke restjes in dezelfde koelkast; per restje uit te zetten |
| R3 | Bewaartermijn restjes | 7 dagen |
| R4 | "Niet voor mij" via 0006, niet gedeeld met het gezin | Ja |
| R5 | Uitvoering | Eerst SQL schrijven en lokaal testen; daarna staging (beslissing 1) |

**Kosten:** geen. Er is geen nieuwe dienst nodig.
