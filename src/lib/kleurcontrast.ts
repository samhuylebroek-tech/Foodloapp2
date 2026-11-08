/**
 * WCAG-contrast voor OKLCH-kleuren (zoals in src/styles.css).
 * Gebruikt in tests om de kleurtokens van licht én donker thema te bewaken.
 */

export type Rgb = [number, number, number];

/** OKLCH (L 0..1, C, H in graden) → lineaire sRGB (0..1, geclamped). */
export function oklchNaarLineairRgb(l: number, c: number, h: number): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  const klem = (x: number) => Math.min(1, Math.max(0, x));
  return [klem(r), klem(g), klem(bl)];
}

/** Relatieve luminantie volgens WCAG (op lineaire sRGB). */
export function luminantie([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: Rgb, b: Rgb): number {
  const la = luminantie(a);
  const lb = luminantie(b);
  const [hoog, laag] = la > lb ? [la, lb] : [lb, la];
  return (hoog + 0.05) / (laag + 0.05);
}

/** Leest "oklch(0.47 0.075 158)" (ook met procent of alfa genegeerd). */
export function parseOklch(waarde: string): Rgb | null {
  const m = waarde.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return null;
  const l = Number(m[1]) / (m[2] === "%" ? 100 : 1);
  return oklchNaarLineairRgb(l, Number(m[3]), Number(m[4]));
}

/** Haalt `--naam: waarde;`-tokens uit één CSS-blok (bv. ":root" of ".dark"). */
export function leesTokens(css: string, selector: string): Record<string, string> {
  const start = css.search(new RegExp(`(^|\\n)\\s*${selector.replace(".", "\\.")}\\s*\\{`));
  if (start < 0) return {};
  const open = css.indexOf("{", start);
  const sluit = css.indexOf("}", open);
  const blok = css.slice(open + 1, sluit);
  const uit: Record<string, string> = {};
  for (const m of blok.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    uit[m[1]!] = m[2]!.trim();
  }
  return uit;
}
