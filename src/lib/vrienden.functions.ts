import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { teksten } from "@/lib/melding-teksten";
import { stuurPush } from "@/lib/webpush.server";

export type Rechten = {
  recipes_view: boolean;
  recipes_edit: boolean;
  planner_view: boolean;
  planner_edit: boolean;
  shopping_view: boolean;
  shopping_edit: boolean;
};

const LEEG: Rechten = {
  recipes_view: false,
  recipes_edit: false,
  planner_view: false,
  planner_edit: false,
  shopping_view: false,
  shopping_edit: false,
};

function schoonRechten(input: Partial<Rechten> | null | undefined): Rechten {
  const uit = { ...LEEG };
  for (const sleutel of Object.keys(LEEG) as (keyof Rechten)[]) {
    uit[sleutel] = Boolean(input?.[sleutel]);
  }
  // Bewerken impliceert bekijken.
  if (uit.recipes_edit) uit.recipes_view = true;
  if (uit.planner_edit) uit.planner_view = true;
  if (uit.shopping_edit) uit.shopping_view = true;
  return uit;
}

/**
 * Zet een bericht in het meldingenlogboek van de ontvanger en stuurt
 * indien mogelijk ook een pushbericht. Gebruikt de beheerclient omdat
 * we naar een ánder account schrijven; de oproeper is al gecontroleerd.
 */
async function stuurBericht(opts: {
  ontvanger: string;
  soort: "uitnodiging" | "uitnodiging_ok" | "gezinsuitnodiging" | "gezin_ok";
  vanNaam: string;
  gezinNaam?: string;
  url: string;
  sleutel: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
  const g = opts.gezinNaam ?? "";
  const titel =
    opts.soort === "uitnodiging"
      ? T.uitnodiging_titel
      : opts.soort === "uitnodiging_ok"
        ? T.uitnodiging_ok_titel
        : opts.soort === "gezinsuitnodiging"
          ? T.gezinsuitnodiging_titel
          : T.gezin_ok_titel;
  const volleBody =
    opts.soort === "uitnodiging"
      ? T.uitnodiging_body(opts.vanNaam)
      : opts.soort === "uitnodiging_ok"
        ? T.uitnodiging_ok_body(opts.vanNaam)
        : opts.soort === "gezinsuitnodiging"
          ? T.gezinsuitnodiging_body(opts.vanNaam, g)
          : T.gezin_ok_body(opts.vanNaam, g);
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

async function mijnNaam(supabase: { from: (t: string) => any }, userId: string) {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return (data?.display_name as string | undefined) || "Iemand";
}

/** Nodigt een bestaande gebruiker uit en verwittigt die persoon. */
export const nodigUitVriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { doelId: string; rechten: Partial<Rechten> }) => {
    // Rechten worden daarna nog door schoonRechten() tot booleans herleid.
    const { doelId } = z.object({ doelId: z.string().uuid() }).parse(input);
    return { doelId, rechten: (input?.rechten ?? {}) as Partial<Rechten> };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.doelId || data.doelId === userId) {
      return { ok: false as const, reden: "ongeldig" as const };
    }

    const { data: rij, error } = await supabase
      .from("shares")
      .insert({
        owner_id: userId,
        member_id: data.doelId,
        status: "pending",
        ...schoonRechten(data.rechten),
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return { ok: false as const, reden: "bestaat" as const };
      throw new Error(error.message);
    }

    await stuurBericht({
      ontvanger: data.doelId,
      soort: "uitnodiging",
      vanNaam: await mijnNaam(supabase, userId),
      url: `/vrienden?uitnodiging=${rij.id}`,
      sleutel: `${data.doelId}:uitnodiging:${rij.id}`,
    });

    return { ok: true as const, id: rij.id as string };
  });

/** Neemt een uitnodiging aan of weigert ze, en deelt optioneel iets terug. */
export const beantwoordUitnodiging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string; ja: boolean; terug?: Partial<Rechten> | null }) => {
    const { token, ja } = z
      .object({ token: z.string().min(1).max(200), ja: z.boolean() })
      .parse(input);
    return { token, ja, terug: (input?.terug ?? null) as Partial<Rechten> | null };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!data.ja) {
      const { error } = await supabase.rpc("decline_share", { _token: data.token });
      if (error) throw new Error(error.message);
      return { ok: true as const, eigenaar: null };
    }

    const { data: eigenaar, error } = await supabase.rpc("accept_share", { _token: data.token });
    if (error) throw new Error(error.message);
    const owner = eigenaar as unknown as string;

    let terugGedeeld = true;
    const kies = schoonRechten(data.terug);
    if (owner && Object.values(kies).some(Boolean)) {
      const { error: fout } = await supabase
        .from("shares")
        .insert({ owner_id: userId, member_id: owner, status: "accepted", ...kies });
      if (fout && fout.code === "23505") {
        const { error: fout2 } = await supabase
          .from("shares")
          .update({ status: "accepted", ...kies })
          .eq("owner_id", userId)
          .eq("member_id", owner);
        terugGedeeld = !fout2;
      } else {
        terugGedeeld = !fout;
      }
    }

    if (owner) {
      await stuurBericht({
        ontvanger: owner,
        soort: "uitnodiging_ok",
        vanNaam: await mijnNaam(supabase, userId),
        url: "/vrienden",
        sleutel: `${owner}:aanvaard:${userId}`,
      });
    }

    return { ok: true as const, eigenaar: owner, terugGedeeld };
  });
