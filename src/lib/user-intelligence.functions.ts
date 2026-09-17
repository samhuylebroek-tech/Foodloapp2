import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bewaker, logboek } from "@/lib/admin.functions";

/**
 * User Intelligence — server-side onderzoek naar gebruik van Foodlo.
 *
 * Bouwt volledig op de bestaande tabellen (usage_events, user_sessions,
 * ai_usage, credit_transactions, app_errors, daily_user_stats, groups).
 * Geen tweede meetsysteem, geen verzonnen cijfers: ontbrekende gegevens
 * komen terug als null en tonen in de UI "niet beschikbaar".
 */

type Ctx = { supabase: any; userId: string; claims?: any };

const SESSIE_TIMEOUT_MIN = 30;

export const BEREIKEN = ["vandaag", "gisteren", "zeven", "dertig", "negentig", "eigen"] as const;
export type Bereik = (typeof BEREIKEN)[number];

export const filterSchema = z.object({
  bereik: z.enum(BEREIKEN).default("dertig"),
  van: z.string().optional(),
  tot: z.string().optional(),
  zoek: z.string().default(""),
  userIds: z.array(z.string().uuid()).default([]),
  groupId: z.string().uuid().optional(),
  status: z.enum(["alles", "nieuw", "actief", "terugkerend", "weinig", "inactief", "nooit"]).default("alles"),
  device: z.string().default(""),
  platform: z.string().default(""),
  browser: z.string().default(""),
  appVersion: z.string().default(""),
  feature: z.string().default(""),
  event: z.string().default(""),
  sessionId: z.string().uuid().optional(),
  entityId: z.string().default(""),
  provider: z.string().default(""),
  model: z.string().default(""),
  minCredits: z.number().default(0),
  minKost: z.number().default(0),
  resultaat: z.enum(["alles", "gelukt", "mislukt"]).default("alles"),
  sorteer: z.string().default(""),
  richting: z.enum(["op", "af"]).default("af"),
  pagina: z.number().int().min(1).default(1),
  perPagina: z.number().int().min(10).max(200).default(50),
});

export type Filters = z.infer<typeof filterSchema>;

function grenzen(f: Pick<Filters, "bereik" | "van" | "tot">) {
  const nu = new Date();
  const eindeVandaag = new Date(nu.getTime() + 60_000);
  const dagen = (n: number) => new Date(nu.getTime() - n * 86400_000);
  if (f.bereik === "eigen" && f.van && f.tot) {
    return { van: new Date(`${f.van}T00:00:00Z`), tot: new Date(`${f.tot}T23:59:59Z`) };
  }
  if (f.bereik === "vandaag") {
    const d = new Date(nu);
    d.setUTCHours(0, 0, 0, 0);
    return { van: d, tot: eindeVandaag };
  }
  if (f.bereik === "gisteren") {
    const s = new Date(nu);
    s.setUTCHours(0, 0, 0, 0);
    return { van: new Date(s.getTime() - 86400_000), tot: s };
  }
  if (f.bereik === "zeven") return { van: dagen(7), tot: eindeVandaag };
  if (f.bereik === "negentig") return { van: dagen(90), tot: eindeVandaag };
  return { van: dagen(30), tot: eindeVandaag };
}

function bereikIso(f: Filters) {
  const g = grenzen(f);
  return { vanIso: g.van.toISOString(), totIso: g.tot.toISOString(), van: g.van, tot: g.tot };
}

/** Sluit sessies die langer dan de time-out stil zijn; markeer het einde als geschat. */
async function sluitStilleSessies(db: any) {
  const grens = new Date(Date.now() - SESSIE_TIMEOUT_MIN * 60_000).toISOString();
  await db
    .from("user_sessions")
    .update({ ended_at: new Date().toISOString(), einde_geschat: true })
    .is("ended_at", null)
    .lt("last_seen_at", grens);
}

function tijdFilter(q: any, kolom: string, vanIso: string, totIso: string) {
  return q.gte(kolom, vanIso).lte(kolom, totIso);
}

function pasGebeurtenisFilters(q: any, f: Filters) {
  if (f.userIds.length) q = q.in("user_id", f.userIds);
  if (f.event) q = q.eq("event", f.event);
  if (f.feature) q = q.eq("feature", f.feature);
  if (f.sessionId) q = q.eq("session_id", f.sessionId);
  if (f.device) q = q.eq("device", f.device);
  if (f.platform) q = q.eq("platform", f.platform);
  if (f.browser) q = q.eq("browser", f.browser);
  if (f.appVersion) q = q.eq("app_version", f.appVersion);
  if (f.entityId) q = q.eq("entity_id", f.entityId);
  if (f.resultaat === "gelukt") q = q.eq("ok", true);
  if (f.resultaat === "mislukt") q = q.eq("ok", false);
  return q;
}

async function profielMap(db: any, ids: string[]) {
  const uniek = [...new Set(ids.filter(Boolean))];
  if (!uniek.length) return new Map<string, { naam: string }>();
  const { data } = await db.from("profiles").select("id, display_name").in("id", uniek);
  return new Map<string, { naam: string }>(((data ?? []) as any[]).map((r) => [r.id, { naam: r.display_name }]));
}

