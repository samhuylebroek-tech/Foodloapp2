/**
 * Ronde 3 (MOBILE_ARCHITECTURE M3): zonder internet nooit een wit scherm. De service worker bewaart
 * het offline-scherm vooraf en toont het voor een pagina die niet in de cache zit.
 * Nepdata; de browser wordt echt offline gezet.
 */
import { expect, meldAan, resetDemo, test } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("offline een nooit bezochte pagina openen toont het offline-scherm met een weg terug", async ({
  page,
  context,
  extern,
}) => {
  await page.goto("/");
  // Wachten tot de service worker actief is en het offline-scherm bewaard heeft.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const namen = await caches.keys();
          for (const n of namen)
            if (await (await caches.open(n)).match("/offline.html")) return true;
          return false;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
  // Zeker zijn dat de service worker deze pagina beheert (na de eerste registratie herladen).
  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.goto("/hulp/tutorials").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Even geen internet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Opnieuw proberen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Naar mijn lijst" })).toBeVisible();
  await context.setOffline(false);
  void extern;
});
