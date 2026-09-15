import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { teksten, type Soort } from "@/lib/melding-teksten";
import { stuurPush } from "@/lib/webpush.server";

/** Standaardtijden per moment van de dag (lokale tijd van de gebruiker). */
const MOMENT_TIJD: Record<string, number> = {
  ontbijt: 8 * 60,
  middageten: 12 * 60 + 30,
  avondeten: 18 * 60 + 30,
  maaltijd: 18 * 60 + 30,
};

type Deel = { soort: Soort; titel: string; body: string; url: string; sleutel: string };

function lokaal(tijdzone: string, nu: Date) {
  let delen: Intl.DateTimeFormatPart[];
  try {
    delen = new Intl.DateTimeFormat("en-CA", {
      timeZone: tijdzone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    }).formatToParts(nu);
  } catch {
    return lokaal("Europe/Brussels", nu);
  }
  const p = Object.fromEntries(delen.map((d) => [d.type, d.value])) as Record<string, string>;
  const dagen = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    datum: `${p["year"]}-${p["month"]}-${p["day"]}`,
    minuten: Number(p["hour"] === "24" ? "0" : p["hour"]) * 60 + Number(p["minute"]),
    dow: Math.max(0, dagen.indexOf(p["weekday"] ?? "Sun")),
  };
}

function naarMinuten(tijd: string) {
  const [u, m] = tijd.split(":");
  return Number(u) * 60 + Number(m ?? 0);
}

/** Valt dit tijdstip in het kwartier dat nu afgesloten wordt? */
function nuAanDeBeurt(doel: number, nu: number) {
  const verschil = nu - doel;
  return verschil >= 0 && verschil < 15;
}

