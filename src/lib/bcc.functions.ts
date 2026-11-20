/**
 * Business Control Center (fase 5), uitsluitend TESTMODUS: partneraanvragen, campagnes met
 * vertoningen/klikken, omzet per maand, makeruitbetalingen (niets wordt uitbetaald) en
 * teamuitnodigingen (er wordt geen e-mail verstuurd).
 *
 * Elke functie loopt via `bewaker()` (vaste eigenaar + rol uit admin_users + recht per actie +
 * alleen-lezen + snelheidslimiet) en elke wijziging komt in het onwijzigbare auditlogboek.
 * Tabellen die in productie pas na voorstel 0011/0012/0021/0022 bestaan, geven `beschikbaar: false`.
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bewaker, logboek } from "@/lib/admin.functions";
import { testBetalingGeweigerd } from "@/lib/betaalpoort";
import { isOntbrekendeTabel } from "@/lib/module-beschikbaar";
import { FEE_VOORSTEL } from "@/lib/betalen/fee";
import {
  aanvraagBesluitFout,
  klikratio,
  leesPlatformProcent,
  maandVan,
  omzetPerMaand,
  PLATFORM_PROCENT_SLEUTEL,
  uitbetalingPerMaker,
  uitnodigingFout,
  type FactuurRij,
  type MakerBetalingRij,
  type MakerUitbetaling,
  type OmzetMaand,
} from "@/lib/bcc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string; claims?: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LosseDb = SupabaseClient<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rij = any;

async function poort(context: unknown, recht: Parameters<typeof bewaker>[1], schrijft?: boolean) {
  const { db, profiel } = await bewaker(
    context as Ctx,
    recht,
    schrijft === undefined ? {} : { schrijft },
  );
  return { db: db as unknown as LosseDb, profiel };
}

async function namen(db: LosseDb, ids: string[]): Promise<Map<string, string>> {
  const uniek = [...new Set(ids.filter(Boolean))];
  if (!uniek.length) return new Map();
  const { data } = await db.from("profiles").select("id, display_name").in("id", uniek);
  return new Map(
    ((data ?? []) as Rij[]).map((p) => [String(p.id), String(p.display_name ?? "Gebruiker")]),
  );
}

// ---------- partneraanvragen ----------

export type BccAanvraag = {
  id: string;
  bedrijfsnaam: string;
  soort: string;
  website: string | null;
  bericht: string | null;
  status: string;
  created_at: string | null;
  aanvrager: string;
  beoordeling_reden: string | null;
  beoordeeld_op: string | null;
  partner_id: string | null;
};

export const bccAanvragen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ beschikbaar: boolean; aanvragen: BccAanvraag[] }> => {
    const { db } = await poort(context, "partners.view", false);
    const { data, error } = await db
      .from("partner_aanvragen")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      if (isOntbrekendeTabel(error)) return { beschikbaar: false, aanvragen: [] };
      throw new Error("De partneraanvragen konden niet geladen worden.");
    }
    const rijen = (data ?? []) as Rij[];
    const naam = await namen(
      db,
      rijen.map((r) => String(r.user_id)),
    );
    return {
      beschikbaar: true,
      aanvragen: rijen.map((r) => ({
        id: String(r.id),
        bedrijfsnaam: String(r.bedrijfsnaam),
        soort: String(r.soort),
        website: r.website ?? null,
        bericht: r.bericht ?? null,
        status: String(r.status),
        created_at: r.created_at ?? null,
        aanvrager: naam.get(String(r.user_id)) ?? "Gebruiker",
        beoordeling_reden: r.beoordeling_reden ?? null,
        beoordeeld_op: r.beoordeeld_op ?? null,
        partner_id: r.partner_id ?? null,
      })),
    };
  });

export const bccAanvraagBeslissen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        besluit: z.enum(["goedgekeurd", "geweigerd"]),
        reden: z.string().trim().max(500).default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await poort(context, "partners.manage");
    const { data: a } = await db
      .from("partner_aanvragen")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!a) throw new Error("Deze aanvraag bestaat niet (meer).");
    const fout = aanvraagBesluitFout(String((a as Rij).status), data.besluit, data.reden);
    if (fout) throw new Error(fout);
    const aanvraag = a as Rij;
    let partnerId: string | null = null;
    if (data.besluit === "goedgekeurd") {
      const { data: partner, error } = await db
        .from("partners")
        .insert({
          naam: String(aanvraag.bedrijfsnaam).slice(0, 80),
          soort: aanvraag.soort,
          website: aanvraag.website ?? null,
          logo_url: null,
          omschrijving: null,
          verificatie_status: "geverifieerd",
        })
        .select("*")
        .single();
      if (error || !partner) throw new Error("De partner kon niet aangemaakt worden.");
      partnerId = String((partner as Rij).id);
      const { error: lidFout } = await db
        .from("partner_leden")
        .insert({ partner_id: partnerId, user_id: aanvraag.user_id, rol: "eigenaar" });
      if (lidFout) {
        await db.from("partners").delete().eq("id", partnerId);
        throw new Error("De aanvrager kon niet als eigenaar toegevoegd worden.");
      }
    }
    const { error } = await db
      .from("partner_aanvragen")
      .update({
        status: data.besluit,
        beoordeling_reden: data.reden || null,
        beoordeeld_door: profiel.user_id,
        beoordeeld_op: new Date().toISOString(),
        partner_id: partnerId,
      })
      .eq("id", data.id);
    if (error) throw new Error("Het besluit kon niet bewaard worden.");
    await logboek(db, profiel, `partner.aanvraag.${data.besluit}`, "partner_aanvraag", data.id, {
      bedrijf: aanvraag.bedrijfsnaam,
      reden: data.reden || null,
      partner_id: partnerId,
    });
    return { ok: true, partnerId };
  });

// ---------- campagnes ----------

export type BccCampagne = {
  id: string;
  naam: string;
  partner: string;
  partner_id: string;
  status: string;
  start: string | null;
  einde: string | null;
  doel: string | null;
  testbudget_cent: number;
  items: number;
  vertoningen: number;
  klikken: number;
  klikratio: number;
};

export const bccCampagnes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ beschikbaar: boolean; campagnes: BccCampagne[] }> => {
    const { db } = await poort(context, "partners.view", false);
    const { data, error } = await db
      .from("campagnes")
      .select("*")
      .order("start", { ascending: false })
      .limit(500);
    if (error) {
      if (isOntbrekendeTabel(error)) return { beschikbaar: false, campagnes: [] };
      throw new Error("De campagnes konden niet geladen worden.");
    }
    const camp = (data ?? []) as Rij[];
    const ids = camp.map((c) => String(c.id));
    const partnerIds = [...new Set(camp.map((c) => String(c.partner_id)))];
    const [{ data: partners }, { data: stats }, { data: items }] = await Promise.all([
      partnerIds.length
        ? db.from("partners").select("id, naam").in("id", partnerIds)
        : Promise.resolve({ data: [] }),
      ids.length
        ? db
            .from("gesponsord_statistiek")
            .select("campagne_id, vertoningen, klikken")
            .in("campagne_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? db.from("gesponsorde_items").select("id, campagne_id").in("campagne_id", ids)
        : Promise.resolve({ data: [] }),
    ]);
    const partnerNaam = new Map(
      ((partners ?? []) as Rij[]).map((p) => [String(p.id), String(p.naam)]),
    );
    const som = new Map<string, { v: number; k: number }>();
    for (const s of (stats ?? []) as Rij[]) {
      const t = som.get(String(s.campagne_id)) ?? { v: 0, k: 0 };
      t.v += Math.max(0, Number(s.vertoningen) || 0);
      t.k += Math.max(0, Number(s.klikken) || 0);
      som.set(String(s.campagne_id), t);
    }
    return {
      beschikbaar: true,
      campagnes: camp.map((c) => {
        const t = som.get(String(c.id)) ?? { v: 0, k: 0 };
        return {
          id: String(c.id),
          naam: String(c.naam),
          partner: partnerNaam.get(String(c.partner_id)) ?? "Onbekende partner",
          partner_id: String(c.partner_id),
          status: String(c.status),
          start: c.start ?? null,
          einde: c.einde ?? null,
          doel: c.doel ?? null,
          testbudget_cent: Math.max(0, Number(c.testbudget_cent) || 0),
          items: ((items ?? []) as Rij[]).filter((i) => i.campagne_id === c.id).length,
          vertoningen: t.v,
          klikken: t.k,
          klikratio: klikratio(t.v, t.k),
        };
      }),
    };
  });

export const bccCampagneBeslissen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        besluit: z.enum(["goedgekeurd", "afgewezen", "beeindigd"]),
        reden: z.string().trim().max(500).default(""),
      })
      .refine((x) => x.besluit !== "afgewezen" || x.reden.length >= 3, {
        message: "Geef een korte reden bij terugsturen. De partner ziet die.",
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await poort(context, "partners.manage");
    const { data: c } = await db.from("campagnes").select("*").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Deze campagne bestaat niet (meer).");
    const camp = c as Rij;
    const van = String(camp.status);
    if (data.besluit !== "beeindigd" && van !== "ingediend")
      throw new Error("Alleen een ingediende campagne kan je goedkeuren of terugsturen.");
    if (data.besluit === "beeindigd" && van !== "goedgekeurd" && van !== "actief")
      throw new Error("Alleen een goedgekeurde of actieve campagne kan je beëindigen.");
    const status =
      data.besluit === "goedgekeurd"
        ? "goedgekeurd"
        : data.besluit === "afgewezen"
          ? "concept"
          : "afgelopen";
    const { error } = await db
      .from("campagnes")
      .update({
        status,
        beoordeling_reden: data.besluit === "afgewezen" ? data.reden : null,
      })
      .eq("id", data.id)
      .eq("status", van);
    if (error) throw new Error("De campagne kon niet bijgewerkt worden.");

    // Goedgekeurd met testbudget: een TESTfactuur voor de partner (niets wordt aangerekend).
    let factuur: string | null = null;
    const budget = Math.max(0, Number(camp.testbudget_cent) || 0);
    if (data.besluit === "goedgekeurd" && budget > 0 && !testBetalingGeweigerd("test")) {
      const { count } = await db.from("facturen").select("id", { count: "exact", head: true });
      factuur = `TEST-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;
      await db.from("facturen").insert({
        user_id: null,
        partner_id: camp.partner_id,
        abonnement_id: null,
        campagne_id: camp.id,
        nummer: factuur,
        omschrijving: `Campagne «${String(camp.naam)}»: testbudget`,
        bedrag_cent: budget,
        status: "open",
        test: true,
        datum: new Date().toISOString().slice(0, 10),
      });
    }
    await logboek(db, profiel, `bcc.campagne.${data.besluit}`, "campagne", data.id, {
      naam: camp.naam,
      reden: data.reden || null,
      testfactuur: factuur,
    });
    return { ok: true, factuur };
  });

// ---------- omzet (testmodus) ----------

export const bccOmzet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      beschikbaar: boolean;
      maanden: OmzetMaand[];
      terugbetalingen: { maker: string; bedrag_cent: number; datum: string }[];
    }> => {
      const { db } = await poort(context, "finance.view", false);
      const { data: bet, error } = await db
        .from("maker_betalingen")
        .select("creator_id, soort, bedrag_cent, btw_cent, test, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      const { data: fac, error: facFout } = await db
        .from("facturen")
        // "*": soort/btw_cent (voorstel 0023) bestaan pas na die migratie.
        .select("*")
        .limit(5000);
      const betOk = !error;
      const facOk = !facFout;
      if (!betOk && !facOk) {
        if (isOntbrekendeTabel(error) || isOntbrekendeTabel(facFout))
          return { beschikbaar: false, maanden: [], terugbetalingen: [] };
        throw new Error("De omzet kon niet geladen worden.");
      }
      const betalingen = (betOk ? (bet ?? []) : []) as MakerBetalingRij[];
      const facturen = (facOk ? (fac ?? []) : []) as FactuurRij[];
      const terug = betalingen.filter((b) => b.soort === "terugbetaling").slice(0, 50);
      const { data: makers } = terug.length
        ? await db
            .from("creators")
            .select("id, naam")
            .in("id", [...new Set(terug.map((t) => String(t.creator_id)))])
        : { data: [] };
      const makerNaam = new Map(
        ((makers ?? []) as Rij[]).map((m) => [String(m.id), String(m.naam)]),
      );
      return {
        beschikbaar: true,
        maanden: omzetPerMaand(betalingen, facturen),
        terugbetalingen: terug.map((t) => ({
          maker: makerNaam.get(String(t.creator_id)) ?? "Maker",
          bedrag_cent: t.bedrag_cent,
          datum: t.created_at,
        })),
      };
    },
  );

// ---------- makeruitbetalingen (testmodus) ----------

async function leesProcent(db: LosseDb): Promise<number> {
  const { data } = await db
    .from("platform_settings")
    .select("value")
    .eq("key", PLATFORM_PROCENT_SLEUTEL)
    .maybeSingle();
  return leesPlatformProcent((data as Rij)?.value) ?? FEE_VOORSTEL.platformProcent;
}

export type BccUitbetaling = MakerUitbetaling & { maker: string; handle: string | null };

export const bccUitbetalingen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        maand: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
      })
      .parse(d ?? {}),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      beschikbaar: boolean;
      maand: string;
      maanden: string[];
      platformProcent: number;
      makers: BccUitbetaling[];
      vastgelegd: { creator_id: string; maand: string; maker_cent: number; created_at: string }[];
    }> => {
      const { db } = await poort(context, "finance.view", false);
      const platformProcent = await leesProcent(db);
      const { data: bet, error } = await db
        .from("maker_betalingen")
        .select("creator_id, soort, bedrag_cent, btw_cent, test, created_at")
        .limit(5000);
      const nu = new Date().toISOString().slice(0, 7);
      if (error) {
        if (isOntbrekendeTabel(error))
          return {
            beschikbaar: false,
            maand: data.maand ?? nu,
            maanden: [],
            platformProcent,
            makers: [],
            vastgelegd: [],
          };
        throw new Error("De uitbetalingen konden niet geladen worden.");
      }
      const alle = (bet ?? []) as MakerBetalingRij[];
      const maanden = [
        ...new Set(alle.map((b) => maandVan(b.created_at)).filter(Boolean) as string[]),
      ].sort((a, b) => b.localeCompare(a));
      const maand = data.maand ?? maanden[0] ?? nu;
      const rijen = uitbetalingPerMaker(
        alle.filter((b) => maandVan(b.created_at) === maand),
        platformProcent,
      );
      const { data: makers } = rijen.length
        ? await db
            .from("creators")
            .select("id, naam, handle")
            .in(
              "id",
              rijen.map((r) => r.creator_id),
            )
        : { data: [] };
      const perId = new Map(((makers ?? []) as Rij[]).map((m) => [String(m.id), m]));
      const { data: vast } = await db
        .from("maker_uitbetalingen")
        .select("creator_id, maand, maker_cent, created_at")
        .eq("maand", `${maand}-01`)
        .limit(500);
      return {
        beschikbaar: true,
        maand,
        maanden,
        platformProcent,
        makers: rijen.map((r) => ({
          ...r,
          maker: String(perId.get(r.creator_id)?.naam ?? "Maker"),
          handle: (perId.get(r.creator_id)?.handle as string | undefined) ?? null,
        })),
        vastgelegd: ((vast ?? []) as Rij[]).map((v) => ({
          creator_id: String(v.creator_id),
          maand: String(v.maand).slice(0, 7),
          maker_cent: Number(v.maker_cent) || 0,
          created_at: String(v.created_at ?? ""),
        })),
      };
    },
  );

export const bccZetPlatformProcent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ procent: z.union([z.number(), z.string()]) }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await poort(context, "finance.manage");
    const procent = leesPlatformProcent(data.procent);
    if (procent === null) throw new Error("Kies een percentage tussen 0 en 50.");
    const oud = await leesProcent(db);
    const { error } = await db.from("platform_settings").upsert(
      {
        key: PLATFORM_PROCENT_SLEUTEL,
        value: procent,
        description: "Platformdeel van makerabonnementen in procent (testmodus).",
        updated_at: new Date().toISOString(),
        updated_by: profiel.user_id,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error("De verdeling kon niet bewaard worden.");
    await logboek(db, profiel, "bcc.verdeling.gewijzigd", "setting", PLATFORM_PROCENT_SLEUTEL, {
      van: oud,
      naar: procent,
    });
    return { ok: true, procent };
  });

/** Legt vast wat er voor een maand uitbetaald ZOU worden. Er gaat geen geld weg. */
export const bccTestuitbetalingVastleggen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ maand: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ context, data }) => {
    const geweigerd = testBetalingGeweigerd("test");
    if (geweigerd) throw new Error(geweigerd);
    const { db, profiel } = await poort(context, "finance.manage");
    const { error: ontbreekt } = await db.from("maker_uitbetalingen").select("id").limit(1);
    if (ontbreekt) {
      if (isOntbrekendeTabel(ontbreekt))
        throw new Error("Testuitbetalingen worden binnenkort geactiveerd.");
      throw new Error("De testuitbetaling kon niet vastgelegd worden.");
    }
    const platformProcent = await leesProcent(db);
    const { data: bet } = await db
      .from("maker_betalingen")
      .select("creator_id, soort, bedrag_cent, btw_cent, test, created_at")
      .limit(5000);
    const rijen = uitbetalingPerMaker(
      ((bet ?? []) as MakerBetalingRij[]).filter((b) => maandVan(b.created_at) === data.maand),
      platformProcent,
    );
    const maandDatum = `${data.maand}-01`;
    await db.from("maker_uitbetalingen").delete().eq("maand", maandDatum);
    if (rijen.length) {
      const { error } = await db.from("maker_uitbetalingen").insert(
        rijen.map((r) => ({
          creator_id: r.creator_id,
          maand: maandDatum,
          bruto_cent: r.brutoCent,
          btw_cent: r.btwCent,
          betaalkosten_cent: r.betaalkostenCent,
          platform_cent: r.platformCent,
          maker_cent: r.makerCent,
          platform_procent: platformProcent,
          status: "zou_uitbetaald_worden",
          kyc: "niet_gekoppeld",
          test: true,
          vastgelegd_door: profiel.user_id,
          created_at: new Date().toISOString(),
        })),
      );
      if (error) throw new Error("De testuitbetaling kon niet vastgelegd worden.");
    }
    await logboek(db, profiel, "bcc.uitbetaling.testrun", "uitbetaling", maandDatum, {
      makers: rijen.length,
      maker_cent: rijen.reduce((s, r) => s + r.makerCent, 0),
      platform_procent: platformProcent,
    });
    return { ok: true, makers: rijen.length };
  });

