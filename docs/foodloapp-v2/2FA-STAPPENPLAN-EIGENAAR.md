# 2FA aanzetten voor het Control Center: stappenplan voor de eigenaar

Stand 2026-11-11. **2FA staat nog UIT** (`MFA_AFDWINGEN = false`). Dit is het eenvoudige stappenplan bij [2FA-HERSTELPLAN.md](2FA-HERSTELPLAN.md). Er wordt pas iets aangezet als jij zegt: "ga".

**Wat is 2FA?** Na je wachtwoord vraagt het Control Center een code van 6 cijfers uit een app op je telefoon. Wie alleen je wachtwoord heeft, komt er dan niet meer in.

## 1. Wat je nodig hebt
- Een **authenticator-app** op je telefoon, bijvoorbeeld Google Authenticator, Microsoft Authenticator of de app Wachtwoorden op een iPhone. Ze zijn gratis.
- **Een tweede plek** voor een reservecode:
  - een tweede toestel (oude telefoon of tablet);
  - of een wachtwoordbeheerder die codes kan maken (bijvoorbeeld 1Password of Bitwarden).
- Een **papieren blad of een kluis** voor de herstelcodes van je Lovable-account.

## 2. Stappen (in deze volgorde)
| # | Wie | Wat | Klaar als |
|---|---|---|---|
| 1 | Jij | 2FA aanzetten op je **Lovable-account** (accountinstellingen). Herstelcodes op papier bewaren. | Lovable vraagt bij aanmelden een code. |
| 2 | Jij en ik | Op **staging** (zie STAGING-PLAN): Beheer → Beveiliging → "Authenticator koppelen" → QR-code scannen → code ingeven. | Er staat "Telefoon · actief". |
| 3 | Jij | Op staging een **tweede authenticator** koppelen (reserve). | Er staan 2 actieve authenticators. |
| 4 | Jij | Afmelden, opnieuw aanmelden: wachtwoord → blok "2-staps verificatie" → code. | Het Control Center toont weer cijfers. |
| 5 | Jij | Oefenen: aanmelden met de **reserve** in plaats van je telefoon. | Lukt ook. |
| 6 | Jij en ik | Noodherstel oefenen op staging (§4, geval C). | Je kan erin zonder je authenticators. |
| 7 | Ik | Op staging `MFA_AFDWINGEN = true`, daarna `mfa_required` voor jou aan. De twee "verwacht falend"-tests worden gewone tests. | Zonder code: geen gegevens. Met code: alles werkt. |
| 8 | Jij en ik | Stappen 2–5 en 7 herhalen in de **live** app, pas na jouw akkoord. | Zelfde resultaat als op staging. |

Bij elke stap mag je stoppen. Zolang stap 7 niet gebeurd is, verandert er niets aan hoe je nu werkt.

## 3. Elke dag
1. Aanmelden met e-mail en wachtwoord.
2. Het Control Center toont het blok **"2-staps verificatie is verplicht voor jouw rol"**.
3. Je opent de authenticator-app en typt de 6 cijfers. Een spatie is toegelaten.
4. Klaar. De bevestiging blijft gelden tot je je afmeldt.

## 4. Kan ik mezelf buitensluiten? Nagelopen scenario's
| Geval | Wat gebeurt er | Buitengesloten? | Hoe nagegaan |
|---|---|---|---|
| A. 2FA verplicht, maar nog geen authenticator gekoppeld | Je ziet "Nu instellen". Koppelen gaat rechtstreeks via Supabase en niet via de beveiligde beheerfuncties, dus het werkt met alleen je wachtwoord. | **Nee** | Code en E2E `tweede-stap` ("zonder authenticator") |
| B. Gewone aanmelding met wachtwoord | Het blok met het codeveld verschijnt. Vóór BUG-113 ontbrak dit en was je wél buitengesloten. | **Nee** | E2E `tweede-stap`, lokale proef met afdwingen aan |
| C. Code fout of te traag | Duidelijke melding ("Die code klopt niet of is net verlopen"). Gewoon opnieuw proberen. Bij te veel pogingen even wachten. | **Nee** | Unittests `tweede-stap.test.ts` |
| D. Telefoon kwijt, reserve werkt nog | Aanmelden met de reserve. Daarna in Beveiliging de verloren authenticator verwijderen en een nieuwe koppelen. | **Nee**, als je stap 3 deed | Supabase-regel: verwijderen kan alleen met bevestigde sessie ([bron](https://supabase.com/docs/guides/auth/auth-mfa)) |
| E. Laatste authenticator zelf verwijderen | Eerst verschijnt een waarschuwing. Ga je toch door, dan val je terug op geval A. | **Nee** (wel minder veilig) | E2E `tweede-stap` (bevestiging) |
| F. **Alle** authenticators kwijt | Herstel buiten de app (zie hieronder). | Tijdelijk, tot het herstel | **Nog te oefenen op staging** (stap 6) |
| G. **Eigenaarsaccount verwijderd** (via Instellingen of Beheer) | Het Control Center herkent jou aan een vaste account-ID. Met een nieuw account kom je er nooit meer in. | Was **Ja**. Nu geblokkeerd (BUG-121). | E2E `eigenaar-beveiliging` (faalt op de oude code) |
| H. Wachtwoord vergeten | Wachtwoord herstellen per e-mail. Daarna gewoon de code (geval B). | **Nee** | E2E `wachtwoord-herstellen` |
| I. Klok van je telefoon loopt verkeerd | De codes kloppen niet. Zet de tijd op "automatisch". | Tijdelijk | Op een echt toestel te controleren |

**Herstel bij geval F (alles kwijt):** er zijn twee wegen. Beide vragen je Lovable-account, dat zelf 2FA heeft (stap 1). Er komt dus geen zwakkere achterdeur bij.
1. **Via Lovable Cloud:** jouw authenticators wissen in de gebruikersgegevens van de backend, daarna opnieuw koppelen (geval A).
   - **Onzeker:** ik weet niet zeker of Lovable Cloud daarvoor rechtstreekse toegang geeft tot de tabel `auth.mfa_factors`. Dat gaan we op staging na (stap 6).
2. **Via de code (altijd mogelijk):** in Lovable `MFA_AFDWINGEN` terug op `false` zetten en publiceren.
   - Het Control Center werkt dan weer met alleen je wachtwoord.
   - Daarna koppel je nieuwe authenticators en zet je 2FA opnieuw aan.

**Conclusie:** met stappen 1, 3 en 6 afgewerkt is er geen scenario meer waarin je jezelf blijvend buitensluit. Geval G was een echt risico en is nu dicht.

## 5. Wat jij moet beslissen
1. Akkoord op dit stappenplan en op [2FA-HERSTELPLAN.md](2FA-HERSTELPLAN.md) §2b en §6.
2. Welke reserve je gebruikt: een tweede toestel of een wachtwoordbeheerder.
3. Wanneer we stap 7 op staging doen. Live gebeurt pas na een geslaagde staging.
