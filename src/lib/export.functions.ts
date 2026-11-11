import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Alles wat de gebruiker zelf van Foodlo mag meenemen, in één bestand (AVG art. 15/20).
 * Gedeelde lijst met de beheer-export: `avg-export.server.ts` (BUG-026). Draait met de
 * service-sleutel, maar elke query filtert op `context.userId` uit het gecontroleerde token.
 */
export const exporteerMijnGegevens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verzamelPersoonsgegevens } = await import("@/lib/avg-export.server");
    return verzamelPersoonsgegevens(supabaseAdmin, context.userId);
  });
