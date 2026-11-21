/**
 * Creditmotor (server-only).
 *
 * Regel: DETERMINISTISCH EERST -> CACHE -> GOEDKOOP MODEL -> DURE AI.
 * Deze module doet de laatste drie stappen: cache nakijken, credits reserveren,
 * en bij mislukking altijd terugstorten. Gewone app-functies gebruiken dit niet.
 */
import { createHash } from "node:crypto";

export function hashInvoer(feature: string, invoer: string, promptVersie = 1) {
  const genormaliseerd = invoer.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(`${feature}|v${promptVersie}|${genormaliseerd}`).digest("hex");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type ToestemmingDb = {
  from: (t: string) => {
    select: (k: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        eq: (
          k: string,
          v: string,
        ) => {
          maybeSingle: () => PromiseLike<{ data: { aan?: unknown } | null }>;
        };
      };
    };
  };
};

/**
 * Fase 8: heeft de gebruiker AI uitgezet (kop van dit toestel of rij in `toestemmingen`)?
 * Ontbreekt de tabel (voorstel 0025 niet uitgevoerd), dan telt alleen de kop.
 */
export async function aiUitVoor(userId: string): Promise<boolean> {
  const { AI_KOP, aiUitgezet } = await import("@/lib/privacy/ai-toestemming");
  let kop: string | null = null;
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    kop = getRequest()?.headers.get(AI_KOP) ?? null;
  } catch {
    /* buiten een verzoek (tests, achtergrondtaak): geen kop */
  }
  if (aiUitgezet(kop, null)) return true;
  let rij: { aan?: unknown } | null = null;
  try {
    const db = (await admin()) as unknown as ToestemmingDb;
    const { data } = await db
      .from("toestemmingen")
      .select("aan")
      .eq("user_id", userId)
      .eq("soort", "ai")
      .maybeSingle();
    rij = data;
  } catch {
    /* tabel bestaat nog niet: alleen de keuze op het toestel telt */
  }
  return aiUitgezet(null, rij);
}

async function controleerAiToestemming(userId: string) {
  if (await aiUitVoor(userId)) {
    const { AI_UIT_MELDING } = await import("@/lib/privacy/ai-toestemming");
    throw new Error(AI_UIT_MELDING);
  }
}

export type CreditFout = "ONVOLDOENDE_CREDITS" | "DAGLIMIET" | "FUNCTIE_UIT" | "MAANDBUDGET";

const BOODSCHAP: Record<CreditFout, string> = {
  ONVOLDOENDE_CREDITS:
    "Je credits zijn op. Alles in de app blijft gewoon werken; enkel de slimme functies hebben credits nodig.",
  DAGLIMIET: "Je hebt deze slimme functie vandaag al vaak gebruikt. Probeer het morgen opnieuw.",
  FUNCTIE_UIT: "Deze slimme functie staat tijdelijk uit.",
  MAANDBUDGET:
    "De slimme functies staan deze maand even op pauze. Alles in de app blijft gewoon werken.",
};

function vertaalFout(e: unknown): Error {
  const tekst = e instanceof Error ? e.message : String(e);
  for (const sleutel of Object.keys(BOODSCHAP) as CreditFout[]) {
    if (tekst.includes(sleutel)) return new Error(BOODSCHAP[sleutel]);
  }
  return e instanceof Error ? e : new Error(tekst);
}

/** Verbruiksmeter die een AI-taak zelf kan invullen (tokens, beelden). */
export type AiMeter = {
  tokens_in: number;
  tokens_out: number;
  beelden: number;
  provider: string;
  error_code: string | null;
  group_id: string | null;
};

export function nieuweMeter(): AiMeter {
  return {
    tokens_in: 0,
    tokens_out: 0,
    beelden: 0,
    provider: "lovable",
    error_code: null,
    group_id: null,
  };
}

/** Werkelijke kost in euro op basis van de prijslijst in het Control Center. */
export async function berekenKost(model: string, m: AiMeter): Promise<number> {
  try {
    const db = await admin();
    const { data } = await db.from("model_prices").select("*").eq("model", model).maybeSingle();
    // Geen prijs gekend? Dan een voorzichtige schatting i.p.v. 0, anders werkt het budget niet.
    if (!data) return schatKost(m);
    const kost =
      (m.tokens_in / 1_000_000) * Number(data.eur_per_1m_in ?? 0) +
      (m.tokens_out / 1_000_000) * Number(data.eur_per_1m_out ?? 0) +
      m.beelden * Number(data.eur_per_beeld ?? 0) +
      Number(data.eur_per_call ?? 0);
    return Math.round(kost * 1_000_000) / 1_000_000;
  } catch {
    return 0;
  }
}

