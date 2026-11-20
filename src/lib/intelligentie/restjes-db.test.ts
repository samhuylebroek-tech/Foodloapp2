import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  afgeslotenRestjes,
  bewaarRestje,
  heropenRestje,
  merkWeg,
  restjes,
  sluitRestje,
  verspillingVanMaand,
  wegGemerkt,
  zetRestjeTerug,
  type Restje,
} from "./restjes";
import { naarRij, vanRij, voegSamen } from "./restjes-db";
import { herkenOpdracht } from "@/lib/assistent/opdrachten";

const opslag = new Map<string, string>();
beforeEach(() => {
  opslag.clear();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (s: string) => opslag.get(s) ?? null,
      setItem: (s: string, v: string) => void opslag.set(s, v),
    },
  };
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

const NU = new Date(2026, 10, 18, 19).getTime();
const UUID1 = "11111111-aaaa-4aaa-8aaa-000000000001";
const UUID2 = "11111111-aaaa-4aaa-8aaa-000000000002";
const r = (id: string, extra: Partial<Restje> = {}): Restje => ({
  id,
  titel: `Restje ${id.slice(-1)}`,
  receptId: null,
  porties: 2,
  gekookt: NU,
  ...extra,
});

describe("restjes: afloop en verspilling", () => {
  it("opgegeten: uit de lijst, in het overzicht; ongedaan maken zet het terug", () => {
    const x = bewaarRestje("u", { titel: "Soep", receptId: null, porties: 3 }, NU);
    const weg = sluitRestje("u", x.id, "opgegeten", NU + 1000);
    expect(restjes("u", NU)).toEqual([]);
    expect(afgeslotenRestjes("u")).toMatchObject([
      { titel: "Soep", status: "opgegeten", porties: 3 },
    ]);
    heropenRestje("u", weg!);
    expect(restjes("u", NU).map((y) => y.titel)).toEqual(["Soep"]);
    expect(afgeslotenRestjes("u")).toEqual([]);
  });
  it("overzicht per maand telt porties, met aandeel weggegooid; andere maand telt niet", () => {
    const nov = new Date(2026, 10, 5).getTime();
    const okt = new Date(2026, 9, 30).getTime();
    const v = verspillingVanMaand(
      [
        { porties: 3, status: "opgegeten", op: nov },
        { porties: 1, status: "weggegooid", op: nov },
        { porties: 5, status: "weggegooid", op: okt },
      ],
      "2026-11",
    );
    expect(v).toEqual({ maand: "2026-11", opgegeten: 3, weggegooid: 1, procentWeg: 25 });
    expect(verspillingVanMaand([], "2026-11").procentWeg).toBeNull();
  });
  it("opnieuw bewaren dezelfde dag houdt dezelfde id (geen tweede rij op het account)", () => {
    const a = bewaarRestje("u", { titel: "Soep", receptId: "r", porties: 2 }, NU);
    const b = bewaarRestje("u", { titel: "Soep", receptId: "r", porties: 4 }, NU + 60_000);
    expect(b.id).toBe(a.id);
    expect(restjes("u", NU)).toHaveLength(1);
  });
  it("terugzetten wist de 'weg'-markering", () => {
    merkWeg("u", "x1", NU);
    expect(wegGemerkt("u").has("x1")).toBe(true);
    zetRestjeTerug("u", r("x1"));
    expect(wegGemerkt("u").has("x1")).toBe(false);
  });
});

describe("restjes: samenvoegen met het account", () => {
  it("account is de waarheid voor wat er stond; nieuw op het toestel gaat mee", () => {
    const lokaal = [
      r(UUID1, { bron: "account", porties: 1 }),
      r("oud-id"), // van vóór 0019: krijgt een uuid
      r("zzz", { bron: "account" }), // niet meer op het account (gezinslid at het op)
    ];
    const account = [r(UUID1, { bron: "account", porties: 3 }), r(UUID2, { bron: "account" })];
    const s = voegSamen(lokaal, account, new Set());
    expect(s.lijst.find((x) => x.id === UUID1)?.porties).toBe(3);
    expect(s.lijst.some((x) => x.id === UUID2)).toBe(true);
    expect(s.lijst.some((x) => x.id === "zzz")).toBe(false);
    expect(s.versturen).toHaveLength(1);
    expect(s.versturen[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.versturen[0]!.titel).toBe("Restje d");
  });
  it("vuil (offline gewijzigd) wint van het account en wordt opnieuw verstuurd", () => {
    const s = voegSamen(
      [r(UUID1, { bron: "account", vuil: true, gepland: "2026-11-19" })],
      [r(UUID1, { bron: "account" })],
      new Set(),
    );
    expect(s.lijst[0]!.gepland).toBe("2026-11-19");
    expect(s.versturen.map((x) => x.id)).toEqual([UUID1]);
    expect(s.lijst[0]!.vuil).toBeUndefined();
  });
  it("verwijderd op het toestel komt niet terug en wordt op het account gewist", () => {
    const s = voegSamen([], [r(UUID1, { bron: "account" })], new Set([UUID1]));
    expect(s.lijst).toEqual([]);
    expect(s.wissen).toEqual([UUID1]);
  });
  it("op het toestel afgesloten: niet terug in de lijst, afloop naar het account", () => {
    const s = voegSamen(
      [],
      [r(UUID1, { bron: "account" })],
      new Set(),
      new Map([[UUID1, "weggegooid"]]),
    );
    expect(s.lijst).toEqual([]);
    expect(s.sluiten).toEqual([{ id: UUID1, status: "weggegooid" }]);
  });
  it("rij heen en terug: zelfde restje; restje van een gezinslid blijft van dat lid", () => {
    const x = r(UUID1, { receptId: "rec", gepland: "2026-11-20" });
    const rij = naarRij(x, "ik", "gezin");
    expect(rij).toMatchObject({
      user_id: "ik",
      group_id: "gezin",
      status: "bewaard",
      gepland_op: "2026-11-20",
    });
    expect(vanRij(rij)).toMatchObject({
      id: UUID1,
      receptId: "rec",
      gepland: "2026-11-20",
      door: "ik",
    });
    expect(naarRij({ ...x, door: "jan" }, "ik", "gezin").user_id).toBe("jan");
  });
});

describe("assistent: restjes", () => {
  it.each(["Wat kan ik met mijn restjes?", "nog restjes over", "wat doe ik met het overschot"])(
    "herkent '%s'",
    (zin) => {
      const h = herkenOpdracht(zin, { vandaag: "2026-11-18" });
      expect(h.ok && h.opdracht.soort).toBe("restjes");
    },
  );
});
