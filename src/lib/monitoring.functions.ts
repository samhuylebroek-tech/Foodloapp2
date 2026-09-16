import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bewaker, logboek } from "@/lib/admin.functions";

// ============================================================
// Monitoring — alles server-side, alleen voor het Control Center.
// Leest de dagaggregaties; enkel "vandaag" wordt live geteld.
// ============================================================

type Ctx = { supabase: any; userId: string; claims?: any };

const BEREIKEN = ["vandaag", "gisteren", "zeven", "dertig", "jaar", "eigen"] as const;

const bereikSchema = z
  .object({
    van: z.string().optional(),
    tot: z.string().optional(),
    bereik: z.enum(BEREIKEN).default("vandaag"),
  })
  .default({ bereik: "vandaag" });

function dagString(d: Date) {
  return d.toISOString().slice(0, 10);
}

function bereikNaarDagen(b: { bereik: (typeof BEREIKEN)[number]; van?: string | undefined; tot?: string | undefined }) {
  const nu = new Date();
  const vandaag = dagString(nu);
  if (b.bereik === "eigen" && b.van && b.tot) return { van: b.van, tot: b.tot };
  if (b.bereik === "gisteren") {
    const g = dagString(new Date(nu.getTime() - 86400_000));
    return { van: g, tot: g };
  }
  if (b.bereik === "zeven") return { van: dagString(new Date(nu.getTime() - 6 * 86400_000)), tot: vandaag };
  if (b.bereik === "dertig") return { van: dagString(new Date(nu.getTime() - 29 * 86400_000)), tot: vandaag };
  if (b.bereik === "jaar") return { van: dagString(new Date(nu.getTime() - 364 * 86400_000)), tot: vandaag };
  return { van: vandaag, tot: vandaag };
}

function euro(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

// ---------------- activiteit ----------------

export const adminActiviteit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => bereikSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const { aggregeerDagen } = await import("@/lib/monitoring.server");
    await aggregeerDagen(db, 2);

    const { van, tot } = bereikNaarDagen(data);
    const { data: rijen } = await db
      .from("daily_platform_stats")
      .select("*")
      .gte("dag", van)
      .lte("dag", tot)
      .order("dag");

    const lijst = (rijen ?? []) as any[];
    const som = (v: string) => lijst.reduce((s, r) => s + Number(r[v] ?? 0), 0);

    // actieve gebruikers over de hele periode = unieke gebruikers
    const { data: uniek } = await db
      .from("daily_user_stats")
      .select("user_id, handelingen")
      .gte("dag", van)
      .lte("dag", tot)
      .gt("handelingen", 0)
      .limit(20_000);
    const actieveGebruikers = new Set((uniek ?? []).map((r: any) => r.user_id)).size;

    const kost = euro(som("kost_eur"));
    return {
      van,
      tot,
      kpi: {
        nieuweGebruikers: som("nieuwe_gebruikers"),
        actieveGebruikers,
        sessies: som("sessies"),
        handelingen: som("handelingen"),
        nieuweRecepten: som("nieuwe_recepten"),
        imports: som("imports"),
        weekmenus: som("weekmenus"),
        lijsten: som("lijsten"),
        aiCalls: som("ai_calls"),
        credits: som("credits"),
        kostEur: kost,
        kostPerActieve: actieveGebruikers ? euro(kost / actieveGebruikers) : 0,
        fouten: som("fouten"),
      },
      grafiek: lijst.map((r) => ({
        dag: r.dag,
        actief: r.actieve_gebruikers,
        recepten: r.nieuwe_recepten,
        ai: r.ai_calls,
        kost: Number(r.kost_eur ?? 0),
      })),
    };
  });

const stroomSchema = z
  .object({
    van: z.string().optional(),
    tot: z.string().optional(),
    bereik: z.enum(["vandaag", "gisteren", "zeven", "dertig", "eigen"]).default("vandaag"),
    event: z.string().default(""),
    userId: z.string().default(""),
    groupId: z.string().default(""),
    soort: z.enum(["alles", "ai", "fouten"]).default("alles"),
    limiet: z.number().int().min(10).max(500).default(100),
  })
  .default({ bereik: "vandaag", event: "", userId: "", groupId: "", soort: "alles", limiet: 100 });