function datumPlus(datum: string, dagen: number) {
  const d = new Date(`${datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/public/meldingen/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fout = await authenticateCronRequest(request);
        if (fout) return fout;
        return await draai();
      },
      GET: async ({ request }) => {
        const fout = await authenticateCronRequest(request);
        if (fout) return fout;
        return await draai();
      },
    },
  },
});

async function draai() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nu = new Date();

  const { data: abos } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, fail_count")
    .eq("actief", true);

  if (!abos?.length) return Response.json({ ok: true, gebruikers: 0, verstuurd: 0 });

  const gebruikers = [...new Set(abos.map((a) => a.user_id))];

  const [{ data: voorkeuren }, { data: profielen }] = await Promise.all([
    supabaseAdmin.from("notification_preferences").select("*").in("user_id", gebruikers),
    supabaseAdmin.from("profiles").select("id, taal, momenten").in("id", gebruikers),
  ]);

  let verstuurd = 0;

  for (const gebruiker of gebruikers) {
    const v = voorkeuren?.find((x) => x.user_id === gebruiker);
    if (!v) continue;
    const profiel = profielen?.find((p) => p.id === gebruiker);
    const T = teksten(profiel?.taal);
    const tijd = lokaal(v.tijdzone, nu);
    const delen: Deel[] = [];

    // Wat staat er vandaag gepland?
    const { data: vandaag } = await supabaseAdmin
      .from("meal_plan")
      .select("meal_type, custom_title, recipe_id, recipes(title)")
      .eq("user_id", gebruiker)
      .eq("plan_date", tijd.datum);

    const naamVan = (r: (typeof vandaag extends (infer U)[] | null ? U : never) | undefined) =>
      r?.custom_title || (r?.recipes as { title?: string } | null)?.title || "";

    // 1. Menu van vandaag
    if (v.daily_menu_on && nuAanDeBeurt(naarMinuten(String(v.daily_menu_time)), tijd.minuten)) {
      const momenten = v.daily_menu_moments?.length ? v.daily_menu_moments : ["avondeten", "maaltijd"];
      const rij = vandaag?.find((r) => momenten.includes(r.meal_type));
      const naam = naamVan(rij);
      if (naam) {
        delen.push({
          soort: "daily_menu",
          titel: T.daily_titel,
          body: T.daily_body(naam),
          url: "/planner",
          sleutel: `${gebruiker}:daily_menu:${tijd.datum}`,
        });
      }
    }

    // 2. Weekmenu plannen — niet wanneer de komende week al grotendeels gepland is
    if (v.weekly_on && v.weekly_dow === tijd.dow && nuAanDeBeurt(naarMinuten(String(v.weekly_time)), tijd.minuten)) {
      const { count } = await supabaseAdmin
        .from("meal_plan")
        .select("id", { count: "exact", head: true })
        .eq("user_id", gebruiker)
        .gte("plan_date", datumPlus(tijd.datum, 1))
        .lte("plan_date", datumPlus(tijd.datum, 7));
      if ((count ?? 0) < 5) {
        delen.push({
          soort: "weekly",
          titel: T.weekly_titel,
          body: T.weekly_body,
          url: "/planner",
          sleutel: `${gebruiker}:weekly:${tijd.datum}`,
        });
      }
    }

    // 3 + 5. Maaltijd- en kookherinnering
    for (const rij of vandaag ?? []) {
      const naam = naamVan(rij);
      if (!naam) continue;
      const start = MOMENT_TIJD[rij.meal_type] ?? MOMENT_TIJD["avondeten"]!;
      const doelRecept = rij.recipe_id ? `/recepten/${rij.recipe_id}` : "/planner";
      if (v.meal_on && nuAanDeBeurt(start - v.meal_lead_min, tijd.minuten)) {
        delen.push({
          soort: "meal",
          titel: T.meal_titel,
          body: T.meal_body(naam),
          url: doelRecept,
          sleutel: `${gebruiker}:meal:${tijd.datum}:${rij.meal_type}`,
        });
      }
      if (v.cooking_on && nuAanDeBeurt(start - v.cooking_lead_min, tijd.minuten)) {
        delen.push({
          soort: "cooking",
          titel: T.cooking_titel,
          body: T.cooking_body(naam),
          url: `${doelRecept}?koken=1`,
          sleutel: `${gebruiker}:cooking:${tijd.datum}:${rij.meal_type}`,
        });
      }
    }

    // 4. Boodschappen — alleen wanneer er nog iets af te vinken valt
    if (v.shopping_on && nuAanDeBeurt(naarMinuten(String(v.shopping_time)), tijd.minuten)) {
      const { count } = await supabaseAdmin
        .from("shopping_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", gebruiker)
        .eq("checked", false);
      if ((count ?? 0) > 0) {
        delen.push({
          soort: "shopping",
          titel: T.shopping_titel,
          body: T.shopping_body(count ?? 0),
          url: "/boodschappen",
          sleutel: `${gebruiker}:shopping:${tijd.datum}`,
        });
      }
    }

    if (!delen.length) continue;

    // Dubbels weren: alles wat vandaag al verstuurd is, valt af.
    const { data: al } = await supabaseAdmin
      .from("notification_log")
      .select("dedupe_key")
      .in(
        "dedupe_key",
        delen.map((d) => d.sleutel),
      );
    const nieuw = delen.filter((d) => !al?.some((a) => a.dedupe_key === d.sleutel));
    if (!nieuw.length) continue;

    // Meerdere meldingen tegelijk? Eén bericht.
    const eerste = nieuw[0]!;
    const titel = nieuw.length === 1 ? eerste.titel : teksten(profiel?.taal).merk;
    const body = nieuw.map((d) => d.body).join(" · ");
    const toon = v.lockscreen_details;

    const payload = {
      titel: toon ? titel : T.merk,
      body: toon ? body : T.prive,
      url: `${eerste.url}${eerste.url.includes("?") ? "&" : "?"}mld=${encodeURIComponent(eerste.sleutel)}`,
      tag: `foodlo-${tijd.datum}-${eerste.soort}`,
    };

    const mijn = abos.filter((a) => a.user_id === gebruiker);
    let gelukt = false;
    let laatsteFout: string | undefined;

    for (const abo of mijn) {
      const res = await stuurPush(abo, payload);
      if (res.ok) {
        gelukt = true;
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ last_ok_at: new Date().toISOString(), fail_count: 0 })
          .eq("id", abo.id);
      } else {
        laatsteFout = res.fout;
        if (res.verlopen) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", abo.id);
        } else {
          const tellen = (abo.fail_count ?? 0) + 1;
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ fail_count: tellen, actief: tellen < 3 })
            .eq("id", abo.id);
        }
      }
    }

    for (const d of nieuw) {
      await supabaseAdmin.from("notification_log").insert({
        user_id: gebruiker,
        soort: d.soort,
        titel: d.titel,
        body: d.body,
        url: d.url,
        status: gelukt ? "sent" : "failed",
        fout: gelukt ? null : (laatsteFout ?? "geen toestel"),
        dedupe_key: d.sleutel,
      });
    }
    if (gelukt) verstuurd += 1;
  }

  return Response.json({ ok: true, gebruikers: gebruikers.length, verstuurd });
}
