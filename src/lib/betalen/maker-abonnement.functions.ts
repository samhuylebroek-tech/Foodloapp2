/**
 * Serverkant van het makerabonnement (fase 4), uitsluitend in TESTMODUS: er wordt niets
 * aangerekend, er is geen betaalprovider en er worden geen kaartgegevens gevraagd.
 * - Elke schrijfactie controleert eerst `testBetalingGeweigerd("test")` (betaalpoort.ts).
 * - `maker_abonnementen` en `maker_betalingen` worden alleen hier (service-rol) geschreven;
 *   de fan leest zijn eigen rijen, de maker ziet alleen voornaam, sinds en status van zijn
 *   abonnees en een schatting van zijn deel — nooit betaalgegevens (RLS-voorstel 0021).
 * - Toegang tot exclusieve inhoud volgt `rechtenUitMakerAbonnementen` + `heeftRecht`.
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { testBetalingGeweigerd } from "@/lib/betaalpoort";
import { isOntbrekendeTabel } from "@/lib/module-beschikbaar";
import { heeftRecht } from "./entitlements";
import { verdeelOpbrengst } from "./fee";
import {
  abonneesSamenvatting,
  makerRecht,
  nieuwePeriode,
  opzegBerekening,
  rechtenUitMakerAbonnementen,
  voornaamVan,
  type MakerAbonnement,
  type MakerBetaling,
  type MakerPlan,
} from "./maker-abonnement";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LosseDb = SupabaseClient<any>;
type Ctx = { userId: string };

async function adminDb(): Promise<LosseDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as LosseDb;
}

function bewaak() {
  const fout = testBetalingGeweigerd("test");
  if (fout) throw new Error(fout);
}

async function beschikbaar(db: LosseDb): Promise<boolean> {
  const { error } = await db.from("maker_abonnementen").select("id").limit(1);
  if (!error) return true;
  if (isOntbrekendeTabel(error)) return false;
  throw new Error("Abonnementen konden niet geladen worden.");
}

async function haalPlan(db: LosseDb, creatorId: string): Promise<MakerPlan | null> {
  const { data } = await db
    .from("maker_plannen")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();
  return (data as MakerPlan | null) ?? null;
}

async function haalMijnAbonnement(
  db: LosseDb,
  fanId: string,
  creatorId: string,
): Promise<MakerAbonnement | null> {
  const { data } = await db
    .from("maker_abonnementen")
    .select("*")
    .eq("fan_id", fanId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  return (data as MakerAbonnement | null) ?? null;
}

const makerSchema = z.object({ creatorId: z.string().uuid() });

export type MakerAbonnementStaat = {
  beschikbaar: boolean;
  plan: Pick<MakerPlan, "prijs_cent" | "voordelen" | "actief"> | null;
  abonnement: MakerAbonnement | null;
  recht: boolean;
  betalingen: MakerBetaling[];
};

/** Plan van de maker, je eigen abonnement en testbetalingen, en of je toegang hebt. */
export const makerAbonnementStaat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => makerSchema.parse(d))
  .handler(async ({ context, data }): Promise<MakerAbonnementStaat> => {
    const db = await adminDb();
    const ctx = context as Ctx;
    if (!(await beschikbaar(db)))
      return { beschikbaar: false, plan: null, abonnement: null, recht: false, betalingen: [] };
    const [plan, abonnement] = await Promise.all([
      haalPlan(db, data.creatorId),
      haalMijnAbonnement(db, ctx.userId, data.creatorId),
    ]);
    const { data: betalingen } = abonnement
      ? await db
          .from("maker_betalingen")
          .select("id, soort, bedrag_cent, btw_cent, test, created_at")
          .eq("abonnement_id", abonnement.id)
          .eq("fan_id", ctx.userId)
          .order("created_at", { ascending: false })
          .limit(24)
      : { data: [] };
    const rechten = rechtenUitMakerAbonnementen(abonnement ? [abonnement] : []);
    return {
      beschikbaar: true,
      plan: plan
        ? { prijs_cent: plan.prijs_cent, voordelen: plan.voordelen, actief: plan.actief }
        : null,
      abonnement,
      recht: heeftRecht({ id: ctx.userId, entitlements: rechten }, makerRecht(data.creatorId)),
      betalingen: (betalingen ?? []) as MakerBetaling[],
    };
  });

/** Alle makerrechten van de aangemelde gebruiker (voor exclusieve recepten en collecties). */
export const mijnMakerRechten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const ctx = context as Ctx;
    if (!(await beschikbaar(db))) return { beschikbaar: false, entitlements: [] };
    const { data } = await db
      .from("maker_abonnementen")
      .select("creator_id, status, periode_einde")
      .eq("fan_id", ctx.userId)
      .limit(500);
    return {
      beschikbaar: true,
      entitlements: rechtenUitMakerAbonnementen((data ?? []) as MakerAbonnement[]),
    };
  });

