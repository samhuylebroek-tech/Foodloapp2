// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  bccTotalen,
  bewaarRegel,
  kleineKost,
  leesLog,
  naarDagtotalen,
  overzicht,
  voegSamen,
  voegToe,
} from "./gebruik-log";
import {
  cacheSleutel,
  CACHE_GELDIG_MS,
  CACHE_MAX,
  hashVan,
  inCache,
  uitCache,
  zet,
  zoek,
} from "./vraag-cache";
import { nogVandaag, registreerCache, registreerVraag, DAGLIMIET } from "@/lib/assistent/gebruik";

beforeEach(() => window.localStorage.clear());

describe("AI-gebruik: teller en daglimiet", () => {
  it("telt per dag en soort; cache telt niet mee voor de limiet", () => {
    const nu = new Date("2026-11-20T10:00:00");
    for (let i = 0; i < 3; i++) registreerVraag("u1", "kookhulp.vervang", nu);
    registreerVraag("u1", "weekassistent", nu);
    registreerCache("u1", "kookhulp.vervang", nu);
    expect(nogVandaag("u1", nu)).toBe(DAGLIMIET - 4);
    const o = overzicht(naarDagtotalen(leesLog("u1")), "2026-11-20", DAGLIMIET);
    expect(o.vandaag).toBe(4);
    expect(o.maand).toBe(4);
    expect(o.uitCache).toBe(1);
    expect(o.perSoort.map((s) => [s.soort, s.maand])).toEqual([
      ["kookhulp.vervang", 3],
      ["weekassistent", 1],
    ]);
    expect(o.kostCent).toBeGreaterThan(0);
  });

  it("bewaart geen inhoud: alleen dag, soort en cache", () => {
    registreerVraag("u1", "kookhulp.vraag", new Date("2026-11-20T10:00:00"));
    const ruw = window.localStorage.getItem("foodlo:ai-gebruik:u1")!;
    expect(JSON.parse(ruw)).toEqual([{ dag: "2026-11-20", soort: "kookhulp.vraag" }]);
  });

  it("limiet bereikt: rest 0; morgen opnieuw vol", () => {
    const dag = new Date("2026-11-20T10:00:00");
    for (let i = 0; i < DAGLIMIET + 2; i++) registreerVraag("u1", "kookhulp.vraag", dag);
    expect(nogVandaag("u1", dag)).toBe(0);
    expect(overzicht(naarDagtotalen(leesLog("u1")), "2026-11-20", DAGLIMIET).rest).toBe(0);
    expect(nogVandaag("u1", new Date("2026-11-21T10:00:00"))).toBe(DAGLIMIET);
  });

  it("oude regels (> 40 dagen) en vorige maanden tellen niet; foute opslag breekt niets", () => {
    const log = voegToe([{ dag: "2026-09-01", soort: "weekassistent" }], {
      dag: "2026-11-20",
      soort: "weekassistent",
    });
    expect(log).toHaveLength(1);
    window.localStorage.setItem("foodlo:ai-gebruik:u2", "{kapot");
    expect(leesLog("u2")).toEqual([]);
    expect(
      overzicht([{ dag: "2026-10-31", soort: "weekassistent", aantal: 5 }], "2026-11-20", 20).maand,
    ).toBe(0);
  });

  it("toestel en account samen: per dag en soort het maximum, nooit dubbel", () => {
    const s = voegSamen(
      [{ dag: "2026-11-20", soort: "kookhulp.vraag", aantal: 2, cache: 1 }],
      [
        { dag: "2026-11-20", soort: "kookhulp.vraag", aantal: 5, cache: 0 },
        { dag: "2026-11-19", soort: "weekassistent", aantal: 1 },
      ],
    );
    expect(overzicht(s, "2026-11-20", 20)).toMatchObject({ vandaag: 5, maand: 6, uitCache: 1 });
  });

  it("BCC: alleen totalen per soort met geschatte kost per actie", () => {
    const t = bccTotalen(
      [
        { dag: "2026-11-20", soort: "kookhulp.vervang", aantal: 100, uit_cache: 20 },
        { dag: "2026-11-02", soort: "weekassistent", aantal: 10 },
        { dag: "2026-10-30", soort: "weekassistent", aantal: 999 },
      ],
      "2026-11-20",
    );
    expect(t.maand).toBe(110);
    expect(t.vandaag).toBe(100);
    expect(t.cache).toBe(20);
    expect(t.lijst[0]).toMatchObject({
      soort: "kookhulp.vervang",
      kostCent: 5,
      kostPerActieCent: 0.05,
    });
    expect(kleineKost(0.05)).toBe("minder dan € 0,01");
    expect(kleineKost(5.3)).toBe("€ 0,05");
  });

  it("bewaarRegel negeert onbekende soorten bij het lezen", () => {
    window.localStorage.setItem(
      "foodlo:ai-gebruik:u3",
      JSON.stringify([{ dag: "2026-11-20", soort: "iets", vraag: "geheim" }]),
    );
    bewaarRegel("u3", { dag: "2026-11-20", soort: "weekassistent" });
    expect(leesLog("u3")).toEqual([{ dag: "2026-11-20", soort: "weekassistent" }]);
  });
});

describe("AI-cache: identieke vragen", () => {
  it("zelfde vraag (hoofdletters, spaties, accenten) = zelfde sleutel; ander recept = andere", () => {
    expect(cacheSleutel("vervang", "Room ", "Stoofvlees")).toBe(
      cacheSleutel("vervang", "room", "stoofvlees"),
    );
    expect(cacheSleutel("vervang", "room", "Soep")).not.toBe(
      cacheSleutel("vervang", "room", "Stoofvlees"),
    );
    expect(cacheSleutel("vraag", "room")).not.toBe(cacheSleutel("vervang", "room"));
    expect(hashVan("abc")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("geldig 24 uur, daarna weg; hooguit 50 antwoorden", () => {
    const r = zet([], "k", { a: 1 }, 1000);
    expect(zoek(r, "k", 1000 + CACHE_GELDIG_MS - 1)).toEqual({ a: 1 });
    expect(zoek(r, "k", 1000 + CACHE_GELDIG_MS)).toBeNull();
    let veel = r;
    for (let i = 0; i < 80; i++) veel = zet(veel, `k${i}`, { a: i }, 2000);
    expect(veel).toHaveLength(CACHE_MAX);
  });

  it("per gebruiker op het toestel; de vraagtekst zelf wordt niet bewaard", () => {
    const k = cacheSleutel("vraag", "hoe lang kook ik pasta", "");
    inCache("u1", k, { bron: "test", antwoord: "10 min" });
    expect(uitCache("u1", k)).toEqual({ bron: "test", antwoord: "10 min" });
    expect(uitCache("u2", k)).toBeNull();
    expect(window.localStorage.getItem("foodlo:ai-cache:u1")).not.toContain("pasta");
  });
});