export const adminGebeurtenissen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => stroomSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const { van, tot } = bereikNaarDagen(data);
    const vanIso = `${van}T00:00:00.000Z`;
    const totIso = new Date(new Date(`${tot}T00:00:00.000Z`).getTime() + 86400_000).toISOString();

    let leden: string[] | null = null;
    if (data.groupId) {
      const { data: m } = await db.from("group_members").select("user_id").eq("group_id", data.groupId);
      leden = (m ?? []).map((r: any) => r.user_id);
    }

    const rijen: {
      tijd: string;
      user_id: string | null;
      type: "handeling" | "ai" | "fout";
      titel: string;
      detail: string;
      credits?: number;
      kost?: number;
    }[] = [];

    if (data.soort !== "fouten") {
      let q = db
        .from("usage_events")
        .select("user_id, event, path, created_at")
        .gte("created_at", vanIso)
        .lt("created_at", totIso)
        .order("created_at", { ascending: false })
        .limit(data.limiet);
      if (data.event) q = q.eq("event", data.event);
      if (data.userId) q = q.eq("user_id", data.userId);
      if (leden) q = q.in("user_id", leden.length ? leden : ["00000000-0000-0000-0000-000000000000"]);
      const { data: ev } = await q;
      for (const e of (ev ?? []) as any[]) {
        rijen.push({
          tijd: e.created_at,
          user_id: e.user_id,
          type: "handeling",
          titel: e.event,
          detail: e.path ?? "",
        });
      }
    }

    if (data.soort !== "fouten") {
      let q = db
        .from("ai_usage")
        .select("user_id, feature, model, credits, kost_eur, ok, created_at")
        .gte("created_at", vanIso)
        .lt("created_at", totIso)
        .order("created_at", { ascending: false })
        .limit(data.limiet);
      if (data.userId) q = q.eq("user_id", data.userId);
      if (leden) q = q.in("user_id", leden.length ? leden : ["00000000-0000-0000-0000-000000000000"]);
      const { data: ai } = await q;
      for (const a of (ai ?? []) as any[]) {
        rijen.push({
          tijd: a.created_at,
          user_id: a.user_id,
          type: "ai",
          titel: `AI · ${a.feature}`,
          detail: a.model ?? "",
          credits: a.credits ?? 0,
          kost: Number(a.kost_eur ?? 0),
        });
      }
    }

    if (data.soort !== "ai") {
      let q = db
        .from("app_errors")
        .select("user_id, soort, feature, bericht, path, created_at")
        .gte("created_at", vanIso)
        .lt("created_at", totIso)
        .order("created_at", { ascending: false })
        .limit(data.limiet);
      if (data.userId) q = q.eq("user_id", data.userId);
      if (leden) q = q.in("user_id", leden.length ? leden : ["00000000-0000-0000-0000-000000000000"]);
      const { data: f } = await q;
      for (const e of (f ?? []) as any[]) {
        rijen.push({
          tijd: e.created_at,
          user_id: e.user_id,
          type: "fout",
          titel: `Fout · ${e.feature || e.soort}`,
          detail: e.bericht ?? "",
        });
      }
    }

    rijen.sort((a, b) => (a.tijd < b.tijd ? 1 : -1));
    const beperkt = rijen.slice(0, data.limiet);
    const namen = await naamKaart(db, beperkt.map((r) => r.user_id));
    return beperkt.map((r) => ({ ...r, naam: (r.user_id && namen.get(r.user_id)) || "onbekend" }));
  });

async function naamKaart(db: any, ids: (string | null)[]) {
  const uniek = [...new Set(ids.filter(Boolean))] as string[];
  if (!uniek.length) return new Map<string, string>();
  const { data } = await db.from("profiles").select("id, display_name").in("id", uniek);
  return new Map<string, string>(((data ?? []) as any[]).map((p) => [p.id as string, (p.display_name ?? "") as string]));
}

// ---------------- gebruikers: vergelijkingstabel ----------------

const tabelSchema = z
  .object({
    zoek: z.string().default(""),
    segment: z.string().default(""),
    sorteer: z
      .enum(["kost", "activiteit", "laag", "ai", "login", "stil"])
      .default("kost"),
  })
  .default({ zoek: "", segment: "", sorteer: "kost" });

