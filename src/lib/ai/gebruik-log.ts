/**
 * Fase 7 — AI-gebruik zichtbaar: wat telde mee, zonder inhoud.
 *
 * Per slimme vraag bewaart Foodlo alleen de dag, de soort en of het antwoord uit de cache kwam.
 * Nooit de vraag, het antwoord, een recept of gezondheidsgegevens. Op het toestel (40 dagen) en,
 * na voorstel 0024, als dagtotaal op je account (`ai_gebruik_dag`) via `ai_gebruik_tel`. Het
 * Control Center ziet alleen totalen over iedereen samen (`ai_gebruik_totaal`), nooit wie.
 *
 * Vaste regels (tips, herkenning van opdrachten, de boodschappen-agent) tellen nooit mee: die zijn
 * gratis en onbeperkt.
 */
import { lokaleDatum } from "@/lib/tijd";

export const AI_SOORTEN = {
  "kookhulp.vervang": {
    label: "Extra vervangers in de kookhulp",
    /** Geschatte kost per actie in eurocent (klein model, kort antwoord). */
    kostCent: 0.05,
  },
  "kookhulp.vraag": { label: "Kookvraag aan de slimme hulp", kostCent: 0.04 },
  weekassistent: { label: "Weekassistent: opdracht herkennen", kostCent: 0.03 },
} as const;

export type AiSoort = keyof typeof AI_SOORTEN;

export function isAiSoort(s: unknown): s is AiSoort {
  return typeof s === "string" && s in AI_SOORTEN;
}

export type LogRegel = { dag: string; soort: AiSoort; cache?: boolean };

/** Dagtotaal (account of toestel): zoveel acties van die soort op die dag. */
export type DagTotaal = { dag: string; soort: AiSoort; aantal: number; cache?: number };

const BEWAAR_DAGEN = 40;
const sleutel = (userId: string) => `foodlo:ai-gebruik:${userId}`;

export function leesLog(userId: string | null | undefined): LogRegel[] {
  if (!userId) return [];
  try {
    const ruw = JSON.parse(window.localStorage.getItem(sleutel(userId)) ?? "[]") as unknown;
    if (!Array.isArray(ruw)) return [];
    return ruw.filter(
      (r): r is LogRegel =>
        !!r &&
        typeof (r as LogRegel).dag === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test((r as LogRegel).dag) &&
        isAiSoort((r as LogRegel).soort),
    );
  } catch {
    return [];
  }
}

function dagenTerug(dag: string, n: number) {
  const d = new Date(`${dag}T12:00:00`);
  d.setDate(d.getDate() - n);
  return lokaleDatum(d);
}

/** Puur: één regel erbij, oude regels (> 40 dagen) eruit. Hooguit 2000 regels. */
export function voegToe(log: readonly LogRegel[], regel: LogRegel): LogRegel[] {
  const grens = dagenTerug(regel.dag, BEWAAR_DAGEN);
  return [...log.filter((r) => r.dag >= grens), regel].slice(-2000);
}

export function bewaarRegel(userId: string, regel: LogRegel) {
  try {
    window.localStorage.setItem(sleutel(userId), JSON.stringify(voegToe(leesLog(userId), regel)));
  } catch {
    /* privévenster: niet bewaren */
  }
}

/** Toestel-log naar dagtotalen. */
export function naarDagtotalen(log: readonly LogRegel[]): DagTotaal[] {
  const per = new Map<string, DagTotaal>();
  for (const r of log) {
    const k = `${r.dag}|${r.soort}`;
    const t = per.get(k) ?? { dag: r.dag, soort: r.soort, aantal: 0, cache: 0 };
    if (r.cache) t.cache = (t.cache ?? 0) + 1;
    else t.aantal += 1;
    per.set(k, t);
  }
  return [...per.values()];
}

/**
 * Toestel en account samen: per dag en soort het hoogste getal (zelfde actie staat op beide;
 * op een ander toestel kan het account meer weten). Nooit dubbel tellen.
 */
