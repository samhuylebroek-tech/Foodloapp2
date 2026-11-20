/**
 * P4 — Opdrachten herkennen zonder AI.
 *
 * Vaste regels voor wat je de assistent over je week vraagt ("maak mijn week goedkoper",
 * "vervang woensdag", "ik heb morgen 15 minuten", "Gust eet zaterdag mee", "niemand thuis
 * vrijdag", "zet de ingrediënten van X op de lijst", "wat kan ik maken met pompoen",
 * "verplaats donderdag naar vrijdag"). Nederlands en Vlaams, met varianten en kleine typfouten.
 *
 * De uitkomst is een gestructureerde opdracht of "niet begrepen" met voorbeelden. Herkennen is
 * alles wat hier gebeurt: uitvoeren gebeurt nooit zonder voorstel en bevestiging (acties.ts).
 * Een AI (als die ooit ingesteld is) mag alleen herkennen wat deze regels niet herkennen, en
 * levert dan dezelfde vorm op (herkenner.ts).
 */
import { normaliseerTekst } from "@/lib/zoeken";

export type Soort = "vlees" | "vis" | "vega";

export type Opdracht =
  | { soort: "goedkoper" }
  | { soort: "vervang"; datum: string; gewenst?: Soort | undefined; metEter?: string | undefined }
  | { soort: "weinig-tijd"; datum: string; minuten: number }
  | { soort: "eter"; datum: string; naam: string; mee: boolean }
  | { soort: "niet-thuis"; datum: string }
  | { soort: "op-lijst"; zoek: string; receptId?: string | undefined }
  | { soort: "wat-met"; ingredient: string }
  | { soort: "restjes" }
  | { soort: "verplaats"; van: string; naar: string };

export type Herkenning =
  { ok: true; opdracht: Opdracht } | { ok: false; reden: string; voorbeelden: readonly string[] };

export type HerkenContext = {
  /** Vandaag (JJJJ-MM-DD), voor "morgen" en weekdagen. */
  vandaag: string;
  /** Namen van gezinsleden (voor "Gust eet zaterdag mee"). */
  namen?: readonly string[];
  /** Eigen recepten (voor "zet de ingrediënten van … op de lijst"). */
  recepten?: readonly { id: string; title: string }[];
};

export const VOORBEELDEN = [
  "Maak mijn week goedkoper",
  "Vervang woensdag",
  "Ik heb morgen 15 minuten",
  "Niemand thuis vrijdag",
  "Verplaats donderdag naar vrijdag",
  "Wat kan ik maken met pompoen?",
  "Wat kan ik met mijn restjes?",
] as const;

// ---------------------------------------------------------------- woorden

const WEEKDAGEN: [string, string[]][] = [
  ["maandag", ["ma", "maan"]],
  ["dinsdag", ["di", "dins"]],
  ["woensdag", ["wo", "woe", "woens"]],
  ["donderdag", ["do", "dond", "donder"]],
  ["vrijdag", ["vr", "vrij", "vrydag"]],
  ["zaterdag", ["za", "zat", "zaterdach"]],
  ["zondag", ["zo", "zon"]],
];

