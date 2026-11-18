/**
 * Recept uit losse tekst halen ZONDER AI (fase 2).
 *
 * Gebruikt als terugval wanneer de slimme hulp niet beschikbaar is (demo, tests, geen credits,
 * storing) en voor de beschrijving onder een video. Het resultaat gaat altijd naar het
 * nakijkscherm; wat we niet zeker weten, staat in `onzeker`.
 */
import { parseIngredientLine } from "@/lib/ingredienten";

export type OnzekerVeld = "naam" | "ingredienten" | "hoeveelheden" | "stappen" | "personen" | "gok";

export type Onzeker = { veld: OnzekerVeld; uitleg: string };

export type TekstRecept = {
  title: string;
  description: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  category: string;
  difficulty: string;
  tags: string[];
  ingredients: { name: string; quantity: number | null; unit: string }[];
  instructions: string[];
};

const KOP_INGREDIENTEN =
  /^(?:ingredi[eë]nten|ingredients?|wat heb je nodig|wat je nodig hebt|benodigdheden|boodschappen|nodig)\b(?:\s*\([^)]*\))?\s*:?\s*/i;
const KOP_STAPPEN =
  /^(?:bereiding(?:swijze)?|werkwijze|instructies|stappen|zo maak je het|zo maak je het klaar|aan de slag|method|instructions|directions|preparation|recept)\b\s*:?\s*/i;
const PERSONEN = /(?:voor\s+)?(\d{1,2})\s*(?:personen|pers\.?|porties|persoon|servings|people)\b/i;
const MINUTEN =
  /(?:bereidingstijd|kooktijd|totale tijd|tijd|klaar in|duurt|in)\s*:?\s*(?:±|ca\.?|ongeveer)?\s*(\d{1,3})\s*(?:min|minuten|minutes)\b/i;
const NAAR_SMAAK = /\b(naar smaak|snuf(je)?|scheutje|beetje|wat|handvol|optioneel)\b/i;
// Emoji's en pictogrammen vooraan een regel (Instagram, TikTok).
const VERSIERING = /^(?:[\s\p{Extended_Pictographic}•·*▪►✔✓☑-]|\u{FE0F}|\u{200D})+/u;

function schoonRegel(regel: string): string {
  return regel
    .replace(VERSIERING, "")
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isRuis(regel: string): boolean {
  if (!regel) return true;
  if (/^(#\S+\s*)+$/.test(regel)) return true; // alleen hashtags
  if (/^https?:\/\/\S+$/i.test(regel)) return true; // alleen een link
  if (/^(volg|follow|like|deel|share|bewaar|save|link in bio|abonneer)\b/i.test(regel)) return true;
  return false;
}

/** Verwijdert "1.", "1)", "Stap 1:", "Step 2 -" vooraan. */
export function zonderNummer(regel: string): string {
  return regel
    .replace(/^(?:(?:stap|step)\s*\d+\s*[:.)-]?|\d{1,2}\s*[.)]|\d{1,2}\s*-(?=\s))\s*/i, "")
    .trim();
}

function isGenummerd(regel: string): boolean {
  return /^(?:(?:stap|step)\s*\d+|\d{1,2}\s*[.)])\s*\S/i.test(regel);
}

function lijktIngredient(regel: string): boolean {
  if (/^\d{1,2}\s*[.)]\s/.test(regel)) return false; // genummerde stap
  if (/^\d{1,2}:\d{2}/.test(regel)) return false; // tijdcode
  const woorden = regel.split(/\s+/).length;
  if (/[.!?]$/.test(regel) && woorden > 4) return false;
  if (/^(?:\d|½|¼|¾|⅓|⅔)/.test(regel)) return woorden <= 9;
  if (NAAR_SMAAK.test(regel) && woorden <= 6) return true;
  return false;
}

function lijktStap(regel: string): boolean {
  if (isGenummerd(regel) || /^\d{1,2}:\d{2}/.test(regel)) return true;
  const woorden = regel.split(/\s+/).length;
  return woorden >= 5;
}

function ingredientVan(regel: string) {
  const p = parseIngredientLine(regel);
  return p ? { name: p.name, quantity: p.quantity, unit: p.unit ?? "" } : null;
}

/** Splitst "200 g bloem, 2 eieren en 1 snuf zout" (alles op één regel) in losse ingrediënten. */
function splitsInline(regel: string): string[] {
  return regel
    .split(/\s*[,;]\s*|\s+(?:en|and)\s+(?=\d)/i)
    .map((d) => d.trim())
    .filter(Boolean);
}

