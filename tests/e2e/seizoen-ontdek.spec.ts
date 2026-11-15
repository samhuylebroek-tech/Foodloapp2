/**
 * Werkstroom F — Ontdek › "In het seizoen": alleen ideeën met groenten of fruit die nu in België
 * van eigen bodem komen (vaste lijst), met per kaart welk product. Vaste datum: 15 november.
 */
import { axeErnstig, expect, meldAan, resetDemo, test } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  await page.clock.setFixedTime(new Date("2026-11-15T14:00:00"));
});

test("filter 'In het seizoen' in november: pompoen, witloof en appel; geen tomaat of courgette", async ({
  page,
}) => {
  await page.goto("/inspiratie");
  const lijst = page.getByRole("list", { name: "Alle ideeën" });
  await expect(lijst.getByRole("listitem").filter({ hasText: "Shakshuka met feta" })).toBeVisible();

  const knop = page.getByRole("button", { name: "In het seizoen", exact: true });
  await knop.click();
  await expect(knop).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "van bij ons" })).toContainText(
    "In november van bij ons: witloof, pompoen",
  );
  await expect(
    lijst.getByRole("listitem").filter({ hasText: "Romige pompoensoep met gember" }),
  ).toBeVisible();
  await expect(
    lijst.getByRole("listitem").filter({ hasText: "Witloofgratin met hesp en kaas" }),
  ).toBeVisible();
  await expect(lijst.getByRole("listitem").filter({ hasText: "Appeltaart van oma" })).toBeVisible();
  await expect(lijst.getByRole("listitem").filter({ hasText: "Shakshuka met feta" })).toHaveCount(
    0,
  );
  await expect(
    lijst.getByRole("listitem").filter({ hasText: "Pasta met pesto en geroosterde groenten" }),
  ).toHaveCount(0);
  await expect(lijst.getByRole("listitem").filter({ hasText: "Romige pompoensoep" })).toContainText(
    "Seizoen: pompoen",
  );
  expect(await axeErnstig(page)).toEqual([]);

  await knop.click();
  await expect(lijst.getByRole("listitem").filter({ hasText: "Shakshuka met feta" })).toBeVisible();
});
