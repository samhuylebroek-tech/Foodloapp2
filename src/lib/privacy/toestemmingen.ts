/**
 * Fase 8 — Toestemmingen per persoon: AI, analyse, community, meldingen (gezondheid en gezin
 * hebben hun eigen bron: persoonlijke_voeding.toestemming_op en group_members).
 *
 * Opslag: tabel `toestemmingen` (voorstel 0025). Zolang die ontbreekt, bewaren we de keuze op dit
 * toestel (`foodlo:toestemmingen:<userId>`), zodat intrekken altijd meteen werkt. Een keuze op
 * het toestel geldt altijd, ook als het account (nog) iets anders zegt: intrekken wint.
 *
 * Standaard:
 * - AI: aan, "minimaal" (alleen recepttekst en neutrale smaakwensen via voorAI(), nooit
 *   allergieën, dieet of gezondheid; dat is een vaste regel, geen keuze);
 * - analyse: aan (welke schermen en knoppen, nooit wat je typt);
 * - community: aan (pas zichtbaar als je zelf iets deelt);
 * - meldingen: pas aan als je ze zelf aanzet op een toestel.
 */
import { useCallback, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, isOntbrekendeTabel } from "@/lib/module-beschikbaar";

export const TOESTEMMING_TABEL = "toestemmingen";
export type Soort = "ai" | "analyse" | "community" | "meldingen";
export const SOORTEN: readonly Soort[] = ["ai", "analyse", "community", "meldingen"];

export type Keuze = {
  aan: boolean;
  sinds: string | null;
  bron: "standaard" | "toestel" | "account";
};

export const STANDAARD: Record<Soort, boolean> = {
  ai: true,
  analyse: true,
  community: true,
  meldingen: true,
};

const sleutel = (userId: string) => `foodlo:toestemmingen:${userId}`;
const GEWIJZIGD = "foodlo:toestemmingen-gewijzigd";

type Opgeslagen = Partial<Record<Soort, { aan: boolean; sinds: string }>>;

export function leesToestel(userId: string | null | undefined): Opgeslagen {
  if (!userId || typeof window === "undefined") return {};
  try {
    const ruw = JSON.parse(window.localStorage.getItem(sleutel(userId)) ?? "{}") as unknown;
    if (!ruw || typeof ruw !== "object") return {};
    const uit: Opgeslagen = {};
    for (const s of SOORTEN) {
      const v = (ruw as Record<string, unknown>)[s] as
        { aan?: unknown; sinds?: unknown } | undefined;
      if (v && typeof v.aan === "boolean")
        uit[s] = { aan: v.aan, sinds: typeof v.sinds === "string" ? v.sinds : "" };
    }
    return uit;
  } catch {
    return {};
  }
}

function schrijfToestel(userId: string, o: Opgeslagen) {
  try {
    window.localStorage.setItem(sleutel(userId), JSON.stringify(o));
    window.dispatchEvent(new Event(GEWIJZIGD));
  } catch {
    /* privé-venster: de keuze geldt dan alleen voor deze pagina */
  }
}

export type AccountRij = { soort: string; aan: boolean; sinds: string | null };

/**
 * Zuivere regel (getest): wat geldt er? Intrekken wint altijd: staat iets op het toestel OF op
 * het account uit, dan is het uit. Anders: de recentste keuze, of de standaard.
 */
export function huidigeKeuze(soort: Soort, toestel: Opgeslagen, account: AccountRij[]): Keuze {
  const a = account.find((r) => r.soort === soort);
  const t = toestel[soort];
  if (t && !t.aan) return { aan: false, sinds: t.sinds || null, bron: "toestel" };
  if (a && !a.aan) return { aan: false, sinds: a.sinds, bron: "account" };
  if (a) return { aan: true, sinds: a.sinds, bron: "account" };
  if (t) return { aan: true, sinds: t.sinds || null, bron: "toestel" };
  return { aan: STANDAARD[soort], sinds: null, bron: "standaard" };
}

/** Snel en zonder netwerk: mag er gemeten worden (analyse)? Alleen de keuze op dit toestel. */
export function analyseToegestaan(userId: string | null | undefined): boolean {
  return leesToestel(userId).analyse?.aan !== false;
}

async function haalAccount(userId: string): Promise<{ rijen: AccountRij[]; tabel: boolean }> {
  const { data, error } = await db
    .from(TOESTEMMING_TABEL)
    .select("soort, aan, sinds")
    .eq("user_id", userId);
  if (error) {
    if (isOntbrekendeTabel(error)) return { rijen: [], tabel: false };
    throw error;
  }
  return { rijen: (data ?? []) as AccountRij[], tabel: true };
}

/** Bewaart een keuze: altijd op dit toestel, en op het account als de tabel bestaat. */
export async function zetToestemming(
  userId: string,
  soort: Soort,
  aan: boolean,
  nu = new Date().toISOString(),
): Promise<{ opAccount: boolean }> {
  schrijfToestel(userId, { ...leesToestel(userId), [soort]: { aan, sinds: nu } });
  const { error } = await db
    .from(TOESTEMMING_TABEL)
    .upsert(
      { user_id: userId, soort, aan, niveau: soort === "ai" && aan ? "minimaal" : null, sinds: nu },
      { onConflict: "user_id,soort" },
    );
  if (error) {
    if (isOntbrekendeTabel(error)) return { opAccount: false };
    throw error;
  }
  return { opAccount: true };
}

function abonneer(cb: () => void) {
  window.addEventListener(GEWIJZIGD, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(GEWIJZIGD, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Alle toestemmingen met hun stand, plus `zet`. */
export function useToestemmingen(userId: string | null | undefined) {
  const qc = useQueryClient();
  const toestelRuw = useSyncExternalStore(
    abonneer,
    () =>
      (userId && typeof window !== "undefined"
        ? window.localStorage.getItem(sleutel(userId))
        : null) ?? "",
    () => "",
  );
  const account = useQuery({
    queryKey: ["toestemmingen", userId],
    enabled: !!userId,
    queryFn: () => haalAccount(userId!),
    retry: 1,
  });
  void toestelRuw;
  const toestel = leesToestel(userId);
  const rijen = account.data?.rijen ?? [];
  const keuzes = Object.fromEntries(
    SOORTEN.map((s) => [s, huidigeKeuze(s, toestel, rijen)]),
  ) as Record<Soort, Keuze>;
  const zet = useCallback(
    async (soort: Soort, aan: boolean) => {
      if (!userId) return { opAccount: false };
      const r = await zetToestemming(userId, soort, aan);
      await qc.invalidateQueries({ queryKey: ["toestemmingen", userId] });
      return r;
    },
    [qc, userId],
  );
  return {
    keuzes,
    zet,
    laden: account.isLoading,
    opAccount: account.data?.tabel ?? false,
    fout: account.isError,
  };
}
