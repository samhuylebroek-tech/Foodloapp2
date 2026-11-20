/**
 * Fase 4 — videorecepten van makers: een tijd per stap invullen ("0:45") en die vooraan in de
 * staptekst bewaren, in exact de vorm die de receptpagina (fase 2, `tijdcodeUit`) al leest.
 * Zo is er één opslag (de stappen zelf), geen aparte tabel en geen gedownloade video.
 */
import { tijdcodeUit } from "./video-link";

/**
 * Invoer van de maker → nette tijd, of `null` als ze leeg is. Een ongeldige invoer geeft een
 * foutmelding in gewone taal.
 * "45" → "0:45", "1.30" → "1:30", "90" → "1:30", "1:02:03" blijft.
 */
export function leesTijdInvoer(
  invoer: string,
): { label: string; seconden: number } | { fout: string } | null {
  const t = invoer.trim().replace(/[.,]/g, ":").replace(/\s+/g, "");
  if (!t) return null;
  let sec: number | null = null;
  if (/^\d{1,4}$/.test(t)) sec = Number(t);
  else if (/^\d{1,3}:\d{2}$/.test(t)) {
    const [m, s] = t.split(":").map(Number) as [number, number];
    sec = s < 60 ? m * 60 + s : null;
  } else if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) {
    const [u, m, s] = t.split(":").map(Number) as [number, number, number];
    sec = m < 60 && s < 60 ? u * 3600 + m * 60 + s : null;
  }
  if (sec === null) return { fout: "Schrijf de tijd zoals 0:45 of 1:30." };
  if (sec > 10 * 3600) return { fout: "Die tijd is langer dan de video kan zijn." };
  return { label: tijdLabel(sec), seconden: sec };
}

/** 65 → "1:05"; 3723 → "1:02:03". */
export function tijdLabel(seconden: number): string {
  const s = Math.max(0, Math.floor(seconden));
  const u = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return u ? `${u}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** Huidige tijd en tekst van een stap (zonder tijdcode). */
export function splitsStap(stap: string): { tijd: string; tekst: string } {
  const t = tijdcodeUit(stap);
  return t ? { tijd: t.label, tekst: t.tekst } : { tijd: "", tekst: stap.trim() };
}

/** Zet (of verwijdert, met `null`) de tijd vooraan in een stap; een oude tijd gaat eerst weg. */
export function zetTijdcode(stap: string, label: string | null): string {
  const { tekst } = splitsStap(stap);
  return label ? `${label} ${tekst}` : tekst;
}

/**
 * Alle stappen in één keer bijwerken uit de invoervelden. Geeft de nieuwe stappen, of de eerste
 * fout met het stapnummer. Lege velden halen de tijd weg; de staptekst zelf verandert nooit.
 */
export function stappenMetTijden(
  stappen: readonly string[],
  invoer: readonly string[],
): { stappen: string[] } | { fout: string; stap: number } {
  const uit: string[] = [];
  for (let i = 0; i < stappen.length; i++) {
    const r = leesTijdInvoer(invoer[i] ?? "");
    if (r && "fout" in r) return { fout: `Stap ${i + 1}: ${r.fout}`, stap: i };
    uit.push(zetTijdcode(stappen[i] ?? "", r ? r.label : null));
  }
  return { stappen: uit };
}
