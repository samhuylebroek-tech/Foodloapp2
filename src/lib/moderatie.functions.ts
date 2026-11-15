/**
 * Moderatie in het team-Control Center: openbare recepten die op controle wachten, meldingen van
 * gebruikers (bijdrage verbergen/terugzetten, melding afsluiten) en partnercampagnes die ter
 * goedkeuring zijn ingediend. Elke beslissing loopt via `bewaker()` (recht `content.manage`) en
 * komt in het auditlogboek. De tabellen bestaan in productie pas na voorstel 0008/0011; ontbreken
 * ze, dan geeft de server `beschikbaar: false` en toont het scherm "binnenkort".
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bewaker, logboek } from "@/lib/admin.functions";
import { isOntbrekendeTabel } from "@/lib/module-beschikbaar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string; claims?: any };

export type WachtendRecept = {
  publicatie_id: string;
  recipe_id: string;
  titel: string;
  maker: string;
  handle: string | null;
  gepubliceerd_op: string | null;
};

export type OpenMelding = {
  id: string;
  soort: string;
  doel_id: string;
  reden: string;
  toelichting: string | null;
  created_at: string;
  /** Bij een bijdrage: de tekst en of ze nu verborgen is. */
  bijdrage: { tekst: string; verborgen: boolean; weergavenaam: string | null } | null;
  /** Bij een recept: de titel. */
  receptTitel: string | null;
};

export type IngediendeCampagne = {
  id: string;
  naam: string;
  partner: string;
  doel: string | null;
  start: string | null;
  einde: string | null;
  items: { soort: string; label: string; label_tekst: string }[];
};

export type Wachtrij = {
  beschikbaar: boolean;
  recepten: WachtendRecept[];
  meldingen: OpenMelding[];
  campagnes: IngediendeCampagne[];
  campagnesBeschikbaar: boolean;
};

// Ongetypeerde rijen: deze tabellen staan (nog) niet in de gegenereerde types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rij = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LosseDb = SupabaseClient<any>;

export const moderatieWachtrij = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Wachtrij> => {
    const db = (await bewaker(context as Ctx, "content.manage", { schrijft: false }))
      .db as unknown as LosseDb;
    const leeg: Wachtrij = {
      beschikbaar: false,
      recepten: [],
      meldingen: [],
      campagnes: [],
      campagnesBeschikbaar: false,
    };

    const { data: pubs, error } = await db
      .from("recipe_publicaties")
      .select("id, recipe_id, creator_id, gepubliceerd_op")
      .eq("zichtbaarheid", "openbaar")
      .eq("status", "gepubliceerd")
      .eq("moderatie", "wacht")
      .limit(200);
    if (error) {
      if (isOntbrekendeTabel(error)) return leeg;
      throw new Error("De wachtrij kon niet geladen worden.");
    }
    const pubRijen = (pubs ?? []) as Rij[];

    const { data: meld } = await db
      .from("content_meldingen")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200);
    const meldRijen = (meld ?? []) as Rij[];

    const receptIds = [
      ...new Set([
        ...pubRijen.map((p) => String(p.recipe_id)),
        ...meldRijen.filter((m) => m.soort === "recept").map((m) => String(m.doel_id)),
      ]),
    ];
    const makerIds = [...new Set(pubRijen.map((p) => String(p.creator_id)))];
    const bijdrageIds = meldRijen
      .filter((m) => m.soort === "bijdrage")
      .map((m) => String(m.doel_id));

    const [recepten, makers, bijdragen] = await Promise.all([
      receptIds.length
        ? db.from("recipes").select("id, title").in("id", receptIds)
        : Promise.resolve({ data: [] }),
      makerIds.length
        ? db.from("creators").select("id, naam, handle").in("id", makerIds)
        : Promise.resolve({ data: [] }),
      bijdrageIds.length
        ? db
            .from("community_bijdragen")
            .select("id, tekst, verborgen, weergavenaam")
            .in("id", bijdrageIds)
        : Promise.resolve({ data: [] }),
    ]);
    const titel = new Map(
      ((recepten.data ?? []) as Rij[]).map((r) => [String(r.id), String(r.title)]),
    );
    const maker = new Map(((makers.data ?? []) as Rij[]).map((m) => [String(m.id), m]));
    const bijdrage = new Map(((bijdragen.data ?? []) as Rij[]).map((b) => [String(b.id), b]));

    // Partnercampagnes (voorstel 0011): ontbreekt de tabel, dan gewoon geen campagnes.
    let campagnes: IngediendeCampagne[] = [];
    let campagnesBeschikbaar = true;
    const { data: camp, error: campFout } = await db
      .from("campagnes")
      .select("*")
      .eq("status", "ingediend")
      .limit(100);
    if (campFout) campagnesBeschikbaar = false;
    else if (camp?.length) {
      const partnerIds = [...new Set((camp as Rij[]).map((c) => String(c.partner_id)))];
      const campIds = (camp as Rij[]).map((c) => String(c.id));
      const [{ data: partners }, { data: items }] = await Promise.all([
        db.from("partners").select("id, naam").in("id", partnerIds),
        db.from("gesponsorde_items").select("*").in("campagne_id", campIds),
      ]);
      const itemRecepten = ((items ?? []) as Rij[])
        .filter((i) => i.recipe_id)
        .map((i) => String(i.recipe_id));
      const { data: itemTitels } = itemRecepten.length
        ? await db.from("recipes").select("id, title").in("id", itemRecepten)
        : { data: [] };
      const itemTitel = new Map(
        ((itemTitels ?? []) as Rij[]).map((r) => [String(r.id), String(r.title)]),
      );
      const partnerNaam = new Map(
        ((partners ?? []) as Rij[]).map((p) => [String(p.id), String(p.naam)]),
      );
      campagnes = (camp as Rij[]).map((c) => ({
        id: String(c.id),
        naam: String(c.naam),
        partner: partnerNaam.get(String(c.partner_id)) ?? "Onbekende partner",
        doel: (c.doel as string | null) ?? null,
        start: (c.start as string | null) ?? null,
        einde: (c.einde as string | null) ?? null,
        items: ((items ?? []) as Rij[])
          .filter((i) => i.campagne_id === c.id)
          .map((i) => ({
            soort: String(i.soort),
            label:
              i.soort === "recept"
                ? (itemTitel.get(String(i.recipe_id)) ?? "Recept")
                : String(i.product_naam ?? "Product"),
            label_tekst: String(i.label_tekst ?? "Gesponsord"),
          })),
      }));
    }

    return {
      beschikbaar: true,
      campagnesBeschikbaar,
      recepten: pubRijen.map((p) => {
        const m = maker.get(String(p.creator_id));
        return {
          publicatie_id: String(p.id),
          recipe_id: String(p.recipe_id),
          titel: titel.get(String(p.recipe_id)) ?? "Recept zonder titel",
          maker: m ? String(m.naam) : "Onbekende maker",
          handle: m ? String(m.handle) : null,
          gepubliceerd_op: (p.gepubliceerd_op as string | null) ?? null,
        };
      }),
      meldingen: meldRijen.map((m) => {
        const b = m.soort === "bijdrage" ? bijdrage.get(String(m.doel_id)) : undefined;
        return {
          id: String(m.id),
          soort: String(m.soort),
          doel_id: String(m.doel_id),
          reden: String(m.reden),
          toelichting: (m.toelichting as string | null) ?? null,
          created_at: String(m.created_at ?? ""),
          bijdrage: b
            ? {
                tekst: String(b.tekst),
                verborgen: b.verborgen === true,
                weergavenaam: (b.weergavenaam as string | null) ?? null,
              }
            : null,
          receptTitel: m.soort === "recept" ? (titel.get(String(m.doel_id)) ?? null) : null,
        };
      }),
      campagnes,
    };
  });

