/**
 * Regels voor 2-staps verificatie (TOTP) in het Control Center (BUG-095, 2FA-HERSTELPLAN).
 * Zuiver en getest; de schermen gebruiken Supabase Auth (`mfa.challengeAndVerify`).
 */

/** Spaties en streepjes weg ("123 456" en "123-456" zijn ook goed). */
export function schoonCode(invoer: string): string {
  return invoer.replace(/[\s-]+/g, "");
}

export function codeGeldig(invoer: string): boolean {
  return /^\d{6}$/.test(schoonCode(invoer));
}

/** Begrijpelijke Nederlandse melding in plaats van de Engelse fout van Supabase. */
export function mfaFoutTekst(
  fout: { code?: string | undefined; message?: string | undefined } | null | undefined,
): string {
  const code = fout?.code ?? "";
  const tekst = (fout?.message ?? "").toLowerCase();
  if (code === "mfa_verification_failed" || tekst.includes("invalid totp"))
    return "Die code klopt niet of is net verlopen. Typ de nieuwe code uit je app. Klopt hij nog altijd niet? Kijk of de tijd op je telefoon automatisch ingesteld staat.";
  if (code === "mfa_challenge_expired" || tekst.includes("expired"))
    return "Dat duurde te lang. Typ de nieuwe code uit je app.";
  if (
    code === "over_request_rate_limit" ||
    code === "too_many_requests" ||
    tekst.includes("rate limit")
  )
    return "Te veel pogingen. Wacht een paar minuten en probeer opnieuw.";
  if (code === "insufficient_aal" || tekst.includes("aal2"))
    return "Bevestig eerst met je huidige code voor je dit wijzigt.";
  return "Dat lukte niet. Probeer het opnieuw.";
}

export type Factor = { id: string; status: string; friendly_name?: string | null };

export function factorStatusTekst(status: string): string {
  return status === "verified" ? "actief" : "niet afgewerkt";
}

/**
 * Waarschuwing vóór het verwijderen van een factor. De laatste actieve factor verwijderen
 * terwijl 2FA verplicht is, sluit je buiten (dan rest alleen herstel via het dashboard).
 */
export function verwijderWaarschuwing(factoren: Factor[], id: string, verplicht: boolean): string {
  const doel = factoren.find((f) => f.id === id);
  if (!doel || doel.status !== "verified") return "Deze onafgewerkte koppeling wordt verwijderd.";
  const overige = factoren.filter((f) => f.status === "verified" && f.id !== id).length;
  if (overige > 0)
    return `Je houdt daarna nog ${overige} actieve authenticator${overige > 1 ? "s" : ""}.`;
  return verplicht
    ? "Dit is je laatste authenticator en 2-staps verificatie is verplicht voor jouw rol. Zonder authenticator kom je niet meer in het Control Center tot je een nieuwe koppelt."
    : "Dit is je laatste authenticator. Daarna meld je aan met alleen je wachtwoord.";
}

/** Tip als er minder dan twee actieve factoren zijn (herstelplan §3: reserve vereist). */
export function reserveTip(factoren: Factor[]): string | null {
  const actief = factoren.filter((f) => f.status === "verified").length;
  if (actief >= 2) return null;
  if (actief === 1)
    return "Koppel ook een reserve-authenticator (bv. een tweede toestel of je wachtwoordbeheerder). Ben je je telefoon kwijt, dan kom je zo toch binnen.";
  return null;
}
