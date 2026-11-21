import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fase 8 — Analyse intrekken: ook de bestaande gebruiksgegevens wissen (welke schermen en knoppen,
 * dagtotalen). De app mag usage_events niet zelf wissen (RLS), dus dit loopt via de server met de
 * service-sleutel, strikt gefilterd op de gebruiker uit het gecontroleerde token. Sessies
 * (user_sessions) blijven: die dienen voor "waar ben je aangemeld" (beveiliging), en verdwijnen
 * met het account.
 */
export const wisMijnGebruiksgegevens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [a, b] = await Promise.all([
      supabaseAdmin.from("usage_events").delete().eq("user_id", context.userId),
      supabaseAdmin.from("daily_user_stats").delete().eq("user_id", context.userId),
    ]);
    if (a.error || b.error) throw new Error("Wissen lukte niet. Probeer het straks opnieuw.");
    return { ok: true };
  });
