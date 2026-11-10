import { meldAan, resetDemo, test } from "./helpers";
import { EIGENAAR, seedEigenaar } from "./beheer-paden";
test("kruimel", async ({ page }) => {
  await resetDemo(); await seedEigenaar(); await meldAan(page, EIGENAAR);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/beheer/ui"); await page.waitForLoadState("networkidle").catch(() => undefined); await page.waitForTimeout(800);
  await page.getByText("Control Center").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-samhuylebroek-Documents-GitHub-dinner-dialogue-hub/3eb3b235-ec85-4fa7-ba7e-da1be7923dbe/scratchpad/kruimel.png" });
});