function csv(rijen: Record<string, unknown>[]) {
  if (!rijen.length) return "";
  const kolommen = Object.keys(rijen[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [kolommen.join(","), ...rijen.map((r) => kolommen.map((k) => esc(r[k])).join(","))].join("\n");
}

// ============================================================
// Overzicht
// ============================================================

/** PostgREST geeft maximaal 1000 rijen per verzoek; dit haalt alles in stukken op. */
async function pagineer<T = any>(bouw: (a: number, b: number) => any, max = 200_000): Promise<{ data: T[] }> {
  const stap = 1000;
  const uit: T[] = [];
  for (let a = 0; a < max; a += stap) {
    const { data } = await bouw(a, Math.min(a + stap, max) - 1);
    const r = (data ?? []) as T[];
    uit.push(...r);
    if (r.length < stap) break;
  }
  return { data: uit };
}

export const uiOverzicht = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filterSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    await sluitStilleSessies(db);
    const { vanIso, totIso, van } = bereikIso(data);
    const duur = new Date(totIso).getTime() - van.getTime();
    const vorigVan = new Date(van.getTime() - duur).toISOString();

    const tel = async (tabel: string, kolom: string, extra?: (q: any) => any) => {
      let q = (db as any).from(tabel).select("*", { count: "exact", head: true });
      q = tijdFilter(q, kolom, vanIso, totIso);
      if (extra) q = extra(q);
      const { count } = await q;
      return count ?? 0;
    };

    const [
      { count: totaalUsers },
      nieuweUsers,
      vorigeNieuwe,
      { data: events },
      { data: sessies },
      { data: ai },
      { data: fouten },
      nooit,
    ] = await Promise.all([
      db.from("profiles").select("*", { count: "exact", head: true }),
      tel("profiles", "created_at"),
      (async () => {
        const { count } = await db
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", vorigVan)
          .lt("created_at", vanIso);
        return count ?? 0;
      })(),
      await pagineer((a, b) => db
        .from("usage_events")
        .select("user_id, event, feature, created_at, session_id")
        .gte("created_at", vanIso)
        .lte("created_at", totIso)
        .range(a, b), 200000),
      await pagineer((a, b) => db
        .from("user_sessions")
        .select("id, user_id, started_at, ended_at, einde_geschat, last_seen_at")
        .gte("started_at", vanIso)
        .lte("started_at", totIso)
        .range(a, b), 100000),
      await pagineer((a, b) => db
        .from("ai_usage")
        .select("user_id, credits, kost_eur, ok, created_at")
        .gte("created_at", vanIso)
        .lte("created_at", totIso)
        .range(a, b), 100000),
      await pagineer((a, b) => db
        .from("app_errors")
        .select("user_id, created_at")
        .gte("created_at", vanIso)
        .lte("created_at", totIso)
        .range(a, b), 50000),
      (async (): Promise<number> => {
        const { data: metEvent } = await await pagineer((a, b) => db.from("usage_events").select("user_id").range(a, b), 200000);
        const actieveOoit = new Set(((metEvent ?? []) as any[]).map((r) => r.user_id));
        const { data: alle } = await await pagineer((a, b) => db.from("profiles").select("id").range(a, b), 100000);
        return ((alle ?? []) as any[]).filter((p) => !actieveOoit.has(p.id)).length;
      })(),
    ]);

    const ev = (events ?? []) as any[];
    const ss = (sessies ?? []) as any[];
    const aiR = (ai ?? []) as any[];
    const fr = (fouten ?? []) as any[];

    const actieveUsers = new Set(ev.map((e) => e.user_id)).size;
    const startVandaag = new Date();
    startVandaag.setUTCHours(0, 0, 0, 0);
    const weekGrens = new Date(Date.now() - 7 * 86400_000);

    const loginsVandaag = new Set(
      ss.filter((s) => new Date(s.started_at) >= startVandaag).map((s) => s.user_id),
    ).size;
    const loginsWeek = new Set(ss.filter((s) => new Date(s.started_at) >= weekGrens).map((s) => s.user_id)).size;
    const nuActief = new Set(
      ss.filter((s) => !s.ended_at && Date.now() - new Date(s.last_seen_at).getTime() < 15 * 60_000).map((s) => s.user_id),
    ).size;

    const duurLijst = ss
      .filter((s) => s.ended_at)
      .map((s) => new Date(s.ended_at).getTime() - new Date(s.started_at).getTime())
      .filter((n) => n > 0);
    const gemDuur = duurLijst.length ? Math.round(duurLijst.reduce((a, b) => a + b, 0) / duurLijst.length / 1000) : null;

    const telEv = (naam: string) => ev.filter((e) => e.event === naam).length;

    // terugkerend = actief in deze periode én al eerder actief
    const { data: eerder } = await await pagineer((a, b) => db
      .from("usage_events")
      .select("user_id")
      .lt("created_at", vanIso)
      .range(a, b), 200000);
    const eerderSet = new Set(((eerder ?? []) as any[]).map((r) => r.user_id));
    const actieveSet = new Set(ev.map((e) => e.user_id));
    const terugkerend = [...actieveSet].filter((u) => eerderSet.has(u)).length;

    const kpi = (sleutel: string, label: string, waarde: number | null, doel: string, extra?: string) => ({
      sleutel,
      label,
      waarde,
      doel,
      extra: extra ?? null,
    });

    return {
      periode: { van: vanIso, tot: totIso },
      kpis: [
        kpi("totaal", "Gebruikers totaal", totaalUsers ?? 0, "gebruikers"),
        kpi("nieuw", "Nieuwe gebruikers", nieuweUsers, "gebruikers:nieuw", `vorige periode: ${vorigeNieuwe}`),
        kpi("actief", "Actieve gebruikers", actieveUsers, "gebruikers:actief"),
        kpi("terugkerend", "Terugkerend", terugkerend, "gebruikers:terugkerend"),
        kpi("inactief", "Inactief", Math.max(0, (totaalUsers ?? 0) - actieveUsers), "gebruikers:inactief"),
        kpi("nooit", "Nooit actief geweest", nooit, "gebruikers:nooit"),
        kpi("nu", "Nu actief", nuActief, "sessies:open"),
        kpi("login_vandaag", "Ingelogd vandaag", loginsVandaag, "sessies:vandaag"),
        kpi("login_week", "Ingelogd deze week", loginsWeek, "sessies:week"),
        kpi("sessies", "Sessies", ss.length, "sessies"),
        kpi(
          "duur",
          "Gem. sessieduur",
          gemDuur,
          "sessies",
          gemDuur === null ? "nog geen afgesloten sessies" : `${Math.round(gemDuur / 60)} min gemiddeld`,
        ),
        kpi("events", "Gebeurtenissen", ev.length, "gebeurtenissen"),
        kpi("recept_nieuw", "Recepten aangemaakt", telEv("recept.aangemaakt"), "gebeurtenissen:recept.aangemaakt"),
        kpi("recept_import", "Recepten geïmporteerd", telEv("recept.geimporteerd"), "gebeurtenissen:recept.geimporteerd"),
        kpi("recept_bekeken", "Recepten bekeken", telEv("recept.bekeken"), "gebeurtenissen:recept.bekeken"),
        kpi("gekookt", "Kookstand gestart", telEv("kookmodus.gestart"), "gebeurtenissen:kookmodus.gestart"),
        kpi("lijsten", "Boodschappenlijsten", telEv("boodschappen.lijst_aangemaakt"), "gebeurtenissen:boodschappen.lijst_aangemaakt"),
        kpi("weekmenu", "Weekmenu aangepast", telEv("weekmenu.aangepast"), "gebeurtenissen:weekmenu.aangepast"),
        kpi("ai", "AI-acties", aiR.length, "ai"),
        kpi("credits", "Credits gebruikt", aiR.reduce((t, r) => t + (r.credits ?? 0), 0), "ai"),
        kpi(
          "kost",
          "Geschatte AI-kost",
          Math.round(aiR.reduce((t, r) => t + Number(r.kost_eur ?? 0), 0) * 10000) / 10000,
          "ai",
          "schatting op basis van modelprijzen",
        ),
        kpi("fouten", "Fouten", fr.length, "fouten"),
      ],
      dagen: dagReeks(ev, ss, aiR, fr, van, new Date(totIso)),
      uren: uurReeks(ev),
    };
  });

