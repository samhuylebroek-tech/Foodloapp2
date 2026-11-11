import { describe, expect, it } from "vitest";
import { haalAccountVoorkeuren, isRechtenfout, type VoorkeurClient } from "./account-voorkeuren";

function nep(opties: { weekmenuDicht: boolean; rpcBestaat: boolean }) {
  const log: string[] = [];
  const rij = {
    taal: "nl",
    thema: "warm",
    momenten: ["avondeten"],
    weekmenu: { vermijd: "noten" },
  };
  const db: VoorkeurClient = {
    from: () => ({
      select: (kol: string) => ({
        eq: () => ({
          maybeSingle: async () => {
            log.push(`select ${kol}`);
            if (kol.includes("weekmenu") && opties.weekmenuDicht)
              return {
                data: null,
                error: { code: "42501", message: "permission denied for table profiles" },
              };
            const { weekmenu, ...rest } = rij;
            return { data: kol.includes("weekmenu") ? rij : rest, error: null };
          },
        }),
      }),
    }),
    rpc: async () => {
      log.push("rpc eigen_weekmenu");
      return opties.rpcBestaat
        ? { data: rij.weekmenu, error: null }
        : { data: null, error: { code: "PGRST202", message: "not found" } };
    },
  };
  return { db, log };
}

describe("haalAccountVoorkeuren (BUG-119)", () => {
  it("vandaag (kolom leesbaar): één verzoek, alles erin", async () => {
    const { db, log } = nep({ weekmenuDicht: false, rpcBestaat: false });
    const v = await haalAccountVoorkeuren(db, "u1");
    expect(v?.weekmenu).toEqual({ vermijd: "noten" });
    expect(log).toEqual(["select taal, thema, momenten, weekmenu"]);
  });
  it("na migratie 0004: rest via select, weekmenu via eigen_weekmenu()", async () => {
    const { db, log } = nep({ weekmenuDicht: true, rpcBestaat: true });
    const v = await haalAccountVoorkeuren(db, "u1");
    expect(v).toMatchObject({ taal: "nl", thema: "warm", weekmenu: { vermijd: "noten" } });
    expect(log).toContain("rpc eigen_weekmenu");
  });
  it("functie ontbreekt nog: taal en thema blijven werken, weekmenu leeg", async () => {
    const { db } = nep({ weekmenuDicht: true, rpcBestaat: false });
    const v = await haalAccountVoorkeuren(db, "u1");
    expect(v).toMatchObject({ taal: "nl", thema: "warm" });
    expect(v?.weekmenu).toBeUndefined();
  });
  it("herkent alleen rechtenfouten", () => {
    expect(isRechtenfout({ code: "42501" })).toBe(true);
    expect(isRechtenfout({ message: "permission denied for table profiles" })).toBe(true);
    expect(isRechtenfout({ code: "PGRST116" })).toBe(false);
    expect(isRechtenfout(null)).toBe(false);
  });
});
