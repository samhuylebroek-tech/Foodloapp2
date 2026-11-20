import { createServerFn } from "@tanstack/react-start";
import { betaalInstellingGeweigerd } from "./betaalpoort";
import { z } from "zod";
import { begrensdeLijst } from "@/lib/zod-hulp";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { alleRijen } from "@/lib/pagineer";
import { EIGENAAR_ID, EIGENAAR_NIET_VERWIJDEREN, isEigenaar } from "@/lib/eigenaar";

// ============================================================
// Admin API — aparte autorisatielaag boven dezelfde backend.
// Geen enkele beheeractie loopt via de gewone app-permissies.
// ============================================================

export type AdminRol = "super_admin" | "admin" | "support" | "content_manager" | "analyst";

export type AdminProfiel = {
  user_id: string;
  role: AdminRol;
  active: boolean;
  can_view_private_content: boolean;
  note: string;
  read_only?: boolean;
  mfa_required?: boolean;
};

export type Rechten =
  | "dashboard.view"
  | "finance.view"
  | "users.view"
  | "users.manage"
  | "users.delete"
  | "recipes.view"
  | "recipes.manage"
  | "content.manage"
  | "ai.view"
  | "support.view"
  | "support.manage"
  | "system.view"
  | "audit.view"
  | "settings.manage"
  | "admins.manage"
  | "privacy.manage"
  | "private.view"
  // Fase 5 — Business Control Center (testmodus).
  | "partners.view"
  | "partners.manage"
  | "finance.manage";

const MATRIX: Record<AdminRol, Rechten[]> = {
  super_admin: [
    "dashboard.view",
    "finance.view",
    "users.view",
    "users.manage",
    "users.delete",
    "recipes.view",
    "recipes.manage",
    "content.manage",
    "ai.view",
    "support.view",
    "support.manage",
    "system.view",
    "audit.view",
    "settings.manage",
    "admins.manage",
    "privacy.manage",
    "private.view",
    "partners.view",
    "partners.manage",
    "finance.manage",
  ],
  admin: [
    "dashboard.view",
    "finance.view",
    "users.view",
    "users.manage",
    "recipes.view",
    "recipes.manage",
    "content.manage",
    "ai.view",
    "support.view",
    "support.manage",
    "system.view",
    "audit.view",
    "settings.manage",
    "privacy.manage",
    "partners.view",
    "partners.manage",
  ],
  support: ["dashboard.view", "users.view", "recipes.view", "support.view", "support.manage", "system.view"],
  content_manager: [
    "dashboard.view",
    "recipes.view",
    "recipes.manage",
    "content.manage",
    "ai.view",
    "partners.view",
    "partners.manage",
  ],
  analyst: ["dashboard.view", "system.view", "ai.view", "partners.view"],
};

/** Alle rechten van een rol (zonder de aparte vlag voor privé-inhoud). */
export function rechtenVanRol(rol: AdminRol): Rechten[] {
  return [...MATRIX[rol]];
}

export function heeftRecht(profiel: AdminProfiel | null, recht: Rechten): boolean {
  if (!profiel || !profiel.active) return false;
  if (recht === "private.view") return profiel.can_view_private_content;
  return MATRIX[profiel.role].includes(recht);
}

type Ctx = { supabase: any; userId: string; claims?: any };

// Vaste eigenaar-ID: zie lib/eigenaar.ts (ook gebruikt door accountverwijdering).
export { EIGENAAR_ID };

const SCHRIJFRECHTEN: Rechten[] = [
  "users.manage",
  "users.delete",
  "recipes.manage",
  "content.manage",
  "support.manage",
  "settings.manage",
  "admins.manage",
  "privacy.manage",
  "partners.manage",
  "finance.manage",
];

// Max aantal beheeracties per minuut per beheerder.
const LIMIET_PER_MINUUT = 120;

/**
 * BUG-095: 2FA op de server. Staat UIT tot de eigenaar het herstelplan (2FA-HERSTELPLAN.md) heeft
 * goedgekeurd en twee factoren heeft ingesteld. Aanzetten = deze waarde op `true` en daarna
 * `mfa_required` voor de eigenaar aanzetten in Beheer → Team.
 */
export const MFA_AFDWINGEN = false;

export const MFA_MELDING =
  "Bevestig eerst met je tweede stap (2FA) om het Control Center te gebruiken.";

/** Zuivere regel (getest): weigeren als 2FA verplicht is en de sessie geen tweede stap heeft. */
export function mfaOntbreekt(
  profiel: Pick<AdminProfiel, "mfa_required">,
  aal: string | null | undefined,
  afdwingen: boolean = MFA_AFDWINGEN,
): boolean {
  return afdwingen && profiel.mfa_required === true && aal !== "aal2";
}

