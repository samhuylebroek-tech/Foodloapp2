import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Versie = {
  id: string;
  created_at: string;
  momentopname: {
    recept: Record<string, unknown>;
    ingredienten: Array<Record<string, unknown>>;
  };
};

function moment(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Toont eerdere versies van een recept en zet er eentje terug. */
export function ReceptGeschiedenis({ recipeId }: { recipeId: string }) {
  const qc = useQueryClient();

  const { data: versies = [] } = useQuery({
    queryKey: ["recept-versies", recipeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_versions")
        .select("id, created_at, momentopname")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as Versie[];
    },
  });

  if (versies.length === 0) return null;

  const zetTerug = async (versie: Versie) => {
    const recept = { ...versie.momentopname.recept } as Record<string, unknown>;
    delete recept["id"];
    delete recept["created_at"];
    delete recept["updated_at"];

    const { error } = await supabase
      .from("recipes")
      .update(recept as never)
      .eq("id", recipeId);
    if (error) {
      toast.error("Terugzetten lukte niet.");
      return;
    }

    await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
    const rijen = (versie.momentopname.ingredienten ?? []).map((i) => {
      const rij = { ...i } as Record<string, unknown>;
      delete rij["id"];
      delete rij["created_at"];
      rij["recipe_id"] = recipeId;
      return rij;
    });
    if (rijen.length) {
      await supabase.from("recipe_ingredients").insert(rijen as never);
    }

    toast.success("De vorige versie staat terug.");
    void qc.invalidateQueries({ queryKey: ["recipe-edit", recipeId] });
    void qc.invalidateQueries({ queryKey: ["recept-versies", recipeId] });
    void qc.invalidateQueries({ queryKey: ["recipe", recipeId] });
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <History className="size-5" aria-hidden /> Eerdere versies
      </h2>
      <p className="mt-1 text-base text-muted-foreground">
        Iets verkeerd aangepast? Zet gerust een vorige versie terug.
      </p>
      <ul className="mt-4 space-y-2">
        {versies.map((v) => (
          <li
            key={v.id}
            className="flex min-h-16 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border px-4 py-2"
          >
            <span className="text-base font-semibold">{moment(v.created_at)}</span>
            <Button variant="outline" className="h-12 text-base" onClick={() => void zetTerug(v)}>
              <Undo2 className="size-5" aria-hidden /> Terugzetten
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
