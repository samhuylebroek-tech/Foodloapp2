import { supabase } from "@/integrations/supabase/client";

/**
 * Lichte, anonieme gebruiksmeting voor het Control Center.
 * Eén vaste lijst van gebeurtenissen, zodat cijfers altijd vergelijkbaar blijven.
 * Geen persoonlijke inhoud in het detailveld — enkel losse ids en korte labels.
 */
export const GEBEURTENISSEN = [
  "app.open",
  "auth.login",
  "auth.signup",
  "recept.bekeken",
  "recept.aangemaakt",
  "recept.geimporteerd",
  "recept.favoriet",
  "weekmenu.bekeken",
  "weekmenu.aangepast",
  "boodschappen.bekeken",
  "boodschappen.afgevinkt",
  "kookmodus.gestart",
  "kaart.getoond",
  "vrienden.uitnodiging",
  "vrienden.aanvaard",
  "melding.aangetikt",
  "ai.gebruikt",
] as const;

export type Gebeurtenis = (typeof GEBEURTENISSEN)[number];

export const GEBEURTENIS_LABEL: Record<string, string> = {
  "app.open": "App geopend",
  "auth.login": "Aangemeld",
  "auth.signup": "Account aangemaakt",
  "recept.bekeken": "Recept geopend",
  "recept.aangemaakt": "Recept aangemaakt",
  "recept.geimporteerd": "Recept geïmporteerd",
  "recept.favoriet": "Favoriet gezet",
  "weekmenu.bekeken": "Weekmenu bekeken",
  "weekmenu.aangepast": "Weekmenu aangepast",
  "boodschappen.bekeken": "Boodschappenlijst geopend",
  "boodschappen.afgevinkt": "Boodschap afgevinkt",
  "kookmodus.gestart": "Kookmodus gestart",
  "kaart.getoond": "Klantenkaart getoond",
  "vrienden.uitnodiging": "Uitnodiging verstuurd",
  "vrienden.aanvaard": "Uitnodiging aanvaard",
  "melding.aangetikt": "Melding aangetikt",
  "ai.gebruikt": "Slimme functie gebruikt",
};

function pad(path?: string) {
  return path ?? (typeof window !== "undefined" ? window.location.pathname : null);
}

export async function meet(event: string, path?: string, detail?: Record<string, unknown>) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    await supabase.from("usage_events").insert({
      user_id: userId,
      event,
      path: pad(path),
      detail: (detail ?? {}) as never,
    });
  } catch {
    /* meten mag de app nooit hinderen */
  }
}

/** Fout die een gebruiker effectief zag. Nooit tokens of wachtwoorden meesturen. */
export async function meldFout(opts: {
  soort?: string;
  feature?: string;
  bericht: string;
  detail?: string;
  path?: string;
}) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    await supabase.from("app_errors").insert({
      user_id: userId,
      soort: opts.soort ?? "runtime",
      feature: opts.feature ?? "",
      bericht: opts.bericht.slice(0, 500),
      detail: (opts.detail ?? "").slice(0, 4000),
      path: pad(opts.path),
    });
  } catch {
    /* fouten melden mag nooit een tweede fout veroorzaken */
  }
}
