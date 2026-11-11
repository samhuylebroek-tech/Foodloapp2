import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EIGENAAR_NIET_VERWIJDEREN, isEigenaar } from "@/lib/eigenaar";

/**
 * Verwijdert het eigen account en alle eigen gegevens (verplicht door Apple en Google).
 * Volgorde:
 * 1. gezinnen waarvan je eigenaar bent overdragen of wissen (BUG-110), zodat andere leden hun
 *    gezinslijst en hun eigen items niet verliezen;
 * 2. het account wissen (cascades wissen je eigen rijen);
 * 3. je foto's wissen, behalve wat anderen nog gebruiken (BUG-025, bv. bewaard uit Inspiratie).
 * Faalt stap 3, dan is het account toch weg; de fout wordt zonder persoonsgegevens gelogd.
 */
export const verwijderMijnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bevestiging: z.literal("VERWIJDER") }).parse(d))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { draagGezinnenOver, ruimFotosOp } = await import("@/lib/account-opruimen.server");
    const mislukt = "Je account kon niet verwijderd worden. Probeer later opnieuw.";
    if (isEigenaar(context.userId)) throw new Error(EIGENAAR_NIET_VERWIJDEREN);

    try {
      await draagGezinnenOver(supabaseAdmin, context.userId);
    } catch {
      throw new Error(mislukt);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(mislukt);
    try {
      await ruimFotosOp(supabaseAdmin, context.userId);
    } catch (e) {
      console.error(
        "foto-opruiming na accountverwijdering mislukt",
        e instanceof Error ? e.message : "onbekend",
      );
    }
    return { ok: true };
  });