/** Afstand tussen twee woorden (Levenshtein), gestopt boven `max`. */
export function afstand(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let vorige = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const rij = [i];
    let kleinste = i;
    for (let j = 1; j <= b.length; j++) {
      const w = Math.min(
        vorige[j]! + 1,
        rij[j - 1]! + 1,
        vorige[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      rij.push(w);
      kleinste = Math.min(kleinste, w);
    }
    if (kleinste > max) return max + 1;
    vorige = rij;
  }
  return vorige[b.length]!;
}

/** Lijkt dit woord (met een kleine typfout) op het doel? Korte woorden moeten exact zijn. */
function lijkt(woord: string, doel: string): boolean {
  if (woord === doel) return true;
  // Eerste letter moet kloppen: "zorgen" is geen "morgen".
  if (doel.length < 5 || woord.length < 4 || woord[0] !== doel[0]) return false;
  const max = doel.length >= 8 ? 2 : 1;
  return afstand(woord, doel, max) <= max;
}

const heeft = (w: readonly string[], ...doelen: string[]) =>
  w.some((x) => doelen.some((d) => lijkt(x, d)));

function plusDagen(datum: string, n: number): string {
  const d = new Date(`${datum}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Index van de weekdag (0 = maandag) als dit woord een weekdag is. */
function weekdagVan(woord: string): number | null {
  for (let i = 0; i < WEEKDAGEN.length; i++) {
    const [naam, kort] = WEEKDAGEN[i]!;
    if (woord === naam || kort.includes(woord)) return i;
    // "woensag", "donderdg", "zatedag": typfouten in de volledige naam.
    if (woord.length >= 6 && afstand(woord, naam, 2) <= 2) return i;
    // "woensdagavond", "vrijdagmiddag"
    if (woord.startsWith(naam) && woord.length > naam.length) return i;
  }
  return null;
}

type DagTreffer = { datum: string; index: number };

/** Alle dagen in de zin, in volgorde: vandaag, morgen, overmorgen, weekdagen ("volgende …"). */
export function dagenIn(woorden: readonly string[], vandaag: string): DagTreffer[] {
  const uit: DagTreffer[] = [];
  const wdVandaag = (new Date(`${vandaag}T12:00:00`).getDay() + 6) % 7;
  woorden.forEach((w, index) => {
    if (w === "vandaag" || w === "vanavond" || lijkt(w, "vanavond")) {
      uit.push({ datum: vandaag, index });
      return;
    }
    if (w === "overmorgen" || lijkt(w, "overmorgen")) {
      uit.push({ datum: plusDagen(vandaag, 2), index });
      return;
    }
    if (w === "morgen" || w === "morgenavond" || lijkt(w, "morgen")) {
      uit.push({ datum: plusDagen(vandaag, 1), index });
      return;
    }
    // Korte afkortingen ("ma", "do", "zo") alleen als ze duidelijk een dag zijn: niet "do" als
    // werkwoord ("wat do ik") en niet "zo" in "zo snel mogelijk". Daarom: alleen na "op" of
    // vóór "naar", of als het hele woord minstens 3 letters heeft.
    const wd = weekdagVan(w);
    if (wd === null) return;
    if (w.length <= 2) {
      const voor = woorden[index - 1];
      const na = woorden[index + 1];
      if (!(voor === "op" || voor === "van" || voor === "naar" || na === "naar")) return;
    }
    let verschil = (wd - wdVandaag + 7) % 7;
    if (woorden[index - 1] === "volgende" || woorden[index - 2] === "volgende") verschil += 7;
    uit.push({ datum: plusDagen(vandaag, verschil), index });
  });
  return uit;
}

const STOP = new Set([
  "de",
  "het",
  "een",
  "mijn",
  "m",
  "n",
  "me",
  "van",
  "voor",
  "aub",
  "alsjeblieft",
  "alstublieft",
  "graag",
  "eens",
  "even",
  "nog",
  "ik",
  "je",
  "jij",
  "wij",
  "we",
  "kan",
  "kun",
  "kunnen",
  "wil",
  "zou",
  "maken",
  "maak",
  "doen",
  "doe",
  "met",
  "iets",
  "wat",
]);

function soortIn(w: readonly string[]): Soort | undefined {
  if (heeft(w, "vegetarisch", "veggie", "vega", "vleesloos", "groenten", "veganistisch"))
    return "vega";
  if (heeft(w, "vis", "zalm", "visgerecht")) return "vis";
  if (heeft(w, "vlees", "vleesgerecht")) return "vlees";
  return undefined;
}

/** Minuten in de zin: "15 minuten", "20 min", "een kwartier", "half uur", "1 uur". */
function minutenIn(tekst: string): number | null {
  const m = /(\d{1,3})\s*(?:minuten|minuutjes|minuut|min|mins|m)\b/.exec(tekst);
  if (m) return Math.max(5, Math.min(240, Number(m[1])));
  if (/\b(half|halve|halfuur|halfuurtje|halfke)\b/.test(tekst)) return 30;
  if (/\bkwartier(tje)?\b/.test(tekst)) return 15;
  const u = /(\d)\s*(?:uur|u)\b/.exec(tekst);
  if (u) return Math.min(240, Number(u[1]) * 60);
  if (/\been uur(tje)?\b/.test(tekst)) return 60;
  return null;
}

/** Welke naam uit het gezin staat in de zin (ook met een kleine typfout)? */
function naamIn(woorden: readonly string[], namen: readonly string[]): string | null {
  for (const naam of namen) {
    const n = normaliseerTekst(naam).split(" ")[0] ?? "";
    if (!n) continue;
    const letters = (x: string) => [...x].sort().join("");
    const raak = (w: string) =>
      w === n ||
      (n.length >= 5 && afstand(w, n, 1) <= 1) ||
      // Twee letters omgewisseld ("Gsut"): zelfde letters, zelfde eerste letter.
      (n.length >= 4 && w.length === n.length && w[0] === n[0] && letters(w) === letters(n));
    if (woorden.some(raak)) return naam;
  }
  return null;
}

/** Recept zoeken op titel: alle (of bijna alle) zoekwoorden komen voor. */
export function vindRecept(
  zoek: string,
  recepten: readonly { id: string; title: string }[],
): { id: string; title: string } | null {
  const woorden = normaliseerTekst(zoek)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP.has(w));
  if (!woorden.length) return null;
  let beste: { r: { id: string; title: string }; score: number } | null = null;
  for (const r of recepten) {
    const titel = normaliseerTekst(r.title).split(" ");
    const raak = woorden.filter((w) =>
      titel.some((t) => t === w || t.startsWith(w) || (w.length >= 5 && afstand(t, w, 1) <= 1)),
    ).length;
    const score = raak / woorden.length;
    if (score >= 0.6 && (!beste || score > beste.score)) beste = { r, score };
  }
  return beste?.r ?? null;
}

const niet = (reden: string): Herkenning => ({ ok: false, reden, voorbeelden: VOORBEELDEN });

// ---------------------------------------------------------------- herkennen

/**
 * Herkent één opdracht. Volgorde telt: eerst de meest specifieke (twee dagen, een lijst, een
 * naam), dan de algemene. Twijfel = niet begrepen (nooit gokken bij een wijziging).
 */
export function herkenOpdracht(zin: string, ctx: HerkenContext): Herkenning {
  const tekst = normaliseerTekst(zin.slice(0, 300));
  if (!tekst) return niet("Typ of kies een vraag.");
  const w = tekst.split(" ");
  const dagen = dagenIn(w, ctx.vandaag);
  const eersteDag = dagen[0]?.datum;

  // 1. Verplaatsen: twee dagen en "naar" / "verplaats" / "schuif" / "wissel … en …".
  const verplaatsWoord = heeft(w, "verplaats", "verplaatsen", "schuif", "schuiven", "verzet");
  const wisselTwee = heeft(w, "wissel", "ruil", "omwisselen") && dagen.length >= 2;
  if (dagen.length >= 2 && (verplaatsWoord || wisselTwee || w.includes("naar"))) {
    const [van, naar] = dagen;
    if (van!.datum === naar!.datum) return niet("Kies twee verschillende dagen.");
    return { ok: true, opdracht: { soort: "verplaats", van: van!.datum, naar: naar!.datum } };
  }

  // 2. Op de boodschappenlijst: "zet de ingrediënten van X op de lijst".
  const lijstWoord = w.some(
    (x) => lijkt(x, "lijst") || x === "lijstje" || lijkt(x, "boodschappenlijst"),
  );
  const ingredientWoord = heeft(w, "ingredienten", "ingredient", "boodschappen", "nodig");
  if (lijstWoord && (ingredientWoord || heeft(w, "zet", "plaats"))) {
    const m =
      /(?:van|voor)\s+(?:de\s+|het\s+|mijn\s+)?(.+?)\s+(?:op|aan|bij|naar)\s+(?:de\s+|mijn\s+|m n\s+)?(?:boodschappen\s*)?(?:lijst|lijstje|boodschappenlijst|boodschappenlijstje)\b/.exec(
        tekst,
      ) ??
      /(?:zet|plaats)\s+(?:de\s+|het\s+)?(.+?)\s+op\s+(?:de\s+|mijn\s+)?(?:boodschappen\s*)?(?:lijst|lijstje|boodschappenlijst)\b/.exec(
        tekst,
      );
    let zoek = (m?.[1] ?? "")
      .replace(
        /^(?:alle\s+)?(?:de\s+)?(?:ingredienten|ingredient|boodschappen)\s+(?:van|voor)\s+/,
        "",
      )
      .trim();
    if (/^(?:alle\s+)?(?:de\s+)?(?:ingredienten|ingredient|boodschappen)$/.test(zoek)) zoek = "";
    if (!zoek)
      return niet(
        "Voor welk recept? Bijvoorbeeld: zet de ingrediënten van stoofvlees op de lijst.",
      );
    const r = ctx.recepten ? vindRecept(zoek, ctx.recepten) : null;
    return { ok: true, opdracht: { soort: "op-lijst", zoek, receptId: r?.id } };
  }

  // 2b. Restjes (fase 3): "wat kan ik met mijn restjes?", "nog restjes over?".
  if (heeft(w, "restje", "restjes", "restjeskoken", "overschot", "overschotjes", "overschotten"))
    return { ok: true, opdracht: { soort: "restjes" } };

  // 3. Een gezinslid eet (niet) mee.
  const naam = naamIn(w, ctx.namen ?? []);
  if (naam && eersteDag && (w.includes("mee") || heeft(w, "meeeten", "komt", "aanschuiven"))) {
    const neen = w.includes("niet") || w.includes("geen");
    const vervangWoord = heeft(w, "vervang", "vervangen", "anders", "andere");
    if (vervangWoord && !neen)
      return {
        ok: true,
        opdracht: { soort: "vervang", datum: eersteDag, metEter: naam, gewenst: soortIn(w) },
      };
    return { ok: true, opdracht: { soort: "eter", datum: eersteDag, naam, mee: !neen } };
  }

  // 4. Niemand thuis / niet koken.
  const nietThuis =
    (w.includes("niemand") && heeft(w, "thuis", "eten", "eet")) ||
    /\bniet thuis\b/.test(tekst) ||
    /\bniet (?:koken|eten)\b/.test(tekst) ||
    /\b(?:uit eten|op restaurant|buitenshuis|op reis|weg)\b/.test(tekst) ||
    /\bgeen (?:eten|avondeten|maaltijd)\b/.test(tekst) ||
    heeft(w, "schrap", "schrappen", "annuleer");
  if (nietThuis && eersteDag)
    return { ok: true, opdracht: { soort: "niet-thuis", datum: eersteDag } };

  // 5. Weinig tijd: "ik heb morgen 15 minuten", "morgen snel iets", "morgen weinig tijd".
  const minuten = minutenIn(tekst);
  const snel =
    /\bweinig tijd\b/.test(tekst) ||
    /\bgeen tijd\b/.test(tekst) ||
    heeft(w, "snel", "snelle", "sneller", "vlug", "haast", "rap", "rappe");
  if (eersteDag && (minuten !== null || snel) && !heeft(w, "goedkoper"))
    return {
      ok: true,
      opdracht: { soort: "weinig-tijd", datum: eersteDag, minuten: minuten ?? 30 },
    };

  // 6. Goedkoper.
  if (
    heeft(
      w,
      "goedkoper",
      "goedkoop",
      "goedkopere",
      "besparen",
      "bespaar",
      "zuiniger",
      "voordeliger",
    ) ||
    /\bminder (?:duur|geld|uitgeven|betalen)\b/.test(tekst) ||
    /\b(?:te duur|binnen (?:mijn |het )?budget)\b/.test(tekst)
  )
    return { ok: true, opdracht: { soort: "goedkoper" } };

  // 7. Vervangen: "vervang woensdag", "iets anders voor woensdag", "woensdag liever vis".
  const vervang =
    heeft(
      w,
      "vervang",
      "vervangen",
      "verander",
      "veranderen",
      "wissel",
      "wisselen",
      "ander",
      "andere",
      "anders",
    ) ||
    (/\bliever\b/.test(tekst) && !!soortIn(w));
  if (vervang && eersteDag)
    return {
      ok: true,
      opdracht: {
        soort: "vervang",
        datum: eersteDag,
        gewenst: soortIn(w),
        ...(naam && /\bmet\b/.test(tekst) ? { metEter: naam } : {}),
      },
    };
  if (vervang && !eersteDag && heeft(w, "vervang", "vervangen"))
    return niet("Welke dag wil je vervangen? Bijvoorbeeld: vervang woensdag.");

  // 8. Wat kan ik maken met …?
  const met =
    /\b(?:met|van|uit)\s+(?:de\s+|het\s+|mijn\s+|wat\s+|een\s+|die\s+)?([a-z][a-z ]{1,40})$/.exec(
      tekst,
    ) ??
    /\bik heb (?:nog )?(?:wat |een |veel )?([a-z][a-z ]{1,40}?)(?: over| liggen| in huis)?$/.exec(
      tekst,
    );
  const vraagWoord =
    heeft(w, "maken", "koken", "recept", "recepten", "idee", "ideeen") ||
    /\bwat (?:kan|doe|moet|maak)\b/.test(tekst) ||
    /\bik heb nog\b/.test(tekst);
  if (met && vraagWoord) {
    const ingredient = met[1]!
      .split(" ")
      .filter((x) => x && !STOP.has(x) && x !== "over" && x !== "liggen")
      .join(" ")
      .trim();
    if (ingredient.length >= 3) return { ok: true, opdracht: { soort: "wat-met", ingredient } };
  }

  if (dagen.length && !vervang)
    return niet("Wat wil je met die dag doen? Kies een voorbeeld hieronder.");
  return niet("Dat begrijp ik (nog) niet.");
}

/** Korte omschrijving van de opdracht, voor in het gesprek ("Ik begreep: …"). */
export function omschrijf(o: Opdracht, dagNaam: (datum: string) => string): string {
  switch (o.soort) {
    case "goedkoper":
      return "Je week goedkoper maken";
    case "vervang":
      return `Een ander gerecht voor ${dagNaam(o.datum)}${o.gewenst ? ` (${o.gewenst === "vega" ? "vegetarisch" : o.gewenst})` : ""}${o.metEter ? `, ${o.metEter} eet mee` : ""}`;
    case "weinig-tijd":
      return `${dagNaam(o.datum)}: hooguit ${o.minuten} minuten koken`;
    case "eter":
      return `${o.naam} eet ${dagNaam(o.datum)} ${o.mee ? "mee" : "niet mee"}`;
    case "niet-thuis":
      return `${dagNaam(o.datum)}: niemand thuis`;
    case "op-lijst":
      return `Ingrediënten van ${o.zoek} op de lijst`;
    case "wat-met":
      return `Gerechten met ${o.ingredient}`;
    case "verplaats":
      return `${dagNaam(o.van)} verplaatsen naar ${dagNaam(o.naar)}`;
    case "restjes":
      return "Wat je met je restjes kan doen";
  }
}
