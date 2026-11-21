/**
 * Toegang tot premiumfuncties: één pure regel. Rijen in `entitlements` (voorstel 0012) worden
 * alleen door de server (service-rol) geschreven; de gebruiker kan ze enkel lezen.
 * Grondregel: wat vandaag gratis is, blijft gratis. Premium voegt alleen extra's toe.
 */
export type Recht = "premium.weekmenu_extra" | "premium.seizoenskalender" | (string & {});

export type Entitlement = {
  recht: string;
  /** ISO-datum of -tijd; `null` = zonder einde. */
  geldig_tot: string | null;
};

export type Gebruiker = { id: string; entitlements: readonly Entitlement[] } | null | undefined;

export function heeftRecht(gebruiker: Gebruiker, recht: Recht, nu: Date = new Date()): boolean {
  if (!gebruiker) return false;
  return gebruiker.entitlements.some((e) => {
    if (e.recht !== recht) return false;
    if (!e.geldig_tot) return true;
    const tot = new Date(e.geldig_tot.length === 10 ? `${e.geldig_tot}T23:59:59` : e.geldig_tot);
    return !Number.isNaN(tot.getTime()) && tot.getTime() >= nu.getTime();
  });
}