/**
 * Voorzichtige schatting (euro) als er voor een model nog geen prijs in `model_prices` staat.
 * Bewust aan de hoge kant (zie masterplan §16): beter te vroeg gewaarschuwd dan te laat.
 */
export function schatKost(m: Pick<AiMeter, "tokens_in" | "tokens_out" | "beelden">): number {
  const kost =
    (m.tokens_in / 1_000_000) * 1.0 + (m.tokens_out / 1_000_000) * 5.0 + m.beelden * 0.05;
  return Math.round(Math.max(kost, 0.002) * 1_000_000) / 1_000_000;
}

/** Standaard maandbudget voor alle AI samen, als er niets is ingesteld (`ai_budget_maand_eur`). */
export const MAANDBUDGET_STANDAARD_EUR = 25;
/** Vanaf dit aandeel van het budget komt er een waarschuwing in het Control Center. */
export const BUDGET_WAARSCHUWING = 0.8;

/** Budgetstand: mag er nog een betaalde AI-oproep bij? Puur, zodat het te testen is. */
export function budgetOordeel(uitgegeven: number, budget: number) {
  if (!(budget > 0)) return { mag: true, waarschuwen: false, aandeel: 0 };
  const aandeel = uitgegeven / budget;
  return { mag: aandeel < 1, waarschuwen: aandeel >= BUDGET_WAARSCHUWING, aandeel };
}

let budgetGeheugen: { tot: number; maand: string; uitgegeven: number; budget: number } | null =
  null;
const gewaarschuwd = new Set<string>();

/** Hoeveel er deze maand al aan AI is uitgegeven, en wat het budget is (5 min in het geheugen). */
async function budgetStand(db: Awaited<ReturnType<typeof admin>>) {
  const nu = new Date();
  const maand = `${nu.getUTCFullYear()}-${String(nu.getUTCMonth() + 1).padStart(2, "0")}`;
  if (budgetGeheugen && budgetGeheugen.maand === maand && budgetGeheugen.tot > Date.now())
    return budgetGeheugen;
  let budget = MAANDBUDGET_STANDAARD_EUR;
  let uitgegeven = 0;
  try {
    const { data: inst } = await db
      .from("platform_settings")
      .select("value")
      .eq("key", "ai_budget_maand_eur")
      .maybeSingle();
    const waarde = Number((inst?.value as unknown) ?? NaN);
    if (Number.isFinite(waarde) && waarde >= 0) budget = waarde;
    // In stukken: PostgREST geeft max. 1000 rijen per verzoek. Zonder paginering zou de budgetrem
    // het verbruik te laag schatten zodra er meer dan 1000 AI-oproepen per maand zijn (BUG-093).
    const { pagineer } = await import("@/lib/pagineer");
    const { data: rijen } = await pagineer<{ kost_eur: number | null }>(
      (van, tot) =>
        db
          .from("ai_usage")
          .select("kost_eur")
          .gte("created_at", `${maand}-01T00:00:00Z`)
          .order("created_at")
          .order("id")
          .range(van, tot),
      200_000,
    );
    uitgegeven = rijen.reduce((som, r) => som + Number(r.kost_eur ?? 0), 0);
  } catch {
    // Meting niet bereikbaar: niet blokkeren op een meetfout, wel kort onthouden.
  }
  budgetGeheugen = { tot: Date.now() + 5 * 60_000, maand, uitgegeven, budget };
  return budgetGeheugen;
}

async function meet(
  row: {
    user_id: string | null;
    feature: string;
    model: string;
    cache_hit: boolean;
    credits: number;
    duration_ms: number;
    ok: boolean;
  },
  m?: AiMeter,
) {
  try {
    const db = await admin();
    const meter = m ?? nieuweMeter();
    const kost = row.cache_hit ? 0 : await berekenKost(row.model, meter);
    await db.from("ai_usage").insert({
      ...row,
      provider: meter.provider,
      tokens_in: meter.tokens_in,
      tokens_out: meter.tokens_out,
      beelden: meter.beelden,
      kost_eur: kost,
      group_id: meter.group_id,
      error_code: meter.error_code,
    });
  } catch {
    // meten mag de app nooit breken
  }
}

/**
 * Voert een dure AI-taak uit met cache en credits.
 * - Zelfde invoer (hash) = cachetreffer = 0 credits.
 * - Mislukking = credits worden teruggestort.
 */
