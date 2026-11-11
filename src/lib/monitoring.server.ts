/**
 * Aggregatie voor het Control Center (server-only).
 *
 * Ruwe gebeurtenissen worden één keer per dag samengevat in daily_user_stats en
 * daily_platform_stats. Dashboards lezen die samenvatting; alleen "vandaag"
 * wordt live geteld. Zo blijven de schermen snel en goedkoop.
 */

export type Drempels = {
  zeerActiefDagen: number;
  actiefDagen: number;
  lichtDagen: number;
  inactiefDagen: number;
  nieuwDagen: number;
  hoogAi: number;
  hogeKost: number;
  veelFouten: number;
  bewaartermijn: number;
};

const STANDAARD: Drempels = {
  zeerActiefDagen: 3,
  actiefDagen: 7,
  lichtDagen: 14,
  inactiefDagen: 14,
  nieuwDagen: 7,
  hoogAi: 50,
  hogeKost: 1,
  veelFouten: 5,
  bewaartermijn: 90,
};

const SLEUTELS: Record<keyof Drempels, string> = {
  zeerActiefDagen: "seg_zeer_actief_dagen",
  actiefDagen: "seg_actief_dagen",
  lichtDagen: "seg_licht_dagen",
  inactiefDagen: "seg_inactief_dagen",
  nieuwDagen: "seg_nieuw_dagen",
  hoogAi: "seg_hoog_ai",
  hogeKost: "seg_hoge_kost_eur",
  veelFouten: "seg_veel_fouten",
  bewaartermijn: "events_bewaartermijn_dagen",
};

export async function haalDrempels(db: any): Promise<Drempels> {
  const { data } = await db
    .from("platform_settings")
    .select("key, value")
    .in("key", Object.values(SLEUTELS));
  const map = new Map((data ?? []).map((r: any) => [r.key, Number(r.value)]));
  const uit = { ...STANDAARD };
  for (const [veld, sleutel] of Object.entries(SLEUTELS) as [keyof Drempels, string][]) {
    const n = map.get(sleutel);
    if (typeof n === "number" && Number.isFinite(n)) uit[veld] = n;
  }
  return uit;
}

export { SEGMENTEN, SEGMENT_LABEL } from "@/lib/segmenten";
import type { Segment } from "@/lib/segmenten";
export type { Segment };

export function bepaalSegmenten(
  g: {
    aangemaakt: string | null;
    laatsteActiviteit: string | null;
    aiCalls30: number;
    kost30: number;
    betaald: boolean;
  },
  d: Drempels,
): Segment[] {
  const nu = Date.now();
  const dagenSinds = (iso: string | null) =>
    iso ? Math.floor((nu - new Date(iso).getTime()) / 86400_000) : Number.POSITIVE_INFINITY;
  const stil = dagenSinds(g.laatsteActiviteit);
  const leeftijd = dagenSinds(g.aangemaakt);
  const uit: Segment[] = [];

  if (leeftijd <= d.nieuwDagen) uit.push("nieuw");
  if (stil <= d.zeerActiefDagen) uit.push("zeer_actief");
  else if (stil <= d.actiefDagen) uit.push("actief");
  else if (stil <= d.lichtDagen) uit.push("licht_actief");
  if (stil >= d.inactiefDagen) uit.push("inactief");
  if (stil > d.actiefDagen && stil < d.inactiefDagen) uit.push("churnrisico");

  uit.push(g.aiCalls30 >= d.hoogAi ? "hoge_ai" : "lage_ai");
  uit.push(g.kost30 >= d.hogeKost ? "hoge_kost" : "lage_kost");
  uit.push(g.betaald ? "betalend" : "gratis");
  return uit;
}

