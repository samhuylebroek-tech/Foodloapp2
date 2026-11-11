import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FUNCTIES, MODULES, moduleVoorPad } from "@/lib/functies";
import { ARTIKELS, geciteerdeLabels, zichtbareArtikels, type Artikel } from "./artikels";
import { controleerInhoud, groepeerVragen } from "./controle";
import { hoofdstukkenVtt, maakTutorial, naarScript, naarWebVtt, vertaalBestand } from "./tutorials";
import { beantwoord, zoekHulp } from "./zoeken";

const ROOT = path.resolve(__dirname, "../../..");

/** Alle broncode van de app, ZONDER de hulpinhoud zelf (anders citeert de uitleg zichzelf). */
function bronTekst(): string {
  const uit: string[] = [];
  const loop = (map: string) => {
    for (const n of readdirSync(map)) {
      const p = path.join(map, n);
      if (statSync(p).isDirectory()) loop(p);
      else if (/\.(tsx?|jsx?)$/.test(n) && !/\.test\./.test(n)) uit.push(readFileSync(p, "utf8"));
    }
  };
  for (const map of ["src/routes", "src/components", "src/hooks"]) loop(path.join(ROOT, map));
  // lib behalve hulp/ en het register
  for (const n of readdirSync(path.join(ROOT, "src/lib"))) {
    const p = path.join(ROOT, "src/lib", n);
    if (n === "hulp" || n === "functies.ts" || statSync(p).isDirectory() || /\.test\./.test(n))
      continue;
    uit.push(readFileSync(p, "utf8"));
  }
  return uit.join("\n");
}

const BRON = bronTekst();
const inCode = (t: string) => BRON.includes(t);
const bestandBestaat = (p: string) => existsSync(path.join(ROOT, p));

