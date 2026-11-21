/**
 * P4 — Van opdracht naar voorstel: wat zou er veranderen?
 *
 * Elke opdracht (opdrachten.ts) wordt hier via de planner-engine (P1) een voorstel met duidelijke
 * verschillen: menu (oud → nieuw per dag), lijst (erbij / eraf), kost (± €) en wie meeëet. Alles
 * gaat door dezelfde veiligheid als overal (allergie, dieet, "liever niet", mee-eters per persoon).
 *
 * Hier wordt niets uitgevoerd. De stappen worden pas na "Doe maar" uitgevoerd (uitvoeren.ts),
 * via `wijzigMenu` (één keer ongedaan maken). "Nee" verandert niets.
 *
 * Pure functies: zelfde invoer, zelfde voorstel. Geen netwerk, geen AI.
 */
import { bekendeKost, euro } from "@/lib/budget";
import type { HuishoudenLid, LidVoeding } from "@/lib/gezin-veiligheid";
import { toegelaten } from "@/lib/intelligentie/voorstel";
import {
  RESTJE_VOORSTEL_DAGEN,
  bewaarRichtwaarde,
  dagenOud,
  gekooktTekst,
  restjeVeilig,
  type Restje,
} from "@/lib/intelligentie/restjes";
import { etersVoorMaaltijd } from "@/lib/maaltijd-eters";
import {
  FILTER_TEKST,
  keuzeVoor,
  kostVoor,
  maakGoedkoper,
  menuUit,
  rangschikDag,
  type DagKeuze,
  type PlanContext,
  type PlanDag,
  type PlanKandidaat,
} from "@/lib/planner/engine";
import { canoniekeNaam } from "@/lib/product-herkenning";
import type { Recipe } from "@/lib/types";
import {
  etiketVoorEters,
  maaltijdOordeel,
  namenLijst,
  nietGeschikt,
  type EtersContext,
} from "@/lib/voorstel-eters";
import { isBasis, zitInVoorraad } from "@/lib/voorraad-match";
import { soortVan } from "@/lib/weekmenu-voorstel";
import { normaliseerTekst } from "@/lib/zoeken";
import { vindRecept, type Opdracht, type Soort } from "./opdrachten";

// ---------------------------------------------------------------- typen

/** Een geplande maaltijd (eigen weekmenu, geen gezinsmaaltijd). */
export type MenuRij = {
  id: string;
  datum: string;
  moment: string;
  recipeId: string | null;
  titel: string;
  personen: number | null;
  /** Bewaarde mee-eters; null = standaard (het hele huishouden). */
  eterIds: readonly string[] | null;
};

export type AssistentContext = {
  vandaag: string;
  /** Eigen maaltijden vanaf vandaag (twee weken). */
  rijen: readonly MenuRij[];
  /** Kandidaten en je regels (allergie, dieet, liever niet, keuken, budget …). */
  plan: Omit<PlanContext, "dagen">;
  leden: readonly HuishoudenLid[];
  voeding: ReadonlyMap<string, LidVoeding>;
  kijkerId: string | null | undefined;
  /** Serveroordeel voor leden waarvan je de gegevens niet mag lezen. */
  server?: Readonly<Record<string, ReadonlyMap<string, boolean>>> | undefined;
  /** Wat je in huis hebt (voorraad + basis), voor het lijstvoorstel. */
  inHuis: readonly string[];
  standaardPersonen: number;
  /** Het hoofdmoment van de dag ("avondeten"). */
  hoofdMoment: string;
  /** Restjes (toestel of account), voor "wat kan ik met mijn restjes?". */
  restjes?: readonly Restje[] | undefined;
  /** Tijdstip "nu" (ms), voor de leeftijd van restjes; standaard Date.now(). */
  nu?: number | undefined;
};

export type MenuVerschil = {
  datum: string;
  moment: string;
  van: string | null;
  naar: string | null;
  uitleg?: string | undefined;
};

export type Stap =
  | { soort: "vervang"; planId: string; recipeId: string }
  | { soort: "verplaats"; planId: string; datum: string; moment: string }
  | { soort: "weg"; planId: string }
  | { soort: "erbij"; datum: string; moment: string; recipeId: string; personen: number }
  | {
      soort: "eters";
      planId: string;
      lidIds: string[];
      vorige: string[] | null;
      personen: { nu: number; voorheen: number };
    }
  | { soort: "lijst"; recipeId: string; personen: number };

export type Idee = {
  id: string;
  title: string;
  minuten: number;
  reden: string;
  /** Geen recept om te openen (bv. een restje zonder recept). */
  geenLink?: boolean | undefined;
};

export type Voorstel = {
  titel: string;
  menu: MenuVerschil[];
  lijst: { erbij: string[]; eraf: string[] };
  /** Geschatte kost van de maaltijden die veranderen (voor → na). */
  kost: { voor: number; na: number; verschil: number } | null;
  /** Wie eet mee op de dagen die veranderen. */
  eters: { datum: string; namen: string[] }[];
  waarschuwingen: string[];
  stappen: Stap[];
  ideeen?: Idee[] | undefined;
  /** Er valt niets te doen (uitleg in gewone taal). Dan is er geen "Doe maar". */
  leeg?: string | undefined;
};

