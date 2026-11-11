import { describe, expect, it } from "vitest";
import {
  draagGezinnenOver,
  fotosTeWissen,
  nieuweEigenaar,
  ruimFotosOp,
} from "./account-opruimen.server";

type Rij = Record<string, unknown>;

/** Kleine nep-databank met opslag, genoeg voor de opruimstappen. */
function nep(tabellen: Record<string, Rij[]>, opslag: string[]) {
  const bestanden = new Set(opslag);
  const db = {
    from(tabel: string) {
      const filters: ((r: Rij) => boolean)[] = [];
      let actie: { soort: "lees" } | { soort: "wijzig"; v: Rij } | { soort: "wis" } = {
        soort: "lees",
      };
      const q = {
        select: () => q,
        order: () => q,
        update(v: Rij) {
          actie = { soort: "wijzig", v };
          return q;
        },
        delete() {
          actie = { soort: "wis" };
          return q;
        },
        eq(k: string, v: unknown) {
          filters.push((r) => r[k] === v);
          return q;
        },
        neq(k: string, v: unknown) {
          filters.push((r) => r[k] !== v);
          return q;
        },
        in(k: string, v: unknown[]) {
          filters.push((r) => v.includes(r[k]));
          return q;
        },
        then(ok: (r: { data: Rij[]; error: null }) => unknown) {
          const t = (tabellen[tabel] ??= []);
          const raak = t.filter((r) => filters.every((f) => f(r)));
          if (actie.soort === "wijzig") for (const r of raak) Object.assign(r, actie.v);
          if (actie.soort === "wis") tabellen[tabel] = t.filter((r) => !raak.includes(r));
          return Promise.resolve({ data: raak, error: null }).then(ok);
        },
      };
      return q;
    },
    storage: {
      from: () => ({
        list: (map: string, o: { limit: number; offset: number }) =>
          Promise.resolve({
            data: [...bestanden]
              .filter((p) => p.startsWith(`${map}/`))
              .map((p) => ({ name: p.slice(map.length + 1) }))
              .slice(o.offset, o.offset + o.limit),
            error: null,
          }),
        remove: (paden: string[]) => {
          for (const p of paden) bestanden.delete(p);
          return Promise.resolve({ data: paden.map((name) => ({ name })), error: null });
        },
      }),
    },
  };
  return { db, tabellen, bestanden };
}

const A = "eigenaar";
const C = "gezinslid";

describe("nieuweEigenaar / fotosTeWissen (zuivere regels)", () => {
  it("langst actieve ander lid, nooit de vertrekker of een uitgenodigde", () => {
    const leden = [
      { user_id: A, status: "actief", created_at: "2026-01-01" },
      { user_id: "nieuw", status: "actief", created_at: "2026-05-01" },
      { user_id: C, status: "actief", created_at: "2026-02-01" },
      { user_id: "uitgenodigd", status: "uitgenodigd", created_at: "2025-01-01" },
    ];
    expect(nieuweEigenaar(leden, A)).toBe(C);
    expect(nieuweEigenaar([{ user_id: A, status: "actief", created_at: null }], A)).toBeNull();
  });
  it("houdt foto's die anderen gebruiken", () => {
    expect(fotosTeWissen(["a/1.jpg", "a/2.jpg"], new Set(["a/2.jpg"]))).toEqual({
      wissen: ["a/1.jpg"],
      behouden: ["a/2.jpg"],
    });
  });
});

describe("draagGezinnenOver (BUG-110)", () => {
  it("geeft het gezin en de gezinslijst aan het langst actieve lid", async () => {
    const { db, tabellen } = nep(
      {
        groups: [{ id: "g1", owner_id: A }],
        group_members: [
          { group_id: "g1", user_id: A, status: "actief", created_at: "2026-01-01" },
          { group_id: "g1", user_id: C, status: "actief", created_at: "2026-02-01" },
        ],
        shopping_lists: [
          { id: "l1", group_id: "g1", user_id: A },
          { id: "l2", group_id: null, user_id: A },
        ],
      },
      [],
    );
    expect(await draagGezinnenOver(db, A)).toEqual({ overgedragen: 1, gewist: 0 });
    expect(tabellen["groups"]![0]!["owner_id"]).toBe(C);
    expect(tabellen["shopping_lists"]!.find((l) => l["id"] === "l1")!["user_id"]).toBe(C);
    // Een eigen privélijst blijft van de vertrekker (verdwijnt met het account).
    expect(tabellen["shopping_lists"]!.find((l) => l["id"] === "l2")!["user_id"]).toBe(A);
  });
  it("wist een gezin zonder andere actieve leden", async () => {
    const { db, tabellen } = nep(
      {
        groups: [{ id: "g1", owner_id: A }],
        group_members: [
          { group_id: "g1", user_id: A, status: "actief", created_at: "2026-01-01" },
          { group_id: "g1", user_id: "x", status: "uitgenodigd", created_at: "2026-01-02" },
        ],
      },
      [],
    );
    expect(await draagGezinnenOver(db, A)).toEqual({ overgedragen: 0, gewist: 1 });
    expect(tabellen["groups"]).toEqual([]);
  });
  it("raakt gezinnen van anderen niet", async () => {
    const { db, tabellen } = nep({ groups: [{ id: "g2", owner_id: "iemand" }] }, []);
    expect(await draagGezinnenOver(db, A)).toEqual({ overgedragen: 0, gewist: 0 });
    expect(tabellen["groups"]).toHaveLength(1);
  });
});

describe("ruimFotosOp (BUG-025)", () => {
  it("wist eigen foto's, behalve wat een ander recept of Inspiratie nog gebruikt", async () => {
    const { db, bestanden } = nep(
      {
        recipes: [
          { id: "rc", user_id: C, image_url: `${A}/bewaard-door-c.jpg` },
          { id: "rx", user_id: "x", image_url: null },
        ],
        recipe_photos: [{ recipe_id: "rx", path: `${A}/extra-bij-recept-van-x.jpg` }],
        inspiration_recipes: [{ id: "i1", image_url: `${A}/inspiratie.jpg` }],
      },
      [
        `${A}/eigen.jpg`,
        `${A}/bewaard-door-c.jpg`,
        `${A}/extra-bij-recept-van-x.jpg`,
        `${A}/inspiratie.jpg`,
        `${C}/van-c.jpg`,
      ],
    );
    expect(await ruimFotosOp(db, A)).toEqual({ gewist: 1, behouden: 3 });
    expect([...bestanden].sort()).toEqual(
      [
        `${A}/bewaard-door-c.jpg`,
        `${A}/extra-bij-recept-van-x.jpg`,
        `${A}/inspiratie.jpg`,
        `${C}/van-c.jpg`,
      ].sort(),
    );
  });
  it("raakt nooit de map van iemand anders", async () => {
    const { db, bestanden } = nep({}, [`${C}/van-c.jpg`]);
    expect(await ruimFotosOp(db, A)).toEqual({ gewist: 0, behouden: 0 });
    expect([...bestanden]).toEqual([`${C}/van-c.jpg`]);
  });
});
