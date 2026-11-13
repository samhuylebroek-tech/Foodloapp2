/**
 * Ronde 2, punt 6: echte tests voor de receptinvoer via een link (methode 2) en sociale media
 * (methode 3), zonder AI. De AI-stappen (tekst, foto) worden apart in de E2E gecontroleerd op
 * "niets bewaren zonder nakijken" (tests/e2e/receptinvoer.spec.ts).
 */
import { describe, expect, it } from "vitest";
import { leesStructuurData } from "./ai.functions";
import { detecteerPlatform, isSociaal, velden } from "./import.server";

const pagina = (jsonld: unknown, extra = "") => `<!doctype html><html><head>
<meta property="og:image" content="https://voorbeeld.be/foto.jpg">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>${extra}
</head><body><h1>Recept</h1></body></html>`;

const stoofvlees = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Vlaamse stoofvlees",
  description: "Klassiek, met donker bier.",
  recipeYield: "4 personen",
  prepTime: "PT20M",
  cookTime: "PT2H30M",
  recipeCategory: "hoofdgerecht",
  keywords: "Belgisch, winter",
  recipeIngredient: ["1 kg rundvlees", "2 uien", "33 cl donker bier", "2 el mosterd"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Bak het vlees aan." },
    { "@type": "HowToStep", text: "Voeg uien en bier toe en laat 2,5 uur sudderen." },
  ],
};

describe("receptinvoer via link: gestructureerde gegevens (0 credits)", () => {
  it("leest een volledig recept uit JSON-LD", () => {
    const r = leesStructuurData(pagina(stoofvlees), "https://voorbeeld.be/stoofvlees")!;
    expect(r).not.toBeNull();
    expect(r.title).toBe("Vlaamse stoofvlees");
    expect(r.servings).toBe(4);
    expect(r.prep_minutes).toBe(20);
    expect(r.cook_minutes).toBe(150);
    expect(r.ingredients).toHaveLength(4);
    expect(r.ingredients[0]).toMatchObject({
      name: expect.stringContaining("rundvlees"),
      quantity: 1,
    });
    expect(r.instructions).toHaveLength(2);
    expect(r.tags).toEqual(["Belgisch", "winter"]);
    expect(r.source_url).toBe("https://voorbeeld.be/stoofvlees");
    expect(r.bron).toBe("paginagegevens");
  });

  it("vindt het recept ook in een @graph (WordPress-sites)", () => {
    const html = pagina({
      "@context": "https://schema.org",
      "@graph": [{ "@type": "WebPage" }, stoofvlees],
    });
    expect(leesStructuurData(html, "https://voorbeeld.be/x")?.title).toBe("Vlaamse stoofvlees");
  });

  it("verzint niets: te weinig ingrediënten of stappen → geen recept (dan pas AI of zelf invullen)", () => {
    const mager = { ...stoofvlees, recipeIngredient: ["1 kg rundvlees"] };
    expect(leesStructuurData(pagina(mager), "https://voorbeeld.be/x")).toBeNull();
    expect(
      leesStructuurData(pagina({ "@type": "Article", name: "Geen recept" }), "https://x.be"),
    ).toBeNull();
  });

  it("negeert kapotte JSON-LD zonder te crashen", () => {
    const html = `<script type="application/ld+json">{ kapot </script>${pagina(stoofvlees)}`;
    expect(leesStructuurData(html, "https://voorbeeld.be/x")?.title).toBe("Vlaamse stoofvlees");
  });
});

describe("receptinvoer via sociale media: platform herkennen", () => {
  it.each([
    ["https://www.instagram.com/p/abc/", "instagram"],
    ["https://www.tiktok.com/@kok/video/123", "tiktok"],
    ["https://youtu.be/abc", "youtube"],
    ["https://www.youtube.com/watch?v=abc", "youtube"],
    ["https://www.facebook.com/kok/posts/1", "facebook"],
    ["https://nl.pinterest.com/pin/1/", "pinterest"],
  ])("%s → %s", (url, platform) => {
    expect(detecteerPlatform(url)).toBe(platform);
    expect(isSociaal(detecteerPlatform(url))).toBe(true);
  });

  it("een gewone website is geen sociaal platform", () => {
    expect(isSociaal(detecteerPlatform("https://dagelijksekost.vrt.be/gerechten/stoofvlees"))).toBe(
      false,
    );
  });
});

describe("nakijken: wat is gevonden en wat ontbreekt", () => {
  it("noemt de ontbrekende velden, zodat de gebruiker ze zelf aanvult", () => {
    const v = velden({ title: "Soep", ingredients: [1, 2], instructions: [], servings: 0 });
    expect(v.gevonden).toEqual(["titel", "ingrediënten"]);
    expect(v.ontbrekend).toEqual(["bereiding", "personen", "tijd", "foto"]);
  });
});
