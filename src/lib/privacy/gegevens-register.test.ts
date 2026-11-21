import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GEGEVENS_REGISTER, NIET_PERSOONLIJK, registerTabellen } from "./gegevens-register";
import { bestaatNiet, ruimCommunityFotosOp, ruimRegisterOp } from "@/lib/account-opruimen.server";

const MAP = path.resolve(import.meta.dirname, "../../../docs/foodloapp-v2/migratie-voorstel");
const voorstellen = readdirSync(MAP)
  .filter((b) => /^00(0[89]|1\d|2\d)_.*\.up\.sql$/.test(b))
  .map((b) => readFileSync(path.join(MAP, b), "utf8"));

describe("gegevensregister: volledig voor de migratievoorstellen 0008–0025", () => {
  it("elke nieuwe tabel staat in het register of is bewust niet persoonlijk", () => {
    const tabellen = new Set<string>();
    for (const sql of voorstellen)
      for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)/g))
        tabellen.add(m[1]!);
    const inRegister = new Set(registerTabellen());
    const ontbreekt = [...tabellen].filter((t) => !inRegister.has(t) && !NIET_PERSOONLIJK[t]);
    expect(ontbreekt).toEqual([]);
    expect(tabellen.size).toBeGreaterThan(30);
  });

  it("elke kolom die naar auth.users verwijst, staat in het register", () => {
    const ontbreekt: string[] = [];
    const sleutels = new Set(GEGEVENS_REGISTER.map((r) => `${r.tabel}.${r.kolom}`));
    for (const sql of voorstellen) {
      for (const blok of sql.matchAll(/CREATE TABLE public\.(\w+) \(([\s\S]*?)\n\);/g)) {
        for (const k of blok[2]!.matchAll(/^\s*(\w+) uuid[^\n]*REFERENCES auth\.users/gm))
          if (!sleutels.has(`${blok[1]}.${k[1]}`)) ontbreekt.push(`${blok[1]}.${k[1]}`);
      }
      for (const m of sql.matchAll(
        /ALTER TABLE public\.(\w+)\s+ADD COLUMN (\w+) uuid[^;]*REFERENCES auth\.users/g,
      ))
        if (!sleutels.has(`${m[1]}.${m[2]}`)) ontbreekt.push(`${m[1]}.${m[2]}`);
    }
    expect(ontbreekt).toEqual([]);
  });

  it("anonimiseren heeft altijd een reden in gewone taal (behalve een vervolg op een via-regel)", () => {
    const zonder = GEGEVENS_REGISTER.filter(
      (r) => r.actie === "anonimiseren" && !r.reden && r.tabel !== "kookmomenten",
    );
    expect(zonder).toEqual([]);
  });

  it("via-regels staan vóór de regel die de ouder wist", () => {
    GEGEVENS_REGISTER.forEach((r, i) => {
      if (!r.via) return;
      const ouderWeg = GEGEVENS_REGISTER.findIndex(
        (o) => o.tabel === r.via!.ouder && o.kolom === r.via!.ouderKolom && o.actie === "wissen",
      );
      expect(ouderWeg, `${r.tabel}.${r.kolom}`).toBeGreaterThan(i);
    });
  });
});