function dagKey(iso: string) {
  return iso.slice(0, 10);
}

function dagReeks(ev: any[], ss: any[], ai: any[], fouten: any[], van: Date, tot: Date) {
  const uit: Record<string, any> = {};
  for (let d = new Date(van); d <= tot; d = new Date(d.getTime() + 86400_000)) {
    uit[d.toISOString().slice(0, 10)] = {
      dag: d.toISOString().slice(0, 10),
      gebruikers: new Set<string>(),
      events: 0,
      sessies: 0,
      ai: 0,
      credits: 0,
      kost: 0,
      fouten: 0,
    };
  }
  for (const e of ev) {
    const r = uit[dagKey(e.created_at)];
    if (!r) continue;
    r.events += 1;
    r.gebruikers.add(e.user_id);
  }
  for (const s of ss) {
    const r = uit[dagKey(s.started_at)];
    if (r) r.sessies += 1;
  }
  for (const a of ai) {
    const r = uit[dagKey(a.created_at)];
    if (!r) continue;
    r.ai += 1;
    r.credits += a.credits ?? 0;
    r.kost += Number(a.kost_eur ?? 0);
  }
  for (const f of fouten) {
    const r = uit[dagKey(f.created_at)];
    if (r) r.fouten += 1;
  }
  return Object.values(uit).map((r: any) => ({
    ...r,
    gebruikers: r.gebruikers.size,
    kost: Math.round(r.kost * 10000) / 10000,
  }));
}

function uurReeks(ev: any[]) {
  const uit = Array.from({ length: 24 }, (_, u) => ({ uur: u, events: 0, gebruikers: new Set<string>() }));
  for (const e of ev) {
    const u = new Date(e.created_at).getHours();
    const r = uit[u];
    if (!r) continue;
    r.events += 1;
    r.gebruikers.add(e.user_id);
  }
  return uit.map((r) => ({ uur: r.uur, events: r.events, gebruikers: r.gebruikers.size }));
}

// ============================================================
// Gebruikerslijst
// ============================================================

export const uiGebruikers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filterSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    await sluitStilleSessies(db);
    const { vanIso, totIso } = bereikIso(data);

    const [{ data: profielen }, { data: events }, { data: sessies }, { data: ai }, { data: fouten }, { data: leden }] =
      await Promise.all([
        await pagineer((a, b) => db.from("profiles").select("id, display_name, handle, created_at, blocked_at, taal").range(a, b), 100000),
        await pagineer((a, b) => db.from("usage_events").select("user_id, event, feature, created_at").range(a, b), 300000),
        await pagineer((a, b) => db
          .from("user_sessions")
          .select("user_id, started_at, ended_at, device, platform, browser, app_version")
          .range(a, b), 200000),
        await pagineer((a, b) => db.from("ai_usage").select("user_id, credits, kost_eur, created_at").range(a, b), 200000),
        await pagineer((a, b) => db.from("app_errors").select("user_id, created_at").range(a, b), 100000),
        await pagineer((a, b) => db.from("group_members").select("user_id, group_id, status").range(a, b), 50000),
      ]);

    const ev = (events ?? []) as any[];
    const ss = (sessies ?? []) as any[];
    const inPeriode = (iso: string) => iso >= vanIso && iso <= totIso;

    const perUser = new Map<string, any>();
    const zorg = (id: string) =>
      perUser.get(id) ??
      perUser
        .set(id, {
          events: 0,
          eventsPeriode: 0,
          dagen: new Set<string>(),
          sessies: 0,
          laatsteActiviteit: null as string | null,
          laatsteLogin: null as string | null,
          recepten: 0,
          ai: 0,
          credits: 0,
          kost: 0,
          fouten: 0,
          device: null as string | null,
          appVersion: null as string | null,
        })
        .get(id);

    for (const e of ev) {
      const r = zorg(e.user_id);
      r.events += 1;
      if (inPeriode(e.created_at)) {
        r.eventsPeriode += 1;
        r.dagen.add(e.created_at.slice(0, 10));
      }
      if (!r.laatsteActiviteit || e.created_at > r.laatsteActiviteit) r.laatsteActiviteit = e.created_at;
      if (e.event?.startsWith("recept.")) r.recepten += 1;
    }
    for (const s of ss) {
      const r = zorg(s.user_id);
      if (inPeriode(s.started_at)) r.sessies += 1;
      if (!r.laatsteLogin || s.started_at > r.laatsteLogin) {
        r.laatsteLogin = s.started_at;
        r.device = s.device || null;
        r.appVersion = s.app_version || null;
      }
    }
    for (const a of (ai ?? []) as any[]) {
      const r = zorg(a.user_id);
      if (!inPeriode(a.created_at)) continue;
      r.ai += 1;
      r.credits += a.credits ?? 0;
      r.kost += Number(a.kost_eur ?? 0);
    }
    for (const f of (fouten ?? []) as any[]) {
      const r = zorg(f.user_id);
      if (inPeriode(f.created_at)) r.fouten += 1;
    }

    const groepVan = new Map<string, string>();
    for (const l of (leden ?? []) as any[]) if (l.status === "actief") groepVan.set(l.user_id, l.group_id);

    const nu = Date.now();
    const dagenGeleden = (iso: string | null) =>
      iso ? Math.floor((nu - new Date(iso).getTime()) / 86400_000) : null;

    let rijen = ((profielen ?? []) as any[]).map((p) => {
      const r = perUser.get(p.id) ?? {
        events: 0,
        eventsPeriode: 0,
        dagen: new Set(),
        sessies: 0,
        laatsteActiviteit: null,
        laatsteLogin: null,
        recepten: 0,
        ai: 0,
        credits: 0,
        kost: 0,
        fouten: 0,
        device: null,
        appVersion: null,
      };
      const stil = dagenGeleden(r.laatsteActiviteit);
      const leeftijd = dagenGeleden(p.created_at) ?? 0;
      const status =
        r.events === 0
          ? "nooit"
          : leeftijd <= 7
            ? "nieuw"
            : stil !== null && stil <= 7
              ? "actief"
              : stil !== null && stil <= 30
                ? "weinig"
                : "inactief";
      return {
        id: p.id,
        naam: p.display_name,
        handle: p.handle,
        aangemaakt: p.created_at,
        geblokkeerd: !!p.blocked_at,
        status,
        laatsteLogin: r.laatsteLogin,
        laatsteActiviteit: r.laatsteActiviteit,
        sessies: r.sessies,
        actieveDagen: r.dagen.size,
        events: r.eventsPeriode,
        recepten: r.recepten,
        ai: r.ai,
        credits: r.credits,
        kost: Math.round(r.kost * 10000) / 10000,
        fouten: r.fouten,
        groupId: groepVan.get(p.id) ?? null,
        device: r.device,
        appVersion: r.appVersion,
      };
    });

    const f = data;
    if (f.zoek) {
      const t = f.zoek.toLowerCase();
      rijen = rijen.filter(
        (r) => r.naam?.toLowerCase().includes(t) || r.handle?.toLowerCase().includes(t) || r.id.includes(t),
      );
    }
    if (f.userIds.length) rijen = rijen.filter((r) => f.userIds.includes(r.id));
    if (f.groupId) rijen = rijen.filter((r) => r.groupId === f.groupId);
    if (f.status !== "alles") {
      rijen =
        f.status === "terugkerend"
          ? rijen.filter((r) => r.sessies > 1)
          : rijen.filter((r) => r.status === f.status);
    }
    if (f.device) rijen = rijen.filter((r) => r.device === f.device);
    if (f.appVersion) rijen = rijen.filter((r) => r.appVersion === f.appVersion);
    if (f.minCredits) rijen = rijen.filter((r) => r.credits >= f.minCredits);
    if (f.minKost) rijen = rijen.filter((r) => r.kost >= f.minKost);

    const sleutel = (f.sorteer || "laatsteActiviteit") as keyof (typeof rijen)[number];
    rijen.sort((a: any, b: any) => {
      const x = a[sleutel] ?? 0;
      const y = b[sleutel] ?? 0;
      const c = x > y ? 1 : x < y ? -1 : 0;
      return f.richting === "op" ? c : -c;
    });

    const totaal = rijen.length;
    const start = (f.pagina - 1) * f.perPagina;
    return { rijen: rijen.slice(start, start + f.perPagina), totaal, pagina: f.pagina, perPagina: f.perPagina };
  });

