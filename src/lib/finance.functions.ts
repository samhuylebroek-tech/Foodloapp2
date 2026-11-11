import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bewaker } from "@/lib/admin.functions";
import { pagineer } from "@/lib/pagineer";

type Ctx = { supabase: any; userId: string; claims?: any };

const BETAALD = ["betaald", "voltooid", "paid", "completed", "succeeded"];
const TERUG = ["terugbetaald", "refunded"];

/** Finance-overzicht: alleen echte cijfers. Zonder betaalkoppeling blijft omzet 0 en "Niet gekoppeld". */
export const adminFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ dagen: z.number().int().min(1).max(366).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "finance.view");
    const sinds = new Date(Date.now() - data.dagen * 86400_000).toISOString();
    const vorigSinds = new Date(Date.now() - 2 * data.dagen * 86400_000).toISOString();

    // In stukken ophalen: PostgREST geeft max. 1000 rijen per verzoek (BUG-093). Vaste
    // volgorde (created_at, id) zodat geen rij dubbel of niet meegeteld wordt.
    const [aankopen, ai, tx, saldo] = await Promise.all([
      pagineer((van, tot) =>
        db
          .from("aankopen")
          .select("id, user_id, soort, bedrag_cent, valuta, status, provider, created_at")
          .gte("created_at", vorigSinds)
          .order("created_at", { ascending: false })
          .order("id")
          .range(van, tot),
      ),
      pagineer((van, tot) =>
        db
          .from("ai_usage")
          .select("feature, kost_eur, credits, created_at")
          .gte("created_at", vorigSinds)
          .order("created_at")
          .order("id")
          .range(van, tot),
      ),
      pagineer((van, tot) =>
        db
          .from("credit_transactions")
          .select("type, amount, created_at")
          .gte("created_at", vorigSinds)
          .order("created_at")
          .order("id")
          .range(van, tot),
      ),
      pagineer((van, tot) =>
        db.from("user_credits").select("balance").order("user_id").range(van, tot),
      ),
    ]);

    const inPeriode = (d: string) => d >= sinds;
    const a = (aankopen.data ?? []) as any[];
    const betaald = a.filter((x) => BETAALD.includes(x.status));
    const omzet =
      betaald.filter((x) => inPeriode(x.created_at)).reduce((s, x) => s + x.bedrag_cent, 0) / 100;
    const omzetVorig =
      betaald.filter((x) => !inPeriode(x.created_at)).reduce((s, x) => s + x.bedrag_cent, 0) / 100;
    const refunds = a.filter((x) => TERUG.includes(x.status) && inPeriode(x.created_at));

    const u = (ai.data ?? []) as any[];
    const kost = u
      .filter((x) => inPeriode(x.created_at))
      .reduce((s, x) => s + Number(x.kost_eur ?? 0), 0);
    const kostVorig = u
      .filter((x) => !inPeriode(x.created_at))
      .reduce((s, x) => s + Number(x.kost_eur ?? 0), 0);
    const perFeature = new Map<string, { aantal: number; kost: number; credits: number }>();
    for (const x of u.filter((x) => inPeriode(x.created_at))) {
      const r = perFeature.get(x.feature) ?? { aantal: 0, kost: 0, credits: 0 };
      r.aantal += 1;
      r.kost += Number(x.kost_eur ?? 0);
      r.credits += x.credits ?? 0;
      perFeature.set(x.feature, r);
    }

    const t = ((tx.data ?? []) as any[]).filter((x) => inPeriode(x.created_at));
    const somType = (types: string[]) =>
      t.filter((x) => types.includes(x.type)).reduce((s, x) => s + Math.abs(x.amount), 0);

    return {
      omzet,
      omzetVorig,
      kost,
      kostVorig,
      marge: omzet - kost,
      betalendeKlanten: new Set(
        betaald.filter((x) => inPeriode(x.created_at)).map((x) => x.user_id),
      ).size,
      refunds: {
        aantal: refunds.length,
        bedrag: refunds.reduce((s, x) => s + x.bedrag_cent, 0) / 100,
      },
      credits: {
        verbruikt: somType(["usage"]),
        gekocht: somType(["purchase"]),
        gratis: somType(["signup_bonus", "bonus", "admin_grant", "grant"]),
        terug: somType(["refund"]),
        openstaand: ((saldo.data ?? []) as any[]).reduce((s, x) => s + (x.balance ?? 0), 0),
      },
      perFeature: [...perFeature.entries()]
        .map(([sleutel, v]) => ({ sleutel, ...v }))
        .sort((x, y) => y.kost - x.kost),
      transacties: a.filter((x) => inPeriode(x.created_at)).slice(0, 50),
    };
  });

/** Status van externe koppelingen — nooit "gekoppeld" tonen als het niet zo is. */
export const adminIntegraties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "system.view");
    const env = (k: string) => !!process.env[k];
    const [{ data: laatsteAi }, { data: laatstePush }, { data: laatsteMail }] = await Promise.all([
      db
        .from("ai_usage")
        .select("created_at, ok")
        .order("created_at", { ascending: false })
        .limit(1),
      db
        .from("notification_log")
        .select("created_at, status")
        .order("created_at", { ascending: false })
        .limit(1),
      db
        .from("admin_message_recipients")
        .select("created_at, status")
        .eq("kanaal", "email")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const { data: aiFouten } = await db
      .from("ai_usage")
      .select("id", { count: "exact", head: false })
      .eq("ok", false)
      .gte("created_at", new Date(Date.now() - 86400_000).toISOString())
      .limit(1000);
    return [
      {
        naam: "AI (tekst & foto's)",
        type: "AI",
        gekoppeld: env("LOVABLE_API_KEY"),
        laatste: laatsteAi?.[0]?.created_at ?? null,
        data: "AI-oproepen, tokens, kosten",
        fouten: (aiFouten ?? []).length,
      },
      {
        naam: "E-mail (notify.foodloapp.com)",
        type: "E-mail",
        gekoppeld: env("LOVABLE_API_KEY") || env("RESEND_API_KEY"),
        laatste: laatsteMail?.[0]?.created_at ?? null,
        data: "Persoonlijke e-mails, verzendstatus",
        fouten: 0,
      },
      {
        naam: "Pushmeldingen",
        type: "Meldingen",
        gekoppeld: env("VAPID_PRIVATE_KEY") && env("VAPID_PUBLIC_KEY"),
        laatste: laatstePush?.[0]?.created_at ?? null,
        data: "Meldingen op telefoon",
        fouten: 0,
      },
      {
        naam: "Betalingen (web)",
        type: "Betalingen",
        gekoppeld: false,
        laatste: null,
        data: "Omzet, creditpakketten, refunds",
        fouten: 0,
      },
      {
        naam: "Apple App Store",
        type: "Betalingen",
        gekoppeld: false,
        laatste: null,
        data: "Aankopen, abonnementen, uitbetalingen",
        fouten: 0,
      },
      {
        naam: "Google Play",
        type: "Betalingen",
        gekoppeld: false,
        laatste: null,
        data: "Aankopen, abonnementen, uitbetalingen",
        fouten: 0,
      },
      {
        naam: "Inkomende e-mail (antwoorden)",
        type: "E-mail",
        gekoppeld: false,
        laatste: null,
        data: "Antwoorden van gebruikers",
        fouten: 0,
      },
    ];
  });
