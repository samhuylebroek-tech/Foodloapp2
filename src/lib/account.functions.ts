import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Verwijdert het eigen account en alle eigen gegevens (verplicht door Apple en Google). */
export const verwijderMijnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bevestiging: z.literal("VERWIJDER") }).parse(d))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("Je account kon niet verwijderd worden. Probeer later opnieuw.");
    return { ok: true };
  });
