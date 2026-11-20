/**
 * Fase 3 — "Heb ik al" op de lijst, "Klaar met winkelen" met vinkjes, het voorraadscherm
 * (zoeken, plek, aanpassen, bijna op → lijst, foutstaat) en verzamelingen (maken, herschikken,
 * eruit halen, delen, inplannen met allergie-/dieetcontrole). Nepdata (demo).
 */
import { DEMO_USER_ID } from "./demo-data.mjs";
import {
  axeErnstig,
  expect,
  meldAan,
  nepDb,
  resetDemo,
  seedDb,
  storing,
  test,
  voorraadBijhouden,
} from "./helpers";

const R = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const lijstItem = async (naam: string) =>
  ((await nepDb()).shopping_items ?? []).find((i) => i["name"] === naam);
const voorraad = async (naam: string) =>
  ((await nepDb()).pantry_items ?? []).find((i) => i["naam"] === naam);

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("lijst: 'Heb ik al' → van de lijst, in de voorraad; ongedaan maken zet alles terug", async ({
  page,
  extern,
}) => {
  await voorraadBijhouden(page);
  await page.goto("/boodschappen");
  await page.getByRole("button", { name: "melk: heb ik al" }).click();
  await expect.poll(async () => (await lijstItem("melk")) ?? null).toBeNull();
  await expect.poll(async () => (await voorraad("melk"))?.["hoeveelheid"]).toBe(1);
  expect((await voorraad("melk"))?.["eenheid"]).toBe("l");
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect.poll(async () => (await lijstItem("melk"))?.["checked"]).toBe(false);
  await expect.poll(async () => (await voorraad("melk")) ?? null).toBeNull();
  expect(extern).toEqual([]);
});

test("lijst: 'Heb ik al' zonder voorraad bijhouden zet niets in de voorraad", async ({
  page,
  extern,
}) => {
  await page.goto("/boodschappen");
  await page.getByRole("button", { name: "citroen: heb ik al" }).click();
  await expect.poll(async () => (await lijstItem("citroen")) ?? null).toBeNull();
  expect(await voorraad("citroen")).toBeUndefined();
  expect(extern).toEqual([]);
});

test("Klaar met winkelen met 'eerst vragen': alleen het aangevinkte gaat naar de voorraad", async ({
  page,
  extern,
}) => {
  await page.addInitScript(
    (id) => window.localStorage.setItem(`foodlo:na-winkelen:${id}`, "vragen"),
    DEMO_USER_ID,
  );
  await page.goto("/boodschappen");
  await page.getByRole("button", { name: "Klaar met winkelen" }).first().click();
  const vraag = page.getByRole("dialog", { name: "Wat mag in je voorraad?" });
  await expect(vraag).toBeVisible();
  await expect(vraag.getByRole("checkbox")).toHaveCount(2);
  expect(await axeErnstig(page)).toEqual([]);
  await vraag.getByText("koffie").click();
  await vraag.getByRole("button", { name: "Zet in voorraad (1)" }).click();
  await expect.poll(async () => (await voorraad("zalmfilet"))?.["hoeveelheid"]).toBe(2);
  expect(await voorraad("koffie")).toBeUndefined();
  await expect.poll(async () => (await lijstItem("koffie")) ?? null).toBeNull();
  expect(extern).toEqual([]);
});

test("Voorraad › Na het winkelen: de keuze wordt onthouden", async ({ page, extern }) => {
  await page.goto("/voorraad");
  await page.getByRole("radio", { name: "Niet in de voorraad zetten" }).check();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Niet in de voorraad zetten" })).toBeChecked();
  expect(extern).toEqual([]);
});

test("voorraad: zoeken, per plek, aanpassen, bijna op → één tik op de lijst", async ({
  page,
  extern,
}) => {
  await page.goto("/voorraad");
  const inHuis = page.getByRole("list", { name: "In huis", exact: true });
  await expect(inHuis.getByRole("list", { name: "Koelkast" })).toContainText("eieren");
  await expect(inHuis.getByRole("list", { name: "Kast", exact: true })).toContainText("uien");

  await page.getByRole("searchbox", { name: "Zoek in je voorraad" }).fill("ui");
  await expect(inHuis).toContainText("uien");
  await expect(inHuis).not.toContainText("bloem");
  await page.getByRole("searchbox", { name: "Zoek in je voorraad" }).fill("kokos");
  await expect(page.getByText(/Niets gevonden voor/)).toBeVisible();
  await page.getByRole("button", { name: "Toon alles" }).click();

  await page.getByRole("button", { name: "Aanpassen: eieren" }).click();
  const vak = page.getByRole("form", { name: "Aanpassen: eieren" });
  await vak.getByLabel("Hoeveelheid").fill("0");
  await vak.getByRole("button", { name: "Bewaren" }).click();
  await expect(vak.getByText("Typ een getal groter dan 0")).toBeVisible();
  await vak.getByLabel("Hoeveelheid").fill("1");
  await vak.getByRole("radio", { name: "Kast", exact: true }).check();
  expect(await axeErnstig(page)).toEqual([]);
  await vak.getByRole("button", { name: "Bewaren" }).click();
  await expect.poll(async () => (await voorraad("eieren"))?.["hoeveelheid"]).toBe(1);
  await expect.poll(async () => (await voorraad("eieren"))?.["plek"]).toBe("kast");
  await expect(inHuis.getByRole("list", { name: "Kast", exact: true })).toContainText("Bijna op");

  await page.getByRole("button", { name: "eieren op mijn lijst" }).click();
  await expect.poll(async () => (await lijstItem("eieren"))?.["checked"]).toBe(false);
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect.poll(async () => (await lijstItem("eieren")) ?? null).toBeNull();
  expect(extern).toEqual([]);
});