export async function bewaker(context: Ctx, recht: Rechten, opties: { schrijft?: boolean } = {}) {
  if (context.userId !== EIGENAAR_ID) throw new Error("Geen toegang tot het Control Center.");
  const { data, error } = await context.supabase
    .from("admin_users")
    .select("user_id, role, active, can_view_private_content, note, read_only, mfa_required")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error || !data || !data.active) throw new Error("Geen toegang tot het Control Center.");
  const profiel = data as AdminProfiel;
  if (!heeftRecht(profiel, recht)) throw new Error("Je rol heeft dit recht niet.");
  if (mfaOntbreekt(profiel, context.claims?.aal as string | undefined)) {
    try {
      const { supabaseAdmin: logDb } = await import("@/integrations/supabase/client.server");
      await logboek(logDb, profiel, "mfa.geweigerd", "admin", profiel.user_id, { recht });
    } catch {
      /* loggen mag de weigering nooit tegenhouden */
    }
    throw new Error(MFA_MELDING);
  }

  const schrijft = opties.schrijft ?? SCHRIJFRECHTEN.includes(recht);
  if (schrijft && profiel.read_only) {
    throw new Error("Je account staat in alleen-lezen modus. Wijzigen is niet toegestaan.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Snelheidslimiet: beschermt tegen misbruik of een doorgeslagen script.
  const sinds = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("admin_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("admin_id", profiel.user_id)
    .gte("created_at", sinds);
  if ((count ?? 0) >= LIMIET_PER_MINUUT) {
    throw new Error("Te veel acties na elkaar. Probeer over een minuut opnieuw.");
  }
  await supabaseAdmin.from("admin_rate_limits").insert({ admin_id: profiel.user_id, action: recht });

  return { profiel, db: supabaseAdmin };
}

async function sessieLoggen(db: any, adminId: string, aal: string | null) {
  const { verzoekInfo } = await import("@/lib/admin-headers.server");
  const { ip, ua } = verzoekInfo();
  const sinds = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: bestaand } = await db
    .from("admin_sessions")
    .select("id")
    .eq("admin_id", adminId)
    .gte("last_seen_at", sinds)
    .order("last_seen_at", { ascending: false })
    .limit(1);
  if (bestaand?.length) {
    await db.from("admin_sessions").update({ last_seen_at: new Date().toISOString(), aal }).eq("id", bestaand[0].id);
  } else {
    await db.from("admin_sessions").insert({ admin_id: adminId, ip, user_agent: ua, aal });
  }
}

export async function logboek(
  db: any,
  profiel: AdminProfiel,
  action: string,
  entity_type: string,
  entity_id: string | null,
  details: Record<string, unknown> = {},
) {
  const { verzoekInfo } = await import("@/lib/admin-headers.server");
  const { ip, ua } = verzoekInfo();
  await db.from("admin_audit_log").insert({
    actor_id: profiel.user_id,
    actor_role: profiel.role,
    action,
    entity_type,
    entity_id,
    details,
    ip,
    user_agent: ua,
  });
}

// ---------------- profiel & bootstrap ----------------

export const mijnAdminProfiel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ profiel: AdminProfiel | null; rechten: Rechten[]; aal: string | null; mfaOk: boolean }> => {
      const ctx = context as Ctx;
      if (ctx.userId !== EIGENAAR_ID) {
        return { profiel: null, rechten: [], aal: null, mfaOk: true };
      }
      const { data } = await ctx.supabase
        .from("admin_users")
        .select("user_id, role, active, can_view_private_content, note, read_only, mfa_required")
        .eq("user_id", ctx.userId)
        .maybeSingle();
      const profiel = (data as AdminProfiel | null) ?? null;
      const aal = (ctx.claims?.aal as string | undefined) ?? null;
      if (!profiel || !profiel.active) return { profiel: null, rechten: [], aal, mfaOk: true };
      const rechten = [...MATRIX[profiel.role]];
      if (profiel.can_view_private_content) rechten.push("private.view");
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await sessieLoggen(supabaseAdmin, profiel.user_id, aal);
      } catch {
        /* logging mag nooit de toegang blokkeren */
      }
      return { profiel, rechten, aal, mfaOk: aal === "aal2" || !profiel.mfa_required };
    },
  );

// ---------------- dashboard ----------------

export type Periode = "dag" | "week" | "maand" | "jaar";

export const PERIODE_LABEL: Record<Periode, string> = {
  dag: "Vandaag (24 uur)",
  week: "Deze week (7 dagen)",
  maand: "Deze maand (30 dagen)",
  jaar: "Dit jaar (12 maanden)",
};

const PERIODE_DUUR: Record<Periode, number> = {
  dag: 24 * 3600_000,
  week: 7 * 24 * 3600_000,
  maand: 30 * 24 * 3600_000,
  jaar: 365 * 24 * 3600_000,
};

export const wieSchema = z
  .object({
    wieModus: z.enum(["alles", "in", "uit"]).default("alles"),
    wieIds: begrensdeLijst(z.string().uuid(), 1000).default([]),
  })
  .default({ wieModus: "alles", wieIds: [] });

export type WieKeuze = { wieModus: "alles" | "in" | "uit"; wieIds: string[] };

/** Past de personenkeuze toe op een kolom met gebruikers-id's. */
export function pasWie(q: any, kolom: string, wie: WieKeuze) {
  if (wie.wieModus === "alles" || wie.wieIds.length === 0) return q;
  return wie.wieModus === "in" ? q.in(kolom, wie.wieIds) : q.not(kolom, "in", `(${wie.wieIds.join(",")})`);
}

const periodeSchema = z
  .object({
    periode: z.enum(["dag", "week", "maand", "jaar"]).default("week"),
    wieModus: z.enum(["alles", "in", "uit"]).default("alles"),
    wieIds: begrensdeLijst(z.string().uuid(), 1000).default([]),
  })
  .default({ periode: "week", wieModus: "alles", wieIds: [] });


function maakBuckets(periode: Periode) {
  const nu = Date.now();
  const res: { key: string; label: string }[] = [];
  if (periode === "dag") {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(nu - i * 3600_000);
      res.push({ key: d.toISOString().slice(0, 13), label: `${d.toISOString().slice(11, 13)}u` });
    }
  } else if (periode === "jaar") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nu);
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - i);
      res.push({ key: d.toISOString().slice(0, 7), label: d.toISOString().slice(0, 7) });
    }
  } else {
    const n = periode === "week" ? 7 : 30;
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(nu - i * 24 * 3600_000);
      res.push({ key: d.toISOString().slice(0, 10), label: d.toISOString().slice(5, 10) });
    }
  }
  return res;
}

function bucketKey(periode: Periode, iso: string) {
  return periode === "dag" ? iso.slice(0, 13) : periode === "jaar" ? iso.slice(0, 7) : iso.slice(0, 10);
}

function evolutie(nu: number, vorig: number) {
  if (vorig === 0) return nu === 0 ? 0 : 100;
  return Math.round(((nu - vorig) / vorig) * 100);
}