// ============================================================
// Gebeurtenissen
// ============================================================

export const uiGebeurtenissen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filterSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const { vanIso, totIso } = bereikIso(data);
    const start = (data.pagina - 1) * data.perPagina;

    let q = db
      .from("usage_events")
      .select(
        "id, user_id, event, feature, path, detail, entity_type, entity_id, entity_label, ok, duration_ms, device, platform, browser, app_version, session_id, created_at",
        { count: "exact" },
      );
    q = tijdFilter(q, "created_at", vanIso, totIso);
    q = pasGebeurtenisFilters(q, data);
    if (data.zoek) q = q.or(`event.ilike.%${data.zoek}%,entity_label.ilike.%${data.zoek}%,path.ilike.%${data.zoek}%`);
    const { data: rijen, count } = await q
      .order("created_at", { ascending: data.richting === "op" })
      .range(start, start + data.perPagina - 1);

    const namen = await profielMap(db, ((rijen ?? []) as any[]).map((r) => r.user_id));
    return {
      rijen: ((rijen ?? []) as any[]).map((r) => ({ ...r, naam: namen.get(r.user_id)?.naam ?? "Onbekend" })),
      totaal: count ?? 0,
      pagina: data.pagina,
      perPagina: data.perPagina,
    };
  });

export const uiGebeurtenis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const { data: rij } = (await db.from("usage_events").select("*").eq("id", data.id).maybeSingle()) as { data: any };
    if (!rij) return null;
    const namen = await profielMap(db, [rij.user_id]);
    let buren: any[] = [];
    if (rij.session_id) {
      const { data: b } = await db
        .from("usage_events")
        .select("id, event, created_at, entity_label")
        .eq("session_id", rij.session_id)
        .order("created_at")
        .limit(200);
      buren = (b ?? []) as any[];
    }
    return { rij, naam: namen.get(rij.user_id)?.naam ?? "Onbekend", buren };
  });

// ============================================================
// Sessies
// ============================================================

export const uiSessies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filterSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    await sluitStilleSessies(db);
    const { vanIso, totIso } = bereikIso(data);
    const start = (data.pagina - 1) * data.perPagina;

    let q = db.from("user_sessions").select("*", { count: "exact" });
    q = tijdFilter(q, "started_at", vanIso, totIso);
    if (data.userIds.length) q = q.in("user_id", data.userIds);
    if (data.device) q = q.eq("device", data.device);
    if (data.platform) q = q.eq("platform", data.platform);
    if (data.browser) q = q.eq("browser", data.browser);
    if (data.appVersion) q = q.eq("app_version", data.appVersion);
    const { data: rijen, count } = await q
      .order("started_at", { ascending: data.richting === "op" })
      .range(start, start + data.perPagina - 1);

    const ids = ((rijen ?? []) as any[]).map((r) => r.id);
    const namen = await profielMap(db, ((rijen ?? []) as any[]).map((r) => r.user_id));
    const tellingen = new Map<string, { events: number; fouten: number }>();
    if (ids.length) {
      const [{ data: ev }, { data: fo }] = await Promise.all([
        await pagineer((a, b) => db.from("usage_events").select("session_id").in("session_id", ids).range(a, b), 100000),
        await pagineer((a, b) => db.from("app_errors").select("session_id").in("session_id", ids).range(a, b), 50000),
      ]);
      for (const e of (ev ?? []) as any[]) {
        const r = tellingen.get(e.session_id) ?? { events: 0, fouten: 0 };
        r.events += 1;
        tellingen.set(e.session_id, r);
      }
      for (const e of (fo ?? []) as any[]) {
        const r = tellingen.get(e.session_id) ?? { events: 0, fouten: 0 };
        r.fouten += 1;
        tellingen.set(e.session_id, r);
      }
    }

    return {
      rijen: ((rijen ?? []) as any[]).map((r) => ({
        ...r,
        naam: namen.get(r.user_id)?.naam ?? "Onbekend",
        events: tellingen.get(r.id)?.events ?? 0,
        fouten: tellingen.get(r.id)?.fouten ?? 0,
        duur: r.ended_at ? Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 1000) : null,
      })),
      totaal: count ?? 0,
      pagina: data.pagina,
      perPagina: data.perPagina,
    };
  });

