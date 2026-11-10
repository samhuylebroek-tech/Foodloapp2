/**
 * Gedeelde meetfunctie voor de visuele audits (audit-mobiel, audit-profiel-beheer).
 * Zie audit-mobiel.spec.ts voor wat er gemeten wordt.
 */
import type { Page } from "@playwright/test";

export async function klaar(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

export type Bevinding = { soort: string; tekst: string; detail?: string };

/** Meet in de pagina. Geeft unieke bevindingen terug. */
export async function meet(page: Page): Promise<Bevinding[]> {
  return page.evaluate(() => {
    const uit: { soort: string; tekst: string; detail?: string }[] = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1)
      uit.push({
        soort: "horizontale-scroll",
        tekst: `${document.documentElement.scrollWidth}px > ${vw}px`,
      });
    const zichtbaar = (el: Element) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
    };
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (!zichtbaar(el) || el.closest("[aria-hidden='true'], .sr-only, svg")) continue;
      const tekst = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => (n.textContent ?? "").trim())
        .join(" ")
        .trim();
      if (!tekst || el.tagName === "INPUT" || el.tagName === "TEXTAREA") continue;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const kort = tekst.slice(0, 60);
      if (el.scrollWidth > el.clientWidth + 1) {
        if (s.textOverflow === "ellipsis") uit.push({ soort: "afgekapt (ellips)", tekst: kort });
        else if (s.overflowX === "hidden" || s.overflowX === "clip")
          uit.push({ soort: "weggeknipt (zonder ellips)", tekst: kort });
        else if (s.overflowX === "visible")
          uit.push({
            soort: "loopt over kader",
            tekst: kort,
            detail: `${el.scrollWidth}>${el.clientWidth}`,
          });
      }
      if (
        s.webkitLineClamp &&
        s.webkitLineClamp !== "none" &&
        el.scrollHeight > el.clientHeight + 2
      )
        uit.push({ soort: "afgekapt (regels)", tekst: kort });
      const inScroller = (() => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll") return true;
        }
        return false;
      })();
      if ((r.right > vw + 1 || r.left < -1) && !inScroller)
        uit.push({ soort: "buiten scherm", tekst: kort });
      if (el.closest("button, [role=button]")) {
        let regels = 0;
        for (const n of Array.from(el.childNodes)) {
          if (n.nodeType !== 3 || !(n.textContent ?? "").trim()) continue;
          const bereik = document.createRange();
          bereik.selectNodeContents(n);
          const tops = new Set(Array.from(bereik.getClientRects()).map((x) => Math.round(x.top)));
          regels = Math.max(regels, tops.size);
        }
        if (regels > 2)
          uit.push({ soort: "knoptekst > 2 regels", tekst: kort, detail: `${regels}` });
      }
      if ((s.wordBreak === "break-all" || s.overflowWrap === "anywhere") && r.height > 40)
        uit.push({ soort: "woord kan midden breken", tekst: kort });
    }
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>(
        "button, a[href], input:not([type=hidden]), select, [role=button], [role=checkbox], [role=switch], [role=tab]",
      ),
    )) {
      if (!zichtbaar(el) || el.closest(".sr-only") || el.classList.contains("sr-only")) continue;
      if (el.closest("p") && el.tagName === "A") continue; // link in lopende tekst
      const r = el.getBoundingClientRect();
      const naam = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40);
      const maat = `${Math.round(r.width)}×${Math.round(r.height)}`;
      if (r.height < 24 || r.width < 24)
        uit.push({ soort: "doel < 24 px", tekst: naam, detail: maat });
      else if (r.height < 44 || r.width < 44)
        uit.push({ soort: "doel < 44 px", tekst: naam, detail: maat });
    }
    const gezien = new Set<string>();
    return uit.filter((b) => {
      const k = `${b.soort}|${b.tekst}`;
      if (gezien.has(k)) return false;
      gezien.add(k);
      return true;
    });
  });
}