export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => periodeSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const periode = data.periode as Periode;
    const duur = PERIODE_DUUR[periode];
    const nu = Date.now();
    const sinds = new Date(nu - duur).toISOString();
    const sindsVorig = new Date(nu - 2 * duur).toISOString();
    const wie: WieKeuze = { wieModus: data.wieModus, wieIds: data.wieIds };
    // Welke kolom verwijst in welke tabel naar de gebruiker?
    const KOLOM: Record<string, string> = {
      profiles: "id",
      recipes: "user_id",
      shopping_lists: "user_id",
      meal_plan: "user_id",
      shares: "owner_id",
      feedback: "user_id",
    };

    const tel = async (tabel: string, filter?: (q: any) => any) => {
      let q = (db as any).from(tabel).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      if (KOLOM[tabel]) q = pasWie(q, KOLOM[tabel]!, wie);

      const { count } = await q;
      return count ?? 0;
    };

    const [
      gebruikers,
      nieuweGebruikers,
      nieuweGebruikersVorig,
      recepten,
      nieuweRecepten,
      nieuweReceptenVorig,
      verwijderdeRecepten,
      lijsten,
      nieuweLijsten,
      nieuweLijstenVorig,
      planItems,
      shares,
      openTickets,
      aiTotaal,
      aiTotaalVorig,
      aiFouten,
    ] = await Promise.all([
      tel("profiles"),
      tel("profiles", (q) => q.gte("created_at", sinds)),
      tel("profiles", (q) => q.gte("created_at", sindsVorig).lt("created_at", sinds)),
      tel("recipes", (q) => q.is("deleted_at", null)),
      tel("recipes", (q) => q.gte("created_at", sinds).is("deleted_at", null)),
      tel("recipes", (q) => q.gte("created_at", sindsVorig).lt("created_at", sinds).is("deleted_at", null)),
      tel("recipes", (q) => q.not("deleted_at", "is", null)),
      tel("shopping_lists"),
      tel("shopping_lists", (q) => q.gte("created_at", sinds)),
      tel("shopping_lists", (q) => q.gte("created_at", sindsVorig).lt("created_at", sinds)),
      tel("meal_plan"),
      tel("shares", (q) => q.eq("status", "accepted")),
      tel("feedback", (q) => q.in("status", ["nieuw", "bezig"])),
      tel("ai_events", (q) => q.gte("created_at", sinds)),
      tel("ai_events", (q) => q.gte("created_at", sindsVorig).lt("created_at", sinds)),
      tel("ai_events", (q) => q.gte("created_at", sinds).eq("ok", false)),
    ]);

    const { data: aiRijen } = await alleRijen(
      db.from("ai_events").select("created_at, ok, duration_ms").gte("created_at", sinds).order("id"),
    );

    const gem =
      aiRijen && aiRijen.length
        ? Math.round(aiRijen.reduce((s: number, e: any) => s + (e.duration_ms || 0), 0) / aiRijen.length)
        : 0;

    const buckets = maakBuckets(periode);
    const { data: groei } = await alleRijen(
      pasWie(db.from("recipes").select("created_at").gte("created_at", sinds).order("id"), "user_id", wie),
    );
    const { data: nieuweLeden } = await alleRijen(
      pasWie(db.from("profiles").select("created_at").gte("created_at", sinds).order("id"), "id", wie),
    );

    const receptPer = new Map(buckets.map((b) => [b.key, 0]));
    const gebruikerPer = new Map(buckets.map((b) => [b.key, 0]));
    for (const r of groei ?? []) {
      const k = bucketKey(periode, String((r as { created_at: string }).created_at));
      if (receptPer.has(k)) receptPer.set(k, (receptPer.get(k) ?? 0) + 1);
    }
    for (const r of nieuweLeden ?? []) {
      const k = bucketKey(periode, String((r as any).created_at));
      if (gebruikerPer.has(k)) gebruikerPer.set(k, (gebruikerPer.get(k) ?? 0) + 1);
    }

    return {
      periode,
      gebruikers,
      nieuweGebruikers,
      recepten,
      nieuweRecepten,
      verwijderdeRecepten,
      lijsten,
      nieuweLijsten,
      planItems,
      shares,
      openTickets,
      evoluties: {
        gebruikers: evolutie(nieuweGebruikers, nieuweGebruikersVorig),
        recepten: evolutie(nieuweRecepten, nieuweReceptenVorig),
        lijsten: evolutie(nieuweLijsten, nieuweLijstenVorig),
        ai: evolutie(aiTotaal, aiTotaalVorig),
      },
      ai: { totaal: aiTotaal, fouten: aiFouten, gemiddeldMs: gem, vandaag: aiRijen?.length ?? 0 },
      grafiek: buckets.map((b) => ({
        datum: b.label,
        aantal: receptPer.get(b.key) ?? 0,
        gebruikers: gebruikerPer.get(b.key) ?? 0,
      })),
    };
  });

/** Korte lijst van alle personen, om cijfers per persoon te kunnen bekijken. */
export const adminPersonenLijst = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const { data } = await db
      .from("profiles")
      .select("id, display_name")
      .order("display_name")
      .limit(500);
    return (data ?? []).map((p: any) => ({ id: p.id as string, naam: (p.display_name as string) || "Naamloos" }));
  });


// ---------------- gebruikers ----------------

export const adminGebruikers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ zoek: z.string().default(""), pagina: z.number().int().min(0).default(0) }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "users.view");
    const perPagina = 25;
    let q = db
      .from("profiles")
      .select("id, display_name, created_at, blocked_at, admin_note", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.pagina * perPagina, data.pagina * perPagina + perPagina - 1);
    if (data.zoek.trim()) q = q.ilike("display_name", `%${data.zoek.trim()}%`);
    const { data: rijen, count } = await q;
    return { rijen: rijen ?? [], totaal: count ?? 0, perPagina };
  });