export function leesReceptTekst(tekst: string): { recept: TekstRecept; onzeker: Onzeker[] } {
  const regels = tekst
    .replace(/\r/g, "")
    .split("\n")
    .map(schoonRegel)
    .filter((r) => !isRuis(r));

  let title = "";
  const ingredienten: string[] = [];
  const stappen: string[] = [];
  const beschrijving: string[] = [];
  let servings = 0;
  let minuten = 0;
  let deel: "start" | "ing" | "stap" = "start";

  for (const regel of regels) {
    const pers = regel.match(PERSONEN);
    if (pers && !servings && regel.split(/\s+/).length <= 8) {
      servings = Number(pers[1]);
      if (!KOP_INGREDIENTEN.test(regel)) continue;
    }
    const min = regel.match(MINUTEN);
    if (min && !minuten && regel.split(/\s+/).length <= 8) {
      minuten = Number(min[1]);
      continue;
    }
    if (KOP_INGREDIENTEN.test(regel)) {
      deel = "ing";
      const rest = regel
        .replace(KOP_INGREDIENTEN, "")
        .replace(PERSONEN, "")
        .replace(/^[\s:()-]+|[\s:()-]+$/g, "");
      if (rest) ingredienten.push(...splitsInline(rest));
      continue;
    }
    if (KOP_STAPPEN.test(regel) && regel.replace(KOP_STAPPEN, "").split(/\s+/).length < 4) {
      deel = "stap";
      const rest = regel.replace(KOP_STAPPEN, "").trim();
      if (rest) stappen.push(zonderNummer(rest));
      continue;
    }
    if (
      !title &&
      deel === "start" &&
      !ingredienten.length &&
      !stappen.length &&
      !lijktIngredient(regel) &&
      !isGenummerd(regel)
    ) {
      if (regel.length <= 80 && regel.split(/\s+/).length <= 10) {
        title = regel.replace(/[:.!]+$/, "").trim();
        continue;
      }
    }
    if (deel === "ing") {
      // Na de ingrediënten begint de bereiding vaak zonder kop: een lange zin of "1.".
      if (!lijktIngredient(regel) && lijktStap(regel) && ingredienten.length > 0) {
        deel = "stap";
        stappen.push(zonderNummer(regel));
      } else ingredienten.push(regel);
      continue;
    }
    if (deel === "stap") {
      stappen.push(zonderNummer(regel));
      continue;
    }
    // Zonder koppen: per regel raden.
    if (lijktIngredient(regel)) ingredienten.push(regel);
    else if (lijktStap(regel)) {
      if (ingredienten.length || isGenummerd(regel) || /^\d{1,2}:\d{2}/.test(regel))
        stappen.push(zonderNummer(regel));
      else beschrijving.push(regel);
    } else if (ingredienten.length && !stappen.length && regel.split(/\s+/).length <= 4)
      ingredienten.push(regel);
    else beschrijving.push(regel);
  }

  const ingredients = ingredienten
    .map(ingredientVan)
    .filter((x): x is NonNullable<typeof x> => x !== null && x.name.length > 0);
  const instructions = stappen.filter((s) => s.length > 1);

  const onzeker: Onzeker[] = [];
  if (!title)
    onzeker.push({ veld: "naam", uitleg: "We vonden geen naam. Geef het gerecht een naam." });
  if (!ingredients.length)
    onzeker.push({
      veld: "ingredienten",
      uitleg: "We vonden geen ingrediënten. Vul ze aan, één per regel.",
    });
  const zonderMaat = ingredients.filter((i) => i.quantity === null && !NAAR_SMAAK.test(i.name));
  if (zonderMaat.length)
    onzeker.push({
      veld: "hoeveelheden",
      uitleg: `Geen hoeveelheid bij: ${zonderMaat.map((i) => i.name).join(", ")}.`,
    });
  if (!instructions.length)
    onzeker.push({ veld: "stappen", uitleg: "We vonden geen bereiding. Vul de stappen aan." });
  // Het aantal personen vragen we pas bij het inplannen (zoals bij zelf typen).

  return {
    recept: {
      title,
      description: beschrijving.join(" ").slice(0, 400),
      servings: servings || 4,
      prep_minutes: 0,
      cook_minutes: minuten,
      category: "hoofdgerecht",
      difficulty: "makkelijk",
      tags: [],
      ingredients,
      instructions,
    },
    onzeker,
  };
}
