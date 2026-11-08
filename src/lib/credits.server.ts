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

export type CreditFout = "ONVOLDOENDE_CREDITS" | "DAGLIMIET" | "FUNCTIE_UIT";

const BOODSCHAP: Record<CreditFout, string> = {
  ONVOLDOENDE_CREDITS:
    "Je credits zijn op. Alles in de app blijft gewoon werken; enkel de slimme functies hebben credits nodig.",
  DAGLIMIET: "Je hebt deze slimme functie vandaag al vaak gebruikt. Probeer het morgen opnieuw.",
  FUNCTIE_UIT: "Deze slimme functie staat tijdelijk uit.",
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
  return { tokens_in: 0, tokens_out: 0, beelden: 0, provider: "lovable", error_code: null, group_id: null };
}

/** Werkelijke kost in euro op basis van de prijslijst in het Control Center. */
export async function berekenKost(model: string, m: AiMeter): Promise<number> {
  try {
    const db = await admin();
    const { data } = await db.from("model_prices").select("*").eq("model", model).maybeSingle();
    if (!data) return 0;
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
      await meet({
        user_id: opts.userId,
        feature: opts.feature,
        model,
        cache_hit: true,
        credits: 0,
        duration_ms: Date.now() - start,
        ok: true,
      }, meter);
      return { resultaat: data.result as T, credits: 0, cache: true, saldo: null };
    }
  }

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
      console.error("credits_afronden mislukt", opts.feature, e instanceof Error ? e.message : "onbekend");
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
  return { resultaat, credits: reservering.kosten, cache: false, saldo: reservering.saldo };
}