export const adminGebruikerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.view");
    const { data: p } = await db.from("profiles").select("*").eq("id", data.id).maybeSingle();
    const { data: auth } = await db.auth.admin.getUserById(data.id);
    const { data: recepten } = await db
      .from("recipes")
      .select("id, title, created_at, deleted_at")
      .eq("user_id", data.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const { count: lijsten } = await db
      .from("shopping_lists")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.id);
    const { count: planning } = await db
      .from("meal_plan")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.id);
    const { data: adminRij } = await db.from("admin_users").select("*").eq("user_id", data.id).maybeSingle();

    const { count: favorieten } = await db
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.id);
    const { count: kaarten } = await db
      .from("loyalty_cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.id);
    const { count: boodschappen } = await db
      .from("shopping_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.id);

    const { data: credits } = await db.from("user_credits").select("*").eq("user_id", data.id).maybeSingle();
    const { data: boekingen } = await db
      .from("credit_transactions")
      .select("id, type, amount, balance_after, feature, status, created_at")
      .eq("user_id", data.id)
      .order("created_at", { ascending: false })
      .limit(25);

    const { data: verbruik } = await db
      .from("ai_usage")
      .select("feature, credits, cache_hit, ok, created_at")
      .eq("user_id", data.id)
      .order("created_at", { ascending: false })
      .limit(500);
    const perFunctie = new Map<string, { feature: string; aantal: number; credits: number; cache: number }>();
    for (const r of verbruik ?? []) {
      const rij = perFunctie.get(r.feature) ?? { feature: r.feature, aantal: 0, credits: 0, cache: 0 };
      rij.aantal += 1;
      rij.credits += r.credits ?? 0;
      if (r.cache_hit) rij.cache += 1;
      perFunctie.set(r.feature, rij);
    }

    const { count: handelingen } = await db
      .from("usage_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.id);
    const { data: laatsteActie } = await db
      .from("usage_events")
      .select("event, path, created_at")
      .eq("user_id", data.id)
      .order("created_at", { ascending: false })
      .limit(10);

    let aanmeldingen: number | null = null;
    let eersteAanmelding: string | null = null;
    try {
      const { data: logins } = await (db as any).rpc("admin_login_stats", { _user: data.id });
      const rij = Array.isArray(logins) ? logins[0] : logins;
      if (rij) {
        aanmeldingen = rij.aantal ?? null;
        eersteAanmelding = rij.eerste ?? null;
      }
    } catch {
      /* aanmeldgeschiedenis is optioneel */
    }

    await logboek(db, profiel, "user.view", "user", data.id);
    return {
      profiel: p,
      email: auth?.user?.email ?? null,
      laatsteAanmelding: auth?.user?.last_sign_in_at ?? null,
      aangemaakt: auth?.user?.created_at ?? null,
      emailBevestigd: auth?.user?.email_confirmed_at ?? null,
      recepten: recepten ?? [],
      lijsten: lijsten ?? 0,
      planning: planning ?? 0,
      favorieten: favorieten ?? 0,
      kaarten: kaarten ?? 0,
      boodschappen: boodschappen ?? 0,
      credits,
      boekingen: boekingen ?? [],
      aiPerFunctie: [...perFunctie.values()].sort((a, b) => b.credits - a.credits),
      handelingen: handelingen ?? 0,
      laatsteActie: laatsteActie ?? [],
      aanmeldingen,
      eersteAanmelding,
      adminRij,
    };
  });

export const adminBlokkeerGebruiker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), blokkeren: z.boolean(), reden: z.string().default("") }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.manage");
    await db
      .from("profiles")
      .update({ blocked_at: data.blokkeren ? new Date().toISOString() : null, admin_note: data.reden })
      .eq("id", data.id);
    await db.auth.admin.updateUserById(data.id, { ban_duration: data.blokkeren ? "876000h" : "none" });
    await logboek(db, profiel, data.blokkeren ? "user.block" : "user.unblock", "user", data.id, {
      reden: data.reden,
    });
    return { ok: true };
  });

export const adminExportGebruiker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "privacy.manage");
    // Zelfde volledige lijst als de eigen export (BUG-103).
    const { verzamelPersoonsgegevens } = await import("@/lib/avg-export.server");
    const bundel = await verzamelPersoonsgegevens(db, data.id);
    await logboek(db, profiel, "privacy.export", "user", data.id);
    return bundel;
  });

export const adminVerwijderGebruiker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), bevestiging: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.delete");
    if (data.bevestiging !== "VERWIJDER") throw new Error("Bevestiging klopt niet.");
    if (isEigenaar(data.id)) throw new Error(EIGENAAR_NIET_VERWIJDEREN);
    // Zelfde volgorde als zelf verwijderen (BUG-110/025): eerst gezinnen overdragen, dan het
    // account, dan foto's die niemand anders nog gebruikt.
    const { draagGezinnenOver, ruimFotosOp } = await import("@/lib/account-opruimen.server");
    await draagGezinnenOver(db, data.id);
    await logboek(db, profiel, "privacy.delete_account", "user", data.id);
    const { error } = await db.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    try {
      await ruimFotosOp(db, data.id);
    } catch (e) {
      console.error(
        "foto-opruiming na verwijdering door beheer mislukt",
        e instanceof Error ? e.message : "onbekend",
      );
    }
    return { ok: true };
  });

// ---------------- recepten ----------------

export const adminRecepten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        zoek: z.string().default(""),
        status: z.enum(["actief", "verwijderd", "alles"]).default("actief"),
        pagina: z.number().int().min(0).default(0),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "recipes.view");
    const perPagina = 25;
    let q = db
      .from("recipes")
      .select("id, title, category, difficulty, user_id, created_at, deleted_at, image_url, source_url", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(data.pagina * perPagina, data.pagina * perPagina + perPagina - 1);
    if (data.status === "actief") q = q.is("deleted_at", null);
    if (data.status === "verwijderd") q = q.not("deleted_at", "is", null);
    if (data.zoek.trim()) q = q.ilike("title", `%${data.zoek.trim()}%`);
    const { data: rijen, count } = await q;

    const ids = [...new Set((rijen ?? []).map((r: any) => r.user_id))];
    const { data: profielen } = ids.length
      ? await db.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const namen = new Map((profielen ?? []).map((p: any) => [p.id, p.display_name]));
    return {
      rijen: (rijen ?? []).map((r: any) => ({ ...r, eigenaar: namen.get(r.user_id) ?? "onbekend" })),
      totaal: count ?? 0,
      perPagina,
    };
  });

export const adminReceptActie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), actie: z.enum(["verwijder", "herstel"]), reden: z.string().default("") }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "recipes.manage");
    await db
      .from("recipes")
      .update({ deleted_at: data.actie === "verwijder" ? new Date().toISOString() : null })
      .eq("id", data.id);
    await logboek(db, profiel, `recipe.${data.actie}`, "recipe", data.id, { reden: data.reden });
    return { ok: true };
  });

// ---------------- inhoud / taxonomie ----------------

export const adminTaxonomie = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "content.manage");
    const { data: rijen } = await alleRijen(
      db.from("recipes").select("category, tags").is("deleted_at", null).order("id"),
    );
    const cats = new Map<string, number>();
    const tags = new Map<string, number>();
    for (const r of rijen ?? []) {
      cats.set(r.category, (cats.get(r.category) ?? 0) + 1);
      for (const t of r.tags ?? []) tags.set(t, (tags.get(t) ?? 0) + 1);
    }
    const sorteer = (m: Map<string, number>) =>
      [...m.entries()].map(([naam, aantal]) => ({ naam, aantal })).sort((a, b) => b.aantal - a.aantal);
    return { categorieen: sorteer(cats), tags: sorteer(tags) };
  });

export const adminHernoemCategorie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ van: z.string().min(1), naar: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "content.manage");
    const { count } = await db
      .from("recipes")
      .update({ category: data.naar }, { count: "exact" })
      .eq("category", data.van);
    await logboek(db, profiel, "content.rename_category", "category", data.van, { naar: data.naar, aantal: count });
    return { aantal: count ?? 0 };
  });

