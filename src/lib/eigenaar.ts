// Het Control Center is uitsluitend voor de eigenaar van het platform.
// Deze vaste controle staat los van de database: zelfs als er iemand in
// admin_users zou belanden, krijgt die geen toegang.
export const EIGENAAR_ID = "e11454f4-8b82-4b7a-81a4-4c161b3b222d";

/**
 * Het eigenaarsaccount mag niet verwijderd worden via de app: met een nieuw account (nieuwe ID)
 * kan niemand het Control Center nog openen, ook jij niet. Zie 2FA-STAPPENPLAN §4.
 */
export const EIGENAAR_NIET_VERWIJDEREN =
  "Dit is het eigenaarsaccount van het Control Center. Dat kan je niet via de app verwijderen: je zou jezelf buitensluiten. Neem eerst contact op met je ontwikkelaar.";

export function isEigenaar(userId: string | null | undefined): boolean {
  return userId === EIGENAAR_ID;
}