export function dagReeks(vanaf: Date, tot: Date): string[] {
  const uit: string[] = [];
  const d = new Date(Date.UTC(vanaf.getUTCFullYear(), vanaf.getUTCMonth(), vanaf.getUTCDate()));
  const eind = new Date(Date.UTC(tot.getUTCFullYear(), tot.getUTCMonth(), tot.getUTCDate()));
  while (d <= eind) {
    uit.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return uit;
}

/** Aantal sessies = aantal aparte blokken van 30 minuten met activiteit. */
export function telSessies(tijden: string[]): number {
  const blokken = new Set(tijden.map((t) => Math.floor(new Date(t).getTime() / 1_800_000)));
  return blokken.size;
}

async function alles(
  db: any,
  tabel: string,
  kolommen: string,
  van: string,
  tot: string,
  tijdkolom = "created_at",
) {
  // In stukken (max. 1000 rijen per verzoek bij PostgREST), anders kloppen de dagcijfers stil
  // niet meer bij drukte (BUG-093). Vaste volgorde: tijd, dan id.
  const { pagineer } = await import("@/lib/pagineer");
  const { data } = await pagineer(
    (a: number, b: number) =>
      db
        .from(tabel)
        .select(kolommen)
        .gte(tijdkolom, van)
        .lt(tijdkolom, tot)
        .order(tijdkolom)
        .order("id")
        .range(a, b),
    50_000,
  );
  return data as any[];
}

/** Vult de dagcijfers aan voor de laatste X dagen (inclusief vandaag). */
export async function aggregeerDagen(db: any, dagen = 2) {
  const nu = new Date();
  const start = new Date(
    Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate() - (dagen - 1)),
  );
  const eind = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate() + 1));
  const van = start.toISOString();
  const tot = eind.toISOString();

  const [events, ai, recepten, plan, lijsten, fouten, profielen] = await Promise.all([
    alles(db, "usage_events", "user_id, event, created_at", van, tot),
    alles(db, "ai_usage", "user_id, credits, kost_eur, created_at", van, tot),
    alles(db, "recipes", "user_id, source_url, created_at", van, tot),
    alles(db, "meal_plan", "user_id, created_at", van, tot),
    alles(db, "shopping_lists", "user_id, created_at", van, tot),
    alles(db, "app_errors", "user_id, created_at", van, tot),
    alles(db, "profiles", "id, created_at", van, tot),
  ]);

  type Rij = {
    dag: string;
    user_id: string;
    handelingen: number;
    tijden: string[];
    ai_calls: number;
    credits: number;
    kost_eur: number;
    recepten: number;
    imports: number;
    plan_items: number;
    fouten: number;
  };
  const perUser = new Map<string, Rij>();
  const rij = (dag: string, user: string) => {
    const k = `${dag}|${user}`;
    let r = perUser.get(k);
    if (!r) {
      r = {
        dag,
        user_id: user,
        handelingen: 0,
        tijden: [],
        ai_calls: 0,
        credits: 0,
        kost_eur: 0,
        recepten: 0,
        imports: 0,
        plan_items: 0,
        fouten: 0,
      };
      perUser.set(k, r);
    }
    return r;
  };
  const dagVan = (iso: string) => iso.slice(0, 10);

  for (const e of events) {
    if (!e.user_id) continue;
    const r = rij(dagVan(e.created_at), e.user_id);
    r.handelingen += 1;
    r.tijden.push(e.created_at);
  }
  for (const a of ai) {
    if (!a.user_id) continue;
    const r = rij(dagVan(a.created_at), a.user_id);
    r.ai_calls += 1;
    r.credits += a.credits ?? 0;
    r.kost_eur += Number(a.kost_eur ?? 0);
  }
  for (const x of recepten) {
    const r = rij(dagVan(x.created_at), x.user_id);
    r.recepten += 1;
    if (x.source_url) r.imports += 1;
  }
  for (const x of plan) {
    if (!x.user_id) continue;
    rij(dagVan(x.created_at), x.user_id).plan_items += 1;
  }
  for (const x of fouten) {
    if (!x.user_id) continue;
    rij(dagVan(x.created_at), x.user_id).fouten += 1;
  }

  const userRijen = [...perUser.values()].map((r) => ({
    dag: r.dag,
    user_id: r.user_id,
    handelingen: r.handelingen,
    sessies: telSessies(r.tijden),
    ai_calls: r.ai_calls,
    credits: r.credits,
    kost_eur: Math.round(r.kost_eur * 1e6) / 1e6,
    recepten: r.recepten,
    imports: r.imports,
    plan_items: r.plan_items,
    fouten: r.fouten,
    bijgewerkt: new Date().toISOString(),
  }));
  if (userRijen.length) {
    await db.from("daily_user_stats").upsert(userRijen, { onConflict: "dag,user_id" });
  }

  const dagen_ = dagReeks(start, nu);
  const platform = dagen_.map((dag) => {
    const u = userRijen.filter((r) => r.dag === dag);
    return {
      dag,
      nieuwe_gebruikers: profielen.filter((p) => dagVan(p.created_at) === dag).length,
      actieve_gebruikers: u.filter((r) => r.handelingen > 0).length,
      sessies: u.reduce((s, r) => s + r.sessies, 0),
      handelingen: u.reduce((s, r) => s + r.handelingen, 0),
      nieuwe_recepten: recepten.filter((r) => dagVan(r.created_at) === dag).length,
      imports: recepten.filter((r) => dagVan(r.created_at) === dag && r.source_url).length,
      weekmenus: plan.filter((r) => dagVan(r.created_at) === dag).length,
      lijsten: lijsten.filter((r) => dagVan(r.created_at) === dag).length,
      ai_calls: ai.filter((r) => dagVan(r.created_at) === dag).length,
      credits: ai
        .filter((r) => dagVan(r.created_at) === dag)
        .reduce((s, r) => s + (r.credits ?? 0), 0),
      kost_eur:
        Math.round(
          ai
            .filter((r) => dagVan(r.created_at) === dag)
            .reduce((s, r) => s + Number(r.kost_eur ?? 0), 0) * 1e6,
        ) / 1e6,
      fouten: fouten.filter((r) => dagVan(r.created_at) === dag).length,
      bijgewerkt: new Date().toISOString(),
    };
  });
  if (platform.length)
    await db.from("daily_platform_stats").upsert(platform, { onConflict: "dag" });

  return { dagen: dagen_.length, gebruikers: userRijen.length };
}

/** Ruimt ruwe gebeurtenissen op na de ingestelde bewaartermijn. */
export async function ruimOp(db: any) {
  const d = await haalDrempels(db);
  const grens = new Date(Date.now() - d.bewaartermijn * 86400_000).toISOString();
  await db.from("usage_events").delete().lt("created_at", grens);
  await db.from("app_errors").delete().lt("created_at", grens);
  return { grens };
}
