/**
 * Fase 2: recepten uit alle bronnen. Platformherkenning, tijdcodes, tekst-parser zonder AI,
 * dubbelcheck, onzekere velden en deeltekst.
 */
import { describe, expect, it } from "vitest";
import { videoBron } from "./makers";
import { ingredientGelijkenis, naamGelijkenis, onzekerVelden, vindDubbel } from "./nakijken";
import { deelStatus, receptAlsTekst, receptLink } from "./recept-delen";
import { leesReceptTekst, zonderNummer } from "./recept-tekst";
import {
  eersteLink,
  herkenVideoLink,
  tijdcodeUit,
  tijdVoluit,
  videoLinkTekst,
  videoOpTijd,
} from "./video-link";

describe("video-link: platform herkennen", () => {
  it("YouTube: watch, youtu.be, shorts, zonder https en met tracking", () => {
    expect(herkenVideoLink("https://www.youtube.com/watch?v=abc123&si=xyz")).toEqual({
      platform: "YouTube",
      url: "https://www.youtube.com/watch?v=abc123",
      maker: null,
      id: "abc123",
    });
    expect(herkenVideoLink("youtu.be/abc123?t=40")?.id).toBe("abc123");
    expect(herkenVideoLink("https://youtu.be/abc123?t=40")?.url).toBe("https://youtu.be/abc123");
    expect(herkenVideoLink("https://m.youtube.com/shorts/Xy_9")?.id).toBe("Xy_9");
    expect(herkenVideoLink("http://youtube.com/watch?v=q")?.url).toMatch(/^https:/);
  });
  it("TikTok met maker uit de link, ook korte links", () => {
    const t = herkenVideoLink("https://www.tiktok.com/@chefanna/video/7301?is_from_webapp=1");
    expect(t?.platform).toBe("TikTok");
    expect(t?.maker).toBe("@chefanna");
    expect(t?.url).toBe("https://www.tiktok.com/@chefanna/video/7301");
    expect(herkenVideoLink("https://vm.tiktok.com/ZMabc/")?.platform).toBe("TikTok");
  });
  it("Instagram reels en berichten, Facebook-video's en Vimeo", () => {
    expect(herkenVideoLink("https://www.instagram.com/reel/C1abc/?igsh=1")?.url).toBe(
      "https://www.instagram.com/reel/C1abc/",
    );
    expect(herkenVideoLink("https://www.instagram.com/lotte.kookt/reel/C1abc/")?.maker).toBe(
      "@lotte.kookt",
    );
    expect(herkenVideoLink("https://fb.watch/abcDEF/")?.platform).toBe("Facebook");
    expect(herkenVideoLink("https://www.facebook.com/chef/videos/123456/")?.platform).toBe(
      "Facebook",
    );
    expect(herkenVideoLink("https://www.facebook.com/share/v/1AbC/")?.platform).toBe("Facebook");
    expect(herkenVideoLink("https://vimeo.com/76979871")?.id).toBe("76979871");
  });
  it("geen video: kanaalpagina's, andere sites, rommel en gevaarlijke links", () => {
    expect(herkenVideoLink("https://www.youtube.com/@chefanna")).toBeNull();
    expect(herkenVideoLink("https://www.instagram.com/lotte.kookt/")).toBeNull();
    expect(herkenVideoLink("https://www.facebook.com/chef")).toBeNull();
    expect(herkenVideoLink("https://dagelijksekost.vrt.be/gerechten/stoofvlees")).toBeNull();
    expect(herkenVideoLink("https://evil.example/youtube.com/watch?v=1")).toBeNull();
    expect(herkenVideoLink("javascript:alert(1)")).toBeNull();
    expect(herkenVideoLink("https://user:pw@youtube.com/watch?v=1")).toBeNull();
    expect(herkenVideoLink("")).toBeNull();
    expect(herkenVideoLink("niet een link")).toBeNull();
  });
  it("linktekst en eerste link uit gedeelde tekst", () => {
    expect(videoLinkTekst({ platform: "YouTube", url: "https://youtu.be/a" })).toBe(
      "Bekijk de video bij YouTube",
    );
    expect(videoLinkTekst({ platform: "Instagram", url: "https://www.instagram.com/p/abc/" })).toBe(
      "Bekijk het bericht bij Instagram",
    );
    expect(eersteLink("Kijk eens 😍 https://youtu.be/abc, zo lekker!")).toBe(
      "https://youtu.be/abc",
    );
    expect(eersteLink("geen link")).toBeNull();
  });
  it("makers gebruiken dezelfde lijst (ook Facebook), maar blijven strikt https", () => {
    expect(videoBron("https://fb.watch/abc/")?.platform).toBe("Facebook");
    expect(videoBron("http://youtube.com/watch?v=abc")).toBeNull();
  });
});

