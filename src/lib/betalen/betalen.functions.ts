/**
 * Serverkant van premium en abonnementen (voorstel 0012), uitsluitend in TESTMODUS.
 * - Elke schrijfactie controleert eerst `testBetalingGeweigerd("test")` (betaalpoort.ts): zodra een
 *   echte provider gekoppeld is, weigert deze weg. Echte betalingen kunnen hier dus nooit lopen.
 * - Abonnementen, facturen, entitlements en betaal_events worden alleen hier (service-rol)
 *   geschreven; de gebruiker kan ze enkel lezen (RLS 0012).
 * - Elk event gaat langs de statusmachine en wordt één keer verwerkt (unieke event-id).
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { testBetalingGeweigerd } from "@/lib/betaalpoort";
import { isOntbrekendeTabel } from "@/lib/module-beschikbaar";
import { verwerkEvent } from "./statusmachine";
import { TestBetaalProvider } from "./test-provider";
import { PLANNEN, type AbonnementStatus, type BetaalEvent, type PlanId } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LosseDb = SupabaseClient<any>;
type Ctx = { userId: string };

export type Abonnement = {
  id: string;
  user_id: string | null;
  partner_id: string | null;
  plan: PlanId;
  status: AbonnementStatus;
  modus: "test" | "live";
  provider: string;
  provider_ref: string;
  periode_einde: string | null;
  opgezegd_op: string | null;
};

export type Factuur = {
  id: string;
  nummer: string;
  omschrijving: string;
  bedrag_cent: number;
  status: "betaald" | "open" | "mislukt";
  test: boolean;
  datum: string;
};

export type MijnAbonnement = {
  beschikbaar: boolean;
  abonnement: Abonnement | null;
  facturen: Factuur[];
  entitlements: { recht: string; geldig_tot: string | null }[];
};

async function adminDb(): Promise<LosseDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as LosseDb;
}

function bewaak() {
  const fout = testBetalingGeweigerd("test");
  if (fout) throw new Error(fout);
}

function plusDagen(dagen: number) {
  return new Date(Date.now() + dagen * 86400000).toISOString().slice(0, 10);
}

type Eigenaar = { user_id: string | null; partner_id: string | null };

/** Verwerkt één event (idempotent) en werkt abonnement, entitlements en facturen bij. */
async function verwerk(
  db: LosseDb,
  wie: Eigenaar,
  bestaand: Abonnement | null,
  event: BetaalEvent,
): Promise<Abonnement> {
  const { data: al } = await db
    .from("betaal_events")
    .select("id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (al && bestaand) return bestaand;

  const uitkomst = verwerkEvent({ status: bestaand?.status ?? "geen", verwerkt: [] }, event);
  const plan = PLANNEN[event.plan];
  const status = uitkomst.staat.status;
  await db.from("betaal_events").insert({
    event_id: event.id,
    provider: "test",
    soort: event.soort,
    abonnement_ref: event.abonnementRef,
    ...wie,
    verwerkt: uitkomst.veranderd,
    reden: uitkomst.reden ?? null,
    ontvangen_op: event.tijd,
  });

  const periodeEinde =
    event.soort === "proef_gestart"
      ? plusDagen(plan.proefDagen)
      : event.soort === "checkout_voltooid" || event.soort === "betaling_gelukt"
        ? plusDagen(30)
        : (bestaand?.periode_einde ?? null);
  const velden = {
    ...wie,
    plan: event.plan,
    status,
    modus: "test",
    provider: "test",
    provider_ref: event.abonnementRef,
    periode_einde: status === "geen" ? null : periodeEinde,
    opgezegd_op: status === "opgezegd" ? event.tijd : null,
  };
  const { data: abo, error } = bestaand
    ? await db.from("abonnementen").update(velden).eq("id", bestaand.id).select("*").single()
    : await db.from("abonnementen").insert(velden).select("*").single();
  if (error) throw new Error("Het testabonnement kon niet bewaard worden.");

  // Rechten volgen de status: geen toegang meer → rechten weg; anders tot het periode-einde.
  const wis = db.from("entitlements").delete().eq("bron", "abonnement");
  await (wie.user_id ? wis.eq("user_id", wie.user_id) : wis.eq("partner_id", wie.partner_id));
  if (status !== "geen") {
    await db.from("entitlements").insert(
      plan.rechten.map((recht) => ({
        ...wie,
        recht,
        bron: "abonnement",
        geldig_tot: velden.periode_einde,
      })),
    );
  }

  if (
    event.soort === "proef_gestart" ||
    event.soort === "betaling_gelukt" ||
    event.soort === "betaling_mislukt"
  ) {
    const { count } = await db.from("facturen").select("id", { count: "exact", head: true });
    await db.from("facturen").insert({
      ...wie,
      abonnement_id: (abo as Abonnement).id,
      nummer: `TEST-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`,
      omschrijving:
        event.soort === "proef_gestart"
          ? `${plan.naam}: proefperiode (${plan.proefDagen} dagen)`
          : `${plan.naam}: 1 maand`,
      bedrag_cent: event.soort === "proef_gestart" ? 0 : plan.prijsCent,
      status: event.soort === "betaling_mislukt" ? "mislukt" : "betaald",
      test: true,
      datum: event.tijd.slice(0, 10),
    });
  }
  return abo as Abonnement;
}

async function haalAbonnement(db: LosseDb, wie: Eigenaar): Promise<Abonnement | null> {
  const q = db.from("abonnementen").select("*");
  const { data, error } = await (
    wie.user_id ? q.eq("user_id", wie.user_id) : q.eq("partner_id", wie.partner_id)
  )
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    if (isOntbrekendeTabel(error)) return null;
    throw new Error("Je abonnement kon niet geladen worden.");
  }
  return ((data ?? [])[0] as Abonnement | undefined) ?? null;
}

