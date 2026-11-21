import { describe, expect, it } from "vitest";
import {
  filterMakers,
  initialenVan,
  isPubliekZichtbaar,
  leesSpecialisaties,
  naDepubliceren,
  naPubliceren,
  normaliseerHandle,
  publicatieStatusLabel,
  telCijfers,
  valideerBijdrage,
  valideerHandle,
  videoBron,
} from "./makers";

describe("handle", () => {
  it("normaliseert naar kleine letters met streepjes en zonder accenten", () => {
    expect(normaliseerHandle("@Lotte Kookt!")).toBe("lotte-kookt");
    expect(normaliseerHandle("  Crème_Brûlée  ")).toBe("creme-brulee");
    expect(normaliseerHandle("--a  --  b--")).toBe("a-b");
  });
  it("aanvaardt een goede handle", () => {
    expect(valideerHandle("chef-ahmed")).toBeNull();
    expect(valideerHandle("abc")).toBeNull();
  });
  it("weigert te kort, te lang, verkeerde tekens en randstreepjes", () => {
    expect(valideerHandle("ab")).toMatch(/minstens 3/);
    expect(valideerHandle("a".repeat(31))).toMatch(/hoogstens 30/);
    expect(valideerHandle("Lotte")).toMatch(/kleine letters/);
    expect(valideerHandle("-lotte")).toMatch(/kleine letters/);
    expect(valideerHandle("lotte-")).toMatch(/kleine letters/);
    expect(valideerHandle("lo--tte")).toMatch(/twee streepjes/);
  });
  it("weigert voorbehouden en bezette namen", () => {
    expect(valideerHandle("foodlo")).toMatch(/voorbehouden/);
    expect(valideerHandle("beheer")).toMatch(/voorbehouden/);
    expect(valideerHandle("lotte-kookt", ["Lotte-Kookt"])).toMatch(/al in gebruik/);
  });
});

describe("zichtbaarheid en publiceren", () => {
  const basis = { zichtbaarheid: "openbaar" as const, status: "gepubliceerd" as const };
  it("openbaar is pas zichtbaar na goedkeuring als moderatie vooraf geldt", () => {
    expect(isPubliekZichtbaar({ ...basis, moderatie: "wacht" })).toBe(false);
    expect(isPubliekZichtbaar({ ...basis, moderatie: "afgewezen" })).toBe(false);
    expect(isPubliekZichtbaar({ ...basis, moderatie: "goedgekeurd" })).toBe(true);
    expect(isPubliekZichtbaar({ ...basis, moderatie: null }, false)).toBe(true);
  });
  it("privé, vrienden of concept is nooit publiek", () => {
    expect(isPubliekZichtbaar({ ...basis, zichtbaarheid: "prive", moderatie: "goedgekeurd" })).toBe(
      false,
    );
    expect(
      isPubliekZichtbaar({ ...basis, zichtbaarheid: "vrienden", moderatie: "goedgekeurd" }),
    ).toBe(false);
    expect(isPubliekZichtbaar({ ...basis, status: "concept", moderatie: "goedgekeurd" })).toBe(
      false,
    );
    expect(isPubliekZichtbaar(null)).toBe(false);
  });
  it("openbaar publiceren zet de controle op 'wacht'; vrienden niet", () => {
    const nu = new Date("2026-11-14T10:00:00Z");
    expect(naPubliceren("openbaar", nu)).toEqual({
      zichtbaarheid: "openbaar",
      status: "gepubliceerd",
      gepubliceerd_op: "2026-11-14T10:00:00.000Z",
      moderatie: "wacht",
    });
    expect(naPubliceren("vrienden", nu).moderatie).toBeNull();
    expect(naDepubliceren()).toEqual({ status: "concept", moderatie: null });
  });
  it("statuslabel in gewone taal", () => {
    expect(publicatieStatusLabel(null)).toBe("Concept");
    expect(publicatieStatusLabel({ ...basis, moderatie: "wacht" })).toBe("Wacht op controle");
    expect(publicatieStatusLabel({ ...basis, moderatie: "goedgekeurd" })).toBe(
      "Gepubliceerd · Openbaar",
    );
    expect(
      publicatieStatusLabel({ zichtbaarheid: "vrienden", status: "gepubliceerd", moderatie: null }),
    ).toBe("Gepubliceerd · Vrienden en gezin");
  });
});

