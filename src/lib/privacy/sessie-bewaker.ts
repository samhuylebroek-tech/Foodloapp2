/**
 * Fase 8 — Afmelden op andere toestellen moet ook echt merkbaar zijn op dat andere toestel.
 * Supabase houdt een toegangstoken geldig tot het vervalt; de app vroeg tot nu nooit of de sessie
 * nog bestaat. Nu: bij het openen en bij terugkeren naar de app (hooguit elke minuut) één
 * `auth.getUser()`. Zegt de server dat de sessie of de gebruiker niet meer bestaat, dan melden we
 * dit toestel netjes af. Geen netwerk = niets doen (offline blijft de app werken).
 */
import { supabase } from "@/integrations/supabase/client";

type AuthFout = { status?: unknown; code?: unknown; name?: unknown } | null | undefined;

/** Zuivere regel (getest): alleen een expliciet "bestaat niet meer" telt, nooit een netwerkfout. */
export function sessieIngetrokken(fout: AuthFout): boolean {
  if (!fout) return false;
  // supabase-js maakt van "session_not_found" een AuthSessionMissingError (en wist zelf de sessie).
  // We vragen dit alleen als er een sessie was, dus dan betekent het: elders afgemeld.
  if (fout.name === "AuthSessionMissingError") return true;
  const status = typeof fout.status === "number" ? fout.status : 0;
  const code = typeof fout.code === "string" ? fout.code : "";
  if (!(status === 401 || status === 403 || status === 404)) return false;
  return ["session_not_found", "user_not_found", "refresh_token_not_found"].includes(code);
}

export const AFGEMELD_SLEUTEL = "foodlo:afgemeld-elders";

function zetVlag(aan: boolean) {
  try {
    if (aan) window.sessionStorage.setItem(AFGEMELD_SLEUTEL, "1");
    else window.sessionStorage.removeItem(AFGEMELD_SLEUTEL);
  } catch {
    /* geen opslag: alleen ?afgemeld=1 */
  }
}

let laatst = 0;

/** Controleert de sessie (hooguit elke minuut). Geeft true als dit toestel afgemeld werd. */
export async function controleerSessie(nu = Date.now()): Promise<boolean> {
  if (nu - laatst < 60_000) return false;
  laatst = nu;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;
    // Vlag vóór de vraag: supabase-js wist bij "sessie bestaat niet" zelf al de sessie (en de app
    // leidt dan meteen naar de aanmeldpagina), nog voor getUser() terugkomt.
    zetVlag(true);
    const { error } = await supabase.auth.getUser();
    if (!sessieIngetrokken(error as AuthFout)) {
      zetVlag(false);
      return false;
    }
    await supabase.auth.signOut({ scope: "local" });
    return true;
  } catch {
    return false;
  }
}

/** Alleen voor tests. */
export function resetSessieControle() {
  laatst = 0;
}