export const adminGebruikersTabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => tabelSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const { aggregeerDagen, haalDrempels, bepaalSegmenten } = await import("@/lib/monitoring.server");
    await aggregeerDagen(db, 2);
    const drempels = await haalDrempels(db);

    let q = db.from("profiles").select("id, display_name, created_at, blocked_at").limit(2000);
    if (data.zoek.trim()) q = q.ilike("display_name", `%${data.zoek.trim()}%`);
    const { data: profielen } = await q;

    const sinds30 = dagString(new Date(Date.now() - 29 * 86400_000));
    const [{ data: stats }, { data: credits }, { data: aankopen }, { data: recepten }, { data: plan }] =
      await Promise.all([
        db.from("daily_user_stats").select("*").gte("dag", sinds30).limit(50_000),
        db.from("user_credits").select("user_id, balance, gebruikt_totaal, gekocht_totaal, gratis_totaal"),
        db.from("aankopen").select("user_id, bedrag_cent, status").eq("status", "betaald"),
        db.from("recipes").select("user_id").is("deleted_at", null).limit(50_000),
        db.from("meal_plan").select("user_id").limit(50_000),
      ]);

    const perUser = new Map<string, any>();
    for (const s of (stats ?? []) as any[]) {
      const r = perUser.get(s.user_id) ?? {
        handelingen: 0,
        sessies: 0,
        ai: 0,
        credits: 0,
        kost: 0,
        fouten: 0,
        laatste: null as string | null,
      };
      r.handelingen += s.handelingen;
      r.sessies += s.sessies;
      r.ai += s.ai_calls;
      r.credits += s.credits;
      r.kost += Number(s.kost_eur ?? 0);
      r.fouten += s.fouten;
      if (s.handelingen > 0 && (!r.laatste || s.dag > r.laatste)) r.laatste = s.dag;
      perUser.set(s.user_id, r);
    }
    const creditMap = new Map(((credits ?? []) as any[]).map((c) => [c.user_id, c]));
    const omzet = new Map<string, number>();
    for (const a of (aankopen ?? []) as any[]) {
      omzet.set(a.user_id, (omzet.get(a.user_id) ?? 0) + (a.bedrag_cent ?? 0) / 100);
    }
    const tel = (rows: any[], veld = "user_id") => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r[veld], (m.get(r[veld]) ?? 0) + 1);
      return m;
    };
    const receptMap = tel((recepten ?? []) as any[]);
    const planMap = tel((plan ?? []) as any[]);

    const rijen = ((profielen ?? []) as any[]).map((p) => {
      const s = perUser.get(p.id) ?? { handelingen: 0, sessies: 0, ai: 0, credits: 0, kost: 0, fouten: 0, laatste: null };
      const c = creditMap.get(p.id);
      const betaald = (omzet.get(p.id) ?? 0) > 0;
      const segmenten = bepaalSegmenten(
        {
          aangemaakt: p.created_at,
          laatsteActiviteit: s.laatste ? `${s.laatste}T12:00:00Z` : null,
          aiCalls30: s.ai,
          kost30: s.kost,
          betaald,
        },
        drempels,
      );
      return {
        id: p.id,
        naam: p.display_name || "(geen naam)",
        geblokkeerd: Boolean(p.blocked_at),
        lidSinds: p.created_at,
        laatsteActiviteit: s.laatste,
        handelingen: s.handelingen,
        sessies: s.sessies,
        aiCalls: s.ai,
        creditsGebruikt: s.credits,
        creditsSaldo: c?.balance ?? 0,
        kostEur: euro(s.kost),
        omzetEur: omzet.get(p.id) ?? 0,
        fouten: s.fouten,
        recepten: receptMap.get(p.id) ?? 0,
        weekmenus: planMap.get(p.id) ?? 0,
        segmenten,
      };
    });

    const gefilterd = data.segment ? rijen.filter((r) => r.segmenten.includes(data.segment as any)) : rijen;
    const sorters: Record<string, (a: any, b: any) => number> = {
      kost: (a, b) => b.kostEur - a.kostEur,
      activiteit: (a, b) => b.handelingen - a.handelingen,
      laag: (a, b) => a.handelingen - b.handelingen,
      ai: (a, b) => b.aiCalls - a.aiCalls,
      login: (a, b) => String(b.laatsteActiviteit ?? "").localeCompare(String(a.laatsteActiviteit ?? "")),
      stil: (a, b) =>
        String(a.laatsteActiviteit ?? "0000").localeCompare(String(b.laatsteActiviteit ?? "0000")) ||
        String(a.lidSinds).localeCompare(String(b.lidSinds)),
    };
    gefilterd.sort(sorters[data.sorteer] ?? sorters["kost"]!);
    return { rijen: gefilterd.slice(0, 300), totaal: gefilterd.length, drempels };
  });

// ---------------- wie heeft aandacht nodig ----------------