export const adminHernoemTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ van: z.string().min(1), naar: z.string().default("") }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "content.manage");
    const { data: rijen } = await db.from("recipes").select("id, tags").contains("tags", [data.van]);
    for (const r of rijen ?? []) {
      const nieuw = (r.tags as string[])
        .map((t) => (t === data.van ? data.naar.trim() : t))
        .filter((t, i, a) => t && a.indexOf(t) === i);
      await db.from("recipes").update({ tags: nieuw }).eq("id", r.id);
    }
    await logboek(db, profiel, data.naar.trim() ? "content.rename_tag" : "content.delete_tag", "tag", data.van, {
      naar: data.naar,
      aantal: rijen?.length ?? 0,
    });
    return { aantal: rijen?.length ?? 0 };
  });

// ---------------- AI & import monitoring ----------------

export const adminAi = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => periodeSchema.parse(d ?? {}))
  .handler(async ({ context, data: invoer }) => {
    const { db } = await bewaker(context as Ctx, "ai.view");
    const periode = invoer.periode as Periode;
    const sinds = new Date(Date.now() - PERIODE_DUUR[periode]).toISOString();
    const { data: events } = await db
      .from("ai_events")
      .select("*")
      .gte("created_at", sinds)
      .order("created_at", { ascending: false })
      .limit(500);
    const perSoort = new Map<string, { totaal: number; fouten: number; ms: number }>();
    for (const e of events ?? []) {
      const s = perSoort.get(e.kind) ?? { totaal: 0, fouten: 0, ms: 0 };
      s.totaal++;
      if (!e.ok) s.fouten++;
      s.ms += e.duration_ms || 0;
      perSoort.set(e.kind, s);
    }
    const { data: imports } = await db
      .from("recipes")
      .select("id, title, source_url, created_at, user_id, instructions")
      .not("source_url", "is", null)
      .gte("created_at", sinds)
      .order("created_at", { ascending: false })
      .limit(50);
    return {
      periode,

      events: events ?? [],
      samenvatting: [...perSoort.entries()].map(([kind, s]) => ({
        kind,
        totaal: s.totaal,
        fouten: s.fouten,
        gemiddeldMs: Math.round(s.ms / s.totaal),
      })),
      imports: (imports ?? []).map((r: any) => ({
        ...r,
        stappen: (r.instructions ?? []).length,
        verdacht: (r.instructions ?? []).length < 3,
      })),
    };
  });

// ---------------- support ----------------

export const adminTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.string().default("alles") }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "support.view");
    let q = db.from("feedback").select("*").order("created_at", { ascending: false }).limit(100);
    if (data.status !== "alles") q = q.eq("status", data.status);
    const { data: rijen } = await q;
    const ids = [...new Set((rijen ?? []).map((r: any) => r.user_id))];
    const { data: profielen } = ids.length
      ? await db.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const namen = new Map((profielen ?? []).map((p: any) => [p.id, p.display_name]));
    return (rijen ?? []).map((r: any) => ({ ...r, naam: namen.get(r.user_id) ?? "onbekend" }));
  });

export const adminTicketBijwerken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.string(), admin_note: z.string().default("") }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "support.manage");
    await db
      .from("feedback")
      .update({ status: data.status, admin_note: data.admin_note, assigned_to: profiel.user_id })
      .eq("id", data.id);
    await logboek(db, profiel, "support.update", "ticket", data.id, { status: data.status });
    return { ok: true };
  });

// ---------------- systeem ----------------

export const adminSysteem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "system.view");
    const start = Date.now();
    const { error } = await db.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    const dbMs = Date.now() - start;
    const aiSleutel = Boolean(process.env["LOVABLE_API_KEY"]);
    const { data: fouten } = await db
      .from("ai_events")
      .select("*")
      .eq("ok", false)
      .order("created_at", { ascending: false })
      .limit(25);
    return {
      database: { ok: !error, ms: dbMs, melding: error?.message ?? null },
      ai: { ok: aiSleutel, melding: aiSleutel ? null : "AI-sleutel ontbreekt" },
      opslag: { ok: true, melding: null },
      fouten: fouten ?? [],
      tijd: new Date().toISOString(),
    };
  });

// ---------------- auditlogboek ----------------

export const adminAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ zoek: z.string().default(""), pagina: z.number().int().min(0).default(0) }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "audit.view");
    const perPagina = 50;
    let q = db
      .from("admin_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.pagina * perPagina, data.pagina * perPagina + perPagina - 1);
    if (data.zoek.trim()) q = q.ilike("action", `%${data.zoek.trim()}%`);
    const { data: rijen, count } = await q;
    const ids = [...new Set((rijen ?? []).map((r: any) => r.actor_id).filter(Boolean))];
    const { data: profielen } = ids.length
      ? await db.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const namen = new Map((profielen ?? []).map((p: any) => [p.id, p.display_name]));
    return {
      rijen: (rijen ?? []).map((r: any) => ({ ...r, naam: namen.get(r.actor_id) ?? "systeem" })),
      totaal: count ?? 0,
      perPagina,
    };
  });

// ---------------- instellingen / feature flags ----------------

export const adminInstellingen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "settings.manage");
    const { data } = await db.from("platform_settings").select("*").order("key");
    return data ?? [];
  });

export const adminInstellingZetten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().min(1), value: z.any() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "settings.manage");
    // BUG-143: de betaalpoort zit op de server, niet alleen in de interface.
    const geweigerd = betaalInstellingGeweigerd(data.key, data.value);
    if (geweigerd) {
      await logboek(db, profiel, "settings.geweigerd", "setting", data.key, { value: data.value });
      throw new Error(geweigerd);
    }
    await db
      .from("platform_settings")
      .update({ value: data.value, updated_at: new Date().toISOString(), updated_by: profiel.user_id })
      .eq("key", data.key);
    await logboek(db, profiel, "settings.update", "setting", data.key, { value: data.value });
    return { ok: true };
  });

// ---------------- beheerders ----------------

export const adminBeheerders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "admins.manage");
    const { data: rijen } = await db.from("admin_users").select("*").order("created_at");
    const ids = (rijen ?? []).map((r: any) => r.user_id);
    const { data: profielen } = ids.length
      ? await db.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const namen = new Map((profielen ?? []).map((p: any) => [p.id, p.display_name]));
    return (rijen ?? []).map((r: any) => ({ ...r, naam: namen.get(r.user_id) ?? "onbekend" }));
  });