export const uiSessie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const { data: sessie } = (await db.from("user_sessions").select("*").eq("id", data.id).maybeSingle()) as { data: any };
    if (!sessie) return null;
    const [{ data: events }, { data: fouten }, { data: ai }] = await Promise.all([
      await pagineer((a, b) => db.from("usage_events").select("*").eq("session_id", data.id).order("created_at").range(a, b), 2000),
      db.from("app_errors").select("*").eq("session_id", data.id).order("created_at").limit(500),
      db
        .from("ai_usage")
        .select("*")
        .eq("user_id", sessie.user_id)
        .gte("created_at", sessie.started_at)
        .lte("created_at", sessie.ended_at ?? new Date().toISOString())
        .limit(500),
    ]);
    const namen = await profielMap(db, [sessie.user_id]);
    const aiR = (ai ?? []) as any[];
    return {
      sessie: {
        ...sessie,
        naam: namen.get(sessie.user_id)?.naam ?? "Onbekend",
        duur: sessie.ended_at
          ? Math.round((new Date(sessie.ended_at).getTime() - new Date(sessie.started_at).getTime()) / 1000)
          : null,
      },
      events: (events ?? []) as any[],
      fouten: (fouten ?? []) as any[],
      ai: aiR,
      credits: aiR.reduce((t, r) => t + (r.credits ?? 0), 0),
      kost: Math.round(aiR.reduce((t, r) => t + Number(r.kost_eur ?? 0), 0) * 10000) / 10000,
    };
  });

// ============================================================
// AI, credits en fouten
// ============================================================

export const uiAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filterSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "ai.view");
    const { vanIso, totIso } = bereikIso(data);
    const start = (data.pagina - 1) * data.perPagina;

    let q = db.from("ai_usage").select("*", { count: "exact" });
    q = tijdFilter(q, "created_at", vanIso, totIso);
    if (data.userIds.length) q = q.in("user_id", data.userIds);
    if (data.provider) q = q.eq("provider", data.provider);
    if (data.model) q = q.eq("model", data.model);
    if (data.feature) q = q.eq("feature", data.feature);
    if (data.resultaat === "gelukt") q = q.eq("ok", true);
    if (data.resultaat === "mislukt") q = q.eq("ok", false);
    const { data: rijen, count } = await q
      .order("created_at", { ascending: data.richting === "op" })
      .range(start, start + data.perPagina - 1);

    const namen = await profielMap(db, ((rijen ?? []) as any[]).map((r) => r.user_id));
    return {
      rijen: ((rijen ?? []) as any[]).map((r) => ({ ...r, naam: namen.get(r.user_id)?.naam ?? "Onbekend" })),
      totaal: count ?? 0,
      pagina: data.pagina,
      perPagina: data.perPagina,
    };
  });

export const uiAiDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "ai.view");
    const { data: rij } = (await db.from("ai_usage").select("*").eq("id", data.id).maybeSingle()) as { data: any };
    if (!rij) return null;
    const namen = await profielMap(db, [rij.user_id]);
    const { data: transacties } = await db
      .from("credit_transactions")
      .select("*")
      .eq("user_id", rij.user_id)
      .gte("created_at", new Date(new Date(rij.created_at).getTime() - 120_000).toISOString())
      .lte("created_at", new Date(new Date(rij.created_at).getTime() + 120_000).toISOString())
      .limit(20);
    const { data: sessie } = await db
      .from("user_sessions")
      .select("id, started_at, ended_at")
      .eq("user_id", rij.user_id)
      .lte("started_at", rij.created_at)
      .order("started_at", { ascending: false })
      .limit(1);
    return {
      rij,
      naam: namen.get(rij.user_id)?.naam ?? "Onbekend",
      transacties: (transacties ?? []) as any[],
      sessie: ((sessie ?? []) as any[])[0] ?? null,
    };
  });

export const uiCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filterSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const { vanIso, totIso } = bereikIso(data);
    const start = (data.pagina - 1) * data.perPagina;
    let q = db.from("credit_transactions").select("*", { count: "exact" });
    q = tijdFilter(q, "created_at", vanIso, totIso);
    if (data.userIds.length) q = q.in("user_id", data.userIds);
    if (data.feature) q = q.eq("feature", data.feature);
    const { data: rijen, count } = await q
      .order("created_at", { ascending: false })
      .range(start, start + data.perPagina - 1);
    const namen = await profielMap(db, ((rijen ?? []) as any[]).map((r) => r.user_id));
    return {
      rijen: ((rijen ?? []) as any[]).map((r) => ({
        ...r,
        naam: namen.get(r.user_id)?.naam ?? "Onbekend",
        balance_before: r.balance_after - r.amount,
      })),
      totaal: count ?? 0,
      pagina: data.pagina,
      perPagina: data.perPagina,
    };
  });

export const uiFouten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filterSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const { vanIso, totIso } = bereikIso(data);
    const start = (data.pagina - 1) * data.perPagina;
    let q = db.from("app_errors").select("*", { count: "exact" });
    q = tijdFilter(q, "created_at", vanIso, totIso);
    if (data.userIds.length) q = q.in("user_id", data.userIds);
    if (data.feature) q = q.eq("feature", data.feature);
    if (data.appVersion) q = q.eq("app_version", data.appVersion);
    if (data.sessionId) q = q.eq("session_id", data.sessionId);
    if (data.zoek) q = q.ilike("bericht", `%${data.zoek}%`);
    const { data: rijen, count } = await q
      .order("created_at", { ascending: false })
      .range(start, start + data.perPagina - 1);
    const namen = await profielMap(db, ((rijen ?? []) as any[]).map((r) => r.user_id));
    return {
      rijen: ((rijen ?? []) as any[]).map((r) => ({ ...r, naam: namen.get(r.user_id)?.naam ?? "Onbekend" })),
      totaal: count ?? 0,
      pagina: data.pagina,
      perPagina: data.perPagina,
    };
  });

export const uiFoutDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const { data: rij } = (await db.from("app_errors").select("*").eq("id", data.id).maybeSingle()) as { data: any };
    if (!rij) return null;
    const namen = await profielMap(db, [rij.user_id]);
    let rondom: any[] = [];
    if (rij.session_id) {
      const { data: e } = await db
        .from("usage_events")
        .select("id, event, created_at, entity_label")
        .eq("session_id", rij.session_id)
        .order("created_at")
        .limit(200);
      rondom = (e ?? []) as any[];
    }
    return { rij, naam: rij.user_id ? (namen.get(rij.user_id)?.naam ?? "Onbekend") : null, rondom };
  });

// ============================================================
// Gebruikersprofiel: tijdlijn, functiegebruik, laatst gezien
// ============================================================