describe("tijdcodes in stappen", () => {
  it("vooraan, met haakjes of streepje", () => {
    expect(tijdcodeUit("0:45 Bak de ui glazig")).toEqual({
      seconden: 45,
      label: "0:45",
      tekst: "Bak de ui glazig",
    });
    expect(tijdcodeUit("[1:02] – Voeg de room toe")?.seconden).toBe(62);
    expect(tijdcodeUit("(12:30) Laat rusten")?.seconden).toBe(750);
    expect(tijdcodeUit("1:02:03 Klaar")?.seconden).toBe(3723);
  });
  it("tussen haakjes achteraan; een kloktijd middenin telt niet", () => {
    expect(tijdcodeUit("Roer de saus (2:30)")).toEqual({
      seconden: 150,
      label: "2:30",
      tekst: "Roer de saus",
    });
    expect(tijdcodeUit("Om 12:30 aan tafel")).toBeNull();
    expect(tijdcodeUit("0:75 Fout")).toBeNull();
    expect(tijdcodeUit("Meng in verhouding 1:2")).toBeNull();
    expect(tijdcodeUit("0:45")).toBeNull();
  });
  it("link naar het moment (YouTube, Vimeo); andere platformen niet", () => {
    const yt = herkenVideoLink("https://youtu.be/abc123")!;
    expect(videoOpTijd(yt, 45)).toBe("https://www.youtube.com/watch?v=abc123&t=45s");
    expect(videoOpTijd(herkenVideoLink("https://vimeo.com/42")!, 62)).toBe(
      "https://vimeo.com/42#t=62s",
    );
    expect(videoOpTijd(herkenVideoLink("https://www.tiktok.com/@a/video/1")!, 10)).toBeNull();
    expect(tijdVoluit(65)).toBe("op 1 minuut 5 seconden");
    expect(tijdVoluit(0)).toBe("op 0 seconden");
  });
});

describe("tekst-parser zonder AI", () => {
  it("met koppen: naam, personen, ingrediënten en stappen", () => {
    const { recept, onzeker } = leesReceptTekst(`Vlaamse stoofvlees 🍲
Voor 4 personen
Ingrediënten:
- 1 kg rundvlees
- 2 uien
- 33 cl donker bier
- 2 el mosterd
Bereiding
1. Bak het vlees aan in boter.
2. Voeg uien en bier toe en laat 2,5 uur sudderen.
#stoofvlees #belgisch`);
    expect(recept.title).toBe("Vlaamse stoofvlees");
    expect(recept.servings).toBe(4);
    expect(recept.ingredients.map((i) => i.name)).toEqual([
      "rundvlees",
      "uien",
      "donker bier",
      "mosterd",
    ]);
    expect(recept.ingredients[0]).toMatchObject({ quantity: 1, unit: "kg" });
    expect(recept.instructions).toEqual([
      "Bak het vlees aan in boter.",
      "Voeg uien en bier toe en laat 2,5 uur sudderen.",
    ]);
    expect(onzeker).toEqual([]);
  });
  it("zonder koppen (bericht of briefje): regels raden", () => {
    const { recept, onzeker } = leesReceptTekst(
      "Pannenkoeken\n250 g bloem\n2 eieren\n500 ml melk\nsnuf zout\nMeng alles tot een glad beslag.\nBak dunne pannenkoeken in een hete pan.",
    );
    expect(recept.title).toBe("Pannenkoeken");
    expect(recept.ingredients).toHaveLength(4);
    expect(recept.instructions).toHaveLength(2);
    expect(onzeker).toEqual([]);
    expect(recept.servings).toBe(4);
  });
  it("ingrediënten op één regel, stappen met tijdcodes blijven staan", () => {
    const { recept } = leesReceptTekst(
      "Snelle pasta\nIngrediënten: 200 g spaghetti, 1 teentje look, 2 el olijfolie\nStappen:\n0:15 Kook de spaghetti beetgaar.\n0:45 Bak de look kort in de olie.",
    );
    expect(recept.ingredients.map((i) => i.name)).toEqual(["spaghetti", "look", "olijfolie"]);
    expect(recept.instructions[0]).toBe("0:15 Kook de spaghetti beetgaar.");
    expect(tijdcodeUit(recept.instructions[1]!)?.seconden).toBe(45);
  });
  it("markeert wat ontbreekt of onzeker is", () => {
    const { recept, onzeker } = leesReceptTekst("2 eieren\nbloem\nboter");
    expect(recept.title).toBe("");
    const velden = onzeker.map((o) => o.veld);
    expect(velden).toContain("naam");
    expect(velden).toContain("stappen");
    expect(leesReceptTekst("").onzeker.map((o) => o.veld)).toContain("ingredienten");
  });
  it("zonderNummer haalt stapnummers weg", () => {
    expect(zonderNummer("Stap 2: Roer")).toBe("Roer");
    expect(zonderNummer("3) Bak")).toBe("Bak");
    expect(zonderNummer("12. Klaar")).toBe("Klaar");
    expect(zonderNummer("2 eieren")).toBe("2 eieren");
  });
});

