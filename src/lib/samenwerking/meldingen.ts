/**
 * P5 — Meldingen in de app (bel-icoon): wat er in je gezin gebeurde, plus restjes die bijna
 * over datum zijn. Nooit naar buiten (geen push, geen e-mail): die staan apart op /meldingen
 * en vragen eerst toestemming.
 *
 * - Per soort aan/uit in Instellingen › Suggesties en meldingen (standaard aan). Een soort die
 *   uit staat, verschijnt niet in de lijst en telt niet mee in de ongelezen teller.
 * - Opslag van de keuzes: op het account (voorstel 0017, `app_melding_instellingen`), anders op
 *   dit toestel.
 * - Privacy: een melding noemt nooit waarom iets niet veilig is (welke allergie, welk dieet).
 *   De tekstbouwers krijgen daarom alleen namen, dagen en gerechten; `schoonMeldingTekst` is
 *   een tweede slot dat een reden toch weghaalt.
 *
 * Puur en getest in meldingen.test.ts.
 */
import { dagNaam, wieTekst } from "@/lib/samenwerking/conflict";

export const MELDING_SOORTEN = [
  {
    id: "menu",
    label: "Weekmenu gewijzigd",
    uitleg: "Als iemand van je gezin iets in het gezinsweekmenu zet, verandert of weghaalt.",
  },
  {
    id: "toegewezen",
    label: "Iets voor jou op de lijst",
    uitleg: 'Als iemand jou iets laat halen ("Jan haalt de bakker").',
  },
  {
    id: "winkelen-klaar",
    label: "Klaar met winkelen",
    uitleg: "Als iemand van je gezin de gezinslijst afrondt na het winkelen.",
  },
  {
    id: "restje",
    label: "Restje bijna over datum",
    uitleg: "Een restje dat je best vandaag of morgen opeet (op dit toestel bijgehouden).",
  },
  {
    id: "conflict",
    label: "Tegelijk gewijzigd",
    uitleg: "Als iemand anders net hetzelfde veranderde als jij, en wat er toen gekozen werd.",
  },
  {
    id: "maker",
    label: "Nieuw van makers die je volgt",
    uitleg:
      "Als een maker die je volgt een nieuw recept deelt (op dit toestel bijgehouden; de maker ziet niet wie volgt).",
  },
] as const;

export type MeldingSoort = (typeof MELDING_SOORTEN)[number]["id"];
const IDS = MELDING_SOORTEN.map((s) => s.id) as readonly string[];

export type MeldingInstellingen = { uit: MeldingSoort[] };
export const STANDAARD_MELDINGEN: MeldingInstellingen = { uit: [] };

export function leesMeldingInstellingen(ruw: unknown): MeldingInstellingen {
  const r = (ruw ?? {}) as { uit?: unknown };
  const uit = Array.isArray(r.uit)
    ? [...new Set(r.uit.filter((x): x is MeldingSoort => typeof x === "string" && IDS.includes(x)))]
    : [];
  return { uit };
}

export function meldingAan(inst: MeldingInstellingen, soort: MeldingSoort): boolean {
  return !inst.uit.includes(soort);
}

export function zetMeldingSoort(
  inst: MeldingInstellingen,
  soort: MeldingSoort,
  aan: boolean,
): MeldingInstellingen {
  const zonder = inst.uit.filter((s) => s !== soort);
  return { uit: aan ? zonder : [...zonder, soort] };
}

const toestelSleutel = (userId: string) => `foodlo:app-meldingen:${userId}`;

export function leesToestelMeldingen(userId: string): MeldingInstellingen {
  try {
    const ruw = window.localStorage.getItem(toestelSleutel(userId));
    return leesMeldingInstellingen(ruw ? JSON.parse(ruw) : null);
  } catch {
    return { ...STANDAARD_MELDINGEN };
  }
}

export function bewaarToestelMeldingen(userId: string, inst: MeldingInstellingen) {
  try {
    window.localStorage.setItem(toestelSleutel(userId), JSON.stringify(inst));
  } catch {
    // Opslag geblokkeerd: de keuze geldt tot je de pagina sluit.
  }
}

/** Eén melding zoals de lijst ze toont. */
export type AppMelding = {
  id: string;
  soort: MeldingSoort;
  tekst: string;
  /** Interne link ("/planner", "/boodschappen?lijst=gezin"); nooit een externe URL. */
  link: string | null;
  gelezen: boolean;
  /** ISO-tijdstip. */
  op: string;
  /** Lokaal afgeleid (restje, maker) of uit de databank (gezin). */
  bron: "gezin" | "toestel";
};

/** Wat zichtbaar is: soorten die aan staan, nieuwste eerst, hooguit `max`. */
export function zichtbareMeldingen(
  lijst: readonly AppMelding[],
  inst: MeldingInstellingen,
  max = 50,
): AppMelding[] {
  return lijst
    .filter((m) => meldingAan(inst, m.soort))
    .sort((a, b) => (a.op < b.op ? 1 : a.op > b.op ? -1 : 0))
    .slice(0, max);
}