export const uiGebruiker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        zoek: z.string().default(""),
        feature: z.string().default(""),
        event: z.string().default(""),
        sessionId: z.string().uuid().optional(),
        alleenAi: z.boolean().default(false),
        alleenFouten: z.boolean().default(false),
        van: z.string().optional(),
        tot: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.view");
    await sluitStilleSessies(db);
    const id = data.id;

    const [
      { data: prof },
      { data: events },
      { data: sessies },
      { data: ai },
      { data: fouten },
      { data: credits },
      { data: saldo },
      { data: leden },
      { data: shares },
    ] = await Promise.all([
      db.from("profiles").select("*").eq("id", id).maybeSingle(),
      await pagineer((a, b) => db.from("usage_events").select("*").eq("user_id", id).order("created_at", { ascending: false }).range(a, b), 2000),
      db.from("user_sessions").select("*").eq("user_id", id).order("started_at", { ascending: false }).limit(200),
      db.from("ai_usage").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(500),
      db.from("app_errors").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(200),
      db.from("credit_transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(200),
      db.from("user_credits").select("*").eq("user_id", id).maybeSingle(),
      db.from("group_members").select("group_id, rol, status").eq("user_id", id),
      db.from("shares").select("owner_id, member_id, status").or(`owner_id.eq.${id},member_id.eq.${id}`),
    ]);

    const ev = (events ?? []) as any[];
    const ss = (sessies ?? []) as any[];
    const aiR = (ai ?? []) as any[];
    const foutenR = (fouten ?? []) as any[];

    // functiegebruik
    const feat = new Map<string, { feature: string; aantal: number; eerste: string; laatste: string }>();
    for (const e of ev) {
      const f = e.feature ?? "Overig";
      const r = feat.get(f) ?? { feature: f, aantal: 0, eerste: e.created_at, laatste: e.created_at };
      r.aantal += 1;
      if (e.created_at < r.eerste) r.eerste = e.created_at;
      if (e.created_at > r.laatste) r.laatste = e.created_at;
      feat.set(f, r);
    }

    // tijdlijn met filters
    let tijdlijn: any[] = ev.map((e) => ({
      soort: "event",
      id: e.id,
      tijd: e.created_at,
      titel: e.event,
      feature: e.feature,
      label: e.entity_label ?? e.entity_id ?? e.path,
      device: e.device,
      sessionId: e.session_id,
      ok: e.ok,
    }));
    tijdlijn = tijdlijn.concat(
      aiR.map((a) => ({
        soort: "ai" as any,
        id: a.id,
        tijd: a.created_at,
        titel: `AI · ${a.feature}`,
        feature: "AI",
        label: `${a.model} · ${a.credits} credits · € ${Number(a.kost_eur ?? 0).toFixed(4)}`,
        device: null,
        sessionId: null,
        ok: a.ok,
      })),
      foutenR.map((f) => ({
        soort: "fout" as any,
        id: f.id,
        tijd: f.created_at,
        titel: `Fout · ${f.feature || f.soort}`,
        feature: f.feature || "Overig",
        label: f.bericht,
        device: f.device,
        sessionId: f.session_id,
        ok: false,
      })),
    );
    if (data.alleenAi) tijdlijn = tijdlijn.filter((t) => t.soort === "ai");
    if (data.alleenFouten) tijdlijn = tijdlijn.filter((t) => t.soort === "fout");
    if (data.feature) tijdlijn = tijdlijn.filter((t) => t.feature === data.feature);
    if (data.event) tijdlijn = tijdlijn.filter((t) => t.titel === data.event);
    if (data.sessionId) tijdlijn = tijdlijn.filter((t) => t.sessionId === data.sessionId);
    if (data.van) tijdlijn = tijdlijn.filter((t) => t.tijd >= `${data.van}T00:00:00`);
    if (data.tot) tijdlijn = tijdlijn.filter((t) => t.tijd <= `${data.tot}T23:59:59`);
    if (data.zoek) {
      const z = data.zoek.toLowerCase();
      tijdlijn = tijdlijn.filter(
        (t) => t.titel?.toLowerCase().includes(z) || String(t.label ?? "").toLowerCase().includes(z),
      );
    }
    tijdlijn.sort((a, b) => (a.tijd < b.tijd ? 1 : -1));

    const laatste = (lijst: any[], veld = "created_at") => (lijst.length ? lijst[0][veld] : null);
    const laatsteMet = (prefix: string) => ev.find((e) => e.event?.startsWith(prefix))?.created_at ?? null;

    await logboek(db, profiel, "user_intelligence.view", "user", id, {});

    return {
      profiel: prof,
      sessies: ss.map((s) => ({
        ...s,
        duur: s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000) : null,
      })),
      tijdlijn: tijdlijn.slice(0, 500),
      functies: [...feat.values()].sort((a, b) => b.aantal - a.aantal),
      ai: aiR,
      fouten: foutenR,
      credits: (credits ?? []) as any[],
      saldo,
      groepen: (leden ?? []) as any[],
      shares: (shares ?? []) as any[],
      totalen: {
        events: ev.length,
        sessies: ss.length,
        ai: aiR.length,
        creditsGebruikt: aiR.reduce((t, r) => t + (r.credits ?? 0), 0),
        kost: Math.round(aiR.reduce((t, r) => t + Number(r.kost_eur ?? 0), 0) * 10000) / 10000,
        fouten: foutenR.length,
        actieveDagen: new Set(ev.map((e) => e.created_at.slice(0, 10))).size,
      },
      laatstGezien: {
        login: ss.length ? ss[0].started_at : null,
        activiteit: laatste(ev),
        sessie: ss.length ? (ss[0].ended_at ?? ss[0].last_seen_at) : null,
        recept: laatsteMet("recept."),
        ai: laatste(aiR),
        boodschappen: laatsteMet("boodschappen."),
        weekmenu: laatsteMet("weekmenu."),
      },
      huidigeSessie: ss.find((s) => !s.ended_at) ?? null,
    };
  });

