import { describe, expect, it, vi } from "vitest";
import { onveiligeGerechten } from "./servercontrole";

describe("BUG-152: servercontrole per gekozen gerecht", () => {
  it("controleert elk gekozen gerecht, niet alleen het getoonde", async () => {
    const oordeel = vi.fn(async (id: string) => new Map([["lotte", id !== "notentaart"]]));
    const uit = await onveiligeGerechten(["soep", "notentaart", "soep"], ["lotte"], oordeel);
    expect([...uit]).toEqual(["notentaart"]);
    expect(oordeel).toHaveBeenCalledTimes(2);
  });

  it("zonder niet-leesbare eters: geen serververzoek", async () => {
    const oordeel = vi.fn(async () => new Map<string, boolean>());
    expect((await onveiligeGerechten(["soep"], [], oordeel)).size).toBe(0);
    expect(oordeel).not.toHaveBeenCalled();
  });

  it("niets te controleren (server zegt niets) blokkeert niet; fout gooit door", async () => {
    expect((await onveiligeGerechten(["x"], ["lotte"], async () => new Map())).size).toBe(0);
    await expect(
      onveiligeGerechten(["x"], ["lotte"], async () => {
        throw new Error("netwerk");
      }),
    ).rejects.toThrow("netwerk");
  });
});
