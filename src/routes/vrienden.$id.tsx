import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Check, ChefHat, Clock, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { RecipePhoto } from "@/components/RecipePhoto";
import type { Recipe } from "@/lib/types";
import { tijdLabel } from "@/lib/tijd";

export const Route = createFileRoute("/vrienden/$id")({
  head: () => ({
    meta: [
      { title: "Wat een vriend deelt – Foodlo" },
      {
        name: "description",
        content:
          "Bekijk de recepten, het weekmenu en de boodschappenlijst die een vriend of familielid met jou deelt.",
      },
      { property: "og:title", content: "Wat een vriend deelt – Foodlo" },
      {
        property: "og:description",
        content: "Alleen wat deze persoon bewust met jou deelt, op één plek.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VriendPage,
});

function dagLabel(datum: string) {
  const d = new Date(`${datum}T12:00:00`);
  return d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
}

function VriendPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();

  const { data: naam = "Vriend" } = useQuery({
    queryKey: ["profiel", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", id)
        .maybeSingle();
      return data?.display_name || "Vriend";
    },
  });

  // Wat deze persoon met mij deelt. De database bepaalt uiteindelijk wat ik zie;
  // dit is enkel om het netjes te tonen.
  const { data: recht } = useQuery({
    queryKey: ["vriend-recht", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: share }, { data: gezin }] = await Promise.all([
        supabase
          .from("shares")
          .select("recipes_view, recipes_edit, planner_view, planner_edit, shopping_view, shopping_edit")
          .eq("owner_id", id)
          .eq("member_id", user!.id)
          .eq("status", "accepted")
          .maybeSingle(),
        supabase
          .from("group_members")
          .select(
            "recipes_view, recipes_edit, planner_view, planner_edit, shopping_view, shopping_edit",
          )
          .eq("user_id", id)
          .maybeSingle(),
      ]);
      const bron = share ?? gezin;
      return {
        recepten: Boolean(bron?.recipes_view || bron?.recipes_edit),
        weekmenu: Boolean(bron?.planner_view || bron?.planner_edit),
        boodschappen: Boolean(bron?.shopping_view || bron?.shopping_edit),
      };
    },
  });

  const { data: recepten = [], isLoading } = useQuery({
    queryKey: ["vriend-recepten", id],
    enabled: recht?.recepten === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recipe[];
    },
  });

  const { data: weekmenu = [] } = useQuery({
    queryKey: ["vriend-weekmenu", id],
    enabled: recht?.weekmenu === true,
    queryFn: async () => {
      const vandaag = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("meal_plan")
        .select("id, plan_date, meal_type, custom_title, recipe_id, recipes(title)")
        .eq("user_id", id)
        .gte("plan_date", vandaag)
        .order("plan_date")
        .limit(30);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        plan_date: string;
        meal_type: string;
        custom_title: string | null;
        recipe_id: string | null;
        recipes: { title: string } | null;
      }[];
    },
  });

  const { data: boodschappen = [] } = useQuery({
    queryKey: ["vriend-boodschappen", id],
    enabled: recht?.boodschappen === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("id, name, quantity, unit, checked")
        .eq("user_id", id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const regels = [
    { aan: recht?.recepten, label: "Recepten" },
    { aan: recht?.weekmenu, label: "Weekmenu" },
    { aan: recht?.boodschappen, label: "Boodschappenlijst" },
  ];
  const nietsGedeeld = recht && !recht.recepten && !recht.weekmenu && !recht.boodschappen;

  return (
    <AppShell title={naam}>
      <div className="space-y-5">
        <Link
          to="/vrienden"
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-base font-semibold"
        >
          <ArrowLeft className="size-5" aria-hidden /> Terug naar vrienden
        </Link>

        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Avatar naam={naam} sleutel={id} />
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl">{naam}</h2>
              <p className="text-base text-muted-foreground">Verbonden</p>
            </div>
          </div>
          <p className="mt-4 text-base font-semibold">Wat {naam} met jou deelt</p>
          <ul className="mt-2 space-y-1">
            {regels.map((r) => (
              <li key={r.label} className="flex items-center gap-3 text-base">
                {r.aan ? (
                  <Check className="size-5 text-primary" aria-hidden />
                ) : (
                  <X className="size-5 text-muted-foreground" aria-hidden />
                )}
                <span className={r.aan ? "" : "text-muted-foreground"}>{r.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {nietsGedeeld && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-lg text-muted-foreground">
            {naam} deelt op dit moment niets met jou.
          </p>
        )}

        {recht?.recepten && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-display text-xl">
              <ChefHat className="size-5 text-primary" aria-hidden /> Gerechten van {naam}
            </h2>
            {isLoading ? (
              <p className="text-base text-muted-foreground">Laden…</p>
            ) : recepten.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-base text-muted-foreground">
                Nog geen gerechten.
              </p>
            ) : (
              <ul className="space-y-3">
                {recepten.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/recepten/$id"
                      params={{ id: r.id }}
                      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 active:bg-secondary"
                    >
                      <RecipePhoto path={r.image_url} alt={r.title} className="size-20 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-xl">{r.title}</p>
                        <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
                          <Clock className="size-4" aria-hidden />
                          {[tijdLabel(r.prep_minutes, r.cook_minutes), r.category]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="text-sm text-muted-foreground">Gedeeld door {naam}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {recht?.weekmenu && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-display text-xl">
              <CalendarDays className="size-5 text-primary" aria-hidden /> Weekmenu van {naam}
            </h2>
            <p className="text-sm text-muted-foreground">Alleen bekijken.</p>
            {weekmenu.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-base text-muted-foreground">
                Er staat nog niets gepland.
              </p>
            ) : (
              <ul className="space-y-2">
                {weekmenu.map((m) => (
                  <li
                    key={m.id}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <span className="text-base capitalize text-muted-foreground">
                      {dagLabel(m.plan_date)} · {m.meal_type}
                    </span>
                    <span className="truncate text-base font-semibold">
                      {m.recipes?.title ?? m.custom_title ?? "Iets lekkers"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {recht?.boodschappen && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-display text-xl">
              <ShoppingCart className="size-5 text-primary" aria-hidden /> Boodschappen van {naam}
            </h2>
            <p className="text-sm text-muted-foreground">Alleen bekijken.</p>
            {boodschappen.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-base text-muted-foreground">
                De lijst is leeg.
              </p>
            ) : (
              <ul className="space-y-2">
                {boodschappen.map((b) => (
                  <li
                    key={b.id}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <span className={`text-base ${b.checked ? "line-through opacity-60" : ""}`}>
                      {b.name}
                    </span>
                    <span className="text-base text-muted-foreground">
                      {[b.quantity, b.unit].filter(Boolean).join(" ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
