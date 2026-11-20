/**
 * Gedeeld scenario "gezin Peeters" voor de slimme planner (slimme-planner.spec.ts en
 * kwaliteit-20.spec.ts): vaste recepten met tags, een zondag als klok en hulpjes voor
 * "Stel je week samen". Marie, Jan, Lotte (noten, deelt het niet) en opa Gust (vegetarisch).
 */
import type { Locator, Page } from "@playwright/test";
import { expect, nepDb, seedDb } from "./helpers";

export const NEP = "http://127.0.0.1:54439/rest/v1";
export const MARIE = "11111111-1111-4111-8111-111111111111";

export const iso = (d: Date) => d.toLocaleDateString("sv-SE");
function zondag(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  d.setHours(14, 0, 0, 0);
  return d;
}
export const ZONDAG = zondag();
export const VOLGENDE = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(ZONDAG);
  d.setDate(d.getDate() + 1 + i);
  return iso(d);
});
export const [MA, DI, WO, DO, VR, ZA, ZO] = VOLGENDE as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export type R = {
  n: number;
  title: string;
  min: number;
  tags: string[];
  ingr: [string, number, string][];
  stappen?: string[];
};
export const RECEPTEN: R[] = [
  {
    n: 1,
    title: "Kip met rijst",
    min: 25,
    tags: [],
    ingr: [
      ["kipfilet", 600, "g"],
      ["rijst", 300, "g"],
      ["paprika", 2, ""],
    ],
  },
  {
    n: 2,
    title: "Stoofvlees met frietjes",
    min: 170,
    tags: [],
    ingr: [
      ["rundvlees", 1000, "g"],
      ["uien", 3, ""],
      ["bier", 50, "cl"],
    ],
  },
  {
    n: 3,
    title: "Spaghetti bolognese",
    min: 60,
    tags: [],
    ingr: [
      ["spaghetti", 400, "g"],
      ["rundergehakt", 500, "g"],
      ["passata", 70, "cl"],
    ],
  },
  {
    n: 4,
    title: "Pasta met tomaat",
    min: 20,
    tags: ["vegetarisch"],
    ingr: [
      ["pasta", 400, "g"],
      ["passata", 50, "cl"],
    ],
  },
  {
    n: 5,
    title: "Pompoensoep",
    min: 35,
    tags: ["vegetarisch"],
    ingr: [
      ["pompoen", 1, "kg"],
      ["ui", 1, ""],
      ["room", 20, "cl"],
    ],
  },
  {
    n: 6,
    title: "Omelet met spinazie",
    min: 15,
    tags: ["vegetarisch"],
    ingr: [
      ["eieren", 8, ""],
      ["spinazie", 300, "g"],
    ],
  },
  {
    n: 7,
    title: "Groentecurry",
    min: 40,
    tags: ["vegetarisch"],
    ingr: [
      ["kikkererwten", 400, "g"],
      ["kokosmelk", 40, "cl"],
      ["spinazie", 200, "g"],
    ],
  },
  {
    n: 8,
    title: "Krokante frietjes",
    min: 25,
    tags: ["vegetarisch"],
    ingr: [["aardappelen", 1000, "g"]],
    stappen: ["Snij de aardappelen.", "Bak 20 minuten in de airfryer op 180 graden."],
  },
  {
    n: 9,
    title: "Zalm met krieltjes",
    min: 25,
    tags: ["vis"],
    ingr: [
      ["zalmfilet", 4, "stuk(s)"],
      ["krieltjes", 800, "g"],
    ],
  },
  {
    n: 10,
    title: "Linzenstoof",
    min: 45,
    tags: ["vegetarisch"],
    ingr: [
      ["linzen", 300, "g"],
      ["wortel", 3, ""],
      ["ui", 1, ""],
    ],
  },
  {
    n: 11,
    title: "Pasta met hazelnootpesto",
    min: 20,
    tags: ["vegetarisch"],
    ingr: [
      ["pasta", 400, "g"],
      ["hazelnoten", 60, "g"],
    ],
  },
];
export const VLEES_OF_VIS = [
  "Kip met rijst",
  "Stoofvlees met frietjes",
  "Spaghetti bolognese",
  "Zalm met krieltjes",
];
export const rid = (n: number) => `a1a1a1a1-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

export async function alleenDeze(welke: R[]) {
  await fetch(`${NEP}/recipes?id=neq.0`, { method: "DELETE" });
  await fetch(`${NEP}/recipe_ingredients?id=neq.0`, { method: "DELETE" });
  await fetch(`${NEP}/meal_plan?id=neq.0`, { method: "DELETE" });
  await seedDb({
    recipes: welke.map((r) => ({
      id: rid(r.n),
      user_id: MARIE,
      title: r.title,
      description: "",
      servings: 4,
      prep_minutes: Math.min(r.min, 10),
      cook_minutes: Math.max(0, r.min - 10),
      difficulty: "makkelijk",
      is_concept: false,
      tags: r.tags,
      category: "hoofdgerecht",
      instructions: r.stappen ?? ["Maak alles klaar en dien op."],
      image_url: null,
      deleted_at: null,
      created_at: `2026-11-01T10:00:${String(r.n).padStart(2, "0")}Z`,
    })),
    recipe_ingredients: welke.flatMap((r) =>
      r.ingr.map(([name, quantity, unit], p) => ({
        id: `b1b1b1b1-00${String(r.n).padStart(2, "0")}-4000-8000-00000000000${p}`,
        recipe_id: rid(r.n),
        name,
        quantity,
        unit,
        position: p,
      })),
    ),
  });
}

export async function naarSamenstellen(page: Page) {
  await page.goto("/planner");
  await expect(page.getByRole("heading", { name: "Weekmenu" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Stel mijn week samen" }).click();
  await expect(page.getByRole("heading", { name: "Stel je week samen", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Volgende week", exact: true }).click();
  await expect(page.locator(`li[data-dag="${MA}"]`)).toBeVisible({ timeout: 30_000 });
}

export const dag = (page: Page, d: string) => page.locator(`li[data-dag="${d}"]`);
export const voorstel = (page: Page, d: string) => page.locator(`li[data-voorstel="${d}"]`);
export const titel = async (l: Locator) =>
  ((await l.locator("[data-titel]").innerText()) ?? "").trim();
export const kost = async (l: Locator) =>
  Number(await l.locator("[data-kost]").getAttribute("data-kost"));
export const planVolgendeWeek = async () =>
  ((await nepDb()).meal_plan ?? []).filter((p) => VOLGENDE.includes(String(p["plan_date"])));