export function aantalOngelezen(lijst: readonly AppMelding[], inst: MeldingInstellingen): number {
  return zichtbareMeldingen(lijst, inst, Infinity).filter((m) => !m.gelezen).length;
}

/** "3" of "9+" op de bel. */
export function tellerTekst(n: number): string {
  return n > 9 ? "9+" : String(n);
}

/** Alleen interne paden; alles anders wordt null (geen phishing via een melding). */
export function veiligeLink(link: unknown): string | null {
  if (typeof link !== "string") return null;
  return /^\/(?!\/)[\w\-/?=&.%]*$/.test(link) ? link : null;
}

// ------------------------------------------------------------------ privacy

/**
 * Zinsdelen die een reden geven, zoals oordeelVoorLid ze maakt ("bevat mogelijk noten",
 * "past niet bij vegetarisch", "liever geen gember", "eet liefst weinig vlees") of zoals iemand
 * ze zou typen ("allergisch voor …", "intolerantie …"). Productnamen op een lijst ("noten",
 * "melk") zijn geen gezondheidsgegevens en blijven staan.
 */
const REDEN =
  /\s*[(:,–-]?\s*\b(bevat (mogelijk )?|past niet bij |liever geen |eet liefst |allergi\w*|intoleran\w*|coeliaki\w*)[^.()]*[).]?/gi;

/**
 * Tweede slot: haalt elke reden (allergie, intolerantie, dieet) uit een meldingtekst.
 * "Niet veilig voor Lotte" mag; "Lotte: bevat noten" niet.
 */
export function schoonMeldingTekst(tekst: string): string {
  return tekst
    .replace(REDEN, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200);
}

/** Alleen de namen van wie niet veilig eet, nooit de reden. */
export function waarschuwingZonderReden(
  oordelen: readonly { naam: string; veilig: boolean | null }[],
): string | null {
  const niet = oordelen.filter((o) => o.veilig === false).map((o) => o.naam);
  if (!niet.length) return null;
  const namen =
    niet.length === 1 ? niet[0] : `${niet.slice(0, -1).join(", ")} en ${niet[niet.length - 1]}`;
  return `Let op: niet veilig voor ${namen}`;
}

// ------------------------------------------------------------------ teksten

export type MenuWijziging = "erbij" | "anders" | "weg" | "verplaatst";

export function menuMeldingTekst(o: {
  wie: string | null | undefined;
  datum: string;
  titel: string;
  wat: MenuWijziging;
  /** Optioneel: oordeel per mee-eter; alleen de namen van wie niet veilig eet komen erin. */
  oordelen?: readonly { naam: string; veilig: boolean | null }[];
}): string {
  const wie = wieTekst(o.wie);
  const dag = dagNaam(o.datum);
  const zin =
    o.wat === "erbij"
      ? `${wie} zette ${o.titel} op ${dag}`
      : o.wat === "anders"
        ? `${wie} veranderde ${dag} in ${o.titel}`
        : o.wat === "verplaatst"
          ? `${wie} verplaatste ${o.titel} naar ${dag}`
          : `${wie} haalde ${o.titel} van ${dag}`;
  const let_op = o.oordelen ? waarschuwingZonderReden(o.oordelen) : null;
  return schoonMeldingTekst(let_op ? `${zin}. ${let_op}` : zin);
}

export function toegewezenTekst(o: { wie: string | null | undefined; product: string }): string {
  return schoonMeldingTekst(`${wieTekst(o.wie)} vraagt of jij ${o.product} haalt`);
}

export function winkelenKlaarTekst(o: { wie: string | null | undefined; aantal: number }): string {
  const dingen = o.aantal === 1 ? "1 ding" : `${o.aantal} dingen`;
  return `${wieTekst(o.wie)} is klaar met winkelen (${dingen} gekocht)`;
}

export function conflictMeldingTekst(o: {
  wie: string | null | undefined;
  datum: string;
  mijnTitel: string;
  jouwTitel: string | null;
}): string {
  const wie = wieTekst(o.wie);
  const dag = dagNaam(o.datum);
  return schoonMeldingTekst(
    o.jouwTitel
      ? `${wie} zette ${dag} toch op ${o.mijnTitel} (jij had ${o.jouwTitel} gekozen)`
      : `${wie} zette ${o.mijnTitel} op ${dag}`,
  );
}

export function restjeTekst(o: { titel: string; laatsteDag: boolean }): string {
  return o.laatsteDag
    ? `Restje ${o.titel}: eet het vandaag nog op`
    : `Restje ${o.titel}: best morgen op`;
}

/** "net", "5 min geleden", "14:05", "gisteren", "ma 16/11". */
export function wanneerTekst(iso: string, nu = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const min = Math.floor((nu - t) / 60_000);
  if (min < 1) return "net";
  if (min < 60) return `${min} min geleden`;
  const d = new Date(t);
  const vandaag = new Date(nu);
  const zelfdeDag = d.toDateString() === vandaag.toDateString();
  if (zelfdeDag) return d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
  const gisteren = new Date(nu - 86_400_000);
  if (d.toDateString() === gisteren.toDateString()) return "gisteren";
  return d.toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "numeric" });
}
