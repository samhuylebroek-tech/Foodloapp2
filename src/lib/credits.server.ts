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
    "Je AI-credits zijn op. Alles in de app blijft gewoon werken; enkel de slimme functies hebben credits nodig.",
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

async function meet(row: {
  user_id: string | null;
  feature: string;
  model: string;
  cache_hit: boolean;
  credits: number;
  duration_ms: number;
  ok: boolean;
}) {
  try {
    const db = await admin();
    await db.from("ai_usage").insert(row);
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
  opts: { userId: string; feature: string; cacheSleutel?: string; model?: string; promptVersie?: number },
  run: () => Promise<T>,
): Promise<{ resultaat: T; credits: number; cache: boolean; saldo: number | null }> {
  const db = await admin();
  const model = opts.model ?? "";
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
      });
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

  try {
    const resultaat = await run();
    if (reservering.txn) await db.rpc("credits_afronden", { _txn: reservering.txn });
    if (hash) {
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
    }
    await meet({
      user_id: opts.userId,
      feature: opts.feature,
      model,
      cache_hit: false,
      credits: reservering.kosten,
      duration_ms: Date.now() - start,
      ok: true,
    });
    return { resultaat, credits: reservering.kosten, cache: false, saldo: reservering.saldo };
  } catch (e) {
    if (reservering.txn) await db.rpc("credits_terugstorten", { _txn: reservering.txn });
    await meet({
      user_id: opts.userId,
      feature: opts.feature,
      model,
      cache_hit: false,
      credits: 0,
      duration_ms: Date.now() - start,
      ok: false,
    });
    throw vertaalFout(e);
  }
}
