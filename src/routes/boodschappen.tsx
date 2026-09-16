import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Share2, ListPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Klantenkaarten } from "@/components/Klantenkaarten";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { zorgVoorLijst, voegToeAanLijst, type ShoppingList } from "@/lib/boodschappen";
import { parseIngredientLine } from "@/lib/ingredienten";

export const Route = createFileRoute("/boodschappen")({
  head: () => ({
    meta: [
      { title: "Boodschappenlijst – Foodlo" },
      {
        name: "description",
        content:
          "Maak meerdere boodschappenlijstjes met alle ingrediënten van je recepten, af te vinken in de winkel.",
      },
      { property: "og:title", content: "Boodschappenlijst – Foodlo" },
      { property: "og:description", content: "Vink af terwijl je winkelt en deel de lijst." },
    ],
  }),
  component: BoodschappenPage,
});

type Item = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  checked: boolean;
};

function BoodschappenPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [nieuw, setNieuw] = useState("");
  const [actief, setActief] = useState<string | null>(null);

  const { data: lijsten = [] } = useQuery({
    queryKey: ["shopping-lists", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      await zorgVoorLijst(user.id);
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("id, name, created_at, group_id")
        .order("created_at");
      if (error) throw error;
      return data as ShoppingList[];
    },
  });

  // De gezamenlijke gezinslijst ververst mee als een gezinslid iets aanpast.
  useEffect(() => {
    if (!user) return;
    const kanaal = supabase
      .channel("boodschappen-items")
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items" }, () => {
        qc.invalidateQueries({ queryKey: ["shopping"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(kanaal);
    };
  }, [user, qc]);

  useEffect(() => {
    if (!actief && lijsten.length) setActief(lijsten[0]!.id);
    if (actief && lijsten.length && !lijsten.some((l) => l.id === actief))
      setActief(lijsten[0]!.id);
  }, [lijsten, actief]);

  const { data: items = [] } = useQuery({
    queryKey: ["shopping", actief],
    enabled: !!actief,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("id, name, quantity, unit, checked")
        .eq("list_id", actief!)
        .order("checked")
        .order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["shopping"] });
  const refreshLijsten = () => qc.invalidateQueries({ queryKey: ["shopping-lists"] });
  const [vraagVerwijder, setVraagVerwijder] = useState(false);
  const actieveNaam = lijsten.find((l) => l.id === actief)?.name ?? "";

  async function nieuwLijstje() {
    if (!user) return;
    const naam = window.prompt("Hoe noem je dit lijstje?", "Nieuw lijstje");
    if (!naam?.trim()) return;
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: user.id, name: naam.trim() })
      .select("id")
      .single();
    if (error) {
      toast.error("Lijstje maken lukte niet");
      return;
    }
    setActief(data.id);
    refreshLijsten();
  }

  async function hernoem() {
    const huidig = lijsten.find((l) => l.id === actief);
    if (!huidig) return;
    const naam = window.prompt("Nieuwe naam voor dit lijstje", huidig.name);
    if (!naam?.trim()) return;
    await supabase.from("shopping_lists").update({ name: naam.trim() }).eq("id", huidig.id);
    refreshLijsten();
  }

  async function verwijderLijst() {
    const huidig = lijsten.find((l) => l.id === actief);
    if (!huidig) return;
    await supabase.from("shopping_lists").delete().eq("id", huidig.id);
    setVraagVerwijder(false);
    setActief(null);
    refreshLijsten();
    refresh();
    toast.success("Lijstje verwijderd");
  }

  async function voegToe() {
    if (!user || !nieuw.trim() || !actief) return;
    const geparsed = parseIngredientLine(nieuw);
    if (!geparsed) return;
    try {
      await voegToeAanLijst(user.id, actief, [geparsed]);
    } catch {
      toast.error("Toevoegen lukte niet");
      return;
    }
    setNieuw("");
    refresh();
  }

  async function vink(item: Item) {
    await supabase.from("shopping_items").update({ checked: !item.checked }).eq("id", item.id);
    refresh();
  }

  async function verwijder(id: string) {
    await supabase.from("shopping_items").delete().eq("id", id);
    refresh();
  }

  async function wisAfgevinkt() {
    if (!actief) return;
    await supabase.from("shopping_items").delete().eq("checked", true).eq("list_id", actief);
    refresh();
  }

  async function deel() {
    const tekst = items
      .filter((i) => !i.checked)
      .map((i) => `- ${i.quantity ?? ""} ${i.unit} ${i.name}`.replace(/\s+/g, " ").trim())
      .join("\n");
    if (!tekst) {
      toast.error("Je lijst is leeg");
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "Boodschappenlijst", text: tekst });
    } else {
      await navigator.clipboard.writeText(tekst);
      toast.success("Lijst gekopieerd");
    }
  }

  return (
    <AppShell title="Boodschappen">
      <div className="space-y-4">
        <Klantenkaarten />
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Je lijstjes">
          {lijsten.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === actief}
              onClick={() => setActief(l.id)}
              className={
                l.id === actief
                  ? "min-h-12 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground"
                  : "min-h-12 rounded-xl border border-border bg-card px-4 text-base font-semibold"
              }
            >
              {l.name}
              {l.group_id ? (
                <span
                  className={
                    l.id === actief
                      ? "ml-2 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-bold"
                      : "ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
                  }
                >
                  gezin
                </span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            onClick={nieuwLijstje}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-dashed border-border px-4 text-base font-semibold"
          >
            <ListPlus className="size-5" aria-hidden /> Nieuw lijstje
          </button>
        </div>

        {lijsten.length > 0 && !actieveLijst?.group_id && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={hernoem} className="h-12 text-base">
              <Pencil className="size-4" /> Naam wijzigen
            </Button>
            {lijsten.length > 1 && (
              <Button variant="ghost" onClick={() => setVraagVerwijder(true)} className="h-12 text-base text-destructive">
                <Trash2 className="size-4" /> Lijstje verwijderen
              </Button>
            )}
          </div>
        )}
        {actieveLijst?.group_id && (
          <p className="text-base text-muted-foreground">
            Deze lijst is van het hele gezin — iedereen vult aan en vinkt af.
          </p>
        )}

        <div className="flex gap-2">
          <Input
            value={nieuw}
            onChange={(e) => setNieuw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && voegToe()}
            placeholder="Zelf iets toevoegen"
            className="h-14 text-base"
          />
          <Button onClick={voegToe} className="h-14 px-6" aria-label="Toevoegen">
            <Plus className="size-6" />
          </Button>
        </div>

        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <Checkbox
                checked={item.checked}
                onCheckedChange={() => vink(item)}
                className="size-7"
                aria-label={item.name}
              />
              <span
                className={
                  item.checked ? "flex-1 text-lg text-muted-foreground line-through" : "flex-1 text-lg"
                }
              >
                {[item.quantity ?? "", item.unit, item.name].join(" ").replace(/\s+/g, " ").trim()}
              </span>
              <Button
                variant="ghost"
                onClick={() => verwijder(item.id)}
                aria-label="Verwijderen"
                className="size-12"
              >
                <Trash2 className="size-5" />
              </Button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border p-8 text-center text-lg text-muted-foreground">
              Dit lijstje is nog leeg.
            </li>
          )}
        </ul>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={deel} className="h-16 flex-1 text-lg">
            <Share2 className="size-5" /> Delen
          </Button>
          <Button variant="ghost" onClick={wisAfgevinkt} className="h-16 flex-1 text-lg">
            Afgevinkte wissen
          </Button>
        </div>
      </div>

      {vraagVerwijder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl">
            <h2 className="font-display text-xl">Lijstje verwijderen?</h2>
            <p className="mt-2 text-base text-muted-foreground">
              Je verwijdert “{actieveNaam}” met alles wat erop staat.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setVraagVerwijder(false)}
                className="h-14 flex-1 text-base"
              >
                Annuleren
              </Button>
              <Button
                variant="destructive"
                onClick={verwijderLijst}
                className="h-14 flex-1 text-base"
              >
                <Trash2 className="size-5" /> Verwijderen
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
