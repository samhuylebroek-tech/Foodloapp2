/**
 * Fase 6 — regels voor abonnementsbeheer (pure functies, getest in abonnement-regels.test.ts).
 * Alles in TESTMODUS: er wordt niets aangerekend of teruggestort. Bedragen in eurocent, inclusief
 * btw. Termijnen en bedragen komen uit `prijzen.ts`.
 */
import { btwUitInclusief, euro, PRIJZEN } from "./prijzen";
import { PLANNEN, type AbonnementStatus, type PlanId } from "./types";

const DAG = 86_400_000;

export function periodeDagen(plan: PlanId): number {
  return PRIJZEN.periodeDagen[PLANNEN[plan].interval];
}

/** "2026-11-20" → Date om 23:59:59 lokale tijd (einde van die dag). */
function eindeVanDag(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T23:59:59` : iso);
}

export function isoDag(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function plusDagenIso(nu: Date, dagen: number): string {
  return isoDag(new Date(nu.getTime() + dagen * DAG));
}

/** Hele dagen die nog overblijven tot en met de einddatum (minstens 0). */
export function dagenOver(periodeEinde: string | null | undefined, nu: Date = new Date()): number {
  if (!periodeEinde) return 0;
  const t = eindeVanDag(periodeEinde).getTime() - nu.getTime();
  return t <= 0 ? 0 : Math.ceil(t / DAG);
}

export type Wijziging = {
  soort: "upgrade" | "downgrade" | "zelfde" | "niet_mogelijk";
  /** Waarde van de resterende dagen van het huidige plan. */
  tegoedCent: number;
  /** Wat je vandaag (testmodus) zou betalen. */
  teBetalenCent: number;
  /** Wanneer het nieuwe plan ingaat (ISO-dag). */
  ingang: string | null;
  tekst: string;
};

/**
 * Overstappen tussen maand en jaar, pro rata als tekstvoorstel.
 * - Naar een duurder interval (maand → jaar): meteen; het ongebruikte deel van de maand wordt
 *   tegoed en gaat van de jaarprijs af.
 * - Naar een korter interval (jaar → maand): pas vanaf het einde van de betaalde periode; er wordt
 *   niets teruggestort, je houdt wat je betaalde.
 * - Tijdens de proef: je kiest het plan dat na de proef ingaat, je betaalt nu niets.
 */
export function proRataWijziging(i: {
  van: PlanId;
  naar: PlanId;
  status: AbonnementStatus;
  periodeEinde: string | null;
  nu?: Date;
}): Wijziging {
  const nu = i.nu ?? new Date();
  const van = PLANNEN[i.van];
  const naar = PLANNEN[i.naar];
  if (
    van.voor !== "consument" ||
    naar.voor !== "consument" ||
    !["proef", "actief"].includes(i.status)
  )
    return {
      soort: "niet_mogelijk",
      tegoedCent: 0,
      teBetalenCent: 0,
      ingang: null,
      tekst: "Overstappen kan alleen met een lopend Premium-abonnement of tijdens de proef.",
    };
  if (i.van === i.naar)
    return {
      soort: "zelfde",
      tegoedCent: 0,
      teBetalenCent: 0,
      ingang: null,
      tekst: `Je hebt al ${naar.naam}.`,
    };
  const prijsNaar = `${euro(naar.prijsCent)} per ${naar.interval}`;
  if (i.status === "proef") {
    return {
      soort: naar.prijsCent > van.prijsCent ? "upgrade" : "downgrade",
      tegoedCent: 0,
      teBetalenCent: 0,
      ingang: i.periodeEinde,
      tekst: `Je proef loopt gewoon door. Daarna betaal je ${prijsNaar} (testmodus). Nu betaal je niets.`,
    };
  }
  if (periodeDagen(i.naar) > periodeDagen(i.van)) {
    const over = Math.min(dagenOver(i.periodeEinde, nu), periodeDagen(i.van));
    const tegoed = Math.round((van.prijsCent * over) / periodeDagen(i.van));
    const teBetalen = Math.max(0, naar.prijsCent - tegoed);
    return {
      soort: "upgrade",
      tegoedCent: tegoed,
      teBetalenCent: teBetalen,
      ingang: isoDag(nu),
      tekst: `Je stapt vandaag over. De ${over} ${over === 1 ? "dag" : "dagen"} die je nog had, zijn ${euro(tegoed)} tegoed. Je betaalt nu ${euro(teBetalen)} voor een heel jaar (testmodus, voorstel).`,
    };
  }
  return {
    soort: "downgrade",
    tegoedCent: 0,
    teBetalenCent: 0,
    ingang: i.periodeEinde,
    tekst: `Je jaar loopt door tot het einde${i.periodeEinde ? ` (${i.periodeEinde.split("-").reverse().join("/")})` : ""}. Daarna betaal je ${prijsNaar} (testmodus). Er wordt niets teruggestort.`,
  };
}

export type FactuurSoort = "factuur" | "creditnota";

export type FactuurInfo = {
  id: string;
  nummer: string;
  omschrijving: string;
  bedrag_cent: number;
  btw_cent?: number | null;
  btw_procent?: number | null;
  status: "betaald" | "open" | "mislukt";
  soort?: FactuurSoort | null;
  verwijst_naar?: string | null;
  datum: string;
  test: boolean;
};

export function btwVan(f: Pick<FactuurInfo, "bedrag_cent" | "btw_cent" | "btw_procent">): {
  btwCent: number;
  procent: number;
} {
  const procent = f.btw_procent ?? PRIJZEN.btw.procent;
  return { btwCent: f.btw_cent ?? btwUitInclusief(f.bedrag_cent, procent), procent };
}

export type Terugbetaling =
  | { mag: true; factuur: FactuurInfo; bedragCent: number; tekst: string }
  | { mag: false; tekst: string };

/**
 * Terugbetaling binnen de herroepingstermijn (14 dagen na de laatste betaalde factuur).
 * Daarna niet meer: opzeggen kan altijd en Premium blijft dan werken tot het einde van de periode.
 */
export function terugbetalingMogelijk(
  facturen: readonly FactuurInfo[],
  nu: Date = new Date(),
): Terugbetaling {
  const terugbetaald = new Set(
    facturen.filter((f) => f.soort === "creditnota" && f.verwijst_naar).map((f) => f.verwijst_naar),
  );
  const laatste = [...facturen]
    .filter(
      (f) => (f.soort ?? "factuur") === "factuur" && f.status === "betaald" && f.bedrag_cent > 0,
    )
    .sort((a, b) => b.datum.localeCompare(a.datum))[0];
  if (!laatste)
    return { mag: false, tekst: "Er is nog niets betaald, dus niets terug te betalen." };
  if (terugbetaald.has(laatste.id))
    return { mag: false, tekst: "Deze betaling werd al terugbetaald (testmodus)." };
  const leeftijd = nu.getTime() - new Date(`${laatste.datum}T00:00:00`).getTime();
  if (leeftijd > PRIJZEN.herroepingDagen * DAG)
    return {
      mag: false,
      tekst: `Terugbetalen kan tot ${PRIJZEN.herroepingDagen} dagen na een betaling. Opzeggen kan altijd.`,
    };
  return {
    mag: true,
    factuur: laatste,
    bedragCent: laatste.bedrag_cent,
    tekst: `Binnen ${PRIJZEN.herroepingDagen} dagen na je betaling krijg je alles terug: ${euro(laatste.bedrag_cent)} (testmodus). Premium stopt dan meteen; je gratis functies en gegevens blijven.`,
  };
}

/** Tot wanneer Premium blijft werken na een mislukte betaling. */
export function genadeTot(nu: Date = new Date()): string {
  return plusDagenIso(nu, PRIJZEN.genadeDagen);
}

export type Abo = {
  plan: PlanId;
  status: AbonnementStatus;
  periode_einde: string | null;
  genade_tot?: string | null;
  gepland_plan?: PlanId | null;
};

/** Volgende testfactuur (datum + bedrag), of `null` als er geen komt. */
export function volgendeFactuur(abo: Abo | null): { datum: string; bedragCent: number } | null {
  if (!abo || !abo.periode_einde) return null;
  if (abo.status === "geen" || abo.status === "opgezegd") return null;
  const plan = PLANNEN[abo.gepland_plan ?? abo.plan];
  if (abo.status === "betaling_mislukt")
    return { datum: abo.genade_tot ?? abo.periode_einde, bedragCent: PLANNEN[abo.plan].prijsCent };
  return { datum: abo.periode_einde, bedragCent: plan.prijsCent };
}

/**
 * Is de periode voorbij zodat Premium moet sluiten? Opgezegd: na het periode-einde. Mislukte
 * betaling: na de genadeperiode. Nooit voor een lopend of proefabonnement.
 */
export function moetSluiten(abo: Abo | null, nu: Date = new Date()): boolean {
  if (!abo) return false;
  const voorbij = (iso: string | null | undefined) =>
    !!iso && eindeVanDag(iso).getTime() < nu.getTime();
  if (abo.status === "opgezegd") return voorbij(abo.periode_einde);
  if (abo.status === "betaling_mislukt") return voorbij(abo.genade_tot ?? abo.periode_einde);
  return false;
}

/** Testfactuur als platte tekst (download). Duidelijk geen echte factuur. */
export function factuurTekst(f: FactuurInfo, klant = "Foodlo-gebruiker"): string {
  const { btwCent, procent } = btwVan(f);
  const credit = f.soort === "creditnota";
  const teken = credit ? "-" : "";
  const regels = [
    credit ? "TEST-CREDITNOTA — GEEN ECHTE CREDITNOTA" : "TESTFACTUUR — GEEN ECHTE FACTUUR",
    "Foodlo (testmodus). Er werd niets aangerekend of teruggestort.",
    "",
    `Nummer:        ${f.nummer}`,
    `Datum:         ${f.datum.split("-").reverse().join("/")}`,
    `Klant:         ${klant}`,
    `Omschrijving:  ${f.omschrijving}`,
    "",
    `Bedrag excl. btw:  ${teken}${euro(f.bedrag_cent - btwCent)}`,
    `Btw ${procent.toLocaleString("nl-BE")} %:          ${teken}${euro(btwCent)}`,
    `Totaal incl. btw:  ${teken}${euro(f.bedrag_cent)}`,
    `Status:            ${credit ? "terugbetaald (test)" : f.status}`,
    "",
    "Btw: voorbeeld voor België. Het echte tarief per land volgt na de fiscale review.",
  ];
  return regels.join("\n");
}