export const uiVergelijk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(2).max(6) }).parse(d))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const [{ data: prof }, { data: ev }, { data: ss }, { data: ai }, { data: fo }] = await Promise.all([
      db.from("profiles").select("id, display_name").in("id", data.ids),
      await pagineer((a, b) => db.from("usage_events").select("user_id, event, created_at").in("user_id", data.ids).range(a, b), 100000),
      await pagineer((a, b) => db.from("user_sessions").select("user_id, started_at").in("user_id", data.ids).range(a, b), 20000),
      await pagineer((a, b) => db.from("ai_usage").select("user_id, credits, kost_eur").in("user_id", data.ids).range(a, b), 20000),
      await pagineer((a, b) => db.from("app_errors").select("user_id").in("user_id", data.ids).range(a, b), 20000),
    ]);
    return ((prof ?? []) as any[]).map((p) => {
      const mijn = ((ev ?? []) as any[]).filter((e) => e.user_id === p.id);
      const mijnAi = ((ai ?? []) as any[]).filter((a) => a.user_id === p.id);
      return {
        id: p.id,
        naam: p.display_name,
        sessies: ((ss ?? []) as any[]).filter((s) => s.user_id === p.id).length,
        actieveDagen: new Set(mijn.map((e) => e.created_at.slice(0, 10))).size,
        recepten: mijn.filter((e) => e.event === "recept.aangemaakt").length,
        imports: mijn.filter((e) => e.event === "recept.geimporteerd").length,
        ai: mijnAi.length,
        credits: mijnAi.reduce((t, r) => t + (r.credits ?? 0), 0),
        kost: Math.round(mijnAi.reduce((t, r) => t + Number(r.kost_eur ?? 0), 0) * 10000) / 10000,
        fouten: ((fo ?? []) as any[]).filter((f) => f.user_id === p.id).length,
        laatsteActiviteit: mijn.length ? mijn.map((e) => e.created_at).sort().at(-1) : null,
      };
    });
  });

// ============================================================
// Groepen
// ============================================================

export const uiGroepen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const [{ data: groepen }, { data: leden }, { data: ev }, { data: ai }] = await Promise.all([
      await pagineer((a, b) => db.from("groups").select("id, naam, owner_id, created_at").range(a, b), 2000),
      await pagineer((a, b) => db.from("group_members").select("group_id, user_id, status").range(a, b), 20000),
      await pagineer((a, b) => db.from("usage_events").select("user_id, created_at, event").range(a, b), 200000),
      await pagineer((a, b) => db.from("ai_usage").select("user_id, credits, kost_eur").range(a, b), 100000),
    ]);
    const evPer = new Map<string, { n: number; laatste: string }>();
    for (const e of (ev ?? []) as any[]) {
      const r = evPer.get(e.user_id) ?? { n: 0, laatste: e.created_at };
      r.n += 1;
      if (e.created_at > r.laatste) r.laatste = e.created_at;
      evPer.set(e.user_id, r);
    }
    const aiPer = new Map<string, { n: number; credits: number; kost: number }>();
    for (const a of (ai ?? []) as any[]) {
      const r = aiPer.get(a.user_id) ?? { n: 0, credits: 0, kost: 0 };
      r.n += 1;
      r.credits += a.credits ?? 0;
      r.kost += Number(a.kost_eur ?? 0);
      aiPer.set(a.user_id, r);
    }
    return ((groepen ?? []) as any[]).map((g) => {
      const mijn = ((leden ?? []) as any[]).filter((l) => l.group_id === g.id);
      const actieve = mijn.filter((l) => l.status === "actief");
      const stats = actieve.map((l) => evPer.get(l.user_id)).filter(Boolean) as { n: number; laatste: string }[];
      const aiStats = actieve.map((l) => aiPer.get(l.user_id)).filter(Boolean) as any[];
      return {
        id: g.id,
        naam: g.naam,
        owner_id: g.owner_id,
        leden: mijn.length,
        actieveLeden: actieve.length,
        events: stats.reduce((t, s) => t + s.n, 0),
        laatsteActiviteit: stats.map((s) => s.laatste).sort().at(-1) ?? null,
        ai: aiStats.reduce((t, s) => t + s.n, 0),
        credits: aiStats.reduce((t, s) => t + s.credits, 0),
        kost: Math.round(aiStats.reduce((t, s) => t + s.kost, 0) * 10000) / 10000,
      };
    });
  });

export const uiGroep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const { data: groep } = (await db.from("groups").select("*").eq("id", data.id).maybeSingle()) as { data: any };
    if (!groep) return null;
    const { data: leden } = await db.from("group_members").select("*").eq("group_id", data.id);
    const ids = ((leden ?? []) as any[]).map((l) => l.user_id);
    const [{ data: prof }, { data: ev }, { data: ai }, { data: planning }, { data: lijsten }] = await Promise.all([
      db.from("profiles").select("id, display_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      db
        .from("usage_events")
        .select("user_id, event, created_at, feature")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false })
        .limit(500),
      await pagineer((a, b) => db
        .from("ai_usage")
        .select("user_id, credits, kost_eur, feature, created_at")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
        .range(a, b), 5000),
      db.from("meal_plan").select("id, plan_date, meal_type, custom_title").eq("group_id", data.id).limit(500),
      db.from("shopping_lists").select("id, name, created_at").eq("group_id", data.id).limit(200),
    ]);
    const namen = new Map(((prof ?? []) as any[]).map((p) => [p.id, p.display_name]));
    return {
      groep,
      leden: ((leden ?? []) as any[]).map((l) => ({ ...l, naam: namen.get(l.user_id) ?? "Onbekend" })),
      events: ((ev ?? []) as any[]).map((e) => ({ ...e, naam: namen.get(e.user_id) ?? "Onbekend" })),
      ai: (ai ?? []) as any[],
      credits: ((ai ?? []) as any[]).reduce((t, r) => t + (r.credits ?? 0), 0),
      kost: Math.round(((ai ?? []) as any[]).reduce((t, r) => t + Number(r.kost_eur ?? 0), 0) * 10000) / 10000,
      planning: (planning ?? []) as any[],
      lijsten: (lijsten ?? []) as any[],
    };
  });

// ============================================================
// Aandacht, zoeken, weergaven, export
// ============================================================

