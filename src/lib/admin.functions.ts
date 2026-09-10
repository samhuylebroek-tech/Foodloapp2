import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  | "private.view";

const MATRIX: Record<AdminRol, Rechten[]> = {
  super_admin: [
    "dashboard.view",
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
  ],
  admin: [
    "dashboard.view",
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
  ],
  support: ["dashboard.view", "users.view", "recipes.view", "support.view", "support.manage", "system.view"],
  content_manager: ["dashboard.view", "recipes.view", "recipes.manage", "content.manage", "ai.view"],
  analyst: ["dashboard.view", "system.view", "ai.view"],
};

export function heeftRecht(profiel: AdminProfiel | null, recht: Rechten): boolean {
  if (!profiel || !profiel.active) return false;
  if (recht === "private.view") return profiel.can_view_private_content;
  return MATRIX[profiel.role].includes(recht);
}

type Ctx = { supabase: any; userId: string; claims?: any };

const SCHRIJFRECHTEN: Rechten[] = [
  "users.manage",
  "users.delete",
  "recipes.manage",
  "content.manage",
  "support.manage",
  "settings.manage",
  "admins.manage",
  "privacy.manage",
];

// Max aantal beheeracties per minuut per beheerder.
const LIMIET_PER_MINUUT = 120;

async function bewaker(context: Ctx, recht: Rechten, opties: { schrijft?: boolean } = {}) {
  const { data, error } = await context.supabase
    .from("admin_users")
    .select("user_id, role, active, can_view_private_content, note, read_only, mfa_required")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error || !data || !data.active) throw new Error("Geen toegang tot het Control Center.");
  const profiel = data as AdminProfiel;
  if (!heeftRecht(profiel, recht)) throw new Error("Je rol heeft dit recht niet.");

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
  const req = getRequest();
  const ip = req?.headers.get("x-forwarded-for") ?? null;
  const ua = req?.headers.get("user-agent") ?? null;
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

async function logboek(
  db: any,
  profiel: AdminProfiel,
  action: string,
  entity_type: string,
  entity_id: string | null,
  details: Record<string, unknown> = {},
) {
  const req = getRequest();
  await db.from("admin_audit_log").insert({
    actor_id: profiel.user_id,
    actor_role: profiel.role,
    action,
    entity_type,
    entity_id,
    details,
    ip: req?.headers.get("x-forwarded-for") ?? null,
    user_agent: req?.headers.get("user-agent") ?? null,
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

export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const nu = Date.now();
    const dag = new Date(nu - 24 * 3600_000).toISOString();
    const week = new Date(nu - 7 * 24 * 3600_000).toISOString();

    const tel = async (tabel: string, filter?: (q: any) => any) => {
      let q = (db as any).from(tabel).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count } = await q;
      return count ?? 0;
    };

    const [
      gebruikers,
      nieuweGebruikers,
      recepten,
      nieuweRecepten,
      verwijderdeRecepten,
      lijsten,
      planItems,
      shares,
      openTickets,
      aiTotaal,
      aiFouten,
    ] = await Promise.all([
      tel("profiles"),
      tel("profiles", (q) => q.gte("created_at", week)),
      tel("recipes", (q) => q.is("deleted_at", null)),
      tel("recipes", (q) => q.gte("created_at", week).is("deleted_at", null)),
      tel("recipes", (q) => q.not("deleted_at", "is", null)),
      tel("shopping_lists"),
      tel("meal_plan"),
      tel("shares", (q) => q.eq("status", "accepted")),
      tel("feedback", (q) => q.in("status", ["nieuw", "bezig"])),
      tel("ai_events", (q) => q.gte("created_at", week)),
      tel("ai_events", (q) => q.gte("created_at", week).eq("ok", false)),
    ]);

    const { data: aiDag } = await db
      .from("ai_events")
      .select("created_at, ok, duration_ms")
      .gte("created_at", dag)
      .limit(2000);

    const gem =
      aiDag && aiDag.length
        ? Math.round(aiDag.reduce((s: number, e: any) => s + (e.duration_ms || 0), 0) / aiDag.length)
        : 0;

    const { data: groei } = await db
      .from("recipes")
      .select("created_at")
      .gte("created_at", new Date(nu - 30 * 24 * 3600_000).toISOString())
      .order("created_at");

    const perDag = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(nu - i * 24 * 3600_000).toISOString().slice(0, 10);
      perDag.set(d, 0);
    }
    for (const r of groei ?? []) {
      const d = String(r.created_at).slice(0, 10);
      if (perDag.has(d)) perDag.set(d, (perDag.get(d) ?? 0) + 1);
    }

    return {
      gebruikers,
      nieuweGebruikers,
      recepten,
      nieuweRecepten,
      verwijderdeRecepten,
      lijsten,
      planItems,
      shares,
      openTickets,
      ai: { totaal: aiTotaal, fouten: aiFouten, gemiddeldMs: gem, vandaag: aiDag?.length ?? 0 },
      grafiek: [...perDag.entries()].map(([datum, aantal]) => ({ datum, aantal })),
    };
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
    await logboek(db, profiel, "user.view", "user", data.id);
    return {
      profiel: p,
      email: auth?.user?.email ?? null,
      laatsteAanmelding: auth?.user?.last_sign_in_at ?? null,
      aangemaakt: auth?.user?.created_at ?? null,
      recepten: recepten ?? [],
      lijsten: lijsten ?? 0,
      planning: planning ?? 0,
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
    const tabellen = ["profiles", "recipes", "favorites", "meal_plan", "shopping_lists", "shopping_items", "feedback"];
    const bundel: Record<string, any[]> = {};
    for (const t of tabellen) {
      const kolom = t === "profiles" ? "id" : "user_id";
      const { data: rijen } = await (db as any).from(t).select("*").eq(kolom, data.id);
      bundel[t] = (rijen ?? []) as any[];
    }
    await logboek(db, profiel, "privacy.export", "user", data.id);
    return bundel;
  });