export const moderatieReceptBeslissen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        publicatieId: z.string().uuid(),
        besluit: z.enum(["goedgekeurd", "afgewezen"]),
        reden: z.string().trim().max(500).default(""),
      })
      .refine((x) => x.besluit === "goedgekeurd" || x.reden.length >= 3, {
        message: "Geef een korte reden bij afwijzen.",
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db: ruweDb, profiel } = await bewaker(context as Ctx, "content.manage");
    const db = ruweDb as unknown as LosseDb;
    const { error } = await db
      .from("recipe_publicaties")
      .update({
        moderatie: data.besluit,
        moderatie_reden: data.besluit === "afgewezen" ? data.reden : null,
      })
      .eq("id", data.publicatieId);
    if (error) throw new Error("De beslissing kon niet bewaard worden.");
    await logboek(
      db,
      profiel,
      `moderatie.recept.${data.besluit}`,
      "recipe_publicatie",
      data.publicatieId,
      {
        reden: data.reden || null,
      },
    );
    return { ok: true };
  });

export const moderatieBijdrageZichtbaar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ bijdrageId: z.string().uuid(), verborgen: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db: ruweDb, profiel } = await bewaker(context as Ctx, "content.manage");
    const db = ruweDb as unknown as LosseDb;
    const { error } = await db
      .from("community_bijdragen")
      .update({ verborgen: data.verborgen })
      .eq("id", data.bijdrageId);
    if (error) throw new Error("De bijdrage kon niet aangepast worden.");
    await logboek(
      db,
      profiel,
      data.verborgen ? "moderatie.bijdrage.verborgen" : "moderatie.bijdrage.teruggezet",
      "community_bijdrage",
      data.bijdrageId,
    );
    return { ok: true };
  });

export const moderatieMeldingAfsluiten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ meldingId: z.string().uuid(), status: z.enum(["behandeld", "afgewezen"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db: ruweDb, profiel } = await bewaker(context as Ctx, "content.manage");
    const db = ruweDb as unknown as LosseDb;
    const { error } = await db
      .from("content_meldingen")
      .update({ status: data.status })
      .eq("id", data.meldingId);
    if (error) throw new Error("De melding kon niet afgesloten worden.");
    await logboek(
      db,
      profiel,
      `moderatie.melding.${data.status}`,
      "content_melding",
      data.meldingId,
    );
    return { ok: true };
  });

export const moderatieCampagneBeslissen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        campagneId: z.string().uuid(),
        besluit: z.enum(["goedgekeurd", "afgewezen"]),
        reden: z.string().trim().max(500).default(""),
      })
      .refine((x) => x.besluit === "goedgekeurd" || x.reden.length >= 3, {
        message: "Geef een korte reden bij afwijzen.",
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db: ruweDb, profiel } = await bewaker(context as Ctx, "content.manage");
    const db = ruweDb as unknown as LosseDb;
    // Afgewezen gaat terug naar 'concept' (de partner kan aanpassen en opnieuw indienen).
    const { error } = await db
      .from("campagnes")
      .update({
        status: data.besluit === "goedgekeurd" ? "goedgekeurd" : "concept",
        beoordeling_reden: data.besluit === "afgewezen" ? data.reden : null,
      })
      .eq("id", data.campagneId)
      .eq("status", "ingediend");
    if (error) throw new Error("De campagne kon niet beoordeeld worden.");
    await logboek(db, profiel, `moderatie.campagne.${data.besluit}`, "campagne", data.campagneId, {
      reden: data.reden || null,
    });
    return { ok: true };
  });
