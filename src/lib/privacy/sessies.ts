/**
 * Fase 8 — Waar ben je aangemeld? Bron (voorkeur): je eigen sessies uit Supabase Auth via
 * public.mijn_aanmeldingen() (voorstel 0025). Zolang die functie ontbreekt: je recent gebruikte
 * toestellen uit user_sessions (die tonen waar je Foodlo gebruikte, niet of je er nog aangemeld
 * bent; dat zeggen we er ook bij). Afmelden op alle andere toestellen werkt altijd: dat is
 * supabase.auth.signOut({ scope: "others" }).
 */

export type Aanmelding = {
  id: string;
  toestel: string;
  laatst: string | null;
  sinds: string | null;
  huidige: boolean;
  /** true = echte sessie (kan apart afgemeld worden); false = alleen gebruiksgeschiedenis. */
  echt: boolean;
};

/** PostgREST: functie bestaat niet (PGRST202) of Postgres 42883. */
export function isOntbrekendeFunctie(fout: unknown): boolean {
  if (!fout || typeof fout !== "object") return false;
  const f = fout as { code?: unknown; message?: unknown };
  if (f.code === "PGRST202" || f.code === "42883") return true;
  return typeof f.message === "string" && /could not find the function/i.test(f.message);
}

/** "Chrome op Android", "Safari op iPhone" … uit de user-agent; nooit de volledige tekst. */
export function toestelNaam(ua: string | null | undefined): string {
  const u = ua ?? "";
  const browser = /Edg\//.test(u)
    ? "Edge"
    : /Firefox\//.test(u)
      ? "Firefox"
      : /Chrome\//.test(u)
        ? "Chrome"
        : /Safari\//.test(u)
          ? "Safari"
          : null;
  const systeem = /iPhone/.test(u)
    ? "iPhone"
    : /iPad/.test(u)
      ? "iPad"
      : /Android/.test(u)
        ? "Android"
        : /Windows/.test(u)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(u)
            ? "Mac"
            : /Linux/.test(u)
              ? "Linux"
              : null;
  if (browser && systeem) return `${browser} op ${systeem}`;
  return browser ?? systeem ?? "Onbekend toestel";
}

/** Uit user_sessions (gebruiksgeschiedenis): één rij per toestel, recentste eerst. */
export function recenteToestellen(
  rijen: {
    id: string;
    device?: string | null;
    browser?: string | null;
    platform?: string | null;
    last_seen_at?: string | null;
    started_at?: string | null;
  }[],
  huidigeSessieId: string | null,
): Aanmelding[] {
  const perToestel = new Map<string, Aanmelding>();
  const gesorteerd = [...rijen].sort((a, b) =>
    String(b.last_seen_at ?? b.started_at ?? "").localeCompare(
      String(a.last_seen_at ?? a.started_at ?? ""),
    ),
  );
  for (const r of gesorteerd) {
    const naam =
      [r.browser, r.device || r.platform].filter((x) => x && String(x).trim()).join(" op ") ||
      "Onbekend toestel";
    const bestaand = perToestel.get(naam);
    if (bestaand) {
      if (r.id === huidigeSessieId) bestaand.huidige = true;
      continue;
    }
    perToestel.set(naam, {
      id: r.id,
      toestel: naam,
      laatst: r.last_seen_at ?? r.started_at ?? null,
      sinds: r.started_at ?? null,
      huidige: r.id === huidigeSessieId,
      echt: false,
    });
  }
  return [...perToestel.values()].slice(0, 10);
}

/** Belgische notatie: "20/11/2026 om 14:05". */
export function wanneer(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dag = d.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const uur = d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dag} om ${uur}`;
}
