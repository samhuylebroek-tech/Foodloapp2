/**
 * Module B (community): "Ik heb het gemaakt" op een openbaar makerrecept, eigen bijdrage
 * verwijderen met ongedaan maken, en melden van andermans bijdrage. Eigen recepten (niet openbaar)
 * krijgen geen community. Nepdata.
 */
import { expect, meldAan, nepDb, resetDemo, test } from "./helpers";
import type { Page } from "@playwright/test";

const IK = "11111111-1111-4111-8111-111111111111";
const TAJINE = "a7a7a7a7-0000-4000-8000-000000000003";
const STOOFVLEES = "aaaaaaaa-0000-4000-8000-000000000001";

const mijnBijdragen = async () =>
  ((await nepDb()).community_bijdragen ?? []).filter(
    (b) => b["user_id"] === IK && b["recipe_id"] === TAJINE,
  );

/** "Ongedaan maken" in de voorste melding (oudere meldingen liggen eronder). */
const ongedaan = (page: Page) =>
  page
    .locator('[data-sonner-toast][data-front="true"]')
    .getByRole("button", { name: "Ongedaan maken" })
    .click();

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("bijdrage plaatsen, verwijderen en terugzetten", async ({ page }) => {
  await page.goto(`/recepten/${TAJINE}`);
  const sectie = page.getByRole("region", { name: "Zo kookten anderen het" });
  await expect(sectie.getByText("Met wat extra kaneel")).toBeVisible();

  await sectie.getByRole("button", { name: "Ik heb het gemaakt" }).click();
  // Zonder sterren: vriendelijke uitleg, niets verstuurd.
  await sectie.getByLabel("Eén zin over hoe het ging").fill("Heerlijk, met couscous erbij.");
  await sectie.getByRole("button", { name: "Delen" }).click();
  await expect(sectie.getByRole("alert")).toContainText("sterren");
  expect(await mijnBijdragen()).toHaveLength(0);

  await sectie.getByRole("button", { name: "4 sterren" }).click();
  await sectie.getByRole("button", { name: "Delen" }).click();
  await expect(sectie.getByText("Heerlijk, met couscous erbij.")).toBeVisible();
  await expect.poll(async () => (await mijnBijdragen()).length).toBe(1);
  const b = (await mijnBijdragen())[0]!;
  expect(b["sterren"]).toBe(4);
  expect(b["weergavenaam"]).toBe("Marie");

  const mijn = sectie.getByRole("listitem").filter({ hasText: "Heerlijk, met couscous erbij." });
  await expect(mijn.getByText("Jij")).toBeVisible();
  await mijn.getByRole("button", { name: "Verwijderen" }).click();
  await expect(sectie.getByText("Heerlijk, met couscous erbij.")).toHaveCount(0);
  await expect.poll(async () => (await mijnBijdragen()).length).toBe(0);
  await ongedaan(page);
  await expect(sectie.getByText("Heerlijk, met couscous erbij.")).toBeVisible();
  await expect.poll(async () => (await mijnBijdragen()).length).toBe(1);
});

test("andermans bijdrage melden komt in de wachtrij (en in Jouw makerpagina)", async ({ page }) => {
  await page.goto(`/recepten/${TAJINE}`);
  const sectie = page.getByRole("region", { name: "Zo kookten anderen het" });
  const jan = sectie.getByRole("listitem").filter({ hasText: "Met wat extra kaneel" });
  await jan.getByRole("button", { name: "Melden" }).click();
  const venster = page.getByRole("dialog", { name: "Wat is er mis?" });
  await expect(venster.getByRole("button", { name: "Melding versturen" })).toBeDisabled();
  await venster.getByText("Verborgen reclame of spam").click();
  await venster.getByRole("button", { name: "Melding versturen" }).click();
  await expect(page.getByText("Het Foodlo-team bekijkt je melding")).toBeVisible();
  await expect
    .poll(async () => {
      const m = (await nepDb()).content_meldingen ?? [];
      return m.map((x) => `${x["soort"]}/${x["reden"]}/${x["status"]}/${x["melder_id"]}`);
    })
    .toEqual([`bijdrage/reclame/open/${IK}`]);
});

test("eigen (niet-openbaar) recept heeft geen community", async ({ page }) => {
  await page.goto(`/recepten/${STOOFVLEES}`);
  await expect(page.getByRole("button", { name: "Start koken" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ik heb het gemaakt" })).toHaveCount(0);
  // "Bewaar in…" kan wel bij je eigen recepten.
  await expect(page.getByRole("button", { name: /Bewaard in 1|Bewaar in…/ })).toBeVisible();
});
