/**
 * Ronde 3: de assistent als één ervaring. De receptpagina toont "Waarom nu" met dezelfde motor en
 * woorden als Vandaag; uit als "Slimme voorstellen" uit staat. Nepdata, geen AI.
 */
import { expect, meldAan, resetDemo, test, voorraadBijhouden, zetKlok } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const RECEPTEN = [1, 2, 3, 4, 5, 6, 7, 8].map(
  (n) => `/recepten/aaaaaaaa-0000-4000-8000-00000000000${n}`,
);

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  await voorraadBijhouden(page);
  await zetKlok(page, 14);
});

test("receptpagina: 'Waarom nu' met echte redenen, en weg als slimme voorstellen uit staan", async ({
  page,
  extern,
}) => {
  // Minstens één van de demorecepten heeft een echte reden (seizoen, in huis, geschiedenis).
  let gevonden: string | null = null;
  for (const pad of RECEPTEN) {
    await page.goto(pad);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const regel = page.getByTestId("waarom-nu");
    if (await regel.count()) {
      await expect(regel).toContainText("Waarom nu:");
      expect(await regel.innerText()).not.toContain("Uit je eigen recepten");
      gevonden = pad;
      break;
    }
  }
  expect(gevonden).not.toBeNull();

  await page.evaluate((id) => window.localStorage.setItem(`foodlo:slim:${id}`, "uit"), IK);
  await page.goto(gevonden!);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("waarom-nu")).toHaveCount(0);
  void extern;
});
