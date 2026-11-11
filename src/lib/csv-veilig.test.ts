import { describe, expect, it } from "vitest";
import { csvCel, naarCsv } from "./csv-veilig";
import { pagineer } from "./pagineer";

describe("csvCel", () => {
  it("maakt formules onschadelijk", () => {
    expect(csvCel('=HYPERLINK("https://x.test","klik")')).toBe(
      `"'=HYPERLINK(""https://x.test"",""klik"")"`,
    );
    expect(csvCel("+32 470")).toBe(`"'+32 470"`);
    expect(csvCel("-1")).toBe(`"'-1"`);
    expect(csvCel("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });
  it("laat gewone tekst ongemoeid en quote scheidingstekens", () => {
    expect(csvCel("Marie")).toBe("Marie");
    expect(csvCel("a;b")).toBe(`"a;b"`);
    expect(csvCel("a,b", ",")).toBe(`"a,b"`);
    expect(csvCel(null)).toBe("");
    expect(csvCel(["a", "b"])).toBe("a b");
  });
  it("bouwt een volledige CSV", () => {
    expect(naarCsv([{ naam: "=1+1", n: 2 }])).toBe(`naam;n\n"'=1+1";2`);
  });
});

describe("pagineer", () => {
  it("haalt meer dan 1000 rijen op in stukken", async () => {
    const alles = Array.from({ length: 2500 }, (_, i) => i);
    const r = await pagineer<number>(async (van, tot) => ({ data: alles.slice(van, tot + 1) }));
    expect(r.data).toHaveLength(2500);
    expect(r.afgekapt).toBe(false);
  });
  it("meldt afkappen bij de maximumgrens", async () => {
    const r = await pagineer<number>(
      async (van, tot) => ({ data: Array(tot - van + 1).fill(0) }),
      2000,
    );
    expect(r.data).toHaveLength(2000);
    expect(r.afgekapt).toBe(true);
  });
  it("gooit een fout i.p.v. stil te weinig terug te geven", async () => {
    await expect(pagineer(async () => ({ data: null, error: { message: "x" } }))).rejects.toThrow();
  });
});