export const adminAandacht = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const { haalDrempels } = await import("@/lib/monitoring.server");
    const d = await haalDrempels(db);
    const sinds30 = dagString(new Date(Date.now() - 29 * 86400_000));
    const sinds7 = dagString(new Date(Date.now() - 6 * 86400_000));

    const [{ data: profielen }, { data: stats }, { data: credits }, { data: tickets }] = await Promise.all([
      db.from("profiles").select("id, display_name, created_at").limit(2000),
      db.from("daily_user_stats").select("*").gte("dag", sinds30).limit(50_000),
      db.from("user_credits").select("user_id, balance"),
      db.from("feedback").select("user_id, status").neq("status", "gesloten"),
    ]);

    const per = new Map<string, { ai: number; kost: number; fouten7: number; handelingen: number; laatste: string | null }>();
    for (const s of (stats ?? []) as any[]) {
      const r = per.get(s.user_id) ?? { ai: 0, kost: 0, fouten7: 0, handelingen: 0, laatste: null };
      r.ai += s.ai_calls;
      r.kost += Number(s.kost_eur ?? 0);
      r.handelingen += s.handelingen;
      if (s.dag >= sinds7) r.fouten7 += s.fouten;
      if (s.handelingen > 0 && (!r.laatste || s.dag > r.laatste)) r.laatste = s.dag;
      per.set(s.user_id, r);
    }
    const saldo = new Map(((credits ?? []) as any[]).map((c) => [c.user_id, c.balance as number]));
    const open = new Set(((tickets ?? []) as any[]).map((t) => t.user_id));

    const items: { id: string; naam: string; reden: string; ernst: "hoog" | "midden" | "laag" }[] = [];
    const nu = Date.now();
    for (const p of ((profielen ?? []) as any[])) {
      const s = per.get(p.id) ?? { ai: 0, kost: 0, fouten7: 0, handelingen: 0, laatste: null };
      const naam = p.display_name || "(geen naam)";
      const stilDagen = s.laatste ? Math.floor((nu - new Date(`${s.laatste}T12:00:00Z`).getTime()) / 86400_000) : null;
      const leeftijd = Math.floor((nu - new Date(p.created_at).getTime()) / 86400_000);

      if (s.handelingen === 0 && leeftijd <= d.nieuwDagen)
        items.push({ id: p.id, naam, reden: "Nieuw account, nog niets gedaan", ernst: "hoog" });
      else if (stilDagen === null || stilDagen >= d.actiefDagen)
        items.push({
          id: p.id,
          naam,
          reden: stilDagen === null ? "Nog nooit actief geweest" : `${stilDagen} dagen niet actief`,
          ernst: "midden",
        });
      if (s.fouten7 >= d.veelFouten)
        items.push({ id: p.id, naam, reden: `${s.fouten7} fouten deze week`, ernst: "hoog" });
      if (s.ai >= d.hoogAi) items.push({ id: p.id, naam, reden: `Veel AI-gebruik (${s.ai} oproepen)`, ernst: "midden" });
      if (s.kost >= d.hogeKost)
        items.push({ id: p.id, naam, reden: `Hoge kost (€ ${euro(s.kost).toFixed(3)})`, ernst: "midden" });
      if ((saldo.get(p.id) ?? 0) >= 100 && s.handelingen < 5)
        items.push({ id: p.id, naam, reden: "Veel credits, weinig activiteit", ernst: "laag" });
      if (open.has(p.id)) items.push({ id: p.id, naam, reden: "Openstaande supportvraag", ernst: "hoog" });
    }
    const orde = { hoog: 0, midden: 1, laag: 2 } as const;
    items.sort((a, b) => orde[a.ernst] - orde[b.ernst]);
    return items.slice(0, 40);
  });

// ---------------- kosten ----------------

export const adminKosten = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const sinds = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: ai } = await db
      .from("ai_usage")
      .select("user_id, feature, model, provider, credits, kost_eur, cache_hit, ok, created_at")
      .gte("created_at", sinds)
      .limit(50_000);
    const rijen = (ai ?? []) as any[];
    const vandaag = dagString(new Date());
    const gisteren = dagString(new Date(Date.now() - 86400_000));
    const sinds7 = dagString(new Date(Date.now() - 6 * 86400_000));

    const kostIn = (filter: (r: any) => boolean) =>
      euro(rijen.filter(filter).reduce((s, r) => s + Number(r.kost_eur ?? 0), 0));

    const groepeer = (veld: string) => {
      const m = new Map<string, { sleutel: string; aantal: number; credits: number; kost: number }>();
      for (const r of rijen) {
        const k = r[veld] || "(onbekend)";
        const x = m.get(k) ?? { sleutel: k, aantal: 0, credits: 0, kost: 0 };
        x.aantal += 1;
        x.credits += r.credits ?? 0;
        x.kost += Number(r.kost_eur ?? 0);
        m.set(k, x);
      }
      return [...m.values()].map((x) => ({ ...x, kost: euro(x.kost) })).sort((a, b) => b.kost - a.kost);
    };

    const { data: prijzen } = await db.from("model_prices").select("*").order("model");
    const actieve = new Set(rijen.map((r) => r.user_id)).size;
    const totaal30 = kostIn(() => true);
    return {
      vandaag: kostIn((r) => r.created_at.slice(0, 10) === vandaag),
      gisteren: kostIn((r) => r.created_at.slice(0, 10) === gisteren),
      zeven: kostIn((r) => r.created_at.slice(0, 10) >= sinds7),
      dertig: totaal30,
      perActieveGebruiker: actieve ? euro(totaal30 / actieve) : 0,
      perFeature: groepeer("feature"),
      perModel: groepeer("model"),
      perProvider: groepeer("provider"),
      prijzen: (prijzen ?? []) as any[],
    };
  });

