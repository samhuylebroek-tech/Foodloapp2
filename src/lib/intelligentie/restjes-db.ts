/**
 * Restjes op het account en gedeeld met het gezin (fase 3, tabel `restjes`, voorstel 0019).
 *
 * - De lijst op het toestel (`restjes.ts`) blijft de snelle bron voor het scherm; elke handeling
 *   past ze meteen aan en stuurt de wijziging daarna naar het account.
 * - Bestaat de tabel niet (productie vóór migratie 0019), dan blijft alles op het toestel, zoals
 *   voordien. Geen foutmelding.
 * - Mislukt het versturen (offline), dan blijft het restje "vuil" en gaat het mee bij de volgende
 *   keer ophalen. Verwijderd op het toestel = onthouden, zodat het account het niet terugzet.
 * - Geen gezondheidsgegevens: alleen de naam van het gerecht, porties, datums en de afloop.
 */
import { db, isOntbrekendeTabel } from "@/lib/module-beschikbaar";
import {
  afgeslotenRestjes,
  heropenRestje,
  merkWeg,
  planRestje,
  ruweRestjes,
  sluitRestje,
  vergeetWeg,
  vervangRestjes,
  verwijderRestje,
  wegGemerkt,
  bewaarRestje,
  verspillingVanMaand,
  type Afloop,
  type Restje,
  type Verspilling,
} from "./restjes";

export const RESTJES_TABEL = "restjes";
const DAG = 86400000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RestjeRij = {
  id: string;
  user_id: string;
  group_id: string | null;
  titel: string;
  recipe_id: string | null;
  porties: number;
  gekookt_op: string;
  gepland_op: string | null;
  status: "bewaard" | Afloop;
  afgesloten_op: string | null;
};

/** Waar staan je restjes nu? "account" = op je account (en bij je gezin), anders dit toestel. */
export type RestjesBron = "account" | "toestel";
let laatsteBron: RestjesBron = "toestel";
export const restjesBron = () => laatsteBron;

export function naarRij(r: Restje, userId: string, groupId: string | null): RestjeRij {
  return {
    id: r.id,
    user_id: r.door ?? userId,
    // Op het account blijft het gezin vast (de databank laat dat niet veranderen).
    group_id: r.groep !== undefined ? r.groep : groupId,
    titel: r.titel.slice(0, 120),
    recipe_id: r.receptId,
    porties: r.porties,
    gekookt_op: new Date(r.gekookt).toISOString(),
    gepland_op: r.gepland ?? null,
    status: "bewaard",
    afgesloten_op: null,
  };
}

export function vanRij(rij: RestjeRij): Restje {
  return {
    id: rij.id,
    titel: rij.titel,
    receptId: rij.recipe_id,
    porties: rij.porties,
    gekookt: Date.parse(rij.gekookt_op),
    ...(rij.gepland_op ? { gepland: rij.gepland_op } : {}),
    bron: "account",
    door: rij.user_id,
    groep: rij.group_id,
  };
}

/**
 * Pure samenvoeging na het ophalen: het account is de waarheid voor wat er al stond; wat op het
 * toestel nieuw of gewijzigd is (geen `bron` of `vuil`), gaat mee en moet verstuurd worden.
 * Verwijderd op het toestel telt niet, ook al staat het nog op het account.
 */
