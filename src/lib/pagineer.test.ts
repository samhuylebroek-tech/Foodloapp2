import { describe, expect, it } from "vitest";
import { alleRijen } from "./pagineer";

/**
 * Nep-query zoals supabase-js: `.range()` overschrijft offset/limit op dezelfde bouwer en elke
 * `await` voert het verzoek opnieuw uit. De server geeft nooit meer dan 1000 rijen (max-rows).
 */
function nepQuery(totaal: number, fout = false) {
  const rijen = Array.from({ length: totaal }, (_, i) => ({ id: i }));
  let van = 0;
  let tot = Infinity;
  let verzoeken = 0;
  const q = {
    range(a: number, b: number) {
      van = a;
      tot = b;
      return q;
    },
    then<T>(ok: (r: { data: { id: number }[] | null; error: unknown }) => T) {
      verzoeken++;
      if (fout) return Promise.resolve(ok({ data: null, error: { message: "x" } }));
      const einde = Math.min(tot + 1, van + 1000);
      return Promise.resolve(ok({ data: rijen.slice(van, einde), error: null }));
    },
  };
  return { q, verzoeken: () => verzoeken };
}

describe("alleRijen (BUG-093, dashboards)", () => {
  it("haalt alle 2500 rijen op, niet de eerste 1000", async () => {
    const { q, verzoeken } = nepQuery(2500);
    const { data, afgekapt } = await alleRijen(q);
    expect(data).toHaveLength(2500);
    expect(new Set(data.map((r) => r.id)).size).toBe(2500);
    expect(afgekapt).toBe(false);
    expect(verzoeken()).toBe(3);
  });
  it("precies 1000 rijen: één extra (leeg) verzoek om zeker te zijn", async () => {
    const { q, verzoeken } = nepQuery(1000);
    expect((await alleRijen(q)).data).toHaveLength(1000);
    expect(verzoeken()).toBe(2);
  });
  it("respecteert een maximum en meldt dat het afgekapt is", async () => {
    const { q } = nepQuery(5000);
    const r = await alleRijen(q, 2000);
    expect(r.data).toHaveLength(2000);
    expect(r.afgekapt).toBe(true);
  });
  it("een fout wordt geen stil leeg dashboard", async () => {
    const { q } = nepQuery(10, true);
    await expect(alleRijen(q)).rejects.toThrow("Gegevens ophalen lukte niet.");
  });
});
