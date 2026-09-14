import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CreditKost = { feature: string; label: string; credit_cost: number; enabled: boolean };
export type CreditPack = {
  id: string;
  naam: string;
  credits: number;
  bonus: number;
  prijs_cent: number;
};
export type CreditBoeking = {
  id: string;
  type: string;
  amount: number;
  feature: string | null;
  created_at: string;
  status: string;
};

export type CreditOverzicht = {
  saldo: number;
  gratisTotaal: number;
  gekochtTotaal: number;
  gebruiktTotaal: number;
  waarschuwingVanaf: number;
  kopenActief: boolean;
  kosten: CreditKost[];
  pakketten: CreditPack[];
  boekingen: CreditBoeking[];
};

export const creditOverzicht = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditOverzicht> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // zorgt dat iedere gebruiker een tegoed heeft (ook wie al bestond)
    await supabaseAdmin.rpc("credits_account", { _user: context.userId });

    const [saldo, kosten, pakketten, boekingen, instellingen] = await Promise.all([
      supabaseAdmin
        .from("user_credits")
        .select("balance, gratis_totaal, gekocht_totaal, gebruikt_totaal")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("credit_costs")
        .select("feature, label, credit_cost, enabled")
        .order("credit_cost", { ascending: true }),
      supabaseAdmin
        .from("credit_packs")
        .select("id, naam, credits, bonus, prijs_cent")
        .eq("actief", true)
        .order("volgorde", { ascending: true }),
      supabaseAdmin
        .from("credit_transactions")
        .select("id, type, amount, feature, created_at, status")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("platform_settings")
        .select("key, value")
        .in("key", ["credits_kopen_actief", "credits_waarschuwing"]),
    ]);

    const map = new Map((instellingen.data ?? []).map((r) => [r.key, r.value]));
    const getal = (v: unknown, standaard: number) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : standaard;
    };

    return {
      saldo: saldo.data?.balance ?? 0,
      gratisTotaal: saldo.data?.gratis_totaal ?? 0,
      gekochtTotaal: saldo.data?.gekocht_totaal ?? 0,
      gebruiktTotaal: saldo.data?.gebruikt_totaal ?? 0,
      waarschuwingVanaf: getal(map.get("credits_waarschuwing"), 10),
      kopenActief: map.get("credits_kopen_actief") === true,
      kosten: (kosten.data ?? []) as CreditKost[],
      pakketten: (pakketten.data ?? []) as CreditPack[],
      boekingen: (boekingen.data ?? []) as CreditBoeking[],
    };
  });