export const adminPrijsZetten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        model: z.string().min(1),
        provider: z.string().default("lovable"),
        eur_per_1m_in: z.number().min(0),
        eur_per_1m_out: z.number().min(0),
        eur_per_beeld: z.number().min(0).default(0),
        eur_per_call: z.number().min(0).default(0),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "settings.manage");
    await db.from("model_prices").upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "model" });
    await logboek(db, profiel, "cost.price_set", "model_price", data.model, data as any);
    return { ok: true };
  });

// ---------------- groepen ----------------

export const adminGroepen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const sinds30 = dagString(new Date(Date.now() - 29 * 86400_000));
    const [{ data: groepen }, { data: leden }, { data: stats }, { data: plan }, { data: lijsten }] =
      await Promise.all([
        db.from("groups").select("id, naam, owner_id, created_at").limit(500),
        db.from("group_members").select("group_id, user_id, status").limit(5000),
        db.from("daily_user_stats").select("*").gte("dag", sinds30).limit(50_000),
        db.from("meal_plan").select("group_id").not("group_id", "is", null).limit(20_000),
        db.from("shopping_lists").select("group_id").not("group_id", "is", null).limit(5000),
      ]);

    const per = new Map<string, { ai: number; credits: number; kost: number; handelingen: number; laatste: string | null }>();
    for (const s of ((stats ?? []) as any[])) {
      const r = per.get(s.user_id) ?? { ai: 0, credits: 0, kost: 0, handelingen: 0, laatste: null };
      r.ai += s.ai_calls;
      r.credits += s.credits;
      r.kost += Number(s.kost_eur ?? 0);
      r.handelingen += s.handelingen;
      if (s.handelingen > 0 && (!r.laatste || s.dag > r.laatste)) r.laatste = s.dag;
      per.set(s.user_id, r);
    }
    const planTel = new Map<string, number>();
    for (const p of ((plan ?? []) as any[])) planTel.set(p.group_id, (planTel.get(p.group_id) ?? 0) + 1);
    const lijstTel = new Map<string, number>();
    for (const l of ((lijsten ?? []) as any[])) lijstTel.set(l.group_id, (lijstTel.get(l.group_id) ?? 0) + 1);

    const ledenPer = new Map<string, any[]>();
    for (const m of ((leden ?? []) as any[])) {
      ledenPer.set(m.group_id, [...(ledenPer.get(m.group_id) ?? []), m]);
    }

    const ids = [...new Set(((leden ?? []) as any[]).map((m) => m.user_id))];
    const { data: recepten } = ids.length
      ? await db.from("recipes").select("user_id").in("user_id", ids).is("deleted_at", null).limit(50_000)
      : { data: [] as any[] };
    const receptTel = new Map<string, number>();
    for (const r of ((recepten ?? []) as any[])) receptTel.set(r.user_id, (receptTel.get(r.user_id) ?? 0) + 1);

    return ((groepen ?? []) as any[]).map((g) => {
      const m = ledenPer.get(g.id) ?? [];
      const actief = m.filter((x) => x.status === "actief");
      const cijfers = actief.map((x) => per.get(x.user_id) ?? { ai: 0, credits: 0, kost: 0, handelingen: 0, laatste: null });
      return {
        id: g.id,
        naam: g.naam,
        leden: m.length,
        actieveLeden: cijfers.filter((c) => c.handelingen > 0).length,
        laatsteActiviteit: cijfers.map((c) => c.laatste).filter(Boolean).sort().pop() ?? null,
        recepten: actief.reduce((s, x) => s + (receptTel.get(x.user_id) ?? 0), 0),
        weekmenuItems: planTel.get(g.id) ?? 0,
        lijsten: lijstTel.get(g.id) ?? 0,
        aiCalls: cijfers.reduce((s, c) => s + c.ai, 0),
        credits: cijfers.reduce((s, c) => s + c.credits, 0),
        kostEur: euro(cijfers.reduce((s, c) => s + c.kost, 0)),
      };
    });
  });

// ---------------- gebruiker: monitoringdetail ----------------

