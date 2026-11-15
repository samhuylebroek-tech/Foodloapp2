import { describe, expect, it } from "vitest";
import { AVG_SECTIES, verzamelPersoonsgegevens } from "./avg-export.server";

const IK = "11111111-1111-4111-8111-111111111111";
const ANDER = "22222222-2222-4222-8222-222222222222";

type Rij = Record<string, unknown>;
type Oproep = { tabel: string; filters: [string, unknown][] };

/** Kleine nep-databank die wél filtert en, zoals PostgREST, max. 1000 rijen per verzoek geeft. */
function nepDb(tabellen: Record<string, Rij[]>, ontbreekt: string[] = [], kapot: string[] = []) {
  const oproepen: Oproep[] = [];
  const db = {
    from(tabel: string) {
      const o: Oproep = { tabel, filters: [] };
      oproepen.push(o);
      let van = 0;
      let tot = 999;
      const q = {
        select: () => q,
        order: () => q,
        eq(kolom: string, waarde: unknown) {
          o.filters.push([kolom, waarde]);
          return q;
        },
        in(kolom: string, waarden: unknown[]) {
          o.filters.push([kolom, waarden]);
          return q;
        },
        range(a: number, b: number) {
          van = a;
          tot = Math.min(b, a + 999);
          return q;
        },
        then(ok: (r: { data: Rij[] | null; error: unknown }) => unknown) {
          if (ontbreekt.includes(tabel))
            return Promise.resolve({
              data: null,
              error: { code: "42P01", message: `relation "public.${tabel}" does not exist` },
            }).then(ok);
          if (kapot.includes(tabel))
            return Promise.resolve({
              data: null,
              error: { code: "57014", message: "timeout" },
            }).then(ok);
          const rijen = (tabellen[tabel] ?? []).filter((r) =>
            o.filters.every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v)),
          );
          return Promise.resolve({ data: rijen.slice(van, tot + 1), error: null }).then(ok);
        },
      };
      return q;
    },
  };
  return { db, oproepen };
}

function wereld() {
  const recepten = [
    ...Array.from({ length: 1205 }, (_, i) => ({ id: `r${i}`, user_id: IK, title: `Recept ${i}` })),
    { id: "x1", user_id: ANDER, title: "Van iemand anders" },
  ];
  return {
    profiles: [
      { id: IK, display_name: "Ik" },
      { id: ANDER, display_name: "Ander" },
    ],
    recipes: recepten,
    recipe_ingredients: [
      ...recepten.map((r, i) => ({ id: `i${i}`, recipe_id: r.id, name: "zout" })),
    ],
    recipe_photos: [
      { id: "p1", recipe_id: "r0", path: `${IK}/a.jpg` },
      { id: "p2", recipe_id: "x1", path: `${ANDER}/b.jpg` },
    ],
    pantry_items: [
      { id: "v1", user_id: IK, naam: "rijst" },
      { id: "v2", user_id: ANDER, naam: "geheim" },
    ],
    shares: [
      { id: "s1", owner_id: IK, member_id: ANDER, status: "accepted" },
      {
        id: "s2",
        owner_id: ANDER,
        member_id: "33333333-3333-4333-8333-333333333333",
        status: "accepted",
      },
    ],
    loyalty_cards: [{ id: "k1", user_id: IK, winkel_naam: "Winkel", nummer: "1234567890" }],
    push_subscriptions: [
      { id: "t1", user_id: IK, p256dh: "geheim-sleutel", endpoint: "https://push.voorbeeld/x" },
    ],
    feedback: [
      { id: "f1", user_id: IK, message: "mijn ticket" },
      { id: "f2", user_id: ANDER, message: "ander ticket" },
    ],
    persoonlijke_voeding: [
      { user_id: IK, allergieen: ["sesam"] },
      { user_id: ANDER, allergieen: ["geheim-allergie"] },
    ],
    huishouden_leden: [
      { id: "h1", naam: "Ik", user_id: IK, beheerder_id: IK },
      { id: "h2", naam: "Mijn kind", user_id: null, beheerder_id: IK },
      { id: "h3", naam: "Kind van ander", user_id: null, beheerder_id: ANDER },
    ],
    lid_voeding: [
      { lid_id: "h2", allergieen: ["noten"] },
      { lid_id: "h3", allergieen: ["geheim-kind"] },
    ],
    creators: [
      { id: "c1", user_id: IK, naam: "Mijn keuken" },
      { id: "c2", user_id: ANDER, naam: "Andere keuken" },
    ],
    recipe_publicaties: [
      { id: "rp1", creator_id: "c1", recipe_id: "r0" },
      { id: "rp2", creator_id: "c2", recipe_id: "x1" },
    ],
    follows: [
      { id: "fo1", follower_id: IK, creator_id: "c2" },
      { id: "fo2", follower_id: ANDER, creator_id: "c1" },
    ],
    collections: [
      { id: "co1", user_id: IK, naam: "Mijn soepen" },
      { id: "co2", user_id: ANDER, naam: "Geheime map" },
    ],
    collection_recipes: [
      { id: "cr1", collection_id: "co1", recipe_id: "r1" },
      { id: "cr2", collection_id: "co2", recipe_id: "x1" },
    ],
    community_bijdragen: [{ id: "b1", user_id: IK, tekst: "Lekker!" }],
    content_meldingen: [
      { id: "m1", melder_id: IK, soort: "recept", doel_id: "x1", reden: "anders" },
    ],
    partner_aanvragen: [{ id: "pa1", user_id: IK, bedrijf: "Mijn bakkerij" }],
    partner_leden: [{ id: "pl1", user_id: IK, partner_id: "p1", rol: "eigenaar" }],
    abonnementen: [{ id: "ab1", user_id: IK, provider: "test", status: "actief" }],
    facturen: [
      { id: "fa1", user_id: IK, nummer: "TEST-001" },
      { id: "fa2", user_id: ANDER, nummer: "TEST-999" },
    ],
    entitlements: [{ id: "e1", user_id: IK, soort: "premium" }],
  } as Record<string, Rij[]>;
}