export const adminBeheerderZetten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["super_admin", "admin", "support", "content_manager", "analyst"]),
        active: z.boolean().default(true),
        can_view_private_content: z.boolean().default(false),
        note: z.string().default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "admins.manage");
    if (data.user_id === profiel.user_id && (!data.active || data.role !== "super_admin")) {
      throw new Error("Je kunt je eigen hoofdbeheerdersrol niet intrekken.");
    }
    await db.from("admin_users").upsert({ ...data, created_by: profiel.user_id }, { onConflict: "user_id" });
    await logboek(db, profiel, "admin.upsert", "admin", data.user_id, { role: data.role, active: data.active });
    return { ok: true };
  });

export const adminBeheerderVerwijderen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "admins.manage");
    if (data.user_id === profiel.user_id) throw new Error("Je kunt jezelf niet verwijderen.");
    await db.from("admin_users").delete().eq("user_id", data.user_id);
    await logboek(db, profiel, "admin.remove", "admin", data.user_id);
    return { ok: true };
  });

export const adminZoekGebruikerVoorRol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ zoek: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "admins.manage");
    const { data: rijen } = await db
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", `%${data.zoek}%`)
      .limit(10);
    return rijen ?? [];
  });

// ---------------- beveiliging: sessies & apparaten ----------------

export const adminSessies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, profiel } = await bewaker(context as Ctx, "dashboard.view");
    const alles = heeftRecht(profiel, "admins.manage");
    let q = db.from("admin_sessions").select("*").order("last_seen_at", { ascending: false }).limit(100);
    if (!alles) q = q.eq("admin_id", profiel.user_id);
    const { data: rijen } = await q;
    const ids = [...new Set((rijen ?? []).map((r: any) => r.admin_id))];
    const { data: profielen } = ids.length
      ? await db.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const namen = new Map((profielen ?? []).map((p: any) => [p.id, p.display_name]));
    return (rijen ?? []).map((r: any) => ({ ...r, naam: namen.get(r.admin_id) ?? "onbekend" }));
  });

export const adminBeveiligingZetten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        read_only: z.boolean().optional(),
        mfa_required: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "admins.manage");
    const wijziging: Record<string, boolean> = {};
    if (data.read_only !== undefined) wijziging["read_only"] = data.read_only;
    if (data.mfa_required !== undefined) wijziging["mfa_required"] = data.mfa_required;
    await db.from("admin_users").update(wijziging as any).eq("user_id", data.user_id);
    await logboek(db, profiel, "admin.security_update", "admin", data.user_id, wijziging);
    return { ok: true };
  });

// ---------------- analytics ----------------

export const adminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => periodeSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const periode = data.periode as Periode;
    const duur = PERIODE_DUUR[periode];
    const nu = Date.now();
    const sinds = new Date(nu - duur).toISOString();
    const sindsVorig = new Date(nu - 2 * duur).toISOString();

    const { data: events } = await alleRijen(
      db
        .from("usage_events")
        .select("event, path, user_id, created_at")
        .gte("created_at", sindsVorig)
        .order("id"),
    );
    const alle = (events ?? []) as any[];
    const rijen = alle.filter((r) => String(r.created_at) >= sinds);
    const vorige = alle.filter((r) => String(r.created_at) < sinds);

    const buckets = maakBuckets(periode);
    const perEvent = new Map<string, number>();
    const perPad = new Map<string, number>();
    const perBucket = new Map<string, Set<string>>(buckets.map((b) => [b.key, new Set<string>()]));
    for (const r of rijen) {
      perEvent.set(r.event, (perEvent.get(r.event) ?? 0) + 1);
      if (r.path) perPad.set(r.path, (perPad.get(r.path) ?? 0) + 1);
      const k = bucketKey(periode, String(r.created_at));
      if (r.user_id && perBucket.has(k)) perBucket.get(k)!.add(r.user_id);
    }

    const grafiek = buckets.map((b) => ({
      datum: b.label,
      actieveGebruikers: perBucket.get(b.key)?.size ?? 0,
    }));

    const uniek = new Set(rijen.map((r) => r.user_id).filter(Boolean));
    const uniekVorig = new Set(vorige.map((r) => r.user_id).filter(Boolean));
    const week = nu - 7 * 24 * 3600_000;
    const uniekWeek = new Set(
      alle.filter((r) => new Date(r.created_at).getTime() >= week).map((r) => r.user_id).filter(Boolean),
    );
    const maand = nu - 30 * 24 * 3600_000;
    const uniekMaand = new Set(
      alle.filter((r) => new Date(r.created_at).getTime() >= maand).map((r) => r.user_id).filter(Boolean),
    );

    const sorteer = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([naam, aantal]) => ({ naam, aantal }));

    const { count: gebruikers } = await db.from("profiles").select("*", { count: "exact", head: true });
    const { data: recepten } = await alleRijen(
      db.from("recipes").select("user_id").is("deleted_at", null).order("id"),
    );
    const makers = new Set((recepten ?? []).map((r: any) => r.user_id));

    return {
      periode,
      totaalEvents: rijen.length,
      actieveGebruikers: uniek.size,
      actieveGebruikers30: uniekMaand.size,
      actieveGebruikers7: uniekWeek.size,
      evoluties: {
        events: evolutie(rijen.length, vorige.length),
        actieveGebruikers: evolutie(uniek.size, uniekVorig.size),
      },
      gebruikers: gebruikers ?? 0,
      makers: makers.size,
      grafiek,
      topEvents: sorteer(perEvent),
      topPaginas: sorteer(perPad),
    };
  });


// ---------------- teksten (CMS) ----------------

export const adminTeksten = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "content.manage", { schrijft: false });
    const { data } = await db.from("site_content").select("*").order("key");
    return data ?? [];
  });

export const adminTekstZetten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        key: z.string().min(1),
        title: z.string().default(""),
        body: z.string().default(""),
        published: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "content.manage");
    await db
      .from("site_content")
      .upsert(
        { ...data, updated_at: new Date().toISOString(), updated_by: profiel.user_id },
        { onConflict: "key" },
      );
    await logboek(db, profiel, "content.update", "site_content", data.key, { title: data.title });
    return { ok: true };
  });

// ---------------- aankondigingen ----------------