export const adminGebruikerMonitoring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.view");
    const { haalDrempels, bepaalSegmenten, telSessies } = await import("@/lib/monitoring.server");
    const drempels = await haalDrempels(db);
    const id = data.id;
    const sinds30Iso = new Date(Date.now() - 30 * 86400_000).toISOString();
    const sinds30 = dagString(new Date(Date.now() - 29 * 86400_000));

    const [
      { data: stats },
      { data: events },
      { data: ai },
      { data: fouten },
      { data: meldingen },
      { data: tickets },
      { data: shares },
      { data: gezin },
      { data: aankopen },
      { data: berichten },
      { data: creditsRij },
    ] = await Promise.all([
      db.from("daily_user_stats").select("*").eq("user_id", id).gte("dag", sinds30).order("dag"),
      db
        .from("usage_events")
        .select("event, path, detail, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("ai_usage")
        .select("feature, model, provider, credits, kost_eur, cache_hit, ok, tokens_in, tokens_out, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("app_errors")
        .select("soort, feature, bericht, detail, path, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("notification_log")
        .select("soort, titel, status, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      db.from("feedback").select("id, kind, message, status, created_at").eq("user_id", id).limit(25),
      db
        .from("shares")
        .select("owner_id, member_id, status, recipes_view, planner_view, shopping_view")
        .or(`owner_id.eq.${id},member_id.eq.${id}`),
      db.from("group_members").select("group_id, status, rol").eq("user_id", id),
      db.from("aankopen").select("bedrag_cent, status, created_at").eq("user_id", id).eq("status", "betaald"),
      db
        .from("admin_message_recipients")
        .select("message_id, kanaal, status, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(25),
      db.from("user_credits").select("*").eq("user_id", id).maybeSingle(),
    ]);

    const s = ((stats ?? []) as any[]).reduce(
      (acc, r) => ({
        handelingen: acc.handelingen + r.handelingen,
        sessies: acc.sessies + r.sessies,
        ai: acc.ai + r.ai_calls,
        credits: acc.credits + r.credits,
        kost: acc.kost + Number(r.kost_eur ?? 0),
        fouten: acc.fouten + r.fouten,
      }),
      { handelingen: 0, sessies: 0, ai: 0, credits: 0, kost: 0, fouten: 0 },
    );

    const tijden = ((events ?? []) as any[]).map((e) => e.created_at as string);
    const nu = Date.now();
    const sessies24 = telSessies(tijden.filter((t) => nu - new Date(t).getTime() < 86400_000));
    const sessies7 = telSessies(tijden.filter((t) => nu - new Date(t).getTime() < 7 * 86400_000));

    // kosten over de volledige levensduur
    const { data: alleAi } = await db.from("ai_usage").select("credits, kost_eur, feature").eq("user_id", id).limit(20_000);
    const lifetimeKost = euro(((alleAi ?? []) as any[]).reduce((t, r) => t + Number(r.kost_eur ?? 0), 0));
    const perFeature = new Map<string, { feature: string; aantal: number; credits: number; kost: number }>();
    for (const r of ((alleAi ?? []) as any[])) {
      const x = perFeature.get(r.feature) ?? { feature: r.feature, aantal: 0, credits: 0, kost: 0 };
      x.aantal += 1;
      x.credits += r.credits ?? 0;
      x.kost += Number(r.kost_eur ?? 0);
      perFeature.set(r.feature, x);
    }

    const omzet = ((aankopen ?? []) as any[]).reduce((t, a) => t + (a.bedrag_cent ?? 0) / 100, 0);
    const { data: p } = await db.from("profiles").select("created_at").eq("id", id).maybeSingle();
    const laatsteDag = ((stats ?? []) as any[]).filter((r) => r.handelingen > 0).map((r) => r.dag).sort().pop() ?? null;

    const tijdlijn = [
      ...((events ?? []) as any[]).map((e) => ({
        tijd: e.created_at as string,
        type: "handeling" as const,
        titel: e.event as string,
        detail: (e.path ?? "") as string,
        credits: 0,
        kost: 0,
      })),
      ...((ai ?? []) as any[]).map((a) => ({
        tijd: a.created_at as string,
        type: "ai" as const,
        titel: `AI · ${a.feature}`,
        detail: `${a.model ?? ""}${a.cache_hit ? " · uit geheugen" : ""}`,
        credits: a.credits ?? 0,
        kost: Number(a.kost_eur ?? 0),
      })),
      ...((fouten ?? []) as any[]).map((f) => ({
        tijd: f.created_at as string,
        type: "fout" as const,
        titel: `Fout · ${f.feature || f.soort}`,
        detail: f.bericht as string,
        credits: 0,
        kost: 0,
      })),
      ...((berichten ?? []) as any[]).map((b) => ({
        tijd: b.created_at as string,
        type: "bericht" as const,
        titel: "Bericht van het Control Center",
        detail: `${b.kanaal} · ${b.status}`,
        credits: 0,
        kost: 0,
      })),
    ].sort((a, b) => (a.tijd < b.tijd ? 1 : -1));

    await logboek(db, profiel, "user.monitoring_view", "user", id);

    return {
      segmenten: bepaalSegmenten(
        {
          aangemaakt: p?.created_at ?? null,
          laatsteActiviteit: laatsteDag ? `${laatsteDag}T12:00:00Z` : null,
          aiCalls30: s.ai,
          kost30: s.kost,
          betaald: omzet > 0,
        },
        drempels,
      ),
      dagen: ((stats ?? []) as any[]).map((r) => ({
        dag: r.dag,
        handelingen: r.handelingen,
        ai: r.ai_calls,
        kost: Number(r.kost_eur ?? 0),
      })),
      dertig: { ...s, kost: euro(s.kost) },
      sessies24,
      sessies7,
      sessies30: s.sessies,
      laatsteActiviteit: ((events ?? []) as any[])[0]?.created_at ?? null,
      lifetimeKost,
      omzetEur: omzet,
      credits: creditsRij,
      aiPerFeature: [...perFeature.values()].map((x) => ({ ...x, kost: euro(x.kost) })).sort((a, b) => b.kost - a.kost),
      tijdlijn: tijdlijn.slice(0, 150),
      fouten: (fouten ?? []) as any[],
      meldingen: (meldingen ?? []) as any[],
      tickets: (tickets ?? []) as any[],
      connecties: ((shares ?? []) as any[]).filter((x) => x.status === "accepted").length,
      openUitnodigingen: ((shares ?? []) as any[]).filter((x) => x.status === "pending").length,
      gezinnen: (gezin ?? []) as any[],
      sinds30Iso,
    };
  });

// ---------------- communicatie ----------------

const berichtSchema = z.object({
  doelgroep: z.enum(["gebruiker", "groep", "segment", "iedereen"]),
  doelId: z.string().default(""),
  segment: z.string().default(""),
  onderwerp: z.string().min(2).max(150),
  bericht: z.string().min(2).max(4000),
  kanaal: z.enum(["in_app", "email"]).default("in_app"),
  test: z.boolean().default(false),
});

export const adminOntvangersTellen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        doelgroep: z.enum(["gebruiker", "groep", "segment", "iedereen"]),
        doelId: z.string().default(""),
        segment: z.string().default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const ids = await ontvangerIds(db, data);
    const namen = await naamKaart(db, ids);
    return { aantal: ids.length, voorbeeld: ids.slice(0, 8).map((i) => namen.get(i) ?? i) };
  });

async function ontvangerIds(
  db: any,
  data: { doelgroep: string; doelId: string; segment: string },
): Promise<string[]> {
  if (data.doelgroep === "gebruiker") return data.doelId ? [data.doelId] : [];
  if (data.doelgroep === "groep") {
    const { data: m } = await db.from("group_members").select("user_id").eq("group_id", data.doelId).eq("status", "actief");
    return ((m ?? []) as any[]).map((x) => x.user_id);
  }
  const { data: profielen } = await db.from("profiles").select("id, created_at").is("blocked_at", null).limit(5000);
  const alle = ((profielen ?? []) as any[]).map((p) => p.id as string);
  if (data.doelgroep === "iedereen" || !data.segment) return alle;

  const { haalDrempels, bepaalSegmenten } = await import("@/lib/monitoring.server");
  const drempels = await haalDrempels(db);
  const sinds30 = dagString(new Date(Date.now() - 29 * 86400_000));
  const { data: stats } = await db.from("daily_user_stats").select("*").gte("dag", sinds30).limit(50_000);
  const per = new Map<string, { ai: number; kost: number; laatste: string | null }>();
  for (const s of ((stats ?? []) as any[])) {
    const r = per.get(s.user_id) ?? { ai: 0, kost: 0, laatste: null };
    r.ai += s.ai_calls;
    r.kost += Number(s.kost_eur ?? 0);
    if (s.handelingen > 0 && (!r.laatste || s.dag > r.laatste)) r.laatste = s.dag;
    per.set(s.user_id, r);
  }
  return ((profielen ?? []) as any[])
    .filter((p) => {
      const s = per.get(p.id) ?? { ai: 0, kost: 0, laatste: null };
      return bepaalSegmenten(
        {
          aangemaakt: p.created_at,
          laatsteActiviteit: s.laatste ? `${s.laatste}T12:00:00Z` : null,
          aiCalls30: s.ai,
          kost30: s.kost,
          betaald: false,
        },
        drempels,
      ).includes(data.segment as any);
    })
    .map((p) => p.id as string);
}

export const adminBerichtVersturen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => berichtSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.manage");
    const { bezorg } = await import("@/lib/mail.server");
    const ids = await ontvangerIds(db, data);
    if (!ids.length) throw new Error("Geen ontvangers gevonden.");

    const { data: bericht } = await db
      .from("admin_messages")
      .insert({
        actor_id: profiel.user_id,
        doelgroep: data.doelgroep,
        doel_id: data.doelId || null,
        segment: data.segment || null,
        onderwerp: data.onderwerp,
        bericht: data.bericht,
        kanaal: data.kanaal,
        ontvangers: ids.length,
        status: "bezig",
      })
      .select()
      .single();
    if (!bericht) throw new Error("Bericht kon niet worden aangemaakt.");

    let ok = 0;
    let mis = 0;
    for (const id of ids.slice(0, 500)) {
      const { data: auth } = await db.auth.admin.getUserById(id);
      const r = await bezorg(
        db,
        { userId: id, email: auth?.user?.email ?? null, naam: "" },
        data.onderwerp,
        data.bericht,
        data.kanaal,
      );
      if (r.ok) ok += 1;
      else mis += 1;
      await db.from("admin_message_recipients").insert({
        message_id: bericht.id,
        user_id: id,
        kanaal: r.kanaal,
        status: r.ok ? "verzonden" : "mislukt",
        fout: r.fout ?? null,
      });
    }

    await db
      .from("admin_messages")
      .update({ verzonden: ok, mislukt: mis, status: mis ? "deels" : "klaar" })
      .eq("id", bericht.id);
    await logboek(db, profiel, "message.send", "admin_message", bericht.id, {
      doelgroep: data.doelgroep,
      ontvangers: ids.length,
      verzonden: ok,
    });
    return { verzonden: ok, mislukt: mis, ontvangers: ids.length };
  });