/**
 * Partnerplan: lezen mag elk lid van die organisatie, wijzigen alleen eigenaar of finance (ook
 * afgedwongen in RLS 0011/0012). Geen lid = geweigerd, ook al gebruikt de server de service-rol.
 */
async function partnerWie(
  db: LosseDb,
  userId: string,
  partnerId: string,
  schrijft = true,
): Promise<Eigenaar> {
  const { data } = await db
    .from("partner_leden")
    .select("rol")
    .eq("partner_id", partnerId)
    .eq("user_id", userId)
    .maybeSingle();
  const rol = (data as { rol?: string } | null)?.rol;
  if (!rol) throw new Error("Je bent geen lid van deze organisatie.");
  if (schrijft && rol !== "eigenaar" && rol !== "finance") {
    throw new Error(
      "Alleen een eigenaar of financiën kan het abonnement van je organisatie wijzigen.",
    );
  }
  return { user_id: null, partner_id: partnerId };
}

const wieSchema = z.object({ partnerId: z.string().uuid().optional() });

export const mijnAbonnement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => wieSchema.parse(d ?? {}))
  .handler(async ({ context, data }): Promise<MijnAbonnement> => {
    const db = await adminDb();
    const ctx = context as Ctx;
    const wie: Eigenaar = data.partnerId
      ? await partnerWie(db, ctx.userId, data.partnerId, false)
      : { user_id: ctx.userId, partner_id: null };
    const { error: ontbreekt } = await db.from("abonnementen").select("id").limit(1);
    if (ontbreekt && isOntbrekendeTabel(ontbreekt)) {
      return { beschikbaar: false, abonnement: null, facturen: [], entitlements: [] };
    }
    const abonnement = await haalAbonnement(db, wie);
    const kol = wie.user_id ? "user_id" : "partner_id";
    const waarde = wie.user_id ?? wie.partner_id;
    const [{ data: facturen }, { data: rechten }] = await Promise.all([
      db
        .from("facturen")
        .select("*")
        .eq(kol, waarde)
        .order("datum", { ascending: false })
        .limit(50),
      db.from("entitlements").select("recht, geldig_tot").eq(kol, waarde),
    ]);
    return {
      beschikbaar: true,
      abonnement,
      facturen: (facturen ?? []) as Factuur[],
      entitlements: (rechten ?? []) as MijnAbonnement["entitlements"],
    };
  });

export const startTestCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plan: z.enum(["premium_maand", "partner_basis", "partner_plus"]),
        partnerId: z.string().uuid().optional(),
      })
      .refine((x) => (PLANNEN[x.plan].voor === "partner") === Boolean(x.partnerId), {
        message: "Dit plan past niet bij dit account.",
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    bewaak();
    const db = await adminDb();
    const ctx = context as Ctx;
    const wie = data.partnerId
      ? await partnerWie(db, ctx.userId, data.partnerId)
      : { user_id: ctx.userId, partner_id: null };
    let abo = await haalAbonnement(db, wie);
    if (abo && (abo.status === "actief" || abo.status === "proef") && abo.plan === data.plan) {
      return { ok: true, status: abo.status };
    }
    const provider = new TestBetaalProvider();
    const checkout = await provider.startCheckout({ plan: data.plan, klantRef: ctx.userId });
    const plan = PLANNEN[data.plan];
    // Zoals een provider-webhook: ondertekend, via verwerkWebhook (handtekening gecontroleerd).
    const soorten =
      plan.proefDagen > 0 && (!abo || abo.status === "geen")
        ? (["proef_gestart"] as const)
        : (["checkout_voltooid", "betaling_gelukt"] as const);
    for (const soort of soorten) {
      const { body, handtekening } = provider.maakWebhook(
        provider.event(soort, abo?.provider_ref ?? checkout.abonnementRef, data.plan),
      );
      const event = await provider.verwerkWebhook(body, handtekening);
      abo = await verwerk(db, wie, abo, event);
    }
    return { ok: true, status: abo!.status };
  });

export const zegTestAbonnementOp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => wieSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    bewaak();
    const db = await adminDb();
    const ctx = context as Ctx;
    const wie = data.partnerId
      ? await partnerWie(db, ctx.userId, data.partnerId)
      : { user_id: ctx.userId, partner_id: null };
    const abo = await haalAbonnement(db, wie);
    if (!abo || abo.status === "geen" || abo.status === "opgezegd") {
      return { ok: true, status: abo?.status ?? "geen" };
    }
    const provider = new TestBetaalProvider();
    const { body, handtekening } = provider.maakWebhook(
      provider.event("opgezegd", abo.provider_ref, abo.plan),
    );
    const event = await provider.verwerkWebhook(body, handtekening);
    const nieuw = await verwerk(db, wie, abo, event);
    return { ok: true, status: nieuw.status };
  });

/** Alleen in testmodus: laat zien wat er gebeurt bij een mislukte of geslaagde betaling. */
export const simuleerTestBetaling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ soort: z.enum(["betaling_mislukt", "betaling_gelukt"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    bewaak();
    const db = await adminDb();
    const ctx = context as Ctx;
    const wie = { user_id: ctx.userId, partner_id: null };
    const abo = await haalAbonnement(db, wie);
    if (!abo) throw new Error("Er is nog geen testabonnement.");
    const provider = new TestBetaalProvider();
    const { body, handtekening } = provider.maakWebhook(
      provider.event(data.soort, abo.provider_ref, abo.plan),
    );
    const event = await provider.verwerkWebhook(body, handtekening);
    const nieuw = await verwerk(db, wie, abo, event);
    return { ok: true, status: nieuw.status };
  });
