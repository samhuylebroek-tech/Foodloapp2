/**
 * Zet foutmeldingen van het aanmelden om naar gewone, vriendelijke taal.
 * Supabase geeft Engelse, technische teksten ("Invalid login credentials");
 * die begrijpt niet iedereen. We tonen nooit de ruwe tekst aan de gebruiker.
 */

type FoutVorm = { message?: unknown; code?: unknown; status?: unknown };

const REGELS: { test: RegExp; tekst: string }[] = [
  {
    test: /invalid login credentials|invalid_credentials/i,
    tekst:
      "Het e-mailadres of wachtwoord klopt niet. Kijk ze nog eens na, of kies 'Wachtwoord vergeten'.",
  },
  {
    test: /email not confirmed|email_not_confirmed/i,
    tekst:
      "Je e-mailadres is nog niet bevestigd. Open de mail die we je stuurden en tik op de link.",
  },
  {
    test: /user already registered|already been registered|user_already_exists|email_exists/i,
    tekst:
      "Er bestaat al een account met dit e-mailadres. Kies 'Inloggen' of 'Wachtwoord vergeten'.",
  },
  {
    test: /password should be at least|weak_password|password is too weak/i,
    tekst: "Kies een langer wachtwoord: minstens 6 tekens. Een korte zin werkt ook goed.",
  },
  {
    test: /unable to validate email|invalid email|email_address_invalid|validation_failed/i,
    tekst: "Dit e-mailadres lijkt niet te kloppen. Kijk het nog eens na.",
  },
  {
    test: /rate limit|too many requests|over_email_send_rate_limit|over_request_rate_limit/i,
    tekst:
      "Even geduld: er zijn te veel pogingen gedaan. Probeer het over een paar minuten opnieuw.",
  },
  {
    test: /same_password|should be different from the old/i,
    tekst: "Kies een ander wachtwoord dan je vorige.",
  },
  {
    test: /signups? not allowed|signup_disabled/i,
    tekst: "Nieuwe accounts maken kan nu even niet. Probeer het later opnieuw.",
  },
  {
    test: /failed to fetch|network|load failed|fetch failed/i,
    tekst: "Er is geen verbinding. Kijk of je internet aan staat en probeer het opnieuw.",
  },
];

export const ALGEMENE_AUTH_FOUT = "Er ging iets mis. Probeer het zo meteen opnieuw.";

export function authFoutTekst(fout: unknown): string {
  if (!fout) return ALGEMENE_AUTH_FOUT;
  const f = (typeof fout === "object" ? fout : { message: fout }) as FoutVorm;
  const bron = [f.code, f.message].filter((x) => typeof x === "string").join(" ");
  for (const regel of REGELS) if (regel.test.test(bron)) return regel.tekst;
  if (f.status === 429) return REGELS.find((r) => r.test.source.includes("rate"))!.tekst;
  return ALGEMENE_AUTH_FOUT;
}
