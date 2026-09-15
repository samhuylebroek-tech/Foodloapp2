import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MeldingStats = {
  gebruikersMetToestel: number;
  gebruikersTotaal: number;
  optInPercentage: number;
  verstuurd: number;
  mislukt: number;
  aangetikt: number;
  afleverPercentage: number;
  engagementPercentage: number;
  perSoort: { soort: string; verstuurd: number; aangetikt: number; mislukt: number }[];
  aanPerSoort: { soort: string; aantal: number }[];
  standaarden: { key: string; value: unknown; omschrijving: string }[];
};

async function moetAdminZijn(supabase: ReturnType<typeof Object> extends never ? never : any, userId: string) {
  const { data } = await supabase.rpc("is_admin", { _user_id: userId });
  if (!data) throw new Error("Geen toegang");
}

export const meldingStatistieken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeldingStats> => {
    const { supabase, userId } = context;
    await moetAdminZijn(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: abos }, { count: gebruikersTotaal }, { data: log }, { data: prefs }, { data: standaarden }] =
      await Promise.all([
        supabaseAdmin.from("push_subscriptions").select("user_id").eq("actief", true),
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("notification_log").select("soort, status").gte(
          "created_at",
          new Date(Date.now() - 30 * 864e5).toISOString(),
        ),
        supabaseAdmin
          .from("notification_preferences")
          .select("daily_menu_on, weekly_on, meal_on, shopping_on, cooking_on"),
        supabaseAdmin.from("notification_defaults").select("key, value, omschrijving").order("key"),
      ]);

    const metToestel = new Set((abos ?? []).map((a) => a.user_id)).size;
    const totaal = gebruikersTotaal ?? 0;
    const rijen = log ?? [];
    const verstuurd = rijen.filter((r) => r.status === "sent" || r.status === "clicked").length;
    const aangetikt = rijen.filter((r) => r.status === "clicked").length;
    const mislukt = rijen.filter((r) => r.status === "failed").length;

    const soorten = [...new Set(rijen.map((r) => r.soort))];
    const perSoort = soorten.map((soort) => {
      const s = rijen.filter((r) => r.soort === soort);
      return {
        soort,
        verstuurd: s.filter((r) => r.status !== "failed").length,
        aangetikt: s.filter((r) => r.status === "clicked").length,
        mislukt: s.filter((r) => r.status === "failed").length,
      };
    });

    const p = prefs ?? [];
    const aanPerSoort = [
      { soort: "daily_menu", aantal: p.filter((x) => x.daily_menu_on).length },
      { soort: "weekly", aantal: p.filter((x) => x.weekly_on).length },
      { soort: "meal", aantal: p.filter((x) => x.meal_on).length },
      { soort: "shopping", aantal: p.filter((x) => x.shopping_on).length },
      { soort: "cooking", aantal: p.filter((x) => x.cooking_on).length },
    ];

    return {
      gebruikersMetToestel: metToestel,
      gebruikersTotaal: totaal,
      optInPercentage: totaal ? Math.round((metToestel / totaal) * 100) : 0,
      verstuurd,
      mislukt,
      aangetikt,
      afleverPercentage: verstuurd + mislukt ? Math.round((verstuurd / (verstuurd + mislukt)) * 100) : 0,
      engagementPercentage: verstuurd ? Math.round((aangetikt / verstuurd) * 100) : 0,
      perSoort,
      aanPerSoort,
      standaarden: (standaarden ?? []) as MeldingStats["standaarden"],
    };
  });

export const bewaarMeldingStandaard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; value: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    await moetAdminZijn(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("notification_defaults")
      .update({ value: data.value, updated_at: new Date().toISOString() })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
