/**
 * Fase 3 — Ontdek: thema's uit de catalogus, zonder AI. Puur en getest.
 * Een thema bevat de recepten waarvoor het geldt; de pagina toont alleen thema's met ≥ 2.
 */
import { bepaalDieet } from "@/lib/dieet";
import type { InspiratieRecept } from "@/lib/inspiratie";
import { normaliseerTekst } from "@/lib/zoeken";

export type Thema = { id: string; titel: string; uitleg: string; recepten: InspiratieRecept[] };

const minuten = (r: InspiratieRecept) => r.prep_minutes + r.cook_minutes;
const heeft = (r: InspiratieRecept, woorden: string[]) => {
  const tekst = normaliseerTekst([r.title, r.category, ...(r.tags ?? [])].join(" "));
  return woorden.some((w) => tekst.includes(w));
};

/** Seizoensthema voor een maand (0 = januari). */
export function seizoen(maand: number): {
  id: string;
  titel: string;
  uitleg: string;
  woorden: string[];
} {
  if (maand >= 10 || maand <= 1)
    return {
      id: "winter",
      titel: "Soep en stoofpot",
      uitleg: "Warm en vullend voor koude dagen",
      woorden: ["soep", "stoof", "stoverij", "ovenschotel", "stamppot", "stoemp", "witloof", "pompoen"],
    };
  if (maand <= 4)
    return {
      id: "lente",
      titel: "Lentegroen",
      uitleg: "Fris, licht en vol groenten",
      woorden: ["asperge", "erwt", "spinazie", "radijs", "salade", "kruiden", "lente"],
    };
  if (maand <= 7)
    return {
      id: "zomer",
      titel: "Zomers en licht",
      uitleg: "Salades, grill en weinig tijd aan het fornuis",
      woorden: ["salade", "barbecue", "bbq", "grill", "tomaat", "courgette", "zomer"],
    };
  return {
    id: "herfst",
    titel: "Herfstklassiekers",
    uitleg: "Paddenstoelen, pompoen en ovenschotels",
    woorden: ["pompoen", "champignon", "paddenstoel", "oven", "stoof", "appel", "herfst"],
  };
}

export function themas(recepten: InspiratieRecept[], maand = new Date().getMonth()): Thema[] {
  const s = seizoen(maand);
  const lijst: Thema[] = [
    {
      id: s.id,
      titel: s.titel,
      uitleg: s.uitleg,
      recepten: recepten.filter((r) => heeft(r, s.woorden)),
    },
    {
      id: "snel",
      titel: "Klaar in 30 minuten",
      uitleg: "Voor drukke avonden",
      recepten: recepten.filter((r) => minuten(r) > 0 && minuten(r) <= 30),
    },
    {
      id: "vega",
      titel: "Vegetarisch",
      uitleg: "Zonder vlees of vis, wel vol smaak",
      recepten: recepten.filter((r) => bepaalDieet(r.title, r.tags) === "vegetarisch"),
    },
    {
      id: "weekend",
      titel: "Voor het weekend",
      uitleg: "Als je er de tijd voor neemt",
      recepten: recepten.filter((r) => minuten(r) >= 90),
    },
  ];
  return lijst.filter((t) => t.recepten.length >= 2);
}