/** Abonneren in testmodus: geen provider, geen kaart, een testbetaling van € 0 echt geld. */
export const abonneerOpMaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => makerSchema.parse(d))
  .handler(async ({ context, data }) => {
    bewaak();
    const db = await adminDb();
    const ctx = context as Ctx;
    if (!(await beschikbaar(db))) throw new Error("Abonnementen zijn nog niet beschikbaar.");
    const { data: maker } = await db
      .from("creators")
      .select("id, user_id")
      .eq("id", data.creatorId)
      .maybeSingle();
    if (!maker) throw new Error("Deze maker bestaat niet (meer).");
    if ((maker as { user_id: string }).user_id === ctx.userId)
      throw new Error("Je kan je niet abonneren op je eigen makerpagina.");
    const plan = await haalPlan(db, data.creatorId);
    if (!plan?.actief) throw new Error("Deze maker biedt (nog) geen abonnement aan.");

    const bestaand = await haalMijnAbonnement(db, ctx.userId, data.creatorId);
    if (bestaand && rechtenUitMakerAbonnementen([bestaand]).length)
      return { ok: true, status: "actief" as const };

    const periode = nieuwePeriode();
    const velden = {
      fan_id: ctx.userId,
      creator_id: data.creatorId,
      status: "actief",
      modus: "test",
      prijs_cent: plan.prijs_cent,
      ...periode,
      opgezegd_op: null,
    };
    const { data: abo, error } = bestaand
      ? await db
          .from("maker_abonnementen")
          .update(velden)
          .eq("id", bestaand.id)
          .select("*")
          .single()
      : await db.from("maker_abonnementen").insert(velden).select("*").single();
    if (error || !abo) throw new Error("Het testabonnement kon niet bewaard worden.");
    const v = verdeelOpbrengst(plan.prijs_cent);
    await db.from("maker_betalingen").insert({
      abonnement_id: (abo as MakerAbonnement).id,
      fan_id: ctx.userId,
      creator_id: data.creatorId,
      soort: "betaling",
      bedrag_cent: v.prijsCent,
      btw_cent: v.btwCent,
      platform_cent: v.platformCent,
      maker_cent: v.makerCent,
      provider: "test",
      provider_ref: `test_${crypto.randomUUID()}`,
      test: true,
      created_at: new Date().toISOString(),
    });
    return { ok: true, status: "actief" as const };
  });

/** Opzeggen: toegang stopt meteen; testterugbetaling volgens `opzegBerekening`. */
export const zegMakerAbonnementOp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => makerSchema.parse(d))
  .handler(async ({ context, data }) => {
    bewaak();
    const db = await adminDb();
    const ctx = context as Ctx;
    const abo = await haalMijnAbonnement(db, ctx.userId, data.creatorId);
    if (!abo || abo.status !== "actief") return { ok: true, terugCent: 0 };
    const nu = new Date();
    const { terugCent } = opzegBerekening(abo, nu);
    const { error } = await db
      .from("maker_abonnementen")
      .update({
        status: "opgezegd",
        opgezegd_op: nu.toISOString(),
        periode_einde: nu.toISOString(),
      })
      .eq("id", abo.id)
      .eq("fan_id", ctx.userId);
    if (error) throw new Error("Opzeggen lukte niet. Probeer het opnieuw.");
    if (terugCent > 0) {
      const v = verdeelOpbrengst(terugCent);
      await db.from("maker_betalingen").insert({
        abonnement_id: abo.id,
        fan_id: ctx.userId,
        creator_id: data.creatorId,
        soort: "terugbetaling",
        bedrag_cent: v.prijsCent,
        btw_cent: v.btwCent,
        platform_cent: v.platformCent,
        maker_cent: v.makerCent,
        provider: "test",
        provider_ref: `test_${crypto.randomUUID()}`,
        test: true,
        created_at: nu.toISOString(),
      });
    }
    return { ok: true, terugCent };
  });

export type MakerAbonnee = { voornaam: string; sinds: string; status: "actief" | "opgezegd" };

/**
 * De maker ziet zijn abonnees: voornaam, sinds wanneer en of het nog loopt, plus een schatting
 * van zijn deel per maand. Geen e-mail, geen bedragen per persoon, geen betaalgegevens.
 */
export const mijnMakerAbonnees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const ctx = context as Ctx;
    if (!(await beschikbaar(db)))
      return {
        beschikbaar: false,
        abonnees: [] as MakerAbonnee[],
        aantal: 0,
        schattingMakerCent: 0,
      };
    const { data: maker } = await db
      .from("creators")
      .select("id")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (!maker)
      return {
        beschikbaar: true,
        abonnees: [] as MakerAbonnee[],
        aantal: 0,
        schattingMakerCent: 0,
      };
    const creatorId = (maker as { id: string }).id;
    const [{ data: rijen }, plan] = await Promise.all([
      db
        .from("maker_abonnementen")
        .select("fan_id, status, start_op, periode_einde")
        .eq("creator_id", creatorId)
        .order("start_op", { ascending: false })
        .limit(200),
      haalPlan(db, creatorId),
    ]);
    const abos = (rijen ?? []) as Pick<
      MakerAbonnement,
      "fan_id" | "status" | "start_op" | "periode_einde"
    >[];
    const fanIds = [...new Set(abos.map((a) => a.fan_id))];
    const { data: profielen } = fanIds.length
      ? await db.from("profiles").select("id, display_name").in("id", fanIds)
      : { data: [] };
    const naam = new Map(
      ((profielen ?? []) as { id: string; display_name: string | null }[]).map((p) => [
        p.id,
        voornaamVan(p.display_name),
      ]),
    );
    const actief = rechtenUitMakerAbonnementen(
      abos.map((a) => ({ ...a, creator_id: creatorId })),
    ).length;
    return {
      beschikbaar: true,
      abonnees: abos.map((a) => ({
        voornaam: naam.get(a.fan_id) ?? "Een fan",
        sinds: a.start_op,
        status:
          a.status === "actief" && new Date(a.periode_einde).getTime() >= Date.now()
            ? ("actief" as const)
            : ("opgezegd" as const),
      })),
      ...abonneesSamenvatting(actief, plan),
    };
  });