// ---------- teamuitnodigingen (testmodus, geen e-mail) ----------

export type BccUitnodiging = {
  id: string;
  email: string;
  rol: string;
  status: string;
  created_at: string;
  verloopt_op: string | null;
  door: string;
};

export const bccUitnodigingen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ beschikbaar: boolean; uitnodigingen: BccUitnodiging[] }> => {
      const { db } = await poort(context, "admins.manage", false);
      const { data, error } = await db
        .from("beheer_uitnodigingen")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        if (isOntbrekendeTabel(error)) return { beschikbaar: false, uitnodigingen: [] };
        throw new Error("De uitnodigingen konden niet geladen worden.");
      }
      const rijen = (data ?? []) as Rij[];
      const naam = await namen(
        db,
        rijen.map((r) => String(r.uitgenodigd_door ?? "")),
      );
      return {
        beschikbaar: true,
        uitnodigingen: rijen.map((r) => ({
          id: String(r.id),
          email: String(r.email),
          rol: String(r.rol),
          status: String(r.status),
          created_at: String(r.created_at ?? ""),
          verloopt_op: r.verloopt_op ?? null,
          door: naam.get(String(r.uitgenodigd_door)) ?? "Eigenaar",
        })),
      };
    },
  );

export const bccUitnodigen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ email: z.string().trim().max(200), rol: z.string().max(40) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await poort(context, "admins.manage", true);
    const { data: bestaand, error: ontbreekt } = await db
      .from("beheer_uitnodigingen")
      .select("email, status")
      .limit(500);
    if (ontbreekt) {
      if (isOntbrekendeTabel(ontbreekt))
        throw new Error("Teamuitnodigingen worden binnenkort geactiveerd.");
      throw new Error("De uitnodiging kon niet bewaard worden.");
    }
    const fout = uitnodigingFout(data.email, data.rol, (bestaand ?? []) as Rij[]);
    if (fout) throw new Error(fout);
    const email = data.email.trim().toLowerCase();
    const { data: rij, error } = await db
      .from("beheer_uitnodigingen")
      .insert({
        email,
        rol: data.rol,
        status: "testmodus",
        test: true,
        uitgenodigd_door: profiel.user_id,
        created_at: new Date().toISOString(),
        verloopt_op: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !rij) throw new Error("De uitnodiging kon niet bewaard worden.");
    // Bewust geen e-mail: alleen een regel in het auditlog. Het e-mailadres staat niet in de details.
    await logboek(db, profiel, "bcc.team.uitgenodigd", "uitnodiging", String((rij as Rij).id), {
      rol: data.rol,
      email_verstuurd: false,
    });
    return { ok: true };
  });

export const bccUitnodigingIntrekken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await poort(context, "admins.manage", true);
    const { error } = await db
      .from("beheer_uitnodigingen")
      .update({ status: "ingetrokken" })
      .eq("id", data.id)
      .eq("status", "testmodus");
    if (error) throw new Error("De uitnodiging kon niet ingetrokken worden.");
    await logboek(db, profiel, "bcc.team.ingetrokken", "uitnodiging", data.id);
    return { ok: true };
  });
