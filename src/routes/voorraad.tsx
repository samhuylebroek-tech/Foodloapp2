import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/voorkeuren";
import { meet } from "@/lib/meten";
import { parseIngredientLine, toonBelgischeMaat } from "@/lib/ingredienten";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";

export const Route = createFileRoute("/voorraad")({
  head: () => ({
    meta: [
      { title: "Voorraadkast – Foodlo" },
      {
        name: "description",
        content:
          "Houd bij wat je thuis hebt staan, zodat je nooit dubbel koopt en meteen ziet wat je nog nodig hebt.",
      },
      { property: "og:title", content: "Voorraadkast – Foodlo" },
      {
        property: "og:description",
        content: "Zie in één oogopslag wat je al in huis hebt voor je recepten.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VoorraadPage,
});

type Item = {
  id: string;
  naam: string;
  hoeveelheid: number | null;
  eenheid: string;
};

function VoorraadPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const t = useT();
  const [nieuw, setNieuw] = useState("");

  useEffect(() => {
    void meet("voorraad.bekeken");
  }, []);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["voorraad", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("id, naam, hoeveelheid, eenheid")
        .eq("user_id", user!.id)
        .order("naam");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const voegToe = async () => {
    const regel = nieuw.trim();
    if (!regel || !user) return;
    const ontleed = parseIngredientLine(regel);
    const { error } = await supabase.from("pantry_items").insert({
      user_id: user.id,
      naam: ontleed?.name || regel,
      hoeveelheid: ontleed?.quantity ?? null,
      eenheid: ontleed?.unit ?? "",
    });
    if (error) {
      toast.error(t("Toevoegen lukte niet."));
      return;
    }
    setNieuw("");
    void qc.invalidateQueries({ queryKey: ["voorraad", user.id] });
  };

  const verwijder = async (id: string) => {
    const { error } = await supabase.from("pantry_items").delete().eq("id", id);
    if (error) {
      toast.error(t("Verwijderen lukte niet."));
      return;
    }
    void qc.invalidateQueries({ queryKey: ["voorraad", user?.id] });
  };

  return (
    <AppShell title={t("Voorraadkast")}>
      <p className="text-base text-muted-foreground">{t("Wat heb je al in huis?")}</p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Input
          value={nieuw}
          onChange={(e) => setNieuw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void voegToe();
          }}
          placeholder={t("Bijvoorbeeld: 500 g bloem")}
          aria-label={t("Nieuw product")}
          className="h-14 text-lg"
        />
        <Button onClick={() => void voegToe()} className="h-14 px-5 text-lg">
          <Plus aria-hidden /><span className="sr-only sm:not-sr-only">{t("Toevoegen")}</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6"><PageSkeleton rows={2} /></div>
      ) : items.length === 0 ? (
        <EmptyState title={t("Je voorraadkast is nog leeg")} description={t("Voeg toe wat je vaak in huis hebt.")} />
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4"
            >
              <span className="min-w-0 flex-1 truncate text-lg font-semibold">
                {item.hoeveelheid ? `${toonBelgischeMaat(item.hoeveelheid, item.eenheid)} ` : ""}
                {item.naam}
              </span>
              <button
                type="button"
                onClick={() => void verwijder(item.id)}
                aria-label={`${t("Verwijderen")}: ${item.naam}`}
                className="flex size-12 items-center justify-center rounded-xl border border-border"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
