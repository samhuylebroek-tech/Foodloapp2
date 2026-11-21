import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AI_KOP } from "@/lib/privacy/ai-toestemming";
import { leesToestel } from "@/lib/privacy/toestemmingen";

/**
 * Fase 8: stuurt "AI uit" (keuze op dit toestel) mee met elke serverfunctie, zodat de server de
 * AI weigert, ook vóór de toestemmingentabel bestaat. Geen kop = geen beperking.
 */
export const attachToestemmingen = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let uit = false;
    try {
      const { data } = await supabase.auth.getSession();
      uit = leesToestel(data.session?.user.id).ai?.aan === false;
    } catch {
      /* geen sessie: niets mee te sturen */
    }
    return next({ headers: uit ? { [AI_KOP]: "uit" } : {} });
  },
);
