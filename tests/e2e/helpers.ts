import AxeBuilder from "@axe-core/playwright";
import { expect, test as basis, type Page } from "@playwright/test";

export const NEP_SUPABASE = "http://127.0.0.1:54439";

/**
 * Elke test krijgt een pagina waarop alle externe requests geblokkeerd zijn.
 * Een poging om een echte Supabase/Lovable-host te bereiken laat de test falen.
 */
export const test = basis.extend<{ extern: string[] }>({
  extern: async ({ page }, gebruik) => {
    const extern: string[] = [];
    await page.route("**/*", (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === "127.0.0.1" || host === "localhost") return route.continue();
      extern.push(host);
      return route.abort("blockedbyclient");
    });
    await gebruik(extern);
    const verboden = extern.filter((h) =>
      /supabase\.co$|lovable\.(app|dev)$|foodloapp\.com$/.test(h),
    );
    expect(verboden, "test probeerde een echte server te bereiken").toEqual([]);
  },
});
export { expect };

export async function resetNep() {
  await fetch(`${NEP_SUPABASE}/__reset`);
}

export async function nepLog(): Promise<
  { method: string; path: string; query: string; body: unknown }[]
> {
  return (await (await fetch(`${NEP_SUPABASE}/__log`)).json()) as never;
}

/** WCAG 2.2 A/AA-controle; enkel ernstige en kritieke problemen laten de test falen. */
export async function axeErnstig(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length}×`);
}

/** Interactieve elementen kleiner dan `min` px (hoogte of breedte). */
export async function kleineDoelen(page: Page, min = 44) {
  return page.evaluate((min) => {
    const els = [
      ...document.querySelectorAll<HTMLElement>("button, a[href], input, [role=button]"),
    ];
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.width === 0 || s.visibility === "hidden" || s.display === "none") return false;
        return r.height < min || r.width < min;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`,
      );
  }, min);
}

export async function heeftHorizontaleScroll(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

/** Opslagsleutel van supabase-js voor URL http://127.0.0.1:… */
const SESSIE_SLEUTEL = "sb-127-auth-token";

/** Zet een (nep)sessie klaar vóór de app laadt: de gebruiker is ingelogd. */
export async function meldAan(page: Page) {
  const { token, user } = (await (await fetch(`${NEP_SUPABASE}/__token`)).json()) as {
    token: string;
    user: Record<string, unknown>;
  };
  const sessie = {
    access_token: token,
    refresh_token: "nep-refresh",
    token_type: "bearer",
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user,
  };
  await page.addInitScript(
    ([sleutel, waarde]) => {
      // Slechts één keer per tabblad: anders zou afmelden meteen ongedaan gemaakt worden.
      if (window.sessionStorage.getItem("nep-sessie-gezet")) return;
      window.sessionStorage.setItem("nep-sessie-gezet", "1");
      window.localStorage.setItem(sleutel!, waarde!);
      // Rondleiding/onboarding-hints overslaan zodat de kernflow centraal staat.
      window.localStorage.setItem("rondleiding-gezien", "1");
    },
    [SESSIE_SLEUTEL, JSON.stringify(sessie)],
  );
  return user;
}

export async function nepDb(): Promise<Record<string, Record<string, unknown>[]>> {
  return (await (await fetch(`${NEP_SUPABASE}/__db`)).json()) as never;
}

export async function storing(s: {
  pad: string;
  soort: "fout" | "traag" | "netwerk";
  methode?: string;
  keer?: number;
  ms?: number;
  status?: number;
}) {
  await fetch(`${NEP_SUPABASE}/__storing`, { method: "POST", body: JSON.stringify(s) });
}

export async function seedDb(data: Record<string, Record<string, unknown>[]>) {
  await fetch(`${NEP_SUPABASE}/__seed`, { method: "POST", body: JSON.stringify(data) });
}

/** Zet de nep-database terug op de demodataset (recepten, weekmenu, lijst). */
export async function resetDemo() {
  await fetch(`${NEP_SUPABASE}/__reset?demo=1`);
}
