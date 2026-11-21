/**
 * Fase 6 — premium-extra's via de server. De server leest de rechten zelf (service-rol, tabel
 * `entitlements` uit voorstel 0012, alleen door de server geschreven) en controleert met
 * `vereisRecht` vóór er inhoud teruggaat. Een directe API-aanroep zonder recht krijgt dus alleen
 * de vaste fout `GEEN_RECHT` en nooit de inhoud.
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOntbrekendeTabel } from "@/lib/module-beschikbaar";
import type { Entitlement } from "./entitlements";
import { seizoenVoor, WEEK_SJABLONEN, type WeekSjabloon } from "./premium-inhoud";
import { vereisRecht } from "./rechten";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LosseDb = SupabaseClient<any>;

export type PremiumExtra =
  | { beschikbaar: false }
  | { beschikbaar: true; soort: "seizoenskalender"; maand: string; items: string[] }
  | { beschikbaar: true; soort: "weekmenu_sjablonen"; sjablonen: WeekSjabloon[] };

/** Rechten van één gebruiker, gelezen door de server. `null` = tabel bestaat (nog) niet. */
export async function rechtenVanServer(db: LosseDb, userId: string): Promise<Entitlement[] | null> {
  const { data, error } = await db
    .from("entitlements")
    .select("recht, geldig_tot")
    .eq("user_id", userId);
  if (error) {
    if (isOntbrekendeTabel(error)) return null;
    throw new Error("Je rechten konden niet geladen worden.");
  }
  return (data ?? []) as Entitlement[];
}

const RECHT_VOOR = {
  seizoenskalender: "premium.seizoenskalender",
  weekmenu_sjablonen: "premium.weekmenu_extra",
} as const;

export const premiumExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ soort: z.enum(["seizoenskalender", "weekmenu_sjablonen"]) }).parse(d),
  )
  .handler(async ({ context, data }): Promise<PremiumExtra> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as LosseDb;
    const userId = (context as { userId: string }).userId;
    const rechten = await rechtenVanServer(db, userId);
    if (rechten === null) return { beschikbaar: false };
    vereisRecht({ id: userId, entitlements: rechten }, RECHT_VOOR[data.soort]);
    if (data.soort === "seizoenskalender") {
      const s = seizoenVoor();
      return { beschikbaar: true, soort: "seizoenskalender", maand: s.maand, items: [...s.items] };
    }
    return {
      beschikbaar: true,
      soort: "weekmenu_sjablonen",
      sjablonen: WEEK_SJABLONEN.map((w) => ({ ...w, dagen: [...w.dagen] })),
    };
  });
