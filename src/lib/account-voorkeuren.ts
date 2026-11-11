/**
 * Voorkeuren van het eigen account lezen (taal, thema, momenten, weekmenu).
 * BUG-119 / migratievoorstel 0004: na die migratie is de kolom `weekmenu` niet meer rechtstreeks
 * leesbaar (gezinsleden zouden anders je "vermijd"-tekst zien). Dan geeft de gewone select een
 * rechtenfout (42501) en lezen we de rest zonder weekmenu, en het weekmenu via `eigen_weekmenu()`.
 * Vóór de migratie: één verzoek, zoals altijd.
 */
export type AccountVoorkeuren = {
  taal?: string | null;
  thema?: string | null;
  momenten?: string[] | null;
  weekmenu?: unknown;
};

type Antwoord<T> = { data: T | null; error: { code?: string; message?: string } | null };

export type VoorkeurClient = {
  from: (tabel: "profiles") => {
    select: (kolommen: string) => {
      eq: (
        kolom: "id",
        waarde: string,
      ) => { maybeSingle: () => PromiseLike<Antwoord<AccountVoorkeuren>> };
    };
  };
  rpc: (functie: "eigen_weekmenu") => PromiseLike<Antwoord<unknown>>;
};

export function isRechtenfout(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false;
  return e.code === "42501" || /permission denied/i.test(e.message ?? "");
}

export async function haalAccountVoorkeuren(
  db: VoorkeurClient,
  userId: string,
): Promise<AccountVoorkeuren | null> {
  const eerst = await db
    .from("profiles")
    .select("taal, thema, momenten, weekmenu")
    .eq("id", userId)
    .maybeSingle();
  if (!isRechtenfout(eerst.error)) return eerst.data;
  const [rest, wm] = await Promise.all([
    db.from("profiles").select("taal, thema, momenten").eq("id", userId).maybeSingle(),
    db.rpc("eigen_weekmenu"),
  ]);
  if (!rest.data) return null;
  return { ...rest.data, weekmenu: wm.error ? undefined : wm.data };
}
