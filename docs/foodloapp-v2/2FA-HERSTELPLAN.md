# 2FA voor het Control Center: herstelplan en voorstel tot afdwingen (BUG-095)

Stand 2026-11-11 (aangevuld met §2b). **Nog niet afgedwongen.** Dit plan ligt ter goedkeuring voor. Na akkoord volgt de server-side afdwinging uit §6.

## 1. Vandaag
- `admin_users.mfa_required` bestaat. `mijnAdminProfiel` berekent `mfaOk` en de UI toont een rode banner.
- **De server levert de gegevens ook bij `aal1`.**
  - Bewezen in `tests/e2e/directe-api.spec.ts`: een rechtstreekse aanroep met een `aal1`-token krijgt de Finance-cijfers. De test staat als `test.fail` tot de fix er is.
  - Met `aal2` werkt het wel; dat is de controle.
- `requireSupabaseAuth` geeft `claims.aal` door. Afdwingen kan dus zonder extra databankaanroep.
- De eigenaar is de enige beheerder (app én databank-trigger 0008).

**Uitgangspunt:** er mag **geen onbeveiligde omweg** komen. Geen "noodknop" in de app, geen tweede wachtwoord, geen e-mail-link die 2FA overslaat.

## 2. Scenario A: eigenaar heeft nog geen 2FA ingesteld
1. De afdwinging gaat pas live **nadat** de eigenaar 2FA (TOTP) heeft ingesteld en een `aal2`-aanmelding gelukt is (controle in Beheer → Beveiliging: "geverifieerd in 2 stappen").
2. Tot dan staat `mfa_required` voor de eigenaar op `false`. Dat is de huidige stand en blijft die.
3. Bij het afdwingen blijft **één** route met alleen `aal1` open: het instellen van 2FA (`supabase.auth.mfa.enroll`, `challenge`, `verify`). Dat zijn functies van Supabase Auth zelf, geen serverfuncties van het Control Center, dus `bewaker()` hoeft niets door te laten.
4. Het scherm Beveiliging toont bij `aal1` alleen de 2FA-instelling, geen gegevens.

## 2b. Tweede stap bij een volgende aanmelding (gebouwd 2026-11-11, BUG-113)
**Gevonden gat:** de app kon de code alleen vragen tijdens het *koppelen*. Bij een gewone aanmelding (wachtwoord → `aal1`) was er nergens een veld om de 6 cijfers in te geven. Met afdwingen aan zou de eigenaar zich dus bij de volgende aanmelding buitensluiten, en dan blijft alleen scenario C over.

**Nu:**
- In het Control Center staat bij `mfa_required` en `aal1` een blok **"2-staps verificatie is verplicht voor jouw rol"** met een codeveld (`autocomplete="one-time-code"`, cijfertoetsenbord). Na de juiste code wordt de sessie `aal2` en laadt alles opnieuw.
- Bij meerdere authenticators kies je welke (reserve, scenario B).
- Zonder gekoppelde authenticator: een link "Nu instellen" (scenario A).
- Foutmeldingen in gewone taal ("Die code klopt niet of is net verlopen …"), nooit de Engelse ruwe fout.
- Beveiliging → een authenticator verwijderen vraagt eerst bevestiging; bij de laatste volgt een duidelijke waarschuwing. Met één actieve authenticator verschijnt een tip om een reserve te koppelen.
- De QR-code wordt als afbeelding getoond (geen HTML-injectie meer).

**Getest (lokaal, nep-Supabase):**
- `tests/e2e/tweede-stap.spec.ts`: te korte code, foute code, juiste code → `aal2`; zonder authenticator; verwijderen met bevestiging. Alle tests falen op de oude code.
- **Proef met afdwingen tijdelijk aan** (`MFA_AFDWINGEN = true`, daarna teruggezet): een `aal1`-sessie kreeg geen Finance-cijfers; na de code wel. De beheerder raakt dus niet buitengesloten.
- **Niet getest:** echte Supabase Auth (echte TOTP-app, echte QR-code, tijdsafwijking). Dat gebeurt op staging (§5).

