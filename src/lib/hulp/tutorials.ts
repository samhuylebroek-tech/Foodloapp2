/**
 * Tutorialbibliotheek: per handleiding een script, storyboard, hoofdstukken en ondertitels
 * (WebVTT), afgeleid uit de stappen van het artikel. Geen stem (beslissing eigenaar:
 * voorlopig geen stemopnames), wel ondertitels. Opnames maakt Playwright op de demo-app
 * (tests/e2e/tutorial-opname.spec.ts, alleen met OPNAME=1); geen betaalde videodienst.
 *
 * Alles wat hier staat, is afgeleid van artikels en erft dus hun status: een concept-artikel
 * levert een concept-tutorial op.
 */
import { MODULES, type ModuleId } from "@/lib/functies";
import type { Artikel } from "./artikels";

export type Scene = {
  nummer: number;
  /** Ondertitel / schermtekst. */
  tekst: string;
  /** Wat er in beeld moet zijn (storyboard). */
  beeld: string;
  start: number; // seconden
  eind: number;
};

export type Tutorial = {
  slug: string;
  titel: string;
  module: ModuleId;
  route: string;
  status: Artikel["status"];
  duur: number;
  scenes: Scene[];
  hoofdstukken: { titel: string; start: number }[];
  beschrijving: string;
};

/** Leestijd: ± 2,5 woorden per seconde, minstens 3 s, hooguit 9 s per ondertitel. */
export function leesduur(tekst: string): number {
  const woorden = tekst.split(/\s+/).filter(Boolean).length;
  return Math.min(9, Math.max(3, Math.round((woorden / 2.5) * 10) / 10));
}

function beeldVoor(stap: string, route: string): string {
  const knoppen = [...stap.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return knoppen.length
    ? `Scherm ${route}: markeer ${knoppen.map((k) => `«${k}»`).join(", ")} en tik erop`
    : `Scherm ${route}: rustig beeld, geen tik`;
}

export function maakTutorial(a: Artikel): Tutorial | null {
  if (a.soort !== "handleiding" || !a.stappen.length) return null;
  const route = a.doeHetNu?.route ?? MODULES.find((m) => m.id === a.module)?.route ?? "/";
  let t = 0;
  const intro = { tekst: a.titel, beeld: `Titelkaart: ${a.titel}` };
  const regels = [intro, ...a.stappen.map((s) => ({ tekst: s, beeld: beeldVoor(s, route) }))];
  const scenes = regels.map((r, i) => {
    const d = i === 0 ? 2.5 : leesduur(r.tekst);
    const s: Scene = { nummer: i + 1, tekst: r.tekst, beeld: r.beeld, start: t, eind: t + d };
    t += d;
    return s;
  });
  return {
    slug: a.slug,
    titel: a.titel,
    module: a.module,
    route,
    status: a.status,
    duur: Math.round(t * 10) / 10,
    scenes,
    hoofdstukken: scenes.slice(1).map((s) => ({ titel: `Stap ${s.nummer - 1}`, start: s.start })),
    beschrijving: `${a.samenvatting} Duur: ± ${Math.round(t)} seconden, met ondertitels, zonder geluid.`,
  };
}

function tijd(sec: number): string {
  const ms = Math.round(sec * 1000);
  const u = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(u)}:${p(m)}:${p(s)}.${p(r, 3)}`;
}

/** Ondertitels in WebVTT (standaard voor HTML5-video, `<track kind="subtitles">`). */
export function naarWebVtt(tut: Tutorial): string {
  const blokken = tut.scenes.map(
    (s) =>
      `${s.nummer}\n${tijd(s.start)} --> ${tijd(s.eind)}\n${s.tekst.replace(/"/g, "”").replace(/-->/g, "→")}`,
  );
  return `WEBVTT\n\n${blokken.join("\n\n")}\n`;
}

/** Hoofdstukken als WebVTT (`<track kind="chapters">`). */
export function hoofdstukkenVtt(tut: Tutorial): string {
  const s = tut.scenes;
  const blokken = tut.hoofdstukken.map((h, i) => {
    const eind = s[i + 2]?.start ?? tut.duur;
    return `${tijd(h.start)} --> ${tijd(eind)}\n${h.titel}`;
  });
  return `WEBVTT\n\n${blokken.join("\n\n")}\n`;
}

/** Leesbaar script voor wie de video maakt of nakijkt (storyboard + tekst). */
export function naarScript(tut: Tutorial): string {
  const kop = `# ${tut.titel}\nModule: ${tut.module} · Start op: ${tut.route} · Duur: ${tut.duur} s · Status: ${tut.status}\n`;
  const scenes = tut.scenes
    .map(
      (s) =>
        `## Scene ${s.nummer} (${s.start.toFixed(1)}–${s.eind.toFixed(1)} s)\nBeeld: ${s.beeld}\nOndertitel: ${s.tekst}`,
    )
    .join("\n\n");
  return `${kop}\n${scenes}\n`;
}

/** Voorbereiding voor vertaling: alle te vertalen regels met een vaste sleutel. */
export function vertaalBestand(tut: Tutorial, taal: string) {
  return {
    taal,
    status: "machinevertaling nodig, daarna menselijke nalezing",
    bron: "nl",
    regels: tut.scenes.map((s) => ({
      sleutel: `${tut.slug}.${s.nummer}`,
      nl: s.tekst,
      vertaling: "",
    })),
  };
}
