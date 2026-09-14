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

export type CreditAanvraag = {
  id: string;
  aantal: number;
  bericht: string;
  status: string;
  toegekend: number;
  admin_note: string;
  created_at: string;
};

/** Laatste aanvraag van de gebruiker (om dubbele vragen te vermijden). */
export const mijnCreditAanvraag = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditAanvraag | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("credit_requests")
      .select("id, aantal, bericht, status, toegekend, admin_note, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as CreditAanvraag | null) ?? null;
  });

/** Gebruiker vraagt extra credits aan bij het team. */
export const vraagCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ aantal: z.number().int().min(0).max(100000).default(0), bericht: z.string().max(500).default("") })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Niet spammen: één open aanvraag tegelijk, en max 3 per dag.
    const { data: open } = await supabaseAdmin
      .from("credit_requests")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "open")
      .limit(1);
    if (open && open.length > 0) {
      return { ok: false as const, melding: "Je vraag staat al klaar. We laten iets weten zodra ze behandeld is." };
    }
    const sinds = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("credit_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", sinds);
    if ((count ?? 0) >= 3) {
      return { ok: false as const, melding: "Je stuurde vandaag al een paar vragen. Probeer morgen opnieuw." };
    }

    const { error } = await supabaseAdmin.from("credit_requests").insert({
      user_id: context.userId,
      aantal: data.aantal,
      bericht: data.bericht.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, melding: "Bedankt! Je vraag is doorgestuurd." };
  });
