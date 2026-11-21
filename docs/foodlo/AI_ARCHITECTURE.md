# AI-architectuur
**Bron van waarheid voor:** de assistent, het gebruik van AI, de privacylaag, uitbreidbaarheid en kosten.

**Put uit:**
- `FOODLOAPP-INTELLIGENCE-ARCHITECTUUR.md`;
- `RISICO-EN-KOSTENANALYSE.md`;
- `PROACTIEVE-COOKING-USECASES.md`;
- de code in `src/lib/intelligentie/*`, `ai.functions.ts` en `credits.server.ts`.

## 1. Twee lagen
| Laag | Waar | Wat | Kost |
|---|---|---|---|
| **Regels** (eerst) | op het toestel en in pure functies | Vandaag, voorstellen met reden, seizoen, feestdagen, geschiedenis, voorraad, restjes, gebruik eerst, vul aan, voor morgen, tijdregel, **veiligheid** (allergie en dieet) | gratis, voorspelbaar, getest |
| **Generatieve AI** (waar nodig) | op de server, via `metCredits` | Recepten begrijpen (link, tekst, foto), recept van een naam, ideeën voor een week, gerecht herkennen, ingrediënten herkennen, foto maken, stappen verbeteren, vertalen | credits, cache, dag- en maandlimiet |

**Regel:** eerst regels, daarna AI. Bijvoorbeeld bij een link: eerst gratis structuurgegevens lezen, pas dan AI. Elke AI-functie heeft een weg zonder AI.

## 2. Privacylaag (F1, BUG-142, D-2026-11-13-2)
Elke AI-aanvraag gaat door **één** functie, `voorAI()` in `src/lib/ai/privacy.ts` (ronde 2).

1. **Vaste gevoelige gegevens** worden nooit meegestuurd:
   - de allergielijst;
   - het dieet;
   - gezondheid en intoleranties;
   - gegevens van gezinsleden.
2. **Vrije tekst van de gebruiker:**
   - Gaat het om tekst die bij voorkeuren hoort, zoals "liever niet"? Dan haalt de laag eerst termen die op een allergeen, intolerantie, dieet of gezondheid lijken eruit. Hij gebruikt daarvoor de woordenlijst van `veiligheid.ts` en de allergenen.
   - Er gaan alleen neutrale smaakwensen mee, zoals "geen bloemkool".
3. **Cachesleutels** bevatten nooit gevoelige tekst. Ze gebruiken een hash van de opgeschoonde tekst.
4. **Controle achteraf:** het resultaat wordt **op het toestel** gecontroleerd met de volledige persoonlijke allergielijst (`veiligheid.ts`). Een treffer wordt getoond als "mogelijk allergeen", nooit als veilig.
5. **Logging:** alleen tellingen ("2 termen weggelaten"), nooit de tekst zelf.
6. **Test:**
   - een unittest met allergeen- en dieettermen in vrije tekst;
   - een E2E-test die de AI-aanvraag onderschept en controleert dat er geen allergeenterm in staat.

## 3. Menselijke controle
- **Nakijken vóór bewaren:**
   - AI-resultaten worden altijd eerst als voorstel getoond, met "overnemen" of "aanpassen";
   - in ronde 2 ook bij "Vul aan" (BUG-145).
- **Niets automatisch:** geen enkele AI-functie verwijdert, deelt of publiceert zelf iets.
- **Agents (later):** toekomstige agents werken met dezelfde regel. Ze stellen voor en de gebruiker keurt goed. Gevoelige of onomkeerbare acties vragen een expliciete bevestiging.

## 4. Uitbreidbaarheid (F2+)
- **Providers:**
  - nu één gateway;
  - doel: een `AiProvider`-interface (`genereer`, `zie`, `vertaal`) met de gateway als eerste implementatie;
  - zo kunnen andere modellen of providers erbij zonder de schermen te wijzigen.
- **Taken als configuratie:**
  - elke AI-taak (bv. `import_url`, `weekmenu`) heeft een vaste kost, een modelkeuze, een cachebeleid en een privacyprofiel;
  - die staan nu in `credit_costs` en de code;
  - later komt er een centrale taaktabel bij.
- **Agents:**
  - een agent is een reeks taken met een duidelijk doel, bv. "vul mijn week aan";
  - hij gebruikt dezelfde privacylaag, credits en logging, en heeft een goedkeuringsstap;
  - het Growth OS kan dezelfde gateway en hetzelfde kostenmodel gebruiken, maar nooit Foodlo-gebruikersdata (`INDUSTRY_AND_GROWTH_FUTURE.md`).
- **Vragen beantwoorden (chat):** pas na F1, met dezelfde privacylaag. Beslissing #10 bepaalt het aantal vragen per dag.

## 5. Kosten en limieten
- **Al aanwezig:**
  - credits per taak;
  - reserveren en terugstorten bij een fout;
  - cache;
  - dag- en maandlimiet (standaard € 25 per maand, waarschuwing bij 80 %).
- **Open:**
  - het maandbudget voor AI (#19);
  - AI-foto's in de cache als base64 (BUG-012).

## 6. Signalen
| Signaal | Stand |
|---|---|
| Dag, uur, seizoen, feestdagen | ✅ |
| Geschiedenis | ✅ |
| Voorraad, restjes | ✅ (alleen als ze bekend zijn) |
| Eigen tijd | ✅ |
| Weer | ⏭ F2 (#15/#16) |
| Budget | ⏭ F2 (#21) |
| Gezin | ⏭ F2 (0005) |
| Lokale producten | 🟨 (seizoensproducten) |