## 3. Scenario B: authenticator verloren (nieuwe telefoon, gewist)
1. **Voorkomen:**
   - twee TOTP-factoren registreren (bv. telefoon en een wachtwoordbeheerder met TOTP, of een tweede toestel);
   - Supabase staat meerdere geverifieerde factoren toe.
   - Dit is een vereiste vóór het afdwingen (checklist §5).
2. **Als het toch gebeurt:** aanmelden met de tweede factor, dan in Beveiliging de verloren factor verwijderen en een nieuwe registreren.

## 4. Scenario C: geen enkele factor meer (alles kwijt)
Supabase Auth heeft geen ingebouwde herstelcodes voor TOTP. Daarom:
1. **Herstel buiten de app, door de eigenaar zelf, in het Supabase-dashboard** (organisatie-account met eigen 2FA):
   - Authentication → Users → eigenaar → MFA factors → factor verwijderen;
   - of SQL in het dashboard: `delete from auth.mfa_factors where user_id = '<eigenaar>'`.
   - Daarna opnieuw aanmelden met `aal1` en 2FA opnieuw instellen (scenario A).
2. **Waarom dit veilig is:** wie het Supabase-dashboard kan openen, heeft al volledige toegang tot de databank. Er komt geen nieuwe, zwakkere route bij.
3. **Het Supabase-account zelf** moet 2FA hebben, met de herstelcodes van Supabase offline bewaard (papier of kluis). Die codes zijn de echte "herstelcodes" van dit plan.

## 5. Checklist vóór het afdwingen (eigenaar)
- [ ] 2FA voor het **Supabase-dashboardaccount** aan; herstelcodes offline bewaard.
- [ ] 2FA voor de **Foodlo-eigenaar** ingesteld met **twee** factoren; `aal2`-aanmelding getest.
- [ ] Scenario C één keer geoefend op **staging** (factor wissen in het dashboard, opnieuw instellen).
- [ ] Op **staging**: aanmelden met wachtwoord → tweede stap met de echte authenticator-app → Control Center werkt (§2b).
- [ ] Lovable-dashboardaccount met 2FA (daar kan ook code gewijzigd worden).

## 6. Voorgestelde afdwinging (na akkoord)
In `bewaker()`, na het lezen van het profiel:
```ts
const aal = (context.claims?.aal as string | undefined) ?? "aal1";
if (profiel.mfa_required && aal !== "aal2") {
  await logboek(db, profiel, "mfa.geweigerd", "admin", profiel.user_id, { recht });
  throw new Error("Bevestig eerst met je tweede stap (2FA) om het Control Center te gebruiken.");
}
```
- Daarna `mfa_required = true` zetten voor de eigenaar, via Beheer → Team. Dat is een gewone, gelogde instelling.
- **Optioneel, extra laag in de databank** (met 0004/teamleden): beheerpolicies of RPC's die `(auth.jwt()->>'aal') = 'aal2'` eisen.
- **Tests:**
  - `directe-api.spec.ts`: `test.fail` weghalen; dan moet `aal1` "Bevestig eerst …" geven en `aal2` slagen;
  - unittest op `bewaker()` met `mfa_required` × `aal`.

## 7. Logging en controle van herstelacties
- **Elke weigering** door 2FA → `admin_audit_log` (`mfa.geweigerd`), zonder token of IP in de details.
- **Factor toegevoegd of verwijderd:** Supabase logt dit in `auth.audit_log_entries`. Voorstel: in Beheer → Beveiliging een lijst "MFA-gebeurtenissen (30 d)" via een serverfunctie met `audit.view`. Alleen-lezen.
- **Herstel via het dashboard (scenario C):** de eigenaar noteert datum en reden in het auditlog via Beheer → Logboek → "notitie" (nieuw, klein), zodat elk herstel achteraf zichtbaar is.
- **Maandelijkse controle:** aantal geregistreerde factoren van de eigenaar ≥ 2; geen onverwachte factor-gebeurtenissen.

## 8. Wat toestemming vraagt
1. Akkoord op dit plan (scenario's A–C, checklist).
2. Akkoord op de code-wijziging in §6 en daarna het aanzetten van `mfa_required`.
3. Oefening op staging (G1/B6).
