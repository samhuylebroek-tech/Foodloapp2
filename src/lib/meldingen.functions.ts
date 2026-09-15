import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { teksten } from "@/lib/melding-teksten";
import { stuurPush } from "@/lib/webpush.server";

export type MeldingVoorkeuren = {
  daily_menu_on: boolean;
  daily_menu_time: string;
  daily_menu_moments: string[];
  weekly_on: boolean;
  weekly_dow: number;
  weekly_time: string;
  meal_on: boolean;
  meal_lead_min: number;
  shopping_on: boolean;
  shopping_time: string;
  cooking_on: boolean;
  cooking_lead_min: number;
  lockscreen_details: boolean;
  tijdzone: string;
  onboarding_gezien: boolean;
};

function kort(tijd: string) {
  return String(tijd).slice(0, 5);
}

/** Publieke sleutel om de browser te laten abonneren. Geen geheim. */
export const vapidSleutel = createServerFn({ method: "GET" }).handler(async () => ({
  sleutel: process.env["VAPID_PUBLIC_KEY"] ?? "",
}));

export const haalMeldingVoorkeuren = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeldingVoorkeuren> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) {
      const { data: nieuw } = await supabase
        .from("notification_preferences")
        .insert({ user_id: userId })
        .select("*")
        .single();
      return { ...(nieuw as MeldingVoorkeuren), daily_menu_time: kort(nieuw!.daily_menu_time) };
    }
    return {
      ...(data as MeldingVoorkeuren),
      daily_menu_time: kort(data.daily_menu_time),
      weekly_time: kort(data.weekly_time),
      shopping_time: kort(data.shopping_time),
    };
  });

export const bewaarMeldingVoorkeuren = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<MeldingVoorkeuren>) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bewaarPushAbonnement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string; p256dh: string; auth: string; userAgent?: string; tijdzone?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: (data.userAgent ?? "").slice(0, 300),
        actief: true,
        fail_count: 0,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: userId, onboarding_gezien: true, ...(data.tijdzone ? { tijdzone: data.tijdzone } : {}) },
        { onConflict: "user_id" },
      );
    return { ok: true };
  });

export const verwijderPushAbonnement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const bewaarTijdzone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tijdzone: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("notification_preferences")
      .update({ tijdzone: data.tijdzone })
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const meldingAangetikt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sleutel: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("notification_log")
      .update({ status: "clicked", clicked_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("dedupe_key", data.sleutel);
    return { ok: true };
  });

export const stuurTestMelding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: abos }, { data: profiel }] = await Promise.all([
      supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId).eq("actief", true),
      supabase.from("profiles").select("taal").eq("id", userId).maybeSingle(),
    ]);
    if (!abos?.length) return { ok: false, reden: "geen-toestel" as const };
    const T = teksten(profiel?.taal);
    let gelukt = false;
    let fout = "";
    for (const abo of abos) {
      const res = await stuurPush(abo, {
        titel: T.test_titel,
        body: T.test_body,
        url: "/meldingen",
        tag: "foodlo-test",
      });
      if (res.ok) gelukt = true;
      else fout = res.fout ?? "";
    }
    return { ok: gelukt, reden: gelukt ? ("ok" as const) : ("mislukt" as const), fout };
  });