export const adminBerichten = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const { huidigeAanbieder } = await import("@/lib/mail.server");
    const { data } = await db
      .from("admin_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return { rijen: (data ?? []) as any[], mailAanbieder: huidigeAanbieder().naam };
  });

// ---------------- export ----------------

function csv(rijen: Record<string, unknown>[]): string {
  if (!rijen.length) return "";
  const kolommen = Object.keys(rijen[0]!);
  const veld = (v: unknown) => {
    const t = v == null ? "" : Array.isArray(v) ? v.join(" ") : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [kolommen.join(";"), ...rijen.map((r) => kolommen.map((k) => veld(r[k])).join(";"))].join("\n");
}

export const adminExportCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ soort: z.enum(["gebruikers", "activiteit", "ai", "credits", "kosten", "groepen"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.view");
    const sinds30 = dagString(new Date(Date.now() - 29 * 86400_000));
    let rijen: Record<string, unknown>[] = [];

    if (data.soort === "gebruikers") {
      const { data: p } = await db.from("profiles").select("id, display_name, created_at, blocked_at").limit(5000);
      rijen = ((p ?? []) as any[]).map((r) => ({
        id: r.id,
        naam: r.display_name,
        lid_sinds: r.created_at,
        geblokkeerd: r.blocked_at ? "ja" : "nee",
      }));
    } else if (data.soort === "activiteit") {
      const { data: s } = await db.from("daily_user_stats").select("*").gte("dag", sinds30).limit(50_000);
      rijen = (s ?? []) as any[];
    } else if (data.soort === "ai") {
      const { data: a } = await db
        .from("ai_usage")
        .select("created_at, user_id, feature, model, provider, tokens_in, tokens_out, credits, kost_eur, ok, cache_hit")
        .gte("created_at", `${sinds30}T00:00:00Z`)
        .limit(50_000);
      rijen = (a ?? []) as any[];
    } else if (data.soort === "credits") {
      const { data: c } = await db.from("user_credits").select("*").limit(5000);
      rijen = (c ?? []) as any[];
    } else if (data.soort === "kosten") {
      const { data: d2 } = await db.from("daily_platform_stats").select("*").order("dag").limit(2000);
      rijen = (d2 ?? []) as any[];
    } else {
      const { data: g } = await db.from("groups").select("id, naam, owner_id, created_at").limit(2000);
      rijen = (g ?? []) as any[];
    }

    await logboek(db, profiel, "export.csv", "monitoring", data.soort, { rijen: rijen.length });
    return { bestand: `${data.soort}-${dagString(new Date())}.csv`, inhoud: csv(rijen) };
  });

// ---------------- onderhoud ----------------

export const adminAggregeerNu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dagen: z.number().int().min(1).max(90).default(30) }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "settings.manage");
    const { aggregeerDagen } = await import("@/lib/monitoring.server");
    const uit = await aggregeerDagen(db, data.dagen);
    await logboek(db, profiel, "monitoring.aggregate", "monitoring", null, uit);
    return uit;
  });
