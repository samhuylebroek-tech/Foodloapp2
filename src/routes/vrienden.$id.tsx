import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, ChefHat, Clock, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Groep, LadenRijen } from "@/components/mobiel/Lijst";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { RecipePhoto } from "@/components/RecipePhoto";
import type { Recipe } from "@/lib/types";
import { tijdLabel, lokaleDatum } from "@/lib/tijd";
import { toonBelgischeMaat } from "@/lib/ingredienten";

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
          .select(
            "recipes_view, recipes_edit, planner_view, planner_edit, shopping_view, shopping_edit",
          )
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

  // Delen we een gezin? Dan hoort het gezinsmenu en de gezinslijst er ook bij.
  const { data: gezinId = null } = useQuery({
    queryKey: ["vriend-gezin", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [mijn, hun] = await Promise.all([
        supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user!.id)
          .eq("status", "actief"),
        supabase.from("group_members").select("group_id").eq("user_id", id).eq("status", "actief"),
      ]);
      const mijne = new Set((mijn.data ?? []).map((r) => r.group_id));
      const samen = (hun.data ?? []).find((r) => mijne.has(r.group_id));
      return samen?.group_id ?? null;
    },
  });

  const { data: weekmenu = [] } = useQuery({
    queryKey: ["vriend-weekmenu", id, gezinId],
    enabled: recht?.weekmenu === true,
    queryFn: async () => {
      const vandaag = lokaleDatum();
      const basis = () =>
        supabase
          .from("meal_plan")
          .select("id, plan_date, meal_type, custom_title, recipe_id, group_id, recipes(title)")
          .gte("plan_date", vandaag)
          .order("plan_date")
          .limit(60);
      const [eigen, gezin] = await Promise.all([
        basis().eq("user_id", id),
        gezinId ? basis().eq("group_id", gezinId) : Promise.resolve({ data: [], error: null }),
      ]);
      if (eigen.error) throw eigen.error;
      const alles = [...(eigen.data ?? []), ...((gezin as { data: unknown[] }).data ?? [])] as {
        id: string;
        plan_date: string;
        meal_type: string;
        custom_title: string | null;
        recipe_id: string | null;
        group_id: string | null;
        recipes: { title: string } | null;
      }[];
      const uniek = new Map(alles.map((r) => [r.id, r]));
      return [...uniek.values()].sort((a, b) => a.plan_date.localeCompare(b.plan_date));
    },
  });

  const { data: boodschappen = [] } = useQuery({
    queryKey: ["vriend-boodschappen", id, gezinId],
    enabled: recht?.boodschappen === true,
    queryFn: async () => {
      let gezinsLijstIds: string[] = [];
      if (gezinId) {
        const { data: lijsten } = await supabase
          .from("shopping_lists")
          .select("id")
          .eq("group_id", gezinId);
        gezinsLijstIds = (lijsten ?? []).map((l) => l.id);
      }
      const [eigen, gezin] = await Promise.all([
        supabase
          .from("shopping_items")
          .select("id, name, quantity, unit, checked, list_id")
          .eq("user_id", id)
          .order("created_at"),
        gezinsLijstIds.length
          ? supabase
              .from("shopping_items")
              .select("id, name, quantity, unit, checked, list_id")
              .in("list_id", gezinsLijstIds)
              .order("created_at")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (eigen.error) throw eigen.error;
      const alles = [...(eigen.data ?? []), ...((gezin as { data: unknown[] }).data ?? [])] as {
        id: string;
        name: string;
        quantity: number | null;
        unit: string;
        checked: boolean;
        list_id: string | null;
      }[];
      const uniek = new Map(alles.map((r) => [r.id, r]));
      return [...uniek.values()].map((r) => ({
        ...r,
        gezin: Boolean(r.list_id && gezinsLijstIds.includes(r.list_id)),
      }));
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
      <div className="space-y-7">
        {/* Kop: wie is dit en wat deelt die persoon met jou. */}
        <section className="rounded-[1.5rem] bg-inkt p-5 text-inkt-foreground shadow-kaart">
          <div className="flex items-center gap-4">
            <Avatar
              naam={naam}
              sleutel={id}
              className="size-16 text-xl ring-2 ring-inkt-zacht/40"
            />
            <div className="min-w-0">
              <p className="text-label text-inkt-zacht">Verbonden</p>
              <h2 className="truncate text-sectietitel">{naam}</h2>
            </div>
          </div>
          <p className="mt-5 text-base font-semibold">Wat {naam} met jou deelt</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {regels.map((r) => (
              <li
                key={r.label}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[0.95rem] font-semibold",
                  r.aan ? "bg-honing text-honing-foreground" : "bg-white/10 text-inkt-zacht",
                )}
              >
                {r.aan ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <X className="size-4" aria-hidden />
                )}
                <span className={r.aan ? "" : "line-through decoration-1"}>{r.label}</span>
                <span className="sr-only">{r.aan ? "(gedeeld)" : "(niet gedeeld)"}</span>
              </li>
            ))}
          </ul>
        </section>

        {nietsGedeeld && (
          <EmptyState
            icon={<X />}
            title="Nog niets gedeeld"
            description={`${naam} deelt op dit moment niets met jou.`}
          />
        )}

        {recht?.recepten && (
          <section aria-labelledby="vriend-recepten" className="space-y-3">
            <h2 id="vriend-recepten" className="flex items-center gap-2 px-1 text-sectietitel">
              <ChefHat className="size-6 text-primary" aria-hidden /> Gerechten van {naam}
            </h2>
            {isLoading ? (
              <LadenRijen aantal={3} />
            ) : recepten.length === 0 ? (
              <p className="paneel p-5 text-base text-muted-foreground">Nog geen gerechten.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {recepten.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/recepten/$id"
                      params={{ id: r.id }}
                      className="group block overflow-hidden paneel transition-transform active:scale-[0.98]"
                    >
                      <RecipePhoto
                        path={r.image_url}
                        alt=""
                        recept={{ title: r.title, category: r.category }}
                        className="aspect-[4/3] w-full"
                      />
                      <div className="p-3">
                        <p className="line-clamp-2 text-kaarttitel">{r.title}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[0.95rem] text-muted-foreground">
                          <Clock className="size-4 shrink-0" aria-hidden />
                          <span className="truncate">
                            {[tijdLabel(r.prep_minutes, r.cook_minutes), r.category]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {recht?.weekmenu && (
          <Groep
            titel={
              <span className="flex items-center gap-2">
                <CalendarDays className="size-5" aria-hidden /> Weekmenu van {naam}
              </span>
            }
            voet={`Alleen bekijken. ${gezinId ? "Het gezinsmenu staat er ook bij." : ""}`}
          >
            {weekmenu.length === 0 ? (
              <p className="p-4 text-base text-muted-foreground">
                Er staat nog niets gepland
                {gezinId ? " in het gezinsmenu of in het eigen menu van " + naam : " door " + naam}.
                {gezinId
                  ? " Tip: plan je iets in je eigen weekmenu, zet het dan op “Weekmenu gezin” zodat iedereen het ziet."
                  : ""}
              </p>
            ) : (
              weekmenu.map((m) => (
                <div key={m.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <span className="w-24 shrink-0 text-[0.95rem] capitalize leading-tight text-muted-foreground">
                    {dagLabel(m.plan_date)}
                    <span className="block">{m.meal_type}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[1.05rem] font-semibold">
                    {m.recipes?.title ?? m.custom_title ?? "Iets lekkers"}
                  </span>
                  {m.group_id ? (
                    <span className="shrink-0 rounded-full bg-terracotta-zacht px-2.5 py-0.5 text-[0.9rem] font-semibold text-terracotta">
                      Gezin
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </Groep>
        )}

        {recht?.boodschappen && (
          <Groep
            titel={
              <span className="flex items-center gap-2">
                <ShoppingCart className="size-5" aria-hidden /> Boodschappen van {naam}
              </span>
            }
            voet={`Alleen bekijken. ${gezinId ? "De gezinslijst staat er ook bij." : ""}`}
          >
            {boodschappen.length === 0 ? (
              <p className="p-4 text-base text-muted-foreground">
                De lijst is leeg.
                {gezinId ? " Zet items op de gezinslijst zodat iedereen ze ziet." : ""}
              </p>
            ) : (
              boodschappen.map((b) => (
                <div key={b.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                      b.checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {b.checked ? <Check className="size-4" strokeWidth={3} /> : null}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[1.05rem]",
                      b.checked && "text-muted-foreground line-through",
                    )}
                  >
                    {b.name}
                    {b.checked ? <span className="sr-only"> (gekocht)</span> : null}
                  </span>
                  {b.gezin ? (
                    <span className="shrink-0 rounded-full bg-terracotta-zacht px-2.5 py-0.5 text-[0.9rem] font-semibold text-terracotta">
                      Gezin
                    </span>
                  ) : null}
                  <span className="shrink-0 text-base text-muted-foreground">
                    {toonBelgischeMaat(b.quantity, b.unit)}
                  </span>
                </div>
              ))
            )}
          </Groep>
        )}
      </div>
    </AppShell>
  );
}