export function voegSamen(a: readonly DagTotaal[], b: readonly DagTotaal[]): DagTotaal[] {
  const per = new Map<string, DagTotaal>();
  for (const t of [...a, ...b]) {
    const k = `${t.dag}|${t.soort}`;
    const o = per.get(k);
    per.set(
      k,
      o
        ? {
            ...o,
            aantal: Math.max(o.aantal, t.aantal),
            cache: Math.max(o.cache ?? 0, t.cache ?? 0),
          }
        : { ...t },
    );
  }
  return [...per.values()];
}

export type Overzicht = {
  vandaag: number;
  limiet: number;
  rest: number;
  maand: number;
  /** Antwoorden die uit de cache kwamen deze maand (telden niet mee). */
  uitCache: number;
  perSoort: { soort: AiSoort; label: string; vandaag: number; maand: number }[];
  /** Geschatte kost van deze maand voor Foodlo, in eurocent (ter info, je betaalt dit niet). */
  kostCent: number;
};

export function overzicht(
  totalen: readonly DagTotaal[],
  vandaag: string,
  limiet: number,
): Overzicht {
  const maandStart = `${vandaag.slice(0, 7)}-01`;
  const dezeMaand = totalen.filter((t) => t.dag >= maandStart && t.dag <= vandaag);
  const somVan = (lijst: readonly DagTotaal[]) => lijst.reduce((s, t) => s + t.aantal, 0);
  const vandaagTot = somVan(dezeMaand.filter((t) => t.dag === vandaag));
  const perSoort = (Object.keys(AI_SOORTEN) as AiSoort[])
    .map((soort) => ({
      soort,
      label: AI_SOORTEN[soort].label,
      vandaag: somVan(dezeMaand.filter((t) => t.dag === vandaag && t.soort === soort)),
      maand: somVan(dezeMaand.filter((t) => t.soort === soort)),
    }))
    .filter((s) => s.maand > 0);
  return {
    vandaag: vandaagTot,
    limiet,
    rest: Math.max(0, limiet - vandaagTot),
    maand: somVan(dezeMaand),
    uitCache: dezeMaand.reduce((s, t) => s + (t.cache ?? 0), 0),
    perSoort,
    kostCent:
      Math.round(dezeMaand.reduce((s, t) => s + t.aantal * AI_SOORTEN[t.soort].kostCent, 0) * 100) /
      100,
  };
}

/** Geaggregeerde totalen voor het Control Center: per soort, over iedereen samen. */
export type TotaalRij = { dag: string; soort: string; aantal: number; uit_cache?: number | null };

export function bccTotalen(rijen: readonly TotaalRij[], vandaag: string) {
  const maandStart = `${vandaag.slice(0, 7)}-01`;
  const per = new Map<
    string,
    {
      soort: string;
      label: string;
      vandaag: number;
      maand: number;
      cache: number;
      kostCent: number;
      kostPerActieCent: number;
    }
  >();
  for (const r of rijen) {
    if (r.dag < maandStart || r.dag > vandaag) continue;
    const bekend = isAiSoort(r.soort) ? AI_SOORTEN[r.soort] : null;
    const o = per.get(r.soort) ?? {
      soort: r.soort,
      label: bekend?.label ?? r.soort,
      vandaag: 0,
      maand: 0,
      cache: 0,
      kostCent: 0,
      kostPerActieCent: bekend?.kostCent ?? 0,
    };
    o.maand += r.aantal;
    if (r.dag === vandaag) o.vandaag += r.aantal;
    o.cache += r.uit_cache ?? 0;
    o.kostCent += r.aantal * o.kostPerActieCent;
    per.set(r.soort, o);
  }
  const lijst = [...per.values()].sort((a, b) => b.maand - a.maand);
  return {
    lijst,
    maand: lijst.reduce((s, r) => s + r.maand, 0),
    vandaag: lijst.reduce((s, r) => s + r.vandaag, 0),
    cache: lijst.reduce((s, r) => s + r.cache, 0),
    kostCent: Math.round(lijst.reduce((s, r) => s + r.kostCent, 0) * 100) / 100,
  };
}

/** "€ 0,12" of, onder een cent, "minder dan € 0,01". */
export function kleineKost(cent: number): string {
  if (cent <= 0) return "€ 0,00";
  if (cent < 1) return "minder dan € 0,01";
  return `€ ${(cent / 100).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