type Rij = Record<string, unknown>;
function nep(
  tabellen: Record<string, Rij[]>,
  opties: { ontbreekt?: string[]; faalt?: string[] } = {},
) {
  const bestanden = new Set<string>(
    (tabellen["__opslag"] ?? []).map((o) => `${o["bucket"]}|${o["name"]}`),
  );
  const db = {
    from(tabel: string) {
      const filters: ((r: Rij) => boolean)[] = [];
      let actie: "lees" | "wis" | { zet: Rij } = "lees";
      const q = {
        select: () => q,
        order: () => q,
        range: () => q,
        update(v: Rij) {
          actie = { zet: v };
          return q;
        },
        delete() {
          actie = "wis";
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
        then(ok: (r: { data: Rij[] | null; error: unknown }) => unknown) {
          if (opties.ontbreekt?.includes(tabel))
            return Promise.resolve({ data: null, error: { code: "PGRST205" } }).then(ok);
          if (opties.faalt?.includes(tabel))
            return Promise.resolve({ data: null, error: { code: "XX000", message: "stuk" } }).then(
              ok,
            );
          const t = (tabellen[tabel] ??= []);
          const raak = t.filter((r) => filters.every((f) => f(r)));
          if (actie === "wis") tabellen[tabel] = t.filter((r) => !raak.includes(r));
          else if (actie !== "lees") for (const r of raak) Object.assign(r, actie.zet);
          return Promise.resolve({ data: raak, error: null }).then(ok);
        },
      };
      return q;
    },
    storage: {
      from: (bucket: string) => ({
        list: (map: string) =>
          Promise.resolve({
            data: [...bestanden]
              .filter((b) => b.startsWith(`${bucket}|${map}/`))
              .map((b) => ({ name: b.split("|")[1]!.slice(map.length + 1) })),
            error: null,
          }),
        remove: (paden: string[]) => {
          for (const p of paden) bestanden.delete(`${bucket}|${p}`);
          return Promise.resolve({ data: [], error: null });
        },
      }),
    },
  };
  return { db, tabellen, bestanden };
}

const IK = "ik";
const JIJ = "jij";

describe("ruimRegisterOp: alles van de gebruiker weg, niets van een ander", () => {
  it("wist eigen rijen, wist kinderen via eigen recepten, anonimiseert facturen", async () => {
    const { db, tabellen } = nep({
      recipes: [
        { id: "r1", user_id: IK },
        { id: "r2", user_id: JIJ },
      ],
      recipe_ingredients: [
        { id: "i1", recipe_id: "r1" },
        { id: "i2", recipe_id: "r2" },
      ],
      favorites: [
        { id: "f1", user_id: JIJ, recipe_id: "r1" },
        { id: "f2", user_id: JIJ, recipe_id: "r2" },
      ],
      meal_plan: [{ id: "m1", user_id: JIJ, recipe_id: "r1" }],
      planprofiel: [
        { id: "p1", user_id: IK },
        { id: "p2", user_id: JIJ },
      ],
      restjes: [{ id: "x1", user_id: IK }],
      group_members: [
        { id: "g1", user_id: IK },
        { id: "g2", user_id: JIJ },
      ],
      facturen: [{ id: "fa", user_id: IK, nummer: "T-1" }],
      lijst_toewijzingen: [{ id: "t1", toegewezen_aan: IK, toegewezen_door: JIJ }],
      toestemmingen: [{ id: "to", user_id: IK, soort: "ai" }],
      profiles: [{ id: IK }, { id: JIJ }],
    });
    const v = await ruimRegisterOp(db, IK);
    expect(v.mislukt).toEqual([]);
    expect(tabellen["recipes"]!.map((r) => r["id"])).toEqual(["r2"]);
    expect(tabellen["recipe_ingredients"]!.map((r) => r["id"])).toEqual(["i2"]);
    expect(tabellen["favorites"]!.map((r) => r["id"])).toEqual(["f2"]);
    expect(tabellen["meal_plan"]).toEqual([{ id: "m1", user_id: JIJ, recipe_id: null }]);
    expect(tabellen["planprofiel"]!.map((r) => r["id"])).toEqual(["p2"]);
    expect(tabellen["restjes"]).toEqual([]);
    expect(tabellen["group_members"]!.map((r) => r["id"])).toEqual(["g2"]);
    expect(tabellen["facturen"]).toEqual([{ id: "fa", user_id: null, nummer: "T-1" }]);
    expect(tabellen["lijst_toewijzingen"]).toEqual([
      { id: "t1", toegewezen_aan: null, toegewezen_door: JIJ },
    ]);
    expect(tabellen["toestemmingen"]).toEqual([]);
    expect(tabellen["profiles"]).toEqual([{ id: JIJ }]);
    const overal = JSON.stringify(tabellen);
    expect(overal).not.toContain(`"${IK}"`);
  });

  it("een tabel die in productie nog niet bestaat, wordt overgeslagen (geen fout)", async () => {
    const { db } = nep({ profiles: [{ id: IK }] }, { ontbreekt: ["toestemmingen", "restjes"] });
    const v = await ruimRegisterOp(db, IK);
    // restjes.recipe_id (via recepten) vraagt niets als er geen eigen recepten zijn.
    expect(v.overgeslagen).toEqual(["restjes.user_id", "toestemmingen.user_id"]);
    expect(v.mislukt).toEqual([]);
  });

  it("een echte fout wordt gemeld met alleen de tabelnaam", async () => {
    const { db } = nep({ profiles: [{ id: IK }] }, { faalt: ["planprofiel"] });
    const v = await ruimRegisterOp(db, IK);
    expect(v.mislukt).toEqual(["planprofiel.user_id"]);
  });

  it("bestaatNiet herkent ontbrekende tabel en kolom, niet een andere fout", () => {
    expect(bestaatNiet({ code: "PGRST205" })).toBe(true);
    expect(bestaatNiet({ code: "42703" })).toBe(true);
    expect(bestaatNiet({ code: "PGRST204" })).toBe(true);
    expect(bestaatNiet({ code: "23503", message: "foreign key" })).toBe(false);
  });
});

describe("ruimCommunityFotosOp (BUG-179)", () => {
  it("wist alle eigen community-foto's en niets van een ander of uit recepten", async () => {
    const { db, bestanden } = nep({
      __opslag: [
        { bucket: "community-fotos", name: `${IK}/a.jpg` },
        { bucket: "community-fotos", name: `${IK}/b.jpg` },
        { bucket: "community-fotos", name: `${JIJ}/c.jpg` },
        { bucket: "recipe-photos", name: `${IK}/recept.jpg` },
      ],
    });
    expect(await ruimCommunityFotosOp(db, IK)).toBe(2);
    expect([...bestanden].sort()).toEqual(
      [`community-fotos|${JIJ}/c.jpg`, `recipe-photos|${IK}/recept.jpg`].sort(),
    );
  });
});
