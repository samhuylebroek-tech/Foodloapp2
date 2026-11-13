# Privacy en beveiliging
**Bron van waarheid voor:** gegevensklassen, AVG, autorisatie, geheimen en gegevensstromen.

**Put uit:**
- `SECURITY-AUDIT.md`;
- `SECURITY-RELEASE.md`;
- `AVG-AUDIT.md`;
- `AVG-BEWAARTERMIJNEN-VOORSTEL.md`;
- `2FA-HERSTELPLAN.md`;
- `2FA-STAPPENPLAN-EIGENAAR.md`.

## 1. Gegevensklassen
| Klasse | Voorbeelden | Regels |
|---|---|---|
| **Bijzonder (AVG art. 9)** | allergieën, intoleranties, dieet om gezondheidsredenen, vrije tekst die gezondheid kan bevatten ("liever niet") | Alleen leesbaar voor jezelf. Nooit naar externe AI. Nooit in logs of cachesleutels. Delen met gezinsleden alleen met uitdrukkelijke toestemming per lid (F2). Volledig in de export, gewist bij verwijderen. |
| Persoonlijk | naam, e-mail, recepten, planning, lijsten, voorraad, sessies | RLS: eigen rij, of gedeeld via gezin en vrienden. Bewaartermijnen (0003/0003b). |
| Gedeeld | gezinsplanning, gezinslijst | Alleen voor leden met het recht |
| Publiek (F2) | creatorprofielen, gepubliceerde recepten | Moderatie (DSA) vóór publicatie |
| Commercieel (F3) | partnergegevens, campagnes, betalingen | Aparte rollen. Betalingen alleen bij de provider, nooit kaartgegevens bij ons. |
| Operationeel | gebeurtenissen (zonder inhoud), fouten | Minimaal, met bewaartermijn (#6) |

## 2. Waar staan gevoelige gegevens nu (2026-11-13)
| Gegeven | Waar | Risico | Actie |
|---|---|---|---|
| Allergieën, dieet (kennismaking) | `localStorage` op het toestel (`kennismaking.ts`) | Niet op het account, niet per lid | F1: naar het account, alleen voor jezelf (0004b-voorstel) |
| Vrij veld "liever niet" | `profiles.weekmenu` | Leesbaar voor gezinsleden (BUG-119); gaat naar de externe AI (**BUG-142**) | 0004 (staging), privacylaag (ronde 2) |
| Voorraad | `pantry_items` | Leesbaar voor gezinsleden (BUG-112, besloten) | — |
| Recepten | `recipes` | Lokaal getest (BUG-105/106) | — |

## 3. Autorisatie
- **Elke datatoegang loopt via RLS.** De interface filtert daarnaast nog eens (`zichtbare-eigenaren.ts`), als tweede laag.
- **Beheer:**
   - `bewaker()` op elke beheerfunctie;
   - één eigenaar-ID;
   - rechtenmatrix met 5 rollen;
   - rate limit;
   - auditlog.
- **Open punten:**
   - 2FA staat uit (#2);
   - RLS-beheer (BUG-097);
   - bruikbare rollen (BUG-096).
- **Betaal- en commerciële schakelaars:**
   - de server weigert ze zolang er geen provider gekoppeld is (**BUG-143**, ronde 2);
   - de interface volgt de server, nooit omgekeerd.

## 4. Geheimen
- `.env` wordt niet gevolgd. `.env.example` bevat alleen namen.
- De Git-geschiedenis is gescand (`LANCERINGSPLAN-V2.md` §5).
- Cloudsessies werken alleen tegen een nep-databank, zonder echte sleutels.
- Rotatie van geheimen gebeurt alleen met bewijs en akkoord (G6).

## 5. AVG-rechten
| Recht | Stand |
|---|---|
| Inzage en export | ✅ 32 secties (lokaal) |
| Verwijderen | ✅ (gezin overdragen, foto's opruimen; Storage nog op staging testen) |
| Bewaartermijnen | Voorstel 0003/0003b (#6, #12) |
| Privacyverklaring, verwerkers, toestemming | Jurist (#27) |

## 6. Open, in volgorde van belang
1. **BUG-142:** privacylaag voor de AI. *Goedgekeurd, ronde 2.*
2. **BUG-143:** betaalpoort op de server. *Goedgekeurd, ronde 2.*
3. **0004 (BUG-119):** eerst controleren tegen het live schema, dan op staging. Productie alleen met akkoord.
4. **F1-voorstel 0004b:** persoonlijke voeding op het account (opzet in `DATABASE_ARCHITECTURE.md` §4; akkoord nodig).
5. **Beveiligingsreleases** (TanStack/seroval, SSRF) live zetten (G3/G4).
6. **Beheer:** 2FA aan (#2); RLS-beheer 0002 (#3).
7. **Juridisch en bewaartermijnen:** jurist (#27); bewaartermijnen (#6, #12).
