/**
 * BUG-095: 2FA op de server. Staat UIT tot de eigenaar het herstelplan (2FA-HERSTELPLAN.md) heeft
 * goedgekeurd en twee factoren heeft ingesteld. Aanzetten = deze waarde op `true` en daarna
 * `mfa_required` voor de eigenaar aanzetten in Beheer → Team.
 *
 * Apart bestand zonder imports (fase 8), zodat ook de E2E-test (directe-api.spec.ts) deze
 * schakelaar kan lezen en de juiste verwachting toetst, zonder test.fail of test.skip.
 * Waarom niet zelf aanzetten: een autorisatiewijziging vraagt het uitdrukkelijke akkoord van de
 * eigenaar (CLAUDE.md), en zonder ingestelde factoren zou de eigenaar zich kunnen buitensluiten.
 */
export const MFA_AFDWINGEN = false;
