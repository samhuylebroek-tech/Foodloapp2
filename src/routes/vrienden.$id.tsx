import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { RecipePhoto } from "@/components/RecipePhoto";
import { useT } from "@/lib/voorkeuren";
import type { Recipe } from "@/lib/types";

export const Route = createFileRoute("/vrienden/$id")({
  head: () => ({
    meta: [
      { title: "Gerechten van een vriend – Foodlo" },
      {
        name: "description",
        content: "Bekijk de recepten die een vriend of familielid met jou deelt.",
      },
      { property: "og:title", content: "Gerechten van een vriend – Foodlo" },
      {
        property: "og:description",
        content: "Alle gedeelde recepten van je vriend op één plek.",
      },
    ],
  }),
  component: VriendPage,
});

function VriendPage() {
  const { id } = Route.useParams();
  const t = useT();

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

  const { data: recepten = [], isLoading } = useQuery({
    queryKey: ["vriend-recepten", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recipe[];
    },
  });

  return (
    <AppShell title={`${t("Gerechten van")} ${naam}`}>
      <div className="space-y-4">
        <Link
          to="/vrienden"
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-base font-semibold"
        >
          <ArrowLeft className="size-5" aria-hidden /> {t("Terug naar vrienden")}
        </Link>

        {isLoading ? (
          <p className="py-10 text-center text-lg text-muted-foreground">{t("Laden…")}</p>
        ) : recepten.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-lg text-muted-foreground">
            {t("Deze vriend deelt nog geen gerechten met jou.")}
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
                    <p className="truncate font-display text-xl">{t(r.title)}</p>
                    <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
                      <Clock className="size-4" aria-hidden />
                      {r.prep_minutes + r.cook_minutes} min · {t(r.category)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