test("voorraad: laden mislukt → rustige melding met opnieuw proberen", async ({ page, extern }) => {
  await storing({ pad: "/rest/v1/pantry_items", soort: "fout", methode: "GET", keer: 60 });
  await page.goto("/voorraad");
  const fout = page.getByRole("alert").filter({ hasText: "Je voorraad laden lukte niet." });
  await expect(fout).toBeVisible({ timeout: 30_000 });
  await storing({ pad: "/rest/v1/pantry_items", soort: "fout", keer: 0 });
  await fout.getByRole("button", { name: "Opnieuw proberen" }).click();
  await expect(page.getByRole("list", { name: "In huis", exact: true })).toContainText("bloem");
  expect(extern).toEqual([]);
});

test("verzameling: maken vanuit Keuken, herschikken, eruit en terug, privé uitleg", async ({
  page,
  extern,
}) => {
  const V = "e7e7e7e7-0000-4000-8000-0000000000e1";
  await seedDb({
    collections: [
      {
        id: V,
        user_id: DEMO_USER_ID,
        naam: "Volgorde",
        beschrijving: null,
        openbaar: false,
        created_at: "2026-11-03T10:00:00Z",
      },
    ],
    collection_recipes: [
      { id: "e8e8e8e8-0000-4000-8000-0000000000e1", collection_id: V, recipe_id: R(1), positie: 0 },
      { id: "e8e8e8e8-0000-4000-8000-0000000000e2", collection_id: V, recipe_id: R(2), positie: 1 },
    ],
  });
  await page.goto("/gerechten");
  await page.getByRole("button", { name: "Nieuwe verzameling" }).click();
  await page.getByLabel("Naam van de verzameling").fill("Snel door de week");
  await page.getByRole("button", { name: "Maken", exact: true }).click();
  await expect(page).toHaveURL(/\/verzamelingen\//);
  await expect
    .poll(async () =>
      ((await nepDb()).collections ?? []).some((c) => c["naam"] === "Snel door de week"),
    )
    .toBe(true);

  await page.goto(`/verzamelingen/${V}`);
  const lijst = page.getByRole("list", { name: "Recepten in Volgorde" });
  const items = lijst.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("Stoofvlees met frietjes");
  const posities = async () =>
    ((await nepDb()).collection_recipes ?? [])
      .filter((r) => r["collection_id"] === V)
      .sort((a, b) => Number(a["positie"]) - Number(b["positie"]))
      .map((r) => r["recipe_id"]);
  await lijst.getByRole("button", { name: "Stoofvlees met frietjes naar beneden" }).click();
  await expect(items.first()).toContainText("Romige pompoensoep");
  await expect.poll(posities).toEqual([R(2), R(1)]);
  // Toetsenbord: Alt + pijl omhoog op het tweede recept zet het terug bovenaan.
  await lijst.getByRole("button", { name: "Stoofvlees met frietjes naar boven" }).focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(posities).toEqual([R(1), R(2)]);
  await expect(items.first()).toContainText("Stoofvlees met frietjes");

  await lijst.getByRole("button", { name: "Romige pompoensoep uit de verzameling" }).click();
  await expect(items).toHaveCount(1);
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect(items).toHaveCount(2);
  await expect(page.getByText(/Privé: alleen jij ziet deze verzameling/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Deel link" })).toHaveCount(0);
  await page.getByRole("switch", { name: "Tonen op mijn makerpagina" }).click();
  await expect(page.getByRole("button", { name: "Deel link" })).toBeVisible();
  expect(await axeErnstig(page)).toEqual([]);
  expect(extern).toEqual([]);
});

test("verzameling inplannen: nakijken, vlees overgeslagen voor wie vegetarisch eet, Doe maar, ongedaan", async ({
  page,
  extern,
}) => {
  const V = "e7e7e7e7-0000-4000-8000-0000000000f3";
  await seedDb({
    collections: [
      {
        id: V,
        user_id: DEMO_USER_ID,
        naam: "Herfst",
        beschrijving: null,
        openbaar: false,
        created_at: "2026-11-02T10:00:00Z",
      },
    ],
    collection_recipes: [
      { id: "e8e8e8e8-0000-4000-8000-0000000000f1", collection_id: V, recipe_id: R(1), positie: 0 },
      { id: "e8e8e8e8-0000-4000-8000-0000000000f2", collection_id: V, recipe_id: R(2), positie: 1 },
    ],
  });
  const plan = async () =>
    ((await nepDb()).meal_plan ?? []).filter((p) => p["recipe_id"] === R(2) && !p["group_id"])
      .length;
  const voor = await plan();
  await page.goto(`/verzamelingen/${V}`);
  await page.getByRole("link", { name: "Inplannen in mijn week" }).click();
  await expect(page).toHaveURL(/\/assistent\?verzameling=/);
  const kaart = page.locator("[data-voorstel]").last();
  await expect(kaart.getByRole("heading", { name: '"Herfst" in je week' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(kaart).toContainText("Romige pompoensoep");
  await expect(kaart).toContainText("Niet ingepland");
  await expect(kaart).toContainText("Stoofvlees met frietjes");
  await expect(page.locator("main")).not.toContainText(/vegetarisch|noten/i);
  expect(await axeErnstig(page)).toEqual([]);
  expect(await plan()).toBe(voor);
  await kaart.getByRole("button", { name: "Doe maar" }).click();
  await expect(kaart.getByRole("status")).toContainText("Gedaan");
  await expect.poll(plan).toBe(voor + 1);
  await kaart.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect.poll(plan).toBe(voor);
  expect(extern).toEqual([]);
});