describe("AVG-export (BUG-026/103)", () => {
  it("bevat elke sectie", async () => {
    const { db } = nepDb(wereld());
    const uit = await verzamelPersoonsgegevens(db, IK);
    for (const s of AVG_SECTIES) expect(uit, s).toHaveProperty(s);
  });

  it("filtert elke query op de gebruiker of op diens eigen recepten", async () => {
    const { db, oproepen } = nepDb(wereld());
    await verzamelPersoonsgegevens(db, IK);
    expect(oproepen.length).toBeGreaterThan(30);
    for (const o of oproepen) {
      const ok = o.filters.some(
        ([k, v]) =>
          ([
            "user_id",
            "id",
            "owner_id",
            "member_id",
            "beheerder_id",
            "follower_id",
            "melder_id",
          ].includes(k) &&
            v === IK) ||
          // Rijen die horen bij eigen rijen (eigen gezinsleden, makerprofiel, verzamelingen).
          (k === "lid_id" &&
            Array.isArray(v) &&
            v.every((id) => ["h1", "h2"].includes(String(id)))) ||
          (k === "creator_id" && Array.isArray(v) && v.every((id) => id === "c1")) ||
          (k === "collection_id" && Array.isArray(v) && v.every((id) => id === "co1")) ||
          (k === "recipe_id" && Array.isArray(v) && v.every((id) => String(id).startsWith("r"))),
      );
      expect(ok, `${o.tabel} zonder filter op de gebruiker: ${JSON.stringify(o.filters)}`).toBe(
        true,
      );
    }
  });

  it("neemt nooit gegevens van een andere gebruiker mee", async () => {
    const { db } = nepDb(wereld());
    const tekst = JSON.stringify(await verzamelPersoonsgegevens(db, IK));
    expect(tekst).not.toContain("Van iemand anders");
    expect(tekst).not.toContain("geheim");
    expect(tekst).not.toContain("ander ticket");
    expect(tekst).not.toContain(`${ANDER}/b.jpg`);
    expect(tekst).not.toContain('"s2"');
  });

  it("laat geheimen weg, ook als de databank hele rijen teruggeeft", async () => {
    const { db } = nepDb(wereld());
    const tekst = JSON.stringify(await verzamelPersoonsgegevens(db, IK));
    expect(tekst).toContain("Winkel");
    expect(tekst).not.toContain("1234567890");
    expect(tekst).not.toContain("geheim-sleutel");
    expect(tekst).not.toContain("push.voorbeeld");
  });

  it("is volledig voorbij de 1000-rijengrens (1205 recepten en ingrediënten)", async () => {
    const { db } = nepDb(wereld());
    const uit = await verzamelPersoonsgegevens(db, IK);
    expect(uit.recepten).toHaveLength(1205);
    expect(uit.ingredienten).toHaveLength(1205);
    expect(uit.receptfotos).toHaveLength(1);
  });

  it("neemt de eigen rijen van de nieuwe modules mee, en niets van een ander", async () => {
    const { db } = nepDb(wereld());
    const uit = await verzamelPersoonsgegevens(db, IK);
    expect(uit.mijn_voeding).toEqual([{ user_id: IK, allergieen: ["sesam"] }]);
    expect((uit.huishouden_leden as Rij[]).map((l) => l["id"]).sort()).toEqual(["h1", "h2"]);
    expect(uit.huishouden_voeding).toEqual([{ lid_id: "h2", allergieen: ["noten"] }]);
    expect(uit.maker_publicaties).toHaveLength(1);
    expect(uit.volgt).toHaveLength(1);
    expect(uit.verzameling_recepten).toEqual([
      { id: "cr1", collection_id: "co1", recipe_id: "r1" },
    ]);
    expect(uit.facturen).toHaveLength(1);
    expect(uit.abonnementen).toHaveLength(1);
    expect(uit.partner_aanvragen).toHaveLength(1);
    expect(uit.toegangsrechten).toHaveLength(1);
    const tekst = JSON.stringify(uit);
    for (const geheim of [
      "geheim-allergie",
      "geheim-kind",
      "Kind van ander",
      "Geheime map",
      "TEST-999",
      "Andere keuken",
    ])
      expect(tekst).not.toContain(geheim);
  });

  it("faalt niet als de nieuwe tabellen nog niet bestaan (productie vóór de migratie)", async () => {
    const nieuw = [
      "persoonlijke_voeding",
      "huishouden_leden",
      "lid_voeding",
      "creators",
      "recipe_publicaties",
      "follows",
      "collections",
      "collection_recipes",
      "community_bijdragen",
      "content_meldingen",
      "partner_aanvragen",
      "partner_leden",
      "abonnementen",
      "facturen",
      "entitlements",
    ];
    const { db } = nepDb(wereld(), nieuw);
    const uit = await verzamelPersoonsgegevens(db, IK);
    expect(uit.recepten).toHaveLength(1205);
    expect(uit.mijn_voeding).toEqual([]);
    expect(uit.huishouden_voeding).toEqual([]);
    expect(uit.facturen).toEqual([]);
  });

  it("een andere fout bij een nieuwe tabel laat de export wel falen (geen half bestand)", async () => {
    const { db } = nepDb(wereld(), [], ["facturen"]);
    await expect(verzamelPersoonsgegevens(db, IK)).rejects.toThrow();
  });
});