describe("telCijfers", () => {
  const pubs = [
    {
      zichtbaarheid: "openbaar" as const,
      status: "gepubliceerd" as const,
      moderatie: "goedgekeurd" as const,
    },
    {
      zichtbaarheid: "openbaar" as const,
      status: "gepubliceerd" as const,
      moderatie: "wacht" as const,
    },
    { zichtbaarheid: "vrienden" as const, status: "gepubliceerd" as const, moderatie: null },
    { zichtbaarheid: "prive" as const, status: "concept" as const, moderatie: null },
  ];
  it("telt gepubliceerd en echt openbaar apart", () => {
    const c = telCijfers(pubs, { volgers: 3, bewaard: 5, gepland: 0 });
    expect(c).toEqual({ volgers: 3, gepubliceerd: 3, openbaar: 1, bewaard: 5, gepland: 0 });
  });
  it("verzint geen cijfers als de databankfunctie ontbreekt", () => {
    const c = telCijfers(pubs, null);
    expect(c.volgers).toBe(0);
    expect(c.bewaard).toBeNull();
    expect(c.gepland).toBeNull();
    expect(telCijfers([], { volgers: -1, bewaard: "7" }).bewaard).toBeNull();
  });
});

describe("overige regels", () => {
  it("video: alleen https-links van bekende diensten", () => {
    expect(videoBron("https://www.youtube.com/watch?v=abc")?.platform).toBe("YouTube");
    expect(videoBron("https://youtu.be/abc")?.platform).toBe("YouTube");
    expect(videoBron("https://www.tiktok.com/@lotte/video/1")?.platform).toBe("TikTok");
    expect(videoBron("http://youtube.com/watch?v=abc")).toBeNull();
    expect(videoBron("https://evil.example/youtube.com")).toBeNull();
    expect(videoBron("javascript:alert(1)")).toBeNull();
    expect(videoBron("")).toBeNull();
  });
  it("specialisaties: ontdubbeld, opgekuist, hoogstens 6", () => {
    expect(leesSpecialisaties("vegetarisch, Vegetarisch ; soepen\n  ")).toEqual([
      "Vegetarisch",
      "Soepen",
    ]);
    expect(leesSpecialisaties("a,b,c,d,e,f,g,h")).toHaveLength(6);
  });
  it("bijdrage: sterren en één korte zin", () => {
    expect(valideerBijdrage("Heerlijk!", 5)).toBeNull();
    expect(valideerBijdrage("Heerlijk!", 0)).toMatch(/sterren/);
    expect(valideerBijdrage(" ", 4)).toMatch(/zin/);
    expect(valideerBijdrage("x".repeat(281), 4)).toMatch(/280/);
  });
  it("initialen en zoeken", () => {
    expect(initialenVan("Chef Ahmed")).toBe("CA");
    expect(initialenVan("")).toBe("?");
    const makers = [
      { naam: "Lotte kookt", handle: "lotte-kookt", bio: null, specialisaties: ["Soepen"] },
      { naam: "Chef Ahmed", handle: "chef-ahmed", bio: "Marokkaans", specialisaties: [] },
    ];
    expect(filterMakers(makers, "soep").map((m) => m.handle)).toEqual(["lotte-kookt"]);
    expect(filterMakers(makers, "MAROKKAANS").map((m) => m.handle)).toEqual(["chef-ahmed"]);
    expect(filterMakers(makers, "")).toHaveLength(2);
  });
});