export async function metCredits<T>(
  opts: {
    userId: string;
    feature: string;
    cacheSleutel?: string;
    model?: string;
    promptVersie?: number;
    groupId?: string | null;
  },
  run: (meter: AiMeter) => Promise<T>,
): Promise<{ resultaat: T; credits: number; cache: boolean; saldo: number | null }> {
  const db = await admin();
  // Fase 8: "AI uit" (toestel of account) gaat vóór alles, ook vóór de cache.
  await controleerAiToestemming(opts.userId);
  const model = opts.model ?? "";
  const meter = nieuweMeter();
  meter.group_id = opts.groupId ?? null;
  const start = Date.now();

  const hash = opts.cacheSleutel
    ? hashInvoer(opts.feature, opts.cacheSleutel, opts.promptVersie ?? 1)
    : null;

  if (hash) {
    const { data } = await db
      .from("ai_cache")
      .select("result, hits")
      .eq("input_hash", hash)
      .maybeSingle();
    if (data?.result) {
      await db
        .from("ai_cache")
        .update({ hits: (data.hits ?? 0) + 1 })
        .eq("input_hash", hash);
      await meet(
        {
          user_id: opts.userId,
          feature: opts.feature,
          model,
          cache_hit: true,
          credits: 0,
          duration_ms: Date.now() - start,
          ok: true,
        },
        meter,
      );
      return { resultaat: data.result as T, credits: 0, cache: true, saldo: null };
    }
  }

  // Noodrem: het maandbudget voor alle AI samen (bovenop credits en daglimieten per gebruiker).
  const stand = await budgetStand(db);
  const oordeel = budgetOordeel(stand.uitgegeven, stand.budget);
  if (oordeel.waarschuwen && !gewaarschuwd.has(stand.maand + (oordeel.mag ? ":80" : ":100"))) {
    gewaarschuwd.add(stand.maand + (oordeel.mag ? ":80" : ":100"));
    try {
      await db.from("ai_events").insert({
        kind: oordeel.mag ? "budget:waarschuwing" : "budget:op",
        model,
        ok: oordeel.mag,
        duration_ms: 0,
        error: `€${stand.uitgegeven.toFixed(2)} van €${stand.budget.toFixed(2)} (${Math.round(oordeel.aandeel * 100)}%)`,
      });
    } catch {
      // waarschuwing mag de app niet breken
    }
  }
  if (!oordeel.mag) throw vertaalFout(new Error("MAANDBUDGET"));

  let reservering: { txn: string | null; kosten: number; saldo: number };
  try {
    const { data, error } = await db.rpc("credits_reserveren", {
      _user: opts.userId,
      _feature: opts.feature,
    });
    if (error) throw new Error(error.message);
    reservering = data as unknown as { txn: string | null; kosten: number; saldo: number };
  } catch (e) {
    throw vertaalFout(e);
  }

  let resultaat: T;
  try {
    resultaat = await run(meter);
  } catch (e) {
    // Terugstorten mag nooit de oorspronkelijke fout verbergen.
    if (reservering.txn) {
      try {
        await db.rpc("credits_terugstorten", { _txn: reservering.txn });
      } catch (terugFout) {
        console.error(
          "credits_terugstorten mislukt",
          opts.feature,
          terugFout instanceof Error ? terugFout.message : "onbekend",
        );
      }
    }
    await meet(
      {
        user_id: opts.userId,
        feature: opts.feature,
        model,
        cache_hit: false,
        credits: 0,
        duration_ms: Date.now() - start,
        ok: false,
      },
      meter,
    );
    throw vertaalFout(e);
  }

  // Vanaf hier is de AI-taak geslaagd en al betaald (de reservering schreef af).
  // Boekhouding achteraf mag het resultaat nooit meer weggooien, anders betaalt
  // de gebruiker opnieuw voor dezelfde vraag.
  if (reservering.txn) {
    try {
      await db.rpc("credits_afronden", { _txn: reservering.txn });
    } catch (e) {
      console.error(
        "credits_afronden mislukt",
        opts.feature,
        e instanceof Error ? e.message : "onbekend",
      );
    }
  }
  if (hash) {
    try {
      await db.from("ai_cache").upsert(
        {
          input_hash: hash,
          feature: opts.feature,
          model,
          prompt_version: opts.promptVersie ?? 1,
          result: resultaat as never,
        },
        { onConflict: "input_hash" },
      );
    } catch {
      // zonder cache werkt alles nog; enkel een volgende keer duurder
    }
  }
  await meet(
    {
      user_id: opts.userId,
      feature: opts.feature,
      model,
      cache_hit: false,
      credits: reservering.kosten,
      duration_ms: Date.now() - start,
      ok: true,
    },
    meter,
  );
  if (budgetGeheugen) budgetGeheugen.uitgegeven += await berekenKost(model, meter);
  return { resultaat, credits: reservering.kosten, cache: false, saldo: reservering.saldo };
}