export const uiAandacht = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const [{ data: prof }, { data: ev }, { data: ai }, { data: fo }, { data: imports }] = await Promise.all([
      await pagineer((a, b) => db.from("profiles").select("id, display_name, created_at").range(a, b), 50000),
      await pagineer((a, b) => db.from("usage_events").select("user_id, created_at, event").range(a, b), 200000),
      await pagineer((a, b) => db.from("ai_usage").select("user_id, credits, created_at").range(a, b), 100000),
      await pagineer((a, b) => db.from("app_errors").select("user_id, created_at").range(a, b), 50000),
      await pagineer((a, b) => db.from("recipe_import_jobs").select("user_id, status, created_at").range(a, b), 20000),
    ]);
    const nu = Date.now();
    const per = new Map<string, any>();
    const zorg = (id: string) =>
      per.get(id) ?? per.set(id, { events: 0, laatste: null, ai30: 0, fouten30: 0, mislukteImports: 0 }).get(id);
    for (const e of (ev ?? []) as any[]) {
      const r = zorg(e.user_id);
      r.events += 1;
      if (!r.laatste || e.created_at > r.laatste) r.laatste = e.created_at;
    }
    for (const a of (ai ?? []) as any[])
      if (nu - new Date(a.created_at).getTime() < 30 * 86400_000) zorg(a.user_id).ai30 += a.credits ?? 0;
    for (const f of (fo ?? []) as any[])
      if (nu - new Date(f.created_at).getTime() < 30 * 86400_000) zorg(f.user_id).fouten30 += 1;
    for (const i of (imports ?? []) as any[])
      if (i.user_id && i.status !== "klaar" && i.status !== "voltooid") zorg(i.user_id).mislukteImports += 1;

    const uit: any[] = [];
    for (const p of (prof ?? []) as any[]) {
      const r = per.get(p.id) ?? { events: 0, laatste: null, ai30: 0, fouten30: 0, mislukteImports: 0 };
      const signalen: string[] = [];
      if (r.events === 0) signalen.push("nooit actief geweest");
      else if (nu - new Date(p.created_at).getTime() < 7 * 86400_000 && r.events <= 3)
        signalen.push("weinig activiteit na aanmelden");
      if (r.laatste && nu - new Date(r.laatste).getTime() > 30 * 86400_000) signalen.push("meer dan 30 dagen stil");
      if (r.ai30 > 200) signalen.push(`veel AI-verbruik (${r.ai30} credits)`);
      if (r.fouten30 >= 5) signalen.push(`${r.fouten30} fouten deze maand`);
      if (r.mislukteImports >= 3) signalen.push(`${r.mislukteImports} mislukte imports`);
      if (signalen.length) uit.push({ id: p.id, naam: p.display_name, laatste: r.laatste, signalen });
    }
    return uit.sort((a, b) => b.signalen.length - a.signalen.length).slice(0, 200);
  });

export const uiZoek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ term: z.string().min(2) }).parse(d))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const t = data.term.trim();
    const uuid = /^[0-9a-f-]{36}$/i.test(t);

    const [gebruikers, recepten, groepen, sessies, events, fouten, aiJobs] = await Promise.all([
      db
        .from("profiles")
        .select("id, display_name, handle")
        .or(uuid ? `id.eq.${t}` : `display_name.ilike.%${t}%,handle.ilike.%${t}%`)
        .limit(10),
      db.from("recipes").select("id, title, user_id").ilike("title", `%${t}%`).limit(10),
      db.from("groups").select("id, naam").ilike("naam", `%${t}%`).limit(10),
      uuid ? db.from("user_sessions").select("id, user_id, started_at").eq("id", t).limit(5) : { data: [] },
      uuid ? db.from("usage_events").select("id, event, created_at, user_id").eq("id", t).limit(5) : { data: [] },
      uuid ? db.from("app_errors").select("id, bericht, created_at").eq("id", t).limit(5) : { data: [] },
      uuid ? db.from("ai_usage").select("id, feature, model, created_at").eq("id", t).limit(5) : { data: [] },
    ]);

    return {
      gebruikers: (gebruikers.data ?? []) as any[],
      recepten: (recepten.data ?? []) as any[],
      groepen: (groepen.data ?? []) as any[],
      sessies: (sessies.data ?? []) as any[],
      events: (events.data ?? []) as any[],
      fouten: (fouten.data ?? []) as any[],
      aiJobs: (aiJobs.data ?? []) as any[],
    };
  });

export const uiWeergaven = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, profiel } = await bewaker(context as Ctx, "dashboard.view");
    const { data } = await db
      .from("admin_saved_views")
      .select("*")
      .eq("admin_id", profiel.user_id)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as any[];
  });

export const uiWeergaveBewaren = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ naam: z.string().min(1).max(80), scherm: z.string().min(1), filters: z.record(z.string(), z.any()) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "dashboard.view", { schrijft: false });
    const { data: rij, error } = await db
      .from("admin_saved_views")
      .insert({ admin_id: profiel.user_id, naam: data.naam, scherm: data.scherm, filters: data.filters })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rij;
  });

export const uiWeergaveVerwijderen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "dashboard.view", { schrijft: false });
    await db.from("admin_saved_views").delete().eq("id", data.id).eq("admin_id", profiel.user_id);
    return { ok: true };
  });

export const uiExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        soort: z.enum(["gebruikers", "sessies", "gebeurtenissen", "ai", "credits", "fouten"]),
        filters: filterSchema,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.view");
    const { vanIso, totIso } = bereikIso(data.filters);
    const f = { ...data.filters, perPagina: 200, pagina: 1 };
    let rijen: Record<string, unknown>[] = [];

    if (data.soort === "sessies") {
      let q = db.from("user_sessions").select("*");
      q = tijdFilter(q, "started_at", vanIso, totIso);
      if (f.userIds.length) q = q.in("user_id", f.userIds);
      rijen = ((await q.limit(50_000)).data ?? []) as any[];
    } else if (data.soort === "gebeurtenissen") {
      let q = db.from("usage_events").select("*");
      q = tijdFilter(q, "created_at", vanIso, totIso);
      q = pasGebeurtenisFilters(q, f as Filters);
      rijen = ((await q.limit(50_000)).data ?? []) as any[];
    } else if (data.soort === "ai") {
      let q = db.from("ai_usage").select("*");
      q = tijdFilter(q, "created_at", vanIso, totIso);
      if (f.userIds.length) q = q.in("user_id", f.userIds);
      rijen = ((await q.limit(50_000)).data ?? []) as any[];
    } else if (data.soort === "credits") {
      let q = db.from("credit_transactions").select("*");
      q = tijdFilter(q, "created_at", vanIso, totIso);
      if (f.userIds.length) q = q.in("user_id", f.userIds);
      rijen = ((await q.limit(50_000)).data ?? []) as any[];
    } else if (data.soort === "fouten") {
      let q = db.from("app_errors").select("*");
      q = tijdFilter(q, "created_at", vanIso, totIso);
      if (f.userIds.length) q = q.in("user_id", f.userIds);
      rijen = ((await q.limit(50_000)).data ?? []) as any[];
    } else {
      const { data: p } = await await pagineer((a, b) => db.from("profiles").select("id, display_name, handle, created_at, blocked_at").range(a, b), 50000);
      rijen = (p ?? []) as any[];
    }

    await logboek(db, profiel, "user_intelligence.export", "monitoring", data.soort, { rijen: rijen.length });
    return { bestand: `${data.soort}-${new Date().toISOString().slice(0, 10)}.csv`, inhoud: csv(rijen) };
  });
