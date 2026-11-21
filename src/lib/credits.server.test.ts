import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Nep-Supabase: houdt bij welke RPC's en tabelacties gebeuren, zonder netwerk.
 * Zo testen we de creditregels zonder ooit een echte database te raken.
 */
type Oproep = { soort: "rpc" | "from"; naam: string; actie?: string; args?: unknown };
const log: Oproep[] = [];
const staat = {
  cache: new Map<string, { result: unknown; hits: number }>(),
  reserveringFout: null as string | null,
  terugstortenGooit: false,
  afrondenGooit: false,
  upsertGooit: false,
  txn: "txn-1" as string | null,
  budget: null as number | null,
  uitgegeven: [] as { kost_eur: number }[],
  aiUit: false,
};

function tabel(naam: string) {
  let filterHash: string | null = null;
  const q = {
    select: () => q,
    eq: (_kolom: string, waarde: string) => {
      filterHash = waarde;
      return q;
    },
    gte: () => q,
    order: () => q,
    // Zoals PostgREST (max-rows): hoogstens 1000 rijen, ook als je meer vraagt.
    limit: async () => ({
      data: naam === "ai_usage" ? staat.uitgegeven.slice(0, 1000) : [],
      error: null,
    }),
    // Zoals PostgREST: per verzoek een bereik (de budgetrem pagineert, BUG-093).
    range: async (van: number, tot: number) => ({
      data: naam === "ai_usage" ? staat.uitgegeven.slice(van, tot + 1) : [],
      error: null,
    }),
    maybeSingle: async () => {
      if (naam === "platform_settings")
        return { data: staat.budget == null ? null : { value: staat.budget }, error: null };
      if (naam === "toestemmingen")
        return { data: staat.aiUit ? { aan: false } : null, error: null };
      if (naam === "ai_cache" && filterHash)
        return { data: staat.cache.get(filterHash) ?? null, error: null };
      return { data: null, error: null };
    },
    update: (rij: { hits: number }) => {
      log.push({ soort: "from", naam, actie: "update", args: rij });
      return {
        eq: async (_k: string, h: string) => {
          const c = staat.cache.get(h);
          if (c) c.hits = rij.hits;
          return { error: null };
        },
      };
    },
    upsert: async (rij: { input_hash: string; result: unknown }) => {
      if (staat.upsertGooit) throw new Error("cache onbereikbaar");
      log.push({ soort: "from", naam, actie: "upsert", args: rij });
      staat.cache.set(rij.input_hash, { result: rij.result, hits: 0 });
      return { error: null };
    },
    insert: async (rij: unknown) => {
      log.push({ soort: "from", naam, actie: "insert", args: rij });
      return { error: null };
    },
  };
  return q;
}

const nepAdmin = {
  from: (naam: string) => tabel(naam),
  rpc: async (naam: string, args: unknown) => {
    log.push({ soort: "rpc", naam, args });
    if (naam === "credits_reserveren") {
      if (staat.reserveringFout) return { data: null, error: { message: staat.reserveringFout } };
      return { data: { txn: staat.txn, kosten: 2, saldo: 8 }, error: null };
    }
    if (naam === "credits_terugstorten" && staat.terugstortenGooit) throw new Error("netwerk weg");
    if (naam === "credits_afronden" && staat.afrondenGooit) throw new Error("netwerk weg");
    return { data: null, error: null };
  },
};

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: nepAdmin }));

const { metCredits, hashInvoer, budgetOordeel, schatKost } = await import("./credits.server");

const rpcs = () => log.filter((o) => o.soort === "rpc").map((o) => o.naam);
const gebruik = () =>
  log
    .filter((o) => o.naam === "ai_usage")
    .map((o) => o.args as { ok: boolean; credits: number; cache_hit: boolean });

beforeEach(() => {
  log.length = 0;
  staat.cache.clear();
  staat.reserveringFout = null;
  staat.terugstortenGooit = false;
  staat.afrondenGooit = false;
  staat.upsertGooit = false;
  staat.txn = "txn-1";
  staat.budget = null;
  staat.uitgegeven = [];
  staat.aiUit = false;
});