export const adminVerwijderGebruiker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), bevestiging: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { db, profiel } = await bewaker(context as Ctx, "users.delete");
    if (data.bevestiging !== "VERWIJDER") throw new Error("Bevestiging klopt niet.");
    await logboek(db, profiel, "privacy.delete_account", "user", data.id);
    const { error } = await db.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
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
    const { data: rijen } = await db.from("recipes").select("category, tags").is("deleted_at", null).limit(5000);
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
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "ai.view");
    const { data: events } = await db
      .from("ai_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
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
      .order("created_at", { ascending: false })
      .limit(50);
    return {
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
  .handler(async ({ context }) => {
    const { db } = await bewaker(context as Ctx, "dashboard.view");
    const dagen = 30;
    const sinds = new Date(Date.now() - dagen * 24 * 3600_000).toISOString();

    const { data: events } = await db
      .from("usage_events")
      .select("event, path, user_id, created_at")
      .gte("created_at", sinds)
      .limit(20000);
    const rijen = (events ?? []) as any[];

    const perEvent = new Map<string, number>();
    const perPad = new Map<string, number>();
    const perDag = new Map<string, Set<string>>();
    for (const r of rijen) {
      perEvent.set(r.event, (perEvent.get(r.event) ?? 0) + 1);
      if (r.path) perPad.set(r.path, (perPad.get(r.path) ?? 0) + 1);
      const dag = String(r.created_at).slice(0, 10);
      if (!perDag.has(dag)) perDag.set(dag, new Set());
      if (r.user_id) perDag.get(dag)!.add(r.user_id);
    }

    const grafiek: { datum: string; actieveGebruikers: number }[] = [];
    for (let i = dagen - 1; i >= 0; i--) {
      const datum = new Date(Date.now() - i * 24 * 3600_000).toISOString().slice(0, 10);
      grafiek.push({ datum, actieveGebruikers: perDag.get(datum)?.size ?? 0 });
    }

    const uniek = new Set(rijen.map((r) => r.user_id).filter(Boolean));
    const week = Date.now() - 7 * 24 * 3600_000;
    const uniekWeek = new Set(
      rijen.filter((r) => new Date(r.created_at).getTime() >= week).map((r) => r.user_id).filter(Boolean),
    );

    const sorteer = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([naam, aantal]) => ({ naam, aantal }));

    // Retentie: hoeveel gebruikers met een recept keren terug
    const { count: gebruikers } = await db.from("profiles").select("*", { count: "exact", head: true });
    const { data: recepten } = await db.from("recipes").select("user_id").is("deleted_at", null).limit(20000);
    const makers = new Set((recepten ?? []).map((r: any) => r.user_id));

    return {
      totaalEvents: rijen.length,
      actieveGebruikers30: uniek.size,
      actieveGebruikers7: uniekWeek.size,
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
