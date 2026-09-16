import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type BerichtSoort = "gezinsuitnodiging" | "gezin_ok";

async function stuurGezinsBericht(opts: {
  ontvanger: string;
  soort: BerichtSoort;
  vanNaam: string;
  gezinNaam: string;
  url: string;
  sleutel: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { teksten } = await import("@/lib/melding-teksten");
  const { stuurPush } = await import("@/lib/webpush.server");

  const [{ data: profiel }, { data: voorkeur }, { data: abos }] = await Promise.all([
    supabaseAdmin.from("profiles").select("taal").eq("id", opts.ontvanger).maybeSingle(),
    supabaseAdmin
      .from("notification_preferences")
      .select("lockscreen_details")
      .eq("user_id", opts.ontvanger)
      .maybeSingle(),
    supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", opts.ontvanger)
      .eq("actief", true),
  ]);

  const T = teksten(profiel?.taal);
  const titel =
    opts.soort === "gezinsuitnodiging" ? T.gezinsuitnodiging_titel : T.gezin_ok_titel;
  const volleBody =
    opts.soort === "gezinsuitnodiging"
      ? T.gezinsuitnodiging_body(opts.vanNaam, opts.gezinNaam)
      : T.gezin_ok_body(opts.vanNaam, opts.gezinNaam);
  const body = voorkeur?.lockscreen_details === false ? T.prive : volleBody;

  await supabaseAdmin.from("notification_log").insert({
    user_id: opts.ontvanger,
    soort: opts.soort,
    titel,
    body: volleBody,
    url: opts.url,
    status: "verstuurd",
    dedupe_key: opts.sleutel,
  });

  for (const abo of abos ?? []) {
    const res = await stuurPush(abo, {
      titel,
      body,
      url: `${opts.url}${opts.url.includes("?") ? "&" : "?"}mld=${encodeURIComponent(opts.sleutel)}`,
      tag: opts.sleutel,
    });
    if (!res.ok && res.verlopen) {
      await supabaseAdmin.from("push_subscriptions").update({ actief: false }).eq("id", abo.id);
    }
  }
}

async function naamVan(supabase: { from: (t: string) => any }, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return (data?.display_name as string | undefined) || "Iemand";
}

/** Een actief gezinslid nodigt een bestaande gebruiker uit voor het gezin. */
export const nodigUitGezin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; doelId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.groupId || !data.doelId) return { ok: false as const, reden: "ongeldig" as const };

    const { data: groep } = await supabase
      .from("groups")
      .select("id, naam")
      .eq("id", data.groupId)
      .maybeSingle();
    if (!groep) return { ok: false as const, reden: "ongeldig" as const };

    const { error } = await supabase.rpc("nodig_gezinslid", {
      _group: data.groupId,
      _user: data.doelId,
    });
    if (error) {
      if (error.message.includes("al uitgenodigd")) {
        return { ok: false as const, reden: "bestaat" as const };
      }
      return { ok: false as const, reden: "mislukt" as const };
    }

    await stuurGezinsBericht({
      ontvanger: data.doelId,
      soort: "gezinsuitnodiging",
      vanNaam: await naamVan(supabase, userId),
      gezinNaam: groep.naam as string,
      url: `/vrienden?gezin=${groep.id}`,
      sleutel: `${data.doelId}:gezinsuitnodiging:${groep.id}`,
    });

    return { ok: true as const };
  });

/** De uitgenodigde aanvaardt of weigert de gezinsuitnodiging. */
export const beantwoordGezinsUitnodiging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; ja: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.groupId) return { ok: false as const };

    if (!data.ja) {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", data.groupId)
        .eq("user_id", userId)
        .eq("status", "uitgenodigd");
      if (error) return { ok: false as const };
      return { ok: true as const };
    }

    const { data: groep } = await supabase
      .from("groups")
      .select("id, naam, owner_id")
      .eq("id", data.groupId)
      .maybeSingle();

    const { error } = await supabase.rpc("accepteer_gezin", { _group: data.groupId });
    if (error) return { ok: false as const };

    if (groep?.owner_id && groep.owner_id !== userId) {
      await stuurGezinsBericht({
        ontvanger: groep.owner_id as string,
        soort: "gezin_ok",
        vanNaam: await naamVan(supabase, userId),
        gezinNaam: groep.naam as string,
        url: "/gezin",
        sleutel: `${groep.owner_id}:gezin_ok:${data.groupId}:${userId}`,
      });
    }

    return { ok: true as const };
  });