export const adminAankondigingen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "content.manage", { schrijft: false });
    const { data } = await db.from("announcements").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminAankondigingZetten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().nullable().default(null),
        title: z.string().min(1),
        body: z.string().default(""),
        level: z.enum(["info", "waarschuwing", "onderhoud"]).default("info"),
        active: z.boolean().default(true),
        ends_at: z.string().nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "content.manage");
    const rij = {
      title: data.title,
      body: data.body,
      level: data.level,
      active: data.active,
      ends_at: data.ends_at,
      created_by: profiel.user_id,
    };
    if (data.id) await db.from("announcements").update(rij).eq("id", data.id);
    else await db.from("announcements").insert(rij);
    await logboek(db, profiel, data.id ? "announcement.update" : "announcement.create", "announcement", data.id, {
      title: data.title,
    });
    return { ok: true };
  });

export const adminAankondigingVerwijderen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "content.manage");
    await db.from("announcements").delete().eq("id", data.id);
    await logboek(db, profiel, "announcement.delete", "announcement", data.id);
    return { ok: true };
  });

// ---------------- credits & AI-kosten ----------------

export const adminCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "finance.view");
    const sinds = new Date(Date.now() - 30 * 86400_000).toISOString();

    const [kosten, pakketten, saldi, boekingen, gebruik] = await Promise.all([
      db.from("credit_costs").select("*").order("feature"),
      db.from("credit_packs").select("*").order("volgorde"),
      db.from("user_credits").select("balance, gratis_totaal, gekocht_totaal, gebruikt_totaal"),
      db.from("credit_transactions").select("type, amount, created_at").gte("created_at", sinds),
      db.from("ai_usage").select("feature, credits, cache_hit, ok, duration_ms, created_at").gte("created_at", sinds),
    ]);

    const rijen = (saldi.data ?? []) as any[];
    const events = (gebruik.data ?? []) as any[];
    const perFunctie = new Map<string, { feature: string; aantal: number; credits: number; cache: number; fouten: number }>();
    for (const e of events) {
      const r = perFunctie.get(e.feature) ?? { feature: e.feature, aantal: 0, credits: 0, cache: 0, fouten: 0 };
      r.aantal += 1;
      r.credits += e.credits ?? 0;
      if (e.cache_hit) r.cache += 1;
      if (!e.ok) r.fouten += 1;
      perFunctie.set(e.feature, r);
    }

    const gebruikers = rijen.length || 1;
    const cacheTreffers = events.filter((e) => e.cache_hit).length;

    return {
      kosten: kosten.data ?? [],
      pakketten: pakketten.data ?? [],
      gebruikers: rijen.length,
      saldoTotaal: rijen.reduce((s, r) => s + (r.balance ?? 0), 0),
      gratisUitgedeeld: rijen.reduce((s, r) => s + (r.gratis_totaal ?? 0), 0),
      gekocht: rijen.reduce((s, r) => s + (r.gekocht_totaal ?? 0), 0),
      verbruikt: rijen.reduce((s, r) => s + (r.gebruikt_totaal ?? 0), 0),
      verbruiktPerGebruiker: Math.round((rijen.reduce((s, r) => s + (r.gebruikt_totaal ?? 0), 0) / gebruikers) * 10) / 10,
      aiVerzoeken: events.length,
      cacheTreffers,
      cachePercentage: events.length ? Math.round((cacheTreffers / events.length) * 100) : 0,
      teruggestort: (boekingen.data ?? []).filter((b: any) => b.type === "refund").length,
      perFunctie: [...perFunctie.values()].sort((a, b) => b.credits - a.credits),
    };
  });

export const adminCreditKostZetten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        feature: z.string().min(1),
        credit_cost: z.number().int().min(0).max(1000).optional(),
        enabled: z.boolean().optional(),
        max_per_dag: z.number().int().min(1).max(10000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "settings.manage");
    const { feature, ...rest } = data;
    const velden: {
      updated_at: string;
      credit_cost?: number;
      enabled?: boolean;
      max_per_dag?: number;
    } = { updated_at: new Date().toISOString() };
    if (rest.credit_cost !== undefined) velden.credit_cost = rest.credit_cost;
    if (rest.enabled !== undefined) velden.enabled = rest.enabled;
    if (rest.max_per_dag !== undefined) velden.max_per_dag = rest.max_per_dag;
    await db.from("credit_costs").update(velden).eq("feature", feature);
    await logboek(db, profiel, "credits.cost_update", "credit_cost", feature, rest);
    return { ok: true };
  });

export const adminCreditsToekennen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), amount: z.number().int().min(-10000).max(10000), reden: z.string().max(200).default("") }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("credits_toekennen", {
      _user: data.user_id,
      _amount: data.amount,
      _type: "admin_adjustment",
      _ref: `admin:${Date.now()}:${data.user_id}`,
    });
    if (error) throw new Error(error.message);
    await logboek(db, profiel, "credits.adjust", "user", data.user_id, { amount: data.amount, reden: data.reden });
    return { ok: true };
  });

// ============================================================
// Importcentrum — kwaliteit en kosten van de linkimport.
// ============================================================
export const adminImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "ai.view");
    const sinds = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data } = await db
      .from("recipe_import_jobs")
      .select("*")
      .gte("created_at", sinds)
      .order("created_at", { ascending: false })
      .limit(500);

    const rijen = (data ?? []) as any[];
    const perPlatform = new Map<
      string,
      { platform: string; totaal: number; klaar: number; gedeeltelijk: number; mislukt: number; dubbel: number; credits: number; cache: number; ms: number }
    >();
    for (const r of rijen) {
      const p = perPlatform.get(r.platform) ?? {
        platform: r.platform,
        totaal: 0,
        klaar: 0,
        gedeeltelijk: 0,
        mislukt: 0,
        dubbel: 0,
        credits: 0,
        cache: 0,
        ms: 0,
      };
      p.totaal += 1;
      if (r.status === "klaar") p.klaar += 1;
      if (r.status === "gedeeltelijk") p.gedeeltelijk += 1;
      if (r.status === "mislukt") p.mislukt += 1;
      if (r.status === "dubbel") p.dubbel += 1;
      p.credits += r.credits_used ?? 0;
      if (r.cache_hit) p.cache += 1;
      p.ms += r.duration_ms ?? 0;
      perPlatform.set(r.platform, p);
    }

    const vandaag = new Date().toISOString().slice(0, 10);
    const zonderAi = rijen.filter((r) => !r.ai_used).length;

    return {
      totaal: rijen.length,
      vandaag: rijen.filter((r) => String(r.created_at).slice(0, 10) === vandaag).length,
      mislukt: rijen.filter((r) => r.status === "mislukt").length,
      gedeeltelijk: rijen.filter((r) => r.status === "gedeeltelijk").length,
      credits: rijen.reduce((s, r) => s + (r.credits_used ?? 0), 0),
      gratisPercentage: rijen.length ? Math.round((zonderAi / rijen.length) * 100) : 0,
      cachePercentage: rijen.length
        ? Math.round((rijen.filter((r) => r.cache_hit).length / rijen.length) * 100)
        : 0,
      perPlatform: [...perPlatform.values()]
        .map((p) => ({ ...p, gemiddeldMs: p.totaal ? Math.round(p.ms / p.totaal) : 0 }))
        .sort((a, b) => b.totaal - a.totaal),
      recent: rijen.slice(0, 40),
    };
  });

