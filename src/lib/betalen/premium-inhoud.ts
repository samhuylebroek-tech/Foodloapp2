/**
 * Fase 6 — inhoud van de premium-extra's. Deze lijst wordt ALLEEN door de server teruggegeven
 * (`premiumExtra`, na `vereisRecht`), zodat wie geen recht heeft de inhoud ook via een directe
 * aanroep niet krijgt. Vaste, redactionele inhoud: geen AI, geen kosten.
 */

/** Wat in België per maand op zijn best is (vereenvoudigd, vollegrond en bewaargroenten). */
export const SEIZOEN_PER_MAAND: readonly (readonly string[])[] = [
  ["Witloof en prei", "Knolselder en pastinaak", "Spruitjes en boerenkool", "Appels en peren"],
  ["Witloof en prei", "Rode kool en savooi", "Schorseneren", "Appels en peren"],
  ["Prei en spinazie", "Witloof", "Radijsjes", "Rabarber (vroeg)"],
  ["Asperges (vroeg)", "Spinazie en rucola", "Radijsjes", "Rabarber"],
  ["Asperges", "Jonge wortelen", "Sla en rucola", "Aardbeien"],
  ["Erwten en tuinbonen", "Courgette", "Sla", "Aardbeien en kersen"],
  ["Tomaten", "Courgette en aubergine", "Snijbonen", "Frambozen en bessen"],
  ["Tomaten en paprika", "Maïs", "Snijbonen", "Pruimen en bramen"],
  ["Pompoen (vroeg)", "Venkel", "Prei", "Appels, peren en druiven"],
  ["Pompoen en butternut", "Paddenstoelen", "Knolselder", "Appels en peren"],
  ["Pompoen en butternut", "Prei en witloof", "Spruitjes en boerenkool", "Appels en peren"],
  ["Spruitjes en boerenkool", "Witloof", "Rode kool", "Appels, peren en noten"],
];

export const MAANDEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

export type WeekSjabloon = {
  id: string;
  naam: string;
  uitleg: string;
  dagen: readonly string[];
};

export const WEEK_SJABLONEN: readonly WeekSjabloon[] = [
  {
    id: "snel",
    naam: "Snelle week",
    uitleg: "Elke avond klaar in een halfuur.",
    dagen: [
      "Pasta met tomaat en spinazie",
      "Omelet met kruiden en salade",
      "Wok met kip en groenten",
      "Wraps met bonen en avocado",
      "Vissticks met erwtjes en puree",
    ],
  },
  {
    id: "veggie",
    naam: "Veggie week",
    uitleg: "Vijf dagen zonder vlees of vis, toch stevig.",
    dagen: [
      "Linzensoep met brood",
      "Ovenschotel met pompoen en feta",
      "Kikkererwtencurry met rijst",
      "Risotto met paddenstoelen",
      "Stoemp met prei en een spiegelei",
    ],
  },
  {
    id: "budget",
    naam: "Budgetweek",
    uitleg: "Slim met restjes en goedkope basis.",
    dagen: [
      "Stoofvlees met wortelen (dubbele portie)",
      "Restjes stoofvlees in een pasta",
      "Erwtensoep",
      "Aardappeltortilla",
      "Rijst met groenten en ei",
    ],
  },
];

export function seizoenVoor(nu: Date = new Date()): { maand: string; items: readonly string[] } {
  const m = nu.getMonth();
  return { maand: MAANDEN[m]!, items: SEIZOEN_PER_MAAND[m]! };
}