describe("Content Manager: hulpinhoud tegen de echte app", () => {
  const rapport = controleerInhoud({
    artikels: ARTIKELS,
    functies: FUNCTIES,
    inCode,
    bestandBestaat,
  });

  it("het functieregister klopt: elk bestand bestaat, elk label staat in de code", () => {
    expect(rapport.registerFouten).toEqual([]);
  });
  it("geen enkel artikel citeert een knop die niet bestaat of een onbekende functie", () => {
    expect(rapport.artikels.filter((a) => a.verouderd.length)).toEqual([]);
  });
  it("elke functie uit het register heeft minstens één artikel", () => {
    expect(rapport.functiesZonderUitleg).toEqual([]);
  });
  it("elke module heeft uitleg en elk 'Doe het nu' wijst naar een bestaand scherm", () => {
    for (const m of MODULES)
      expect(
        ARTIKELS.some((a) => a.module === m.id),
        m.id,
      ).toBe(true);
    const routes = readdirSync(path.join(ROOT, "src/routes"));
    for (const a of ARTIKELS.filter((x) => x.doeHetNu)) {
      const pad = a.doeHetNu!.route.replace(/^\//, "") || "index";
      const bestaat = routes.some(
        (r) => r === `${pad.replace(/\//g, ".")}.tsx` || r === `${pad}.index.tsx`,
      );
      expect(bestaat, `${a.slug} → ${a.doeHetNu!.route}`).toBe(true);
    }
  });
  it("slugs zijn uniek", () => {
    expect(new Set(ARTIKELS.map((a) => a.slug)).size).toBe(ARTIKELS.length);
  });
});

describe("Content Manager: signaleert verouderde en verzonnen uitleg", () => {
  const nep: Artikel = {
    ...ARTIKELS[0]!,
    slug: "nep",
    stappen: ['Tik op "Knop die niet bestaat".'],
    functies: ["bestaat.niet"],
  };
  it("meldt een verzonnen knop en een onbekende functie", () => {
    const r = controleerInhoud({ artikels: [nep], functies: FUNCTIES, inCode, bestandBestaat });
    expect(r.artikels[0]!.verouderd).toEqual([
      "functie bestaat.niet bestaat niet",
      'knop of tekst "Knop die niet bestaat" staat niet in de app',
    ]);
  });
  it("meldt een hernoemde knop in het register", () => {
    const r = controleerInhoud({
      artikels: [],
      functies: [{ ...FUNCTIES[0]!, labels: ["Oude knopnaam die weg is"] }],
      inCode,
      bestandBestaat,
    });
    expect(r.registerFouten[0]).toMatch(/Oude knopnaam die weg is/);
  });
  it("goedgekeurd zonder nalezer telt als fout (alleen mensen publiceren)", () => {
    const r = controleerInhoud({
      artikels: [{ ...ARTIKELS[0]!, status: "goedgekeurd" }],
      functies: FUNCTIES,
      inCode,
      bestandBestaat,
    });
    expect(r.artikels[0]!.verouderd).toContain("goedgekeurd zonder nalezer");
  });
});

describe("publicatie: AI-concepten zijn niet zichtbaar in productie", () => {
  it("alle huidige artikels zijn door AI voorbereide concepten", () => {
    expect(ARTIKELS.every((a) => a.status === "concept" && a.bron === "ai")).toBe(true);
  });
  it("zonder concepten-vlag (productie) blijft alleen goedgekeurde inhoud over", () => {
    expect(zichtbareArtikels(false)).toEqual([]);
    expect(zichtbareArtikels(true)).toHaveLength(ARTIKELS.length);
  });
});

describe("zoeken en assistent", () => {
  it("vindt het juiste artikel bij een vraag in gewone taal", () => {
    expect(zoekHulp("hoe deel ik mijn lijst met mijn partner", ARTIKELS)[0]!.artikel.module).toBe(
      "gezin",
    );
    expect(zoekHulp("recept van instagram bewaren", ARTIKELS)[0]!.artikel.slug).toBe(
      "recept-toevoegen",
    );
    expect(zoekHulp("wat kan ik koken met wat in huis is", ARTIKELS)[0]!.artikel.slug).toBe(
      "voorraad",
    );
  });
  it("kan tegen tikfouten", () => {
    expect(zoekHulp("winkelmoduss", ARTIKELS)[0]!.artikel.slug).toBe("winkelmodus");
    expect(zoekHulp("klantekaart", ARTIKELS)[0]!.artikel.slug).toBe("klantenkaarten");
  });
  it("de assistent antwoordt alleen met stappen uit een artikel en noemt de bron", () => {
    const a = beantwoord(
      "ik heb geen internet in de winkel en mijn lijst is niet bewaard",
      ARTIKELS,
    );
    expect(a.soort).toBe("antwoord");
    if (a.soort !== "antwoord") return;
    expect(a.bron.slug).toBe("niet-bewaard");
    expect(a.stappen).toEqual(a.bron.stappen);
  });
  it("verzint niets als er geen passend artikel is", () => {
    expect(beantwoord("kan ik bitcoin minen", ARTIKELS).soort).toBe("geen");
    expect(beantwoord("hoe en wat", ARTIKELS).soort).toBe("geen");
  });
  it("contextuele hulp: elk hoofdscherm hoort bij een module", () => {
    for (const p of [
      "/",
      "/planner",
      "/boodschappen",
      "/gerechten",
      "/voorraad",
      "/inspiratie",
      "/gezin",
      "/instellingen",
    ])
      expect(moduleVoorPad(p), p).not.toBeNull();
    expect(moduleVoorPad("/beheer")).toBeNull();
  });
  it("groepeert vragen per artikel; wat niet past, wordt een signaal", () => {
    const g = groepeerVragen(
      ["hoe nodig ik mijn vrouw uit", "gezin uitnodigen lukt niet", "kan ik bitcoin minen"],
      ARTIKELS,
      zoekHulp,
    );
    expect(g.find((x) => x.slug === "gezin-uitnodigen")?.vragen).toHaveLength(2);
    expect(g.find((x) => x.slug === null)?.vragen).toEqual(["kan ik bitcoin minen"]);
  });
});

describe("tutorials: script, storyboard, ondertitels, hoofdstukken, vertaling", () => {
  const tut = maakTutorial(ARTIKELS.find((a) => a.slug === "winkelmodus")!)!;
  it("één scene per stap plus een titelkaart, tijden lopen op", () => {
    expect(tut.scenes).toHaveLength(4);
    for (let i = 1; i < tut.scenes.length; i++)
      expect(tut.scenes[i]!.start).toBe(tut.scenes[i - 1]!.eind);
    expect(tut.duur).toBeLessThanOrEqual(60);
  });
  it("geldige WebVTT-ondertitels en hoofdstukken", () => {
    const vtt = naarWebVtt(tut);
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toMatch(/^1\n00:00:00\.000 --> 00:00:02\.500\nWinkelen met de winkelmodus$/m);
    expect(vtt).not.toMatch(/-->.*-->/);
    expect(hoofdstukkenVtt(tut)).toMatch(/Stap 1/);
  });
  it("storyboard markeert de echte knoppen", () => {
    expect(naarScript(tut)).toContain("«Ik ga winkelen»");
  });
  it("vertaalbestand bevat alle regels en is gemarkeerd als na te lezen", () => {
    const v = vertaalBestand(tut, "fr");
    expect(v.regels).toHaveLength(tut.scenes.length);
    expect(v.status).toMatch(/nalezing/);
  });
  it("elke handleiding levert een tutorial; vragen en problemen niet", () => {
    for (const a of ARTIKELS) expect(!!maakTutorial(a), a.slug).toBe(a.soort === "handleiding");
  });
  it("geciteerde labels uit een artikel", () => {
    expect(geciteerdeLabels(ARTIKELS.find((a) => a.slug === "winkelmodus")!)).toEqual([
      "Ik ga winkelen",
      "Klaar met winkelen",
    ]);
  });
});