// ---------------------------------------------------------------- hulp

const WEEKDAG = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

/** "vandaag", "morgen", "woensdag". */
export function dagNaam(datum: string, vandaag: string): string {
  if (datum === vandaag) return "vandaag";
  const d = new Date(`${datum}T12:00:00`);
  const v = new Date(`${vandaag}T12:00:00`);
  const verschil = Math.round((d.getTime() - v.getTime()) / 86400000);
  if (verschil === 1) return "morgen";
  const naam = WEEKDAG[(d.getDay() + 6) % 7]!;
  return verschil >= 7 ? `${naam} ${d.getDate()}/${d.getMonth() + 1}` : naam;
}

function plusDagen(datum: string, n: number) {
  const d = new Date(`${datum}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const kandidaatVan = (ctx: AssistentContext, id: string | null) =>
  id ? (ctx.plan.kandidaten.find((k) => k.id === id) ?? null) : null;

function etersVan(ctx: AssistentContext, ids: readonly string[] | null): HuishoudenLid[] {
  return ctx.leden.length ? etersVoorMaaltijd(ctx.leden, ids) : [];
}

function etersContext(ctx: AssistentContext, eters: readonly HuishoudenLid[]): EtersContext | null {
  if (!eters.length) return null;
  return {
    eters,
    voeding: ctx.voeding,
    kijkerId: ctx.kijkerId,
    ...(ctx.server ? { server: ctx.server } : {}),
  };
}

function personenVan(ctx: AssistentContext, rij: MenuRij | null, eters: readonly unknown[]) {
  return rij?.personen ?? (eters.length || ctx.standaardPersonen);
}

function dagVan(
  ctx: AssistentContext,
  rij: MenuRij | null,
  datum: string,
  eters: readonly HuishoudenLid[],
  extra: Partial<PlanDag> = {},
): PlanDag {
  return {
    datum,
    moment: rij?.moment ?? ctx.hoofdMoment,
    personen: extra.personen ?? personenVan(ctx, rij, eters),
    eters: etersContext(ctx, eters),
    ...extra,
  };
}

/** Hoofdmaaltijd op een dag: eerst het hoofdmoment, anders de eerste met een recept. */
function rijOp(ctx: AssistentContext, datum: string): MenuRij | null {
  const op = ctx.rijen.filter((r) => r.datum === datum);
  return (
    op.find((r) => r.moment === ctx.hoofdMoment) ?? op.find((r) => r.recipeId) ?? op[0] ?? null
  );
}

function soortVanKandidaat(k: PlanKandidaat): Soort {
  return soortVan(
    { title: k.title, description: "", tags: k.tags } as unknown as Recipe,
    k.ingredienten,
  );
}

/** Andere maaltijden telen mee voor variatie (niet twee keer hetzelfde in 7 dagen). */
function gekozenBehalve(ctx: AssistentContext, behalve: readonly string[]) {
  return ctx.rijen
    .filter((r) => !behalve.includes(r.id) && r.recipeId)
    .map((r) => ({ datum: r.datum, kandidaat: kandidaatVan(ctx, r.recipeId) }))
    .filter((g): g is { datum: string; kandidaat: PlanKandidaat } => !!g.kandidaat);
}

function basisPlan(
  ctx: AssistentContext,
  dagen: PlanDag[],
  extra: Partial<PlanContext> = {},
): PlanContext {
  return { ...ctx.plan, dagen, ...extra };
}

/** Producten (canoniek) die je voor een recept moet kopen: niet de basis, niet wat in huis is. */
function teKopen(ctx: AssistentContext, id: string | null): Map<string, string> {
  const uit = new Map<string, string>();
  const k = kandidaatVan(ctx, id);
  if (!k) return uit;
  for (const n of k.ingredienten) {
    if (!n.trim() || isBasis(n) || zitInVoorraad(n, [...ctx.inHuis])) continue;
    const c = canoniekeNaam(n) || normaliseerTekst(n);
    // Sleutel = de herkende productnaam; tonen doen we de naam uit het recept.
    if (c && !uit.has(c)) uit.set(c, n.trim());
  }
  return uit;
}

/**
 * Lijstverschil: wat erbij komt en wat eraf kan. Wat een andere maaltijd in de komende 7 dagen
 * nog nodig heeft, blijft staan (zoals de lijst zelf rekent).
 */
function lijstVerschil(
  ctx: AssistentContext,
  wissels: readonly { van: string | null; naar: string | null }[],
  weg: readonly string[],
): { erbij: string[]; eraf: string[] } {
  const venster = plusDagen(ctx.vandaag, 6);
  const blijft = new Set<string>();
  for (const r of ctx.rijen)
    if (!weg.includes(r.id) && r.datum <= venster)
      for (const p of teKopen(ctx, r.recipeId).keys()) blijft.add(p);
  const erbij = new Set<string>();
  const eraf = new Set<string>();
  const naam = new Map<string, string>();
  for (const w of wissels) {
    const voor = teKopen(ctx, w.van);
    const na = teKopen(ctx, w.naar);
    for (const [p, n] of na)
      if (!voor.has(p) && !blijft.has(p)) {
        erbij.add(p);
        naam.set(p, n);
      }
    for (const [p, n] of voor)
      if (!na.has(p) && !blijft.has(p)) {
        eraf.add(p);
        naam.set(p, n);
      }
  }
  for (const p of erbij) eraf.delete(p);
  const toon = (x: Set<string>) =>
    [...x].map((p) => naam.get(p) ?? p).sort((a, b) => a.localeCompare(b));
  return { erbij: toon(erbij), eraf: toon(eraf) };
}

function kostVan(ctx: AssistentContext, id: string | null, personen: number): number | null {
  const k = kandidaatVan(ctx, id);
  return k ? bekendeKost(kostVoor(k, personen, ctx.plan.prijsBron)) : null;
}

function kostVerschil(
  ctx: AssistentContext,
  delen: readonly {
    van: string | null;
    naar: string | null;
    personen: number;
    personenNa?: number;
  }[],
): Voorstel["kost"] {
  let voor = 0;
  let na = 0;
  let bekend = false;
  for (const d of delen) {
    const a = d.van ? kostVan(ctx, d.van, d.personen) : 0;
    const b = d.naar ? kostVan(ctx, d.naar, d.personenNa ?? d.personen) : 0;
    if (a === null || b === null) continue;
    bekend = true;
    voor += a;
    na += b;
  }
  if (!bekend) return null;
  const r = (x: number) => Math.round(x * 100) / 100;
  return { voor: r(voor), na: r(na), verschil: r(na - voor) };
}

function leegVoorstel(titel: string, leeg: string, extra: Partial<Voorstel> = {}): Voorstel {
  return {
    titel,
    menu: [],
    lijst: { erbij: [], eraf: [] },
    kost: null,
    eters: [],
    waarschuwingen: [],
    stappen: [],
    leeg,
    ...extra,
  };
}

/** Beste veilige gerecht voor één dag (zelfde filters en score als "Stel mijn week samen"). */
function besteVoorDag(
  ctx: AssistentContext,
  dag: PlanDag,
  opties: {
    behalve: readonly string[];
    nietRecept?: string | null;
    gewenst?: Soort | undefined;
    versoepel?: PlanContext["versoepel"];
  },
): { keuze: DagKeuze | null; krapste: keyof typeof FILTER_TEKST | null; soortGevonden: boolean } {
  const plan = basisPlan(ctx, [dag], {
    alGepland: new Set(
      ctx.rijen.filter((r) => !opties.behalve.includes(r.id) && r.recipeId).map((r) => r.recipeId!),
    ),
    ...(opties.versoepel ? { versoepel: opties.versoepel } : {}),
  });
  const { lijst, krapste } = rangschikDag(plan, dag, gekozenBehalve(ctx, opties.behalve));
  const anders = lijst.filter((k) => k.id !== opties.nietRecept);
  if (opties.gewenst) {
    const vanSoort = anders.find((k) => soortVanKandidaat(k.kandidaat) === opties.gewenst);
    if (vanSoort) return { keuze: vanSoort, krapste: null, soortGevonden: true };
    return { keuze: anders[0] ?? null, krapste: anders[0] ? null : krapste, soortGevonden: false };
  }
  return {
    keuze: anders[0] ?? null,
    krapste: anders[0] ? null : (krapste ?? "herhaling"),
    soortGevonden: true,
  };
}

const SOORT_TEKST: Record<Soort, string> = { vega: "vegetarisch", vis: "vis", vlees: "vlees" };

function redenVan(k: DagKeuze, eters: readonly HuishoudenLid[]): string {
  const r = k.redenen[0]?.tekst;
  if (eters.length > 1)
    return r ? `${r} · past voor iedereen die meeëet` : "Past voor iedereen die meeëet";
  return r ?? "Uit je eigen recepten";
}

// ---------------------------------------------------------------- per opdracht

function goedkoper(ctx: AssistentContext): Voorstel {
  const titel = "Zo wordt je week goedkoper";
  const tot = plusDagen(ctx.vandaag, 6);
  const rijen = ctx.rijen
    .filter(
      (r) =>
        r.recipeId && r.datum >= ctx.vandaag && r.datum <= tot && kandidaatVan(ctx, r.recipeId),
    )
    .sort((a, b) => a.datum.localeCompare(b.datum));
  if (!rijen.length)
    return leegVoorstel(
      titel,
      "Er staan de komende 7 dagen nog geen recepten in je weekmenu. Er is niets om goedkoper te maken.",
    );
  const dagen = rijen.map((r) => dagVan(ctx, r, r.datum, etersVan(ctx, r.eterIds)));
  const plan = basisPlan(ctx, dagen, {
    versoepel: ["tijd"],
    alGepland: new Set(
      ctx.rijen.filter((r) => r.recipeId && !rijen.includes(r)).map((r) => r.recipeId!),
    ),
  });
  const huidig = menuUit(
    rijen.map((r, i) => ({
      dag: dagen[i]!,
      keuze: keuzeVoor(plan, kandidaatVan(ctx, r.recipeId)!, dagen[i]!),
    })),
    ctx.plan.budget,
  );
  const { wissels } = maakGoedkoper(plan, huidig);
  if (!wissels.length)
    return leegVoorstel(
      titel,
      "Je week is al zo goedkoop als het kan met je eigen recepten (voor iedereen die meeëet).",
    );
  const voor = wissels.reduce((s, w) => s + (bekendeKost(w.van.kost) ?? 0), 0);
  const na = wissels.reduce((s, w) => s + (bekendeKost(w.naar.kost) ?? 0), 0);
  const r = (x: number) => Math.round(x * 100) / 100;
  return {
    titel,
    menu: wissels.map((w) => ({
      datum: rijen[w.index]!.datum,
      moment: rijen[w.index]!.moment,
      van: w.van.title,
      naar: w.naar.title,
      uitleg: `≈ ${euro(w.besparing)} goedkoper`,
    })),
    lijst: lijstVerschil(
      ctx,
      wissels.map((w) => ({ van: w.van.id, naar: w.naar.id })),
      [],
    ),
    kost: { voor: r(voor), na: r(na), verschil: r(na - voor) },
    eters: wissels.map((w) => ({
      datum: rijen[w.index]!.datum,
      namen: etersVan(ctx, rijen[w.index]!.eterIds).map((e) => e.naam),
    })),
    waarschuwingen: [],
    stappen: wissels.map((w) => ({
      soort: "vervang" as const,
      planId: rijen[w.index]!.id,
      recipeId: w.naar.id,
    })),
  };
}

function vervang(
  ctx: AssistentContext,
  o: {
    datum: string;
    gewenst?: Soort | undefined;
    metEter?: string | undefined;
    maxMinuten?: number;
  },
): Voorstel {
  const dn = dagNaam(o.datum, ctx.vandaag);
  const snel = o.maxMinuten !== undefined;
  const titel = snel ? `Iets snels voor ${dn}` : `Een ander gerecht voor ${dn}`;
  if (o.datum < ctx.vandaag)
    return leegVoorstel(titel, `${dn} is al voorbij. Kies een dag vanaf vandaag.`);
  const rij = rijOp(ctx, o.datum);
  const extraLid = o.metEter
    ? ctx.leden.find((l) => normaliseerTekst(l.naam) === normaliseerTekst(o.metEter!))
    : undefined;
  const basisIds = rij?.eterIds ?? null;
  let eters = etersVan(ctx, basisIds);
  const personenVoor = personenVan(ctx, rij, eters);
  let etersStap: Stap | null = null;
  if (extraLid && rij && !eters.some((e) => e.id === extraLid.id)) {
    const nieuw = [...eters.map((e) => e.id), extraLid.id];
    eters = etersVan(ctx, nieuw);
    etersStap = {
      soort: "eters",
      planId: rij.id,
      lidIds: nieuw,
      vorige: basisIds ? [...basisIds] : null,
      personen: { nu: nieuw.length, voorheen: nieuw.length - 1 },
    };
  }
  const huidig = kandidaatVan(ctx, rij?.recipeId ?? null);
  if (snel && huidig && huidig.minuten > 0 && huidig.minuten <= o.maxMinuten!) {
    return leegVoorstel(
      titel,
      `${huidig.title} is klaar in ${huidig.minuten} minuten. Dat past al.`,
    );
  }
  const personen = etersStap ? personenVoor + 1 : personenVoor;
  const dag = dagVan(ctx, rij, o.datum, eters, {
    personen,
    ...(snel ? { maxMinuten: o.maxMinuten } : {}),
  });
  const { keuze, krapste, soortGevonden } = besteVoorDag(ctx, dag, {
    behalve: rij ? [rij.id] : [],
    nietRecept: rij?.recipeId ?? null,
    gewenst: o.gewenst,
  });
  if (!keuze) {
    const waarom = krapste
      ? FILTER_TEKST[krapste].waarom
      : "Foodlo vond geen ander gerecht dat past.";
    return leegVoorstel(
      titel,
      snel
        ? `Geen eigen recept dat past is klaar binnen ${o.maxMinuten} minuten. Tip: eet restjes of iets uit de diepvries.`
        : waarom,
    );
  }
  const waarschuwingen: string[] = [];
  if (o.gewenst && !soortGevonden)
    waarschuwingen.push(
      `Geen ${SOORT_TEKST[o.gewenst]} gerecht dat voor iedereen past; dit past wel.`,
    );
  const uitleg = snel
    ? `Klaar in ${keuze.minuten} min · ${redenVan(keuze, eters)}`
    : redenVan(keuze, eters);
  const menu: MenuVerschil[] = [
    {
      datum: o.datum,
      moment: rij?.moment ?? ctx.hoofdMoment,
      van: rij ? rij.titel : null,
      naar: keuze.title,
      uitleg,
    },
  ];
  const stappen: Stap[] = [];
  if (etersStap) stappen.push(etersStap);
  stappen.push(
    rij
      ? { soort: "vervang", planId: rij.id, recipeId: keuze.id }
      : { soort: "erbij", datum: o.datum, moment: ctx.hoofdMoment, recipeId: keuze.id, personen },
  );
  return {
    titel,
    menu,
    lijst: lijstVerschil(ctx, [{ van: rij?.recipeId ?? null, naar: keuze.id }], []),
    kost: kostVerschil(ctx, [
      { van: rij?.recipeId ?? null, naar: keuze.id, personen: personenVoor, personenNa: personen },
    ]),
    eters: eters.length ? [{ datum: o.datum, namen: eters.map((e) => e.naam) }] : [],
    waarschuwingen,
    stappen,
  };
}

function eter(ctx: AssistentContext, o: { datum: string; naam: string; mee: boolean }): Voorstel {
  const dn = dagNaam(o.datum, ctx.vandaag);
  const titel = `${o.naam} eet ${dn} ${o.mee ? "mee" : "niet mee"}`;
  const lid = ctx.leden.find((l) => normaliseerTekst(l.naam) === normaliseerTekst(o.naam));
  if (!lid)
    return leegVoorstel(
      titel,
      `${o.naam} staat niet in je huishouden. Voeg die persoon toe bij Gezin.`,
    );
  const rij = rijOp(ctx, o.datum);
  if (!rij)
    return leegVoorstel(
      titel,
      `Er staat ${dn} nog niets gepland. Vraag bijvoorbeeld: vervang ${dn}.`,
    );
  const nu = etersVan(ctx, rij.eterIds);
  const isMee = nu.some((e) => e.id === lid.id);
  const huidig = kandidaatVan(ctx, rij.recipeId);
  if (o.mee === isMee) {
    // Al zo, maar past het gerecht wel voor die persoon?
    if (o.mee && huidig) {
      const ec = etersContext(ctx, nu);
      if (ec && nietGeschikt(huidig, ec)) {
        const v = vervang(ctx, { datum: o.datum });
        return {
          ...v,
          titel,
          waarschuwingen: [
            `${rij.titel}: ${maaltijdOordeel(huidig, ec).titel ?? "past niet voor iedereen"}.`,
            ...v.waarschuwingen,
          ],
        };
      }
    }
    return leegVoorstel(
      titel,
      o.mee
        ? `${o.naam} eet ${dn} al mee (${rij.titel}). Er verandert niets.`
        : `${o.naam} eet ${dn} al niet mee. Er verandert niets.`,
    );
  }
  const ids = o.mee
    ? [...nu.map((e) => e.id), lid.id]
    : nu.filter((e) => e.id !== lid.id).map((e) => e.id);
  if (!ids.length)
    return leegVoorstel(
      titel,
      `Dan eet er ${dn} niemand mee. Vraag "niemand thuis ${dn}" om de maaltijd te schrappen.`,
    );
  const nieuweEters = etersVan(ctx, ids);
  const personenVoor = personenVan(ctx, rij, nu);
  const personenNa = Math.max(1, personenVoor + (o.mee ? 1 : -1));
  const stappen: Stap[] = [
    {
      soort: "eters",
      planId: rij.id,
      lidIds: ids,
      vorige: rij.eterIds ? [...rij.eterIds] : null,
      personen: { nu: ids.length, voorheen: nu.length },
    },
  ];
  const menu: MenuVerschil[] = [];
  const waarschuwingen: string[] = [];
  let naarId = rij.recipeId;
  const ec = etersContext(ctx, nieuweEters);
  if (o.mee && huidig && ec && nietGeschikt(huidig, ec)) {
    const dag = dagVan(ctx, rij, o.datum, nieuweEters, { personen: personenNa });
    const { keuze } = besteVoorDag(ctx, dag, { behalve: [rij.id], nietRecept: rij.recipeId });
    const etiket =
      etiketVoorEters(maaltijdOordeel(huidig, ec).hard) ?? `Niet geschikt voor ${o.naam}`;
    if (!keuze) {
      waarschuwingen.push(
        `${rij.titel}: ${etiket}. Foodlo vond geen ander gerecht dat voor iedereen past.`,
      );
    } else {
      naarId = keuze.id;
      stappen.push({ soort: "vervang", planId: rij.id, recipeId: keuze.id });
      menu.push({
        datum: o.datum,
        moment: rij.moment,
        van: rij.titel,
        naar: keuze.title,
        uitleg: `${etiket} · ${redenVan(keuze, nieuweEters)}`,
      });
    }
  }
  return {
    titel,
    menu,
    lijst:
      naarId !== rij.recipeId
        ? lijstVerschil(ctx, [{ van: rij.recipeId, naar: naarId }], [])
        : { erbij: [], eraf: [] },
    kost: kostVerschil(ctx, [
      { van: rij.recipeId, naar: naarId, personen: personenVoor, personenNa },
    ]),
    eters: [{ datum: o.datum, namen: nieuweEters.map((e) => e.naam) }],
    waarschuwingen,
    stappen,
  };
}

function nietThuis(ctx: AssistentContext, datum: string): Voorstel {
  const dn = dagNaam(datum, ctx.vandaag);
  const titel = `${dn.charAt(0).toUpperCase()}${dn.slice(1)}: niemand thuis`;
  const rijen = ctx.rijen.filter((r) => r.datum === datum);
  if (!rijen.length)
    return leegVoorstel(titel, `Er staat ${dn} niets gepland. Er verandert niets.`);
  return {
    titel,
    menu: rijen.map((r) => ({
      datum,
      moment: r.moment,
      van: r.titel,
      naar: null,
      uitleg: "Niemand thuis: niet koken",
    })),
    lijst: lijstVerschil(
      ctx,
      rijen.map((r) => ({ van: r.recipeId, naar: null })),
      rijen.map((r) => r.id),
    ),
    kost: kostVerschil(
      ctx,
      rijen.map((r) => ({
        van: r.recipeId,
        naar: null,
        personen: personenVan(ctx, r, etersVan(ctx, r.eterIds)),
      })),
    ),
    eters: [],
    waarschuwingen: [],
    stappen: rijen.map((r) => ({ soort: "weg" as const, planId: r.id })),
  };
}

function verplaats(ctx: AssistentContext, van: string, naar: string): Voorstel {
  const a = dagNaam(van, ctx.vandaag);
  const b = dagNaam(naar, ctx.vandaag);
  const titel = `${a.charAt(0).toUpperCase()}${a.slice(1)} naar ${b}`;
  if (naar < ctx.vandaag)
    return leegVoorstel(titel, `${b} is al voorbij. Kies een dag vanaf vandaag.`);
  const rij = rijOp(ctx, van);
  if (!rij) return leegVoorstel(titel, `Er staat ${a} niets gepland om te verplaatsen.`);
  const doel = ctx.rijen.find((r) => r.datum === naar && r.moment === rij.moment) ?? null;
  const stappen: Stap[] = [{ soort: "verplaats", planId: rij.id, datum: naar, moment: rij.moment }];
  const menu: MenuVerschil[] = [
    {
      datum: naar,
      moment: rij.moment,
      van: doel?.titel ?? null,
      naar: rij.titel,
      uitleg: `Van ${a}`,
    },
  ];
  if (doel) {
    stappen.push({ soort: "verplaats", planId: doel.id, datum: van, moment: doel.moment });
    menu.unshift({
      datum: van,
      moment: rij.moment,
      van: rij.titel,
      naar: doel.titel,
      uitleg: `Van ${b} (gewisseld)`,
    });
  } else
    menu.unshift({
      datum: van,
      moment: rij.moment,
      van: rij.titel,
      naar: null,
      uitleg: `Naar ${b}`,
    });
  return {
    titel,
    menu,
    // Zelfde gerechten, andere dag: de lijst blijft gelijk (binnen de komende 7 dagen).
    lijst: { erbij: [], eraf: [] },
    kost: null,
    eters: [],
    waarschuwingen: [],
    stappen,
  };
}

function opLijst(
  ctx: AssistentContext,
  o: { zoek: string; receptId?: string | undefined },
): Voorstel {
  const k =
    kandidaatVan(ctx, o.receptId ?? null) ??
    (() => {
      const r = vindRecept(o.zoek, ctx.plan.kandidaten);
      return r ? kandidaatVan(ctx, r.id) : null;
    })();
  const titel = `Ingrediënten op de lijst`;
  if (!k)
    return leegVoorstel(
      titel,
      `Ik vond geen eigen recept met "${o.zoek}". Kijk de naam na of zoek bij Gerechten.`,
    );
  const producten = [...teKopen(ctx, k.id).values()].sort((a, b) => a.localeCompare(b));
  const personen = ctx.standaardPersonen;
  const waarschuwingen: string[] = [];
  const ec = etersContext(ctx, etersVan(ctx, null));
  if (ec) {
    const etiket = etiketVoorEters(maaltijdOordeel(k, ec).hard);
    if (etiket) waarschuwingen.push(`${k.title}: ${etiket}.`);
  }
  if (!producten.length)
    return leegVoorstel(
      `${k.title} op de lijst`,
      `Voor ${k.title} heb je alles al in huis (of het is basis). Er hoeft niets op de lijst.`,
      { waarschuwingen },
    );
  return {
    titel: `${k.title} op de lijst`,
    menu: [],
    lijst: { erbij: producten, eraf: [] },
    kost: kostVerschil(ctx, [{ van: null, naar: k.id, personen }]),
    eters: [],
    waarschuwingen,
    stappen: [{ soort: "lijst", recipeId: k.id, personen }],
  };
}

function watMet(ctx: AssistentContext, ingredient: string): Voorstel {
  const titel = `Met ${ingredient}`;
  const n = normaliseerTekst(ingredient);
  const c = canoniekeNaam(ingredient) || n;
  const bevat = (k: PlanKandidaat) =>
    k.ingredienten.some((i) => {
      const x = normaliseerTekst(i);
      return x.includes(n) || (canoniekeNaam(i) || x) === c;
    }) || normaliseerTekst(k.title).includes(n);
  const eters = etersVan(ctx, null);
  const dag = dagVan(ctx, null, ctx.vandaag, eters);
  const plan = basisPlan(ctx, [dag], { versoepel: ["tijd", "herhaling"] });
  const { lijst } = rangschikDag(plan, dag);
  const ideeen = lijst
    .filter((k) => bevat(k.kandidaat))
    .slice(0, 5)
    .map((k) => ({ id: k.id, title: k.title, minuten: k.minuten, reden: redenVan(k, eters) }));
  if (!ideeen.length)
    return leegVoorstel(
      titel,
      `Geen eigen recept met ${ingredient} dat voor iedereen past. Zoek een idee in Ontdek.`,
    );
  return leegVoorstel(
    titel,
    eters.length > 1
      ? "Uit je eigen recepten, voor iedereen die meeëet:"
      : "Uit je eigen recepten:",
    { ideeen },
  );
}

/**
 * "Wat kan ik met mijn restjes?": je restjes die nog goed zijn (hooguit 3 dagen), de oudste
 * eerst, en alleen als ze passen bij je allergieën en dieet (zelfde regel als Vandaag).
 * Verandert niets: plannen gebeurt met één tik op Vandaag of in Week.
 */
function restjesVoorstel(ctx: AssistentContext): Voorstel {
  const titel = "Je restjes";
  const nu = ctx.nu ?? Date.now();
  const alle = [...(ctx.restjes ?? [])].sort((a, b) => a.gekookt - b.gekookt);
  if (!alle.length)
    return leegVoorstel(
      titel,
      'Je hebt geen restjes bewaard. Na het koken vraagt Foodlo "Blijft er iets over?".',
    );
  const goed = alle.filter((r) => dagenOud(r, nu) <= RESTJE_VOORSTEL_DAGEN);
  const veilig = goed.filter((r) =>
    restjeVeilig(r, r.receptId ? kandidaatVan(ctx, r.receptId)?.ingredienten : undefined, {
      allergieen: ctx.plan.allergieen,
      dieet: ctx.plan.dieet,
    }),
  );
  const ideeen: Idee[] = veilig.slice(0, 5).map((r) => ({
    id: r.receptId ?? r.id,
    title: r.titel,
    minuten: 0,
    reden: [
      `${r.porties} ${r.porties === 1 ? "portie" : "porties"}`,
      gekooktTekst(r, nu),
      r.gepland ? "al gepland" : `richtwaarde tot ${bewaarRichtwaarde(r.gekookt, nu).tot}`,
    ].join(" · "),
    ...(r.receptId ? {} : { geenLink: true }),
  }));
  const waarschuwingen: string[] = [];
  if (goed.length > veilig.length)
    waarschuwingen.push(
      "Niet elk restje staat hier: van sommige kent Foodlo de ingrediënten niet, en met een allergie of dieet stelt het die niet voor.",
    );
  if (alle.length > goed.length)
    waarschuwingen.push(
      "Sommige restjes zijn langer dan 3 dagen geleden gekookt. Twijfel je, eet ze dan niet meer.",
    );
  if (!ideeen.length)
    return leegVoorstel(titel, "Geen restje dat Foodlo nu kan voorstellen.", { waarschuwingen });
  return leegVoorstel(
    titel,
    'Eet de oudste eerst. Op Vandaag plan je ze met "Eet vanavond restjes"; in Week met "Plan restjes". Daarna tik je in Keuken op "Opgegeten".',
    { ideeen, waarschuwingen },
  );
}

/**
 * Fase 3 — een verzameling inplannen: de recepten in de volgorde van de verzameling, elk op de
 * eerstvolgende vrije dag (geen hoofdmaaltijd gepland, vandaag tot 13 dagen verder). Elk recept
 * gaat door dezelfde veiligheid als overal (jouw allergie/dieet/liever niet én iedereen die
 * meeëet); wat niet past, wordt overgeslagen zonder de reden te noemen. Bestaande maaltijden
 * worden nooit overschreven. Verandert niets tot "Doe maar".
 */
function collectieVoorstel(
  ctx: AssistentContext,
  o: { naam: string; receptIds: readonly string[] },
): Voorstel {
  const titel = `"${o.naam}" in je week`;
  if (!o.receptIds.length) return leegVoorstel(titel, "Deze verzameling is nog leeg.");
  const vrij: string[] = [];
  for (let i = 0; i < 14 && vrij.length < o.receptIds.length; i++) {
    const d = plusDagen(ctx.vandaag, i);
    if (!ctx.rijen.some((r) => r.datum === d && r.moment === ctx.hoofdMoment)) vrij.push(d);
  }
  const eters = etersVan(ctx, null);
  const ec = etersContext(ctx, eters);
  const personen = eters.length || ctx.standaardPersonen;
  const overgeslagen: string[] = [];
  const onbekend: string[] = [];
  const menu: MenuVerschil[] = [];
  const stappen: Stap[] = [];
  let dagIndex = 0;
  for (const id of new Set(o.receptIds)) {
    const k = kandidaatVan(ctx, id);
    if (!k) {
      onbekend.push(id);
      continue;
    }
    const eigen = toegelaten(k, {
      voorkeur: {
        maxMinuten: 0,
        soort: null,
        vermijd: ctx.plan.vermijd ?? "",
        dieet: ctx.plan.dieet,
      },
      ...(ctx.plan.allergieen ? { allergieen: [...ctx.plan.allergieen] } : {}),
    });
    if (!eigen || (ec && nietGeschikt(k, ec))) {
      overgeslagen.push(k.title);
      continue;
    }
    const datum = vrij[dagIndex];
    if (!datum) break;
    dagIndex++;
    menu.push({
      datum,
      moment: ctx.hoofdMoment,
      van: null,
      naar: k.title,
      uitleg: k.minuten ? `${k.minuten} min · uit "${o.naam}"` : `uit "${o.naam}"`,
    });
    stappen.push({ soort: "erbij", datum, moment: ctx.hoofdMoment, recipeId: k.id, personen });
  }
  const waarschuwingen: string[] = [];
  if (overgeslagen.length)
    waarschuwingen.push(
      `Niet ingepland, want het past niet voor iedereen die meeëet: ${namenLijst(overgeslagen)}.`,
    );
  if (onbekend.length)
    waarschuwingen.push(
      `${onbekend.length} ${onbekend.length === 1 ? "recept staat" : "recepten staan"} niet bij je eigen recepten (bv. van een maker). Bewaar ${onbekend.length === 1 ? "het" : "ze"} eerst als eigen recept om ${onbekend.length === 1 ? "het" : "ze"} in te plannen.`,
    );
  const nietGepland = o.receptIds.length - onbekend.length - overgeslagen.length - menu.length;
  if (nietGepland > 0)
    waarschuwingen.push(
      `Geen vrije dag meer voor ${nietGepland} ${nietGepland === 1 ? "recept" : "recepten"} in de komende twee weken. Bestaande maaltijden blijven staan.`,
    );
  if (!stappen.length)
    return leegVoorstel(titel, "Foodlo kon geen recept uit deze verzameling inplannen.", {
      waarschuwingen,
    });
  return {
    titel,
    menu,
    lijst: lijstVerschil(
      ctx,
      stappen.map((s) => ({ van: null, naar: s.soort === "erbij" ? s.recipeId : null })),
      [],
    ),
    kost: kostVerschil(
      ctx,
      stappen.map((s) => ({ van: null, naar: s.soort === "erbij" ? s.recipeId : null, personen })),
    ),
    eters: eters.length
      ? menu.map((m) => ({ datum: m.datum, namen: eters.map((e) => e.naam) }))
      : [],
    waarschuwingen,
    stappen,
  };
}

/** Het voorstel voor een opdracht. Verandert niets. */
export function maakActieVoorstel(o: Opdracht, ctx: AssistentContext): Voorstel {
  switch (o.soort) {
    case "goedkoper":
      return goedkoper(ctx);
    case "vervang":
      return vervang(ctx, o);
    case "weinig-tijd":
      return vervang(ctx, { datum: o.datum, maxMinuten: o.minuten });
    case "eter":
      return eter(ctx, o);
    case "niet-thuis":
      return nietThuis(ctx, o.datum);
    case "verplaats":
      return verplaats(ctx, o.van, o.naar);
    case "op-lijst":
      return opLijst(ctx, o);
    case "wat-met":
      return watMet(ctx, o.ingredient);
    case "restjes":
      return restjesVoorstel(ctx);
    case "collectie":
      return collectieVoorstel(ctx, o);
  }
}

/**
 * Laatste controle vóór "Doe maar": elk gerecht dat erbij komt, past bij je eigen regels én bij
 * iedereen die die dag meeëet. Geeft de titels die niet passen (leeg = in orde). Dubbel met de
 * engine, bewust: een voorstel met een allergeen mag nooit uitgevoerd worden.
 */
export function onveiligInVoorstel(v: Voorstel, ctx: AssistentContext): string[] {
  const uit: string[] = [];
  const etersPerPlan = new Map<string, string[] | null>();
  for (const s of v.stappen) if (s.soort === "eters") etersPerPlan.set(s.planId, s.lidIds);
  for (const s of v.stappen) {
    if (s.soort !== "vervang" && s.soort !== "erbij" && s.soort !== "lijst") continue;
    const k = kandidaatVan(ctx, s.recipeId);
    if (!k) {
      uit.push(s.recipeId);
      continue;
    }
    const eigen = toegelaten(k, {
      voorkeur: {
        maxMinuten: 0,
        soort: null,
        vermijd: ctx.plan.vermijd ?? "",
        dieet: ctx.plan.dieet,
      },
      ...(ctx.plan.allergieen ? { allergieen: [...ctx.plan.allergieen] } : {}),
    });
    if (s.soort === "lijst") {
      // Op de lijst zetten is jouw keuze; je eigen allergie blijft wel een harde grens.
      if (!eigen) uit.push(k.title);
      continue;
    }
    const rij = s.soort === "vervang" ? ctx.rijen.find((r) => r.id === s.planId) : null;
    const ids = (rij && etersPerPlan.get(rij.id)) ?? rij?.eterIds ?? null;
    const ec = etersContext(ctx, etersVan(ctx, ids));
    if (!eigen || (ec && nietGeschikt(k, ec))) uit.push(k.title);
  }
  return uit;
}

/** Recepten die door dit voorstel nieuw op tafel komen (voor de servercontrole). */
export function nieuweRecepten(v: Voorstel): string[] {
  return [
    ...new Set(
      v.stappen.flatMap((s) => (s.soort === "vervang" || s.soort === "erbij" ? [s.recipeId] : [])),
    ),
  ];
}

/** "Marie, Jan en Gust" voor de verschillen. */
export const wieTekst = (namen: readonly string[]) => namenLijst(namen);
