# Het huishouden als centraal samenwerkingsmodel (ontwerp, 2026-11-09)

Dit is een ontwerp. Er is **niets aan de databank veranderd**. Uitvoeren vraagt jouw akkoord: G1 (migraties, eerst op staging) en G2 (rechten/RLS).

## 1. Het idee in één zin
Wie samen eet, deelt automatisch **één weekmenu, één lijst en één voorraad**. Er zijn geen rechten om in te stellen.

## 2. Wat de gebruiker ziet
| Moment | Wat er gebeurt | Aantal keuzes |
|---|---|---|
| Eerste keer | Je bent meteen "huishouden van 1". Niets uit te leggen. | 0 |
| Iemand toevoegen | Profiel → **Iemand toevoegen** → deel link of QR | 1 |
| Uitnodiging openen | "Kom bij *Thuis*?" → **Ja** | 1 |
| Daarna | Menu, lijst en voorraad zijn gedeeld. Bovenaan staat even "Jan doet nu mee". | 0 |
| Mee-eter zonder account | Naam + één tik: *kind · vegetarisch · geen vis · …* | 2 |
| Iemand eet niet mee | Op de maaltijd tikken → zijn of haar avatar uitzetten. Porties en lijst passen zich aan. | 1 |
| Vertrekken | Profiel → Huishouden → **Verlaten**. Je eigen recepten blijven van jou. | 1 + bevestiging |

Er zijn dus **geen rechtenvinkjes**. Binnen het huishouden mag iedereen alles, en er is altijd "Ongedaan maken". Alleen de beheerder kan iemand verwijderen.

## 3. Samen tegelijk werken (realtime)
| Situatie | Gedrag |
|---|---|
| Twee mensen vullen tegelijk aan | Foodlo rekent vlak vóór het schrijven opnieuw. Wie tweede is, krijgt "Alles staat al op je lijst". **Al gebouwd en getest.** |
| Iemand vinkt iets af | Bij de anderen verdwijnt het met een korte melding "Lotte vinkte melk af" (lijst-realtime bestaat al; de melding is nieuw). |
| Iemand is aan het winkelen | Bovenaan de lijst staat "Jan is aan het winkelen" (Supabase Presence, geen schemawijziging). Nieuwe items lichten op bij Jan. |
| Twee keer "Klaar met winkelen" | De tweede keer zijn er geen afgevinkte items meer, dus de knop verschijnt niet. |
| Iemand kookt | De voorraad wordt bijgewerkt. Iedereen ziet het. Ongedaan maken kan alleen de kok. |
| Plan gewijzigd terwijl de lijst al klaarstaat | "3 op je lijst: gerecht niet meer gepland → Haal weg". **Al gebouwd.** |

Conflicten bij gelijktijdig bewerken: wie het laatst bewaart, wint. Dat volstaat voor lijst, voorraad en menu: elke regel is klein, en je kan altijd ongedaan maken.

## 4. Datamodel (additief, niets wordt gewist)
| Tabel | Wijziging | Waarom |
|---|---|---|
| `groups` | + `soort text default 'huishouden'` | Bestaande gezinnen worden huishoudens |
| `group_members` | De zes rechtenkolommen blijven bestaan, maar worden niet meer getoond (standaard alles aan) | Geen gegevensverlies; terugdraaien kan |
| `huishouden_eters` *(nieuw)* | `id, group_id, naam, voorkeuren text[], user_id null` | Mee-eters met of zonder account |
| `meal_plan` | + `eters uuid[] null` (null = iedereen) | Porties per maaltijd |
| `pantry_items` | + `group_id uuid null`, `vervalt_op date null`, `plek text default 'kast'`, `bron_recept_id uuid null` | Gedeelde voorraad, houdbaarheid, restjes |
| `shopping_lists` | ongewijzigd (heeft al `group_id`) | — |

**RLS (G2):** voor `pantry_items` en `huishouden_eters` lezen en schrijven alle actieve leden van `group_id`. Dezelfde regel bestaat al voor `meal_plan` en `shopping_lists` via `group_members`. Ze wordt eerst op staging getest met twee nepgebruikers.

## 5. Overgang van de bestaande gegevens (fase 2, op staging eerst)
1. Iedereen zonder gezin krijgt een huishouden van 1 (nieuwe rij in `groups`, niets verplaatst).
2. Bestaande gezinnen → `soort = 'huishouden'`.
3. Persoonlijke plannen en lijsten van een gezinslid worden **niet automatisch samengevoegd**. Bij de eerste keer openen verschijnt één kaart: "Je hebt ook een eigen planning (5 maaltijden). Samenvoegen met *Thuis*?" → Ja / Later. Kopiëren, nooit wissen.
4. De bestaande voorraad blijft persoonlijk tot de gebruiker hem één keer deelt (zelfde soort kaart).
5. `shares` (vrienden) blijft werken. Delen per recept of collectie komt in fase 3.

Terugdraaien: elke stap is additief of een kopie. Het oude scherm "Mijn planning / Gezin" blijft bereikbaar tot de overgang goedgekeurd is.

## 6. Acceptatiecriteria (voor wanneer we bouwen)
| ID | Criterium |
|---|---|
| H1 | Na "Ja" op een uitnodiging ziet het nieuwe lid binnen 2 s hetzelfde menu, dezelfde lijst en dezelfde voorraad |
| H2 | Twee leden die tegelijk aanvullen: geen dubbele regels (bestaat: test "dubbel aanvullen") |
| H3 | Een mee-eter uitzetten op een maaltijd verlaagt de porties en de hoeveelheden bij Slim aanvullen |
| H4 | Verlaten: eigen recepten blijven; gedeelde lijst, menu en voorraad blijven bij het huishouden |
| H5 | RLS: een niet-lid kan niets lezen of schrijven (test met twee nepgebruikers op staging) |
| H6 | Overgang: geen enkele bestaande rij wordt gewist (telling vóór en na) |
