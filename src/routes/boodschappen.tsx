import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/boodschappen")({
  head: () => ({
    meta: [
      { title: "Boodschappenlijst – Samen Koken" },
      {
        name: "description",
        content: "Je boodschappenlijst met alle ingrediënten van je recepten, af te vinken in de winkel.",
      },
      { property: "og:title", content: "Boodschappenlijst – Samen Koken" },
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

  const { data: items = [] } = useQuery({
    queryKey: ["shopping", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("id, name, quantity, unit, checked")
        .order("checked")
        .order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["shopping"] });

  async function voegToe() {
    if (!user || !nieuw.trim()) return;
    await supabase.from("shopping_items").insert({ user_id: user.id, name: nieuw.trim() });
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
    await supabase.from("shopping_items").delete().eq("checked", true);
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
              Je lijst is nog leeg.
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
    </AppShell>
  );
}