describe("dubbelcheck", () => {
  const eigen = [
    {
      id: "a",
      title: "Stoofvlees met frietjes",
      ingredienten: ["rundvlees", "uien", "bruin bier", "mosterd", "frieten"],
      source_url: "https://dagelijksekost.vrt.be/stoofvlees",
    },
    {
      id: "b",
      title: "Spaghetti bolognese",
      ingredienten: ["spaghetti", "gehakt", "tomaten", "ui", "look"],
    },
  ];
  it("zelfde bron = zeker dubbel", () => {
    expect(
      vindDubbel(
        {
          title: "Iets",
          ingredienten: [],
          source_url: "https://www.dagelijksekost.vrt.be/stoofvlees/",
        },
        eigen,
      ),
    ).toMatchObject({ reden: "bron", recept: { id: "a" } });
  });
  it("gelijkaardige naam", () => {
    expect(naamGelijkenis("Stoofvlees met frietjes", "Stoofvlees met frieten")).toBeGreaterThan(
      0.5,
    );
    expect(
      vindDubbel({ title: "Stoofvlees met frietjes van oma", ingredienten: [] }, eigen)?.recept.id,
    ).toBe("a");
  });
  it("andere naam maar bijna dezelfde ingrediënten", () => {
    const d = vindDubbel(
      {
        title: "Pasta van de chef",
        ingredienten: ["spaghetti", "gehakt", "tomaat", "uien", "look"],
      },
      eigen,
    );
    expect(d).toMatchObject({ reden: "ingredienten", recept: { id: "b" } });
    expect(ingredientGelijkenis(["a", "b"], ["a", "b"])).toBe(0);
  });
  it("geen dubbel bij een ander gerecht", () => {
    expect(
      vindDubbel(
        {
          title: "Spaghetti carbonara",
          ingredienten: ["spaghetti", "spek", "eieren", "parmezaan"],
        },
        eigen,
      ),
    ).toBeNull();
    expect(vindDubbel({ title: "", ingredienten: [] }, eigen)).toBeNull();
  });
});

describe("onzekere velden (AI- of paginaresultaat)", () => {
  it("foto-gok, ontbrekende maten en stappen", () => {
    const o = onzekerVelden({
      title: "Lasagne",
      ingredients: [
        { name: "pasta", quantity: 250 },
        { name: "kaas", quantity: null },
        { name: "zout naar smaak", quantity: null },
      ],
      instructions: [],
      is_suggestie: true,
    });
    expect(o.map((x) => x.veld)).toEqual(["gok", "hoeveelheden", "stappen"]);
    expect(o[1]!.uitleg).toBe("Geen hoeveelheid bij: kaas.");
  });
});

describe("delen", () => {
  it("link en tekst", () => {
    const link = receptLink("https://app.foodlo.be/", "r1");
    expect(link).toBe("https://app.foodlo.be/recepten/r1");
    expect(
      receptAlsTekst({
        title: "Soep",
        ingredienten: [{ name: "wortelen", quantity: 500, unit: "g" }],
        stappen: ["Kook.", "Mix."],
        link,
      }),
    ).toBe(
      "Soep\n\nIngrediënten\n- 500 g wortelen\n\nBereiding\n1. Kook.\n2. Mix.\n\nBekijk het in Foodlo: https://app.foodlo.be/recepten/r1",
    );
  });
  it("privé of openbaar (openbaar pas na controle)", () => {
    expect(deelStatus({ zichtbaarheid: null, gepubliceerd: false, moderatie: null }).titel).toBe(
      "Privé",
    );
    expect(
      deelStatus({ zichtbaarheid: "openbaar", gepubliceerd: true, moderatie: "wacht" }),
    ).toMatchObject({ titel: "Wacht op controle", openbaar: false });
    expect(
      deelStatus({ zichtbaarheid: "openbaar", gepubliceerd: true, moderatie: "goedgekeurd" })
        .openbaar,
    ).toBe(true);
    expect(
      deelStatus({ zichtbaarheid: "vrienden", gepubliceerd: true, moderatie: null }).titel,
    ).toBe("Vrienden en gezin");
  });
});