export function voegSamen(
  lokaal: readonly Restje[],
  account: readonly Restje[],
  weg: ReadonlySet<string>,
  gesloten: ReadonlyMap<string, Afloop> = new Map(),
): {
  lijst: Restje[];
  versturen: Restje[];
  wissen: string[];
  sluiten: { id: string; status: Afloop }[];
} {
  const perId = new Map(
    account.filter((r) => !weg.has(r.id) && !gesloten.has(r.id)).map((r) => [r.id, r]),
  );
  const versturen: Restje[] = [];
  for (const r of lokaal) {
    if (weg.has(r.id)) continue;
    if (!r.bron || r.vuil) {
      // Oude id's (van vóór 0019) passen niet in de tabel: een nieuwe uuid, zelfde inhoud.
      const id = UUID.test(r.id) ? r.id : nieuweUuid();
      const { vuil: _v, ...rest } = r;
      const nieuw: Restje = { ...rest, id, bron: "account" };
      perId.set(id, nieuw);
      versturen.push(nieuw);
    }
  }
  const wissen = account.filter((r) => weg.has(r.id)).map((r) => r.id);
  const sluiten = account
    .filter((r) => !weg.has(r.id) && gesloten.has(r.id))
    .map((r) => ({ id: r.id, status: gesloten.get(r.id)! }));
  return { lijst: [...perId.values()], versturen, wissen, sluiten };
}

function nieuweUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Zeldzaam (oude browser): een geldige v4-vorm uit Math.random.
  return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

/**
 * Ophalen en gelijkzetten. Geeft waar de restjes nu staan. Gooit nooit: bij een netwerkfout
 * blijft de lijst op het toestel zoals ze is.
 */
export async function synchroniseerRestjes(
  userId: string,
  groupId: string | null,
  nu = Date.now(),
): Promise<RestjesBron> {
  try {
    const sinds = new Date(nu - 7 * DAG).toISOString();
    let q = db
      .from(RESTJES_TABEL)
      .select("*")
      .eq("status", "bewaard")
      .gte("gekookt_op", sinds)
      .order("gekookt_op", { ascending: false })
      .limit(100);
    q = groupId ? q.or(`user_id.eq.${userId},group_id.eq.${groupId}`) : q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) {
      if (isOntbrekendeTabel(error)) laatsteBron = "toestel";
      return laatsteBron;
    }
    laatsteBron = "account";
    // Tweede laag naast RLS: alleen eigen restjes en die van het eigen gezin.
    const rijen = ((data ?? []) as RestjeRij[]).filter(
      (r) =>
        r.status === "bewaard" && (r.user_id === userId || (!!groupId && r.group_id === groupId)),
    );
    const weg = wegGemerkt(userId);
    // Op dit toestel afgesloten (opgegeten/weggegooid) terwijl het account dat nog niet wist.
    const gesloten = new Map(
      afgeslotenRestjes(userId)
        .filter((a) => nu - a.op < 7 * DAG)
        .map((a) => [a.id, a.status] as const),
    );
    const { lijst, versturen, wissen, sluiten } = voegSamen(
      ruweRestjes(userId),
      rijen.map(vanRij),
      weg,
      gesloten,
    );
    vervangRestjes(userId, lijst);
    for (const r of versturen) await stuur(userId, groupId, r);
    for (const id of wissen) await wis(userId, id);
    for (const g of sluiten)
      await db
        .from(RESTJES_TABEL)
        .update({ status: g.status, afgesloten_op: new Date(nu).toISOString() })
        .eq("id", g.id);
    return laatsteBron;
  } catch {
    return laatsteBron;
  }
}

async function stuur(userId: string, groupId: string | null, r: Restje) {
  const rij = naarRij(r, userId, groupId);
  // Een restje van een gezinslid: alleen de planning verandert (dat mag elk gezinslid).
  const { error } =
    rij.user_id === userId
      ? await db.from(RESTJES_TABEL).upsert(rij, { onConflict: "id" })
      : await db.from(RESTJES_TABEL).update({ gepland_op: rij.gepland_op }).eq("id", rij.id);
  if (!error) {
    laatsteBron = "account";
    markeer(userId, r.id, false, rij.group_id);
    return;
  }
  if (isOntbrekendeTabel(error)) {
    laatsteBron = "toestel";
    return;
  }
  markeer(userId, r.id, true);
}

async function wis(userId: string, id: string) {
  if (!UUID.test(id)) return vergeetWeg(userId, id);
  const { error } = await db.from(RESTJES_TABEL).delete().eq("id", id);
  if (!error || isOntbrekendeTabel(error)) vergeetWeg(userId, id);
}

