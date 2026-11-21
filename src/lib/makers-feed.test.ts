import { describe, expect, it } from "vitest";
import { bouwFeed, feedWanneer, nieuwVanGevolgden } from "./makers-feed";
import type { Maker, Publicatie } from "./makers";

const maker = (id: string, naam: string): Maker => ({
  id,
  user_id: `u-${id}`,
  handle: naam.toLowerCase().replace(/\s+/g, "-"),
  naam,
  bio: null,
  specialisaties: [],
  omslag_url: null,
  avatar_url: null,
  geverifieerd: false,
});
const LOTTE = maker("m1", "Lotte kookt");
const GUST = maker("m2", "Groenten met Gust");

const pub = (recipe: string, creator: string, op: string, extra: Partial<Publicatie> = {}) =>
  ({
    id: `p-${recipe}`,
    recipe_id: recipe,
    creator_id: creator,
    zichtbaarheid: "openbaar",
    status: "gepubliceerd",
    gepubliceerd_op: op,
    video_url: null,
    moderatie: "goedgekeurd",
    ...extra,
  }) as Publicatie;
const recept = (id: string) => ({ id, title: `Recept ${id}`, image_url: null, category: null });

describe("bouwFeed", () => {
  const basis = {
    makers: [LOTTE, GUST],
    recepten: ["r1", "r2", "r3", "r4"].map(recept),
  };

  it("alleen gevolgde makers, nieuwste eerst", () => {
    const feed = bouwFeed({
      ...basis,
      gevolgd: new Set(["m1"]),
      publicaties: [
        pub("r1", "m1", "2026-11-01T10:00:00Z"),
        pub("r2", "m1", "2026-11-10T10:00:00Z"),
        pub("r3", "m2", "2026-11-12T10:00:00Z"),
      ],
    });
    expect(feed.map((f) => f.sleutel)).toEqual(["recept:r2", "recept:r1"]);
  });

  it("niets wat nog wacht op controle, privé of een concept is", () => {
    const feed = bouwFeed({
      ...basis,
      gevolgd: new Set(["m1"]),
      publicaties: [
        pub("r1", "m1", "2026-11-01T10:00:00Z", { moderatie: "wacht" }),
        pub("r2", "m1", "2026-11-02T10:00:00Z", { zichtbaarheid: "vrienden" }),
        pub("r3", "m1", "2026-11-03T10:00:00Z", { status: "concept" }),
        pub("r4", "m1", "2026-11-04T10:00:00Z", { moderatie: "afgewezen" }),
      ],
    });
    expect(feed).toEqual([]);
  });

  it("markeert video en exclusief", () => {
    const [f] = bouwFeed({
      ...basis,
      gevolgd: new Set(["m1"]),
      publicaties: [
        pub("r1", "m1", "2026-11-01T10:00:00Z", {
          video_url: "https://youtu.be/x",
          exclusief: true,
        }),
      ],
    });
    expect(f).toMatchObject({ soort: "recept", heeftVideo: true, exclusief: true });
  });

  it("collecties tellen alleen openbare recepten en komen chronologisch tussen de recepten", () => {
    const feed = bouwFeed({
      ...basis,
      gevolgd: new Set(["m1"]),
      publicaties: [
        pub("r1", "m1", "2026-11-01T10:00:00Z"),
        pub("r2", "m1", "2026-11-09T10:00:00Z"),
      ],
      collecties: [
        {
          id: "c1",
          user_id: "u-m1",
          naam: "Soepen",
          openbaar: true,
          created_at: "2026-11-05T10:00:00Z",
          collection_recipes: [{ recipe_id: "r1" }, { recipe_id: "geheim" }],
        },
        {
          id: "c2",
          user_id: "u-m1",
          naam: "Privé",
          openbaar: false,
          created_at: "2026-11-06T10:00:00Z",
          collection_recipes: [{ recipe_id: "r1" }],
        },
        {
          id: "c3",
          user_id: "u-m1",
          naam: "Leeg",
          openbaar: true,
          created_at: "2026-11-07T10:00:00Z",
          collection_recipes: [{ recipe_id: "geheim" }],
        },
      ],
    });
    expect(feed.map((f) => f.sleutel)).toEqual(["recept:r2", "collectie:c1", "recept:r1"]);
    const c = feed[1]!;
    expect(c.soort === "collectie" && c.collectie.aantal).toBe(1);
  });

  it("begrenst het aantal", () => {
    const publicaties = Array.from({ length: 40 }, (_, i) =>
      pub(`x${i}`, "m1", `2026-10-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`),
    );
    const feed = bouwFeed({
      makers: [LOTTE],
      recepten: publicaties.map((p) => recept(p.recipe_id)),
      gevolgd: new Set(["m1"]),
      publicaties,
      max: 10,
    });
    expect(feed).toHaveLength(10);
  });
});

describe("nieuwVanGevolgden", () => {
  const nu = new Date("2026-11-20T12:00:00Z");
  const feed = bouwFeed({
    makers: [LOTTE, GUST],
    recepten: ["r1", "r2", "r3"].map(recept),
    gevolgd: new Set(["m1", "m2"]),
    publicaties: [
      pub("r1", "m1", "2026-11-19T10:00:00Z"),
      pub("r2", "m1", "2026-11-01T10:00:00Z"),
      pub("r3", "m2", "2026-11-18T10:00:00Z"),
    ],
  });

  it("alleen wat na het volgen verscheen en niet ouder dan 14 dagen", () => {
    const m = nieuwVanGevolgden(
      feed,
      [
        { creator_id: "m1", created_at: "2026-10-01T10:00:00Z" },
        { creator_id: "m2", created_at: "2026-11-19T00:00:00Z" },
      ],
      nu,
    );
    expect(m.map((x) => x.id)).toEqual(["maker:r1"]);
    expect(m[0]!.tekst).toBe("Lotte kookt deelde een nieuw recept: Recept r1");
    expect(m[0]!.link).toBe("/recepten/r1");
  });

  it("niet gevolgd = geen melding; onbekende volgdatum = alles van de laatste 14 dagen", () => {
    expect(nieuwVanGevolgden(feed, [], nu)).toEqual([]);
    expect(nieuwVanGevolgden(feed, [{ creator_id: "m2" }], nu).map((x) => x.id)).toEqual([
      "maker:r3",
    ]);
  });

  it("geen meldingen uit de toekomst (verkeerde klok)", () => {
    expect(
      nieuwVanGevolgden(feed, [{ creator_id: "m1" }], new Date("2026-11-19T09:00:00Z")).map(
        (x) => x.id,
      ),
    ).toEqual([]);
  });
});

describe("feedWanneer", () => {
  const nu = new Date(2026, 10, 20, 15, 0);
  it("gewone taal", () => {
    expect(feedWanneer(new Date(2026, 10, 20, 8).toISOString(), nu)).toBe("vandaag");
    expect(feedWanneer(new Date(2026, 10, 19, 22).toISOString(), nu)).toBe("gisteren");
    expect(feedWanneer(new Date(2026, 10, 16, 9).toISOString(), nu)).toBe("4 dagen geleden");
    expect(feedWanneer(new Date(2026, 9, 12, 9).toISOString(), nu)).toBe("12 oktober");
    expect(feedWanneer("geen datum", nu)).toBe("");
  });
});
