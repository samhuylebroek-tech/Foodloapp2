import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EIGENAAR_NIET_VERWIJDEREN, isEigenaar } from "@/lib/eigenaar";

/**
 * Wat er gebeurt als je je account verwijdert, vóór je bevestigt (fase 8): per gezin waarvan je
 * eigenaar bent, wie de nieuwe eigenaar wordt of dat het gezin opgeheven wordt. Alleen eigen
 * gezinnen; de naam van de opvolger is iemand die al in jouw gezin zit.
 */
export const verwijderGevolgen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { gezinGevolgen } = await import("@/lib/account-opruimen.server");
    if (isEigenaar(context.userId)) return { magVerwijderen: false, gezinnen: [] };
    try {
      return { magVerwijderen: true, gezinnen: await gezinGevolgen(supabaseAdmin, context.userId) };
    } catch {
      throw new Error("Even niet gelukt. Probeer het straks opnieuw.");
    }
  });

/**
 * Verwijdert het eigen account en alle eigen gegevens (verplicht door Apple en Google).
 * Volgorde:
 * 1. gezinnen waarvan je eigenaar bent overdragen of opheffen (BUG-110), zodat andere leden hun
 *    gezinslijst en hun eigen items niet verliezen;
 * 2. elke rij uit het gegevensregister wissen of anonimiseren (fase 8: ook de nieuwe modules en
 *    tabellen zonder CASCADE). Mislukt er iets, dan stopt het hier en blijft het account bestaan,
 *    zodat je het opnieuw kan proberen (liever dat dan een half gewist account zonder aanmelding);
 * 3. het account wissen (cascades ruimen de rest);
 * 4. je foto's wissen, behalve wat anderen nog gebruiken (BUG-025), en al je community-foto's
 *    (BUG-179). Faalt stap 4, dan is het account toch weg; de fout wordt zonder persoonsgegevens
 *    gelogd.
 * Rolcontrole: alleen het eigen account (id uit het gecontroleerde token), nooit dat van de
 * eigenaar van het platform. Er is geen bedenktijd: verwijderen gebeurt meteen (zo staat het ook
 * in de app).
 */
export const verwijderMijnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bevestiging: z.literal("VERWIJDER") }).parse(d))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { draagGezinnenOver, ruimCommunityFotosOp, ruimFotosOp, ruimRegisterOp } = await import(
      "@/lib/account-opruimen.server"
    );
    const mislukt = "Je account kon niet verwijderd worden. Probeer later opnieuw.";
    if (isEigenaar(context.userId)) throw new Error(EIGENAAR_NIET_VERWIJDEREN);

    try {
      await draagGezinnenOver(supabaseAdmin, context.userId);
    } catch {
      throw new Error(mislukt);
    }
    const verslag = await ruimRegisterOp(supabaseAdmin, context.userId);
    if (verslag.mislukt.length) {
      // Alleen tabelnamen, nooit gegevens of het id.
      console.error("accountverwijdering: opruimen mislukt voor", verslag.mislukt.join(", "));
      throw new Error(mislukt);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(mislukt);
    try {
      await ruimFotosOp(supabaseAdmin, context.userId);
      await ruimCommunityFotosOp(supabaseAdmin, context.userId);
    } catch (e) {
      console.error(
        "foto-opruiming na accountverwijdering mislukt",
        e instanceof Error ? e.message : "onbekend",
      );
    }
    return { ok: true };
  });
