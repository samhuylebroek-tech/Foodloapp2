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
import {
  genadeTot,
  moetSluiten,
  periodeDagen,
  plusDagenIso,
  proRataWijziging,
  terugbetalingMogelijk,
  type FactuurInfo,
} from "./abonnement-regels";
import { btwUitInclusief, PRIJZEN } from "./prijzen";
import { kiesBetaalProvider } from "./provider";
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
  /** Fase 6 (voorstel 0023): tot wanneer Premium werkt na een mislukte betaling. */
  genade_tot?: string | null;
  /** Fase 6: plan dat ingaat bij de volgende periode (bv. jaar → maand). */
  gepland_plan?: PlanId | null;
};

/** Met btw en soort (factuur of creditnota) uit voorstel 0023. */
export type Factuur = FactuurInfo;

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
  return plusDagenIso(new Date(), dagen);
}

/** Volgend testfactuurnummer (TEST-2026-0001). */
async function volgendNummer(db: LosseDb): Promise<string> {
  const { count } = await db.from("facturen").select("id", { count: "exact", head: true });
  return `TEST-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

function btwVelden(bedragCent: number) {
  return { btw_cent: btwUitInclusief(bedragCent), btw_procent: PRIJZEN.btw.procent };
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
  // Een geplande overstap (jaar → maand) gaat in bij de eerstvolgende geslaagde betaling.
  const planId: PlanId =
    event.soort === "betaling_gelukt" && bestaand?.gepland_plan
      ? bestaand.gepland_plan
      : event.plan;
  const plan = PLANNEN[planId];
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
        ? plusDagen(periodeDagen(planId))
        : (bestaand?.periode_einde ?? null);
  const genade =
    status === "betaling_mislukt"
      ? bestaand?.status === "betaling_mislukt" && bestaand.genade_tot
        ? bestaand.genade_tot
        : genadeTot()
      : null;
  const velden = {
    ...wie,
    plan: planId,
    status,
    modus: "test",
    provider: "test",
    provider_ref: event.abonnementRef,
    periode_einde: status === "geen" ? null : periodeEinde,
    opgezegd_op: status === "opgezegd" ? event.tijd : null,
    genade_tot: genade,
    gepland_plan:
      status === "geen" || planId !== event.plan ? null : (bestaand?.gepland_plan ?? null),
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
        // Genadeperiode: Premium werkt door tot het laatste van periode-einde en genade.
        geldig_tot:
          genade && (!velden.periode_einde || genade > velden.periode_einde)
            ? genade
            : velden.periode_einde,
      })),
    );
  }

  if (
    event.soort === "proef_gestart" ||
    event.soort === "betaling_gelukt" ||
    event.soort === "betaling_mislukt"
  ) {
    const bedrag = event.soort === "proef_gestart" ? 0 : plan.prijsCent;
    await db.from("facturen").insert({
      ...wie,
      abonnement_id: (abo as Abonnement).id,
      nummer: await volgendNummer(db),
      omschrijving:
        event.soort === "proef_gestart"
          ? `${plan.naam}: proefperiode (${plan.proefDagen} dagen)`
          : `${plan.naam}: 1 ${plan.interval}`,
      bedrag_cent: bedrag,
      ...btwVelden(bedrag),
      soort: "factuur",
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
    let abonnement = await haalAbonnement(db, wie);
    // Fase 6: opgezegd en de periode is voorbij, of de genadeperiode is om → Premium sluit.
    // Dezelfde weg als een provider-webhook ("periode_afgelopen"), alleen in testmodus.
    if (abonnement && moetSluiten(abonnement) && !testBetalingGeweigerd("test")) {
      const provider = new TestBetaalProvider();
      const { body, handtekening } = provider.maakWebhook(
        provider.event("periode_afgelopen", abonnement.provider_ref, abonnement.plan),
      );
      abonnement = await verwerk(
        db,
        wie,
        abonnement,
        await provider.verwerkWebhook(body, handtekening),
      );
    }
    const kol = wie.user_id ? "user_id" : "partner_id";
    const waarde = wie.user_id ?? wie.partner_id;
    // BUG-181: facturen van een organisatie alleen voor eigenaar of financiën (zoals RLS 0012
    // facturen_lezen → partner_mag 'abonnement.beheren'); een analist ziet het plan, geen facturen.
    let magFacturen = true;
    if (data.partnerId) {
      const { data: lid } = await db
        .from("partner_leden")
        .select("rol")
        .eq("partner_id", data.partnerId)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      const rol = (lid as { rol?: string } | null)?.rol;
      magFacturen = rol === "eigenaar" || rol === "finance";
    }
    const [{ data: facturen }, { data: rechten }] = await Promise.all([
      magFacturen
        ? db
            .from("facturen")
            .select("*")
            .eq(kol, waarde)
            .order("datum", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
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
        plan: z.enum(["premium_maand", "premium_jaar", "partner_basis", "partner_plus"]),
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
    z
      .object({ soort: z.enum(["betaling_mislukt", "betaling_gelukt", "periode_afgelopen"]) })
      .parse(d),
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

/**
 * Fase 6: overstappen tussen maand en jaar (testmodus). Naar jaar: meteen, met het ongebruikte
 * deel als tegoed (testfactuur voor het verschil). Naar maand: gepland voor de volgende periode.
 */
export const wijzigTestPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ naar: z.enum(["premium_maand", "premium_jaar"]) }).parse(d))
  .handler(async ({ context, data }) => {
    bewaak();
    const db = await adminDb();
    const ctx = context as Ctx;
    const wie = { user_id: ctx.userId, partner_id: null };
    const abo = await haalAbonnement(db, wie);
    if (!abo) throw new Error("Er is nog geen testabonnement.");
    const w = proRataWijziging({
      van: abo.plan,
      naar: data.naar,
      status: abo.status,
      periodeEinde: abo.periode_einde,
    });
    if (w.soort === "niet_mogelijk" || w.soort === "zelfde") throw new Error(w.tekst);
    const naar = PLANNEN[data.naar];
    if (abo.status === "proef" || w.soort === "downgrade") {
      // Proef: het plan na de proef. Downgrade: pas vanaf de volgende periode.
      const velden =
        abo.status === "proef"
          ? { plan: data.naar, gepland_plan: null }
          : { gepland_plan: data.naar };
      const { error } = await db.from("abonnementen").update(velden).eq("id", abo.id);
      if (error) throw new Error("De overstap kon niet bewaard worden.");
      return { ok: true, soort: w.soort, tekst: w.tekst };
    }
    // Upgrade: meteen, nieuwe periode van een jaar, rechten verlengd, testfactuur voor het verschil.
    const einde = plusDagen(periodeDagen(data.naar));
    const { error } = await db
      .from("abonnementen")
      .update({ plan: data.naar, periode_einde: einde, gepland_plan: null })
      .eq("id", abo.id);
    if (error) throw new Error("De overstap kon niet bewaard worden.");
    await db
      .from("entitlements")
      .update({ geldig_tot: einde })
      .eq("user_id", ctx.userId)
      .eq("bron", "abonnement");
    await db.from("facturen").insert({
      ...wie,
      abonnement_id: abo.id,
      nummer: await volgendNummer(db),
      omschrijving: `${naar.naam}: overstap, 1 jaar min ${(w.tegoedCent / 100).toFixed(2).replace(".", ",")} euro tegoed`,
      bedrag_cent: w.teBetalenCent,
      ...btwVelden(w.teBetalenCent),
      soort: "factuur",
      status: "betaald",
      test: true,
      datum: plusDagen(0),
    });
    await db.from("betaal_events").insert({
      event_id: `evt_test_wijziging_${abo.id}_${Date.now()}`,
      provider: "test",
      soort: "plan_gewijzigd",
      abonnement_ref: abo.provider_ref,
      ...wie,
      verwerkt: true,
      reden: null,
      ontvangen_op: new Date().toISOString(),
    });
    return { ok: true, soort: w.soort, tekst: w.tekst };
  });

/**
 * Fase 6: terugbetaling binnen de herroepingstermijn (testmodus). Via de provider-interface
 * (`terugbetaal`), dan een testcreditnota en het event "terugbetaald": Premium stopt meteen,
 * gratis functies en gegevens blijven.
 */
export const vraagTestTerugbetaling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    bewaak();
    const db = await adminDb();
    const ctx = context as Ctx;
    const wie = { user_id: ctx.userId, partner_id: null };
    const abo = await haalAbonnement(db, wie);
    if (!abo || abo.status === "geen") throw new Error("Er is geen lopend testabonnement.");
    const { data: fac } = await db
      .from("facturen")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("datum", { ascending: false })
      .limit(50);
    const t = terugbetalingMogelijk((fac ?? []) as Factuur[]);
    if (!t.mag) throw new Error(t.tekst);
    const provider = kiesBetaalProvider("test");
    const terug = await provider.terugbetaal({
      abonnementRef: abo.provider_ref,
      bedragCent: t.bedragCent,
      reden: "herroeping binnen de termijn",
    });
    await db.from("facturen").insert({
      ...wie,
      abonnement_id: abo.id,
      nummer: await volgendNummer(db),
      omschrijving: `Terugbetaling ${t.factuur.nummer} (binnen ${PRIJZEN.herroepingDagen} dagen)`,
      bedrag_cent: terug.bedragCent,
      ...btwVelden(terug.bedragCent),
      soort: "creditnota",
      verwijst_naar: t.factuur.id,
      status: "betaald",
      test: true,
      datum: plusDagen(0),
    });
    const test = new TestBetaalProvider();
    const { body, handtekening } = test.maakWebhook(
      test.event("terugbetaald", abo.provider_ref, abo.plan),
    );
    const nieuw = await verwerk(db, wie, abo, await test.verwerkWebhook(body, handtekening));
    return { ok: true, status: nieuw.status, bedragCent: terug.bedragCent };
  });
