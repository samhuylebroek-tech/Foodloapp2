import { describe, expect, it } from "vitest";
import { AVG_SECTIES, verzamelPersoonsgegevens } from "./avg-export.server";

const IK = "11111111-1111-4111-8111-111111111111";
const ANDER = "22222222-2222-4222-8222-222222222222";

type Rij = Record<string, unknown>;
type Oproep = { tabel: string; filters: [string, unknown][] };

/** Kleine nep-databank die wél filtert en, zoals PostgREST, max. 1000 rijen per verzoek geeft. */
function nepDb(tabellen: Record<string, Rij[]>) {
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
        then(ok: (r: { data: Rij[]; error: null }) => unknown) {
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
          (["user_id", "id", "owner_id", "member_id"].includes(k) && v === IK) ||
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
});