describe("hashInvoer", () => {
  it("negeert witruimte en hoofdletters, maar niet feature of promptversie", () => {
    expect(hashInvoer("f", "Spaghetti  Bolognese ")).toBe(hashInvoer("f", "spaghetti bolognese"));
    expect(hashInvoer("f", "x")).not.toBe(hashInvoer("g", "x"));
    expect(hashInvoer("f", "x", 1)).not.toBe(hashInvoer("f", "x", 2));
  });
});

describe("metCredits", () => {
  it("fase 8: AI uitgezet op het account → geweigerd vóór cache, credits en AI", async () => {
    staat.aiUit = true;
    const run = vi.fn(async () => "x");
    await expect(
      metCredits({ userId: "u1", feature: "import_url", cacheSleutel: "a" }, run),
    ).rejects.toThrow(/AI\) uitgezet/);
    expect(run).not.toHaveBeenCalled();
    expect(rpcs()).toEqual([]);
  });

  it("succes: reserveert, rondt af, bewaart in cache en meet", async () => {
    const run = vi.fn(async () => ({ titel: "Stoofvlees" }));
    const uit = await metCredits({ userId: "u1", feature: "import_url", cacheSleutel: "a" }, run);
    expect(uit).toEqual({ resultaat: { titel: "Stoofvlees" }, credits: 2, cache: false, saldo: 8 });
    expect(rpcs()).toEqual(["credits_reserveren", "credits_afronden"]);
    expect(log.some((o) => o.actie === "upsert")).toBe(true);
    expect(gebruik()).toEqual([
      expect.objectContaining({ ok: true, credits: 2, cache_hit: false }),
    ]);
  });

  it("cachetreffer: 0 credits, geen reservering, AI wordt niet opnieuw aangeroepen", async () => {
    await metCredits(
      { userId: "u1", feature: "import_url", cacheSleutel: "zelfde" },
      async () => "eerste",
    );
    log.length = 0;
    const run = vi.fn(async () => "tweede");
    const uit = await metCredits(
      { userId: "u2", feature: "import_url", cacheSleutel: " ZELFDE " },
      run,
    );
    expect(uit).toMatchObject({ resultaat: "eerste", credits: 0, cache: true });
    expect(run).not.toHaveBeenCalled();
    expect(rpcs()).toEqual([]);
  });

  it("mislukking: credits worden teruggestort en de fout komt door", async () => {
    await expect(
      metCredits({ userId: "u1", feature: "import_url" }, async () => {
        throw new Error("AI viel om");
      }),
    ).rejects.toThrow("AI viel om");
    expect(rpcs()).toEqual(["credits_reserveren", "credits_terugstorten"]);
    expect(gebruik()).toEqual([expect.objectContaining({ ok: false, credits: 0 })]);
    expect(log.some((o) => o.actie === "upsert")).toBe(false);
  });

  it("mislukte AI wordt nooit in de cache bewaard (volgende poging probeert opnieuw)", async () => {
    await expect(
      metCredits({ userId: "u1", feature: "f", cacheSleutel: "k" }, async () => {
        throw new Error("x");
      }),
    ).rejects.toThrow();
    expect(staat.cache.size).toBe(0);
  });

  it("credits op: gewone, vriendelijke boodschap en AI wordt niet gestart", async () => {
    staat.reserveringFout = "ONVOLDOENDE_CREDITS";
    const run = vi.fn();
    await expect(metCredits({ userId: "u1", feature: "f" }, run)).rejects.toThrow(
      /Je credits zijn op/,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("daglimiet en functie-uit krijgen elk hun eigen boodschap", async () => {
    staat.reserveringFout = "DAGLIMIET bereikt";
    await expect(metCredits({ userId: "u1", feature: "f" }, vi.fn())).rejects.toThrow(
      /vandaag al vaak/,
    );
    staat.reserveringFout = "FUNCTIE_UIT";
    await expect(metCredits({ userId: "u1", feature: "f" }, vi.fn())).rejects.toThrow(
      /tijdelijk uit/,
    );
  });

  it("gratis functie (geen txn): geen afronden of terugstorten", async () => {
    staat.txn = null;
    await metCredits({ userId: "u1", feature: "f" }, async () => 1);
    expect(rpcs()).toEqual(["credits_reserveren"]);
  });

  it("als terugstorten zelf faalt, krijgt de gebruiker toch de oorspronkelijke fout en wordt het gemeten", async () => {
    staat.terugstortenGooit = true;
    await expect(
      metCredits({ userId: "u1", feature: "f" }, async () => {
        throw new Error("AI viel om");
      }),
    ).rejects.toThrow("AI viel om");
    expect(gebruik()).toEqual([expect.objectContaining({ ok: false })]);
  });

  it("als afronden faalt na een geslaagde AI-taak, krijgt de gebruiker het resultaat (niet betalen voor niets)", async () => {
    staat.afrondenGooit = true;
    const uit = await metCredits({ userId: "u1", feature: "f" }, async () => "resultaat");
    expect(uit.resultaat).toBe("resultaat");
    expect(rpcs()).not.toContain("credits_terugstorten");
  });

  it("als de cache niet bereikbaar is na een geslaagde AI-taak, blijft het resultaat behouden", async () => {
    staat.upsertGooit = true;
    const uit = await metCredits(
      { userId: "u1", feature: "f", cacheSleutel: "k" },
      async () => "resultaat",
    );
    expect(uit.resultaat).toBe("resultaat");
    expect(rpcs()).toEqual(["credits_reserveren", "credits_afronden"]);
  });
});

describe("maandbudget (kostenrem)", () => {
  it("budgetOordeel: waarschuwen vanaf 80 %, blokkeren vanaf 100 %, 0 = geen budget ingesteld", () => {
    expect(budgetOordeel(10, 25)).toMatchObject({ mag: true, waarschuwen: false });
    expect(budgetOordeel(20, 25)).toMatchObject({ mag: true, waarschuwen: true });
    expect(budgetOordeel(25, 25)).toMatchObject({ mag: false, waarschuwen: true });
    expect(budgetOordeel(999, 0)).toMatchObject({ mag: true });
  });

  it("schatKost is nooit 0, zodat het budget ook zonder prijslijst meetelt", () => {
    expect(schatKost({ tokens_in: 0, tokens_out: 0, beelden: 0 })).toBeGreaterThan(0);
    expect(schatKost({ tokens_in: 1_000_000, tokens_out: 0, beelden: 0 })).toBeCloseTo(1, 5);
    expect(schatKost({ tokens_in: 0, tokens_out: 0, beelden: 2 })).toBeCloseTo(0.1, 5);
  });

  it("budget telt ook voorbij 1000 AI-oproepen per maand (BUG-093)", async () => {
    vi.useFakeTimers();
    try {
      // Andere maand dan de andere tests: verse budgetstand in het geheugen.
      vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
      staat.budget = 20;
      // 2500 oproepen van € 0,01 = € 25: boven het budget. Met alleen de eerste 1000 rijen
      // (zonder paginering) zou de rem € 10 zien en ten onrechte doorlaten.
      staat.uitgegeven = Array.from({ length: 2500 }, () => ({ kost_eur: 0.01 }));
      const run = vi.fn(async () => "ok");
      await expect(metCredits({ userId: "u1", feature: "import_url" }, run)).rejects.toThrow(
        /deze maand even op pauze/,
      );
      expect(run).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("budget op: geen reservering, geen AI-oproep, duidelijke melding; daarna weer vrij", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-20T10:00:00Z")); // eigen maand: verse budgetstand
      staat.budget = 5;
      staat.uitgegeven = [{ kost_eur: 3 }, { kost_eur: 2.5 }];
      const run = vi.fn(async () => "ok");
      await expect(metCredits({ userId: "u1", feature: "import_url" }, run)).rejects.toThrow(
        /deze maand even op pauze/,
      );
      expect(run).not.toHaveBeenCalled();
      expect(rpcs()).toEqual([]);
      expect(log.some((o) => o.naam === "ai_events" && o.actie === "insert")).toBe(true);
      // Budget verhoogd: na de geheugentijd (5 min) mag het weer.
      staat.budget = 50;
      vi.setSystemTime(new Date("2026-11-20T10:06:00Z"));
      await expect(metCredits({ userId: "u1", feature: "import_url" }, run)).resolves.toMatchObject(
        {
          resultaat: "ok",
        },
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