// ============================================================
// Creditaanvragen — gebruikers vragen extra credits aan het team.
// ============================================================
export const adminCreditAanvragen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await bewaker(context as Ctx, "users.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rijen } = await supabaseAdmin
      .from("credit_requests")
      .select("id, user_id, aantal, bericht, status, toegekend, admin_note, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    const lijst = rijen ?? [];
    const ids = [...new Set(lijst.map((r) => r.user_id))];
    const { data: profielen } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as { id: string; display_name: string }[] };
    const { data: saldi } = ids.length
      ? await supabaseAdmin.from("user_credits").select("user_id, balance").in("user_id", ids)
      : { data: [] as { user_id: string; balance: number }[] };
    const naam = new Map((profielen ?? []).map((p) => [p.id, p.display_name]));
    const saldo = new Map((saldi ?? []).map((s) => [s.user_id, s.balance]));
    return {
      open: lijst.filter((r) => r.status === "open").length,
      aanvragen: lijst.map((r) => ({
        ...r,
        naam: naam.get(r.user_id) ?? "Gebruiker",
        saldo: saldo.get(r.user_id) ?? 0,
      })),
    };
  });

export const adminCreditAanvraagAfhandelen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        toekennen: z.number().int().min(0).max(100000).default(0),
        afwijzen: z.boolean().default(false),
        note: z.string().max(300).default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rij } = await supabaseAdmin
      .from("credit_requests")
      .select("id, user_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!rij) throw new Error("Aanvraag niet gevonden");
    if (rij.status !== "open") throw new Error("Deze aanvraag is al behandeld");

    let toegekend = 0;
    if (!data.afwijzen && data.toekennen > 0) {
      const { error } = await supabaseAdmin.rpc("credits_toekennen", {
        _user: rij.user_id,
        _amount: data.toekennen,
        _type: "promotional_bonus",
        _ref: `aanvraag:${rij.id}`,
      });
      if (error) throw new Error(error.message);
      toegekend = data.toekennen;
    }

    await supabaseAdmin
      .from("credit_requests")
      .update({
        status: data.afwijzen ? "afgewezen" : "toegekend",
        toegekend,
        admin_note: data.note,
        handled_by: profiel.user_id,
        handled_at: new Date().toISOString(),
      })
      .eq("id", rij.id);

    await logboek(db, profiel, "credits.request_handled", "user", rij.user_id, {
      aanvraag: rij.id,
      toegekend,
      afgewezen: data.afwijzen,
    });
    return { ok: true };
  });

// ============================================================
// Klantenkaarten — winkels beheren en gebruik opvolgen.
// Kaartnummers worden nooit volledig getoond.
// ============================================================
export const adminLoyalty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await bewaker(context as Ctx, "content.manage", { schrijft: false });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: winkels } = await supabaseAdmin
      .from("loyalty_stores")
      .select("slug, naam, kleur, standaard_formaat, actief, volgorde")
      .order("volgorde");
    const { data: kaarten } = await supabaseAdmin
      .from("loyalty_cards")
      .select("id, user_id, store_slug, winkel_naam, nummer, formaat, favoriet, gedeeld, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const sinds = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const { data: scans } = await supabaseAdmin
      .from("loyalty_scan_events")
      .select("id, methode, formaat, store_slug, ok, reden, created_at")
      .gte("created_at", sinds)
      .order("created_at", { ascending: false })
      .limit(200);

    const lijst = kaarten ?? [];
    const perWinkel = new Map<string, { winkel: string; aantal: number }>();
    for (const k of lijst) {
      const sleutel = k.store_slug ?? "overig";
      const rij = perWinkel.get(sleutel) ?? { winkel: k.winkel_naam, aantal: 0 };
      rij.aantal += 1;
      perWinkel.set(sleutel, rij);
    }
    const scanLijst = scans ?? [];
    return {
      winkels: winkels ?? [],
      totaal: lijst.length,
      gebruikers: new Set(lijst.map((k) => k.user_id)).size,
      gedeeld: lijst.filter((k) => k.gedeeld).length,
      perWinkel: [...perWinkel.values()].sort((a, b) => b.aantal - a.aantal),
      perFormaat: [...new Set(lijst.map((k) => k.formaat))].map((f) => ({
        formaat: f,
        aantal: lijst.filter((k) => k.formaat === f).length,
      })),
      scans: {
        totaal: scanLijst.length,
        mislukt: scanLijst.filter((s) => !s.ok).length,
        recent: scanLijst.slice(0, 30).map((s) => ({
          id: s.id,
          methode: s.methode,
          formaat: s.formaat,
          winkel: s.store_slug,
          ok: s.ok,
          reden: s.reden,
          created_at: s.created_at,
        })),
      },
      // Enkel de laatste vier cijfers, nooit het volledige nummer.
      recent: lijst.slice(0, 30).map((k) => ({
        id: k.id,
        winkel: k.winkel_naam,
        formaat: k.formaat,
        gedeeld: k.gedeeld,
        gemaskeerd: k.nummer.length > 4 ? `•••• ${k.nummer.slice(-4)}` : "••••",
        created_at: k.created_at,
      })),
    };
  });

export const adminLoyaltyWinkel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        slug: z
          .string()
          .min(2)
          .max(40)
          .regex(/^[a-z0-9-]+$/),
        naam: z.string().min(2).max(60),
        kleur: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#475569"),
        standaard_formaat: z.enum(["CODE128", "EAN13", "EAN8", "CODE39", "ITF", "QR"]).default("CODE128"),
        actief: z.boolean().default(true),
        volgorde: z.number().int().min(0).max(999).default(100),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "content.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("loyalty_stores").upsert(data, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    await logboek(db, profiel, "loyalty.store_saved", "loyalty_store", data.slug, { naam: data.naam });
    return { ok: true };
  });