function markeer(userId: string, id: string, vuil: boolean, groep?: string | null) {
  const l = ruweRestjes(userId);
  if (!l.some((r) => r.id === id)) return;
  vervangRestjes(
    userId,
    l.map((r) => {
      if (r.id !== id) return r;
      const { vuil: _v, ...rest } = r;
      if (vuil) return { ...rest, vuil: true };
      return {
        ...rest,
        bron: "account" as const,
        ...(groep !== undefined ? { groep } : {}),
      };
    }),
  );
}

const vind = (userId: string, id: string) => ruweRestjes(userId).find((r) => r.id === id);

// ---------------------------------------------------------------- handelingen

/** Acties met de juiste gebruiker en het gezin (via `useRestjesActies`). */
export function restjesActies(userId: string, groupId: string | null) {
  return {
    bewaar(r: { titel: string; receptId: string | null; porties: number }): Restje {
      const nieuw = bewaarRestje(userId, r);
      void stuur(userId, groupId, nieuw);
      return nieuw;
    },
    /** Ongedaan maken van bewaren: echt weg (ook op het account). */
    verwijder(id: string): Restje | null {
      const weg = verwijderRestje(userId, id);
      if (weg) {
        merkWeg(userId, id);
        void wis(userId, id);
      }
      return weg;
    },
    plan(id: string, datum: string | null) {
      planRestje(userId, id, datum);
      const r = vind(userId, id);
      if (r) void stuur(userId, groupId, r);
    },
    /** Opgegeten of weggegooid; geeft het herstel terug ("Ongedaan maken"). */
    sluit(id: string, status: Afloop): (() => Promise<void>) | null {
      const r = sluitRestje(userId, id, status);
      if (!r) return null;
      const op = new Date().toISOString();
      // Lukt dit niet (offline), dan zet de volgende synchronisatie het alsnog (afloop op het
      // toestel, zie `voegSamen`).
      void db
        .from(RESTJES_TABEL)
        .update({ status, afgesloten_op: op })
        .eq("id", id)
        .then(
          () => undefined,
          () => undefined,
        );
      return async () => {
        heropenRestje(userId, r);
        const { error } = await db
          .from(RESTJES_TABEL)
          .update({ status: "bewaard", afgesloten_op: null })
          .eq("id", id);
        if (error && !isOntbrekendeTabel(error)) markeer(userId, id, true);
      };
    },
  };
}

/**
 * Verspilling deze maand: van het account (met het gezin) of van dit toestel. Een richtwaarde:
 * alleen wat iemand zelf markeerde.
 */
export async function verspillingDezeMaand(
  userId: string,
  groupId: string | null,
  nu = new Date(),
): Promise<Verspilling & { bron: RestjesBron }> {
  const maand = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;
  const start = new Date(nu.getFullYear(), nu.getMonth(), 1).toISOString();
  const lokaal = () => ({
    ...verspillingVanMaand(afgeslotenRestjes(userId), maand),
    bron: "toestel" as const,
  });
  try {
    let q = db
      .from(RESTJES_TABEL)
      .select("id, user_id, group_id, porties, status, afgesloten_op")
      .neq("status", "bewaard")
      .gte("afgesloten_op", start)
      .limit(500);
    q = groupId ? q.or(`user_id.eq.${userId},group_id.eq.${groupId}`) : q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) return lokaal();
    const rijen = ((data ?? []) as RestjeRij[]).filter(
      (r) =>
        r.status !== "bewaard" &&
        !!r.afgesloten_op &&
        (r.user_id === userId || (!!groupId && r.group_id === groupId)),
    );
    return {
      ...verspillingVanMaand(
        rijen.map((r) => ({
          porties: r.porties,
          status: r.status as Afloop,
          op: Date.parse(r.afgesloten_op!),
        })),
        maand,
      ),
      bron: "account",
    };
  } catch {
    return lokaal();
  }
}
