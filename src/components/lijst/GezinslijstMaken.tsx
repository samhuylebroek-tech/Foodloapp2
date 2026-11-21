/**
 * P6 — Wie via "Gezinslijst" komt maar nog geen gedeelde lijst heeft, kreeg stil zijn eigen lijst
 * te zien (en dus geen "Wie haalt dit?" of "Mijn deel"). Nu zeggen we het en kan je ze maken.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function GezinslijstMaken({
  userId,
  onGemaakt,
}: {
  userId: string;
  onGemaakt: (id: string) => void;
}) {
  const [bezig, setBezig] = useState(false);
  const { data: groepId, isLoading } = useQuery({
    queryKey: ["mijn-gezin-id", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId)
        .eq("status", "actief")
        .limit(1)
        .maybeSingle();
      return (data?.group_id as string | undefined) ?? null;
    },
  });
  if (isLoading) return null;

  async function maak() {
    if (!groepId) return;
    setBezig(true);
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: userId, group_id: groepId, name: "Gezinslijst" })
      .select("id")
      .single();
    setBezig(false);
    if (error || !data) {
      toast.error("De gezinslijst maken lukte niet. Probeer het straks opnieuw.");
      return;
    }
    toast.success("De gezinslijst is gemaakt. Iedereen in je gezin ziet ze nu.");
    onGemaakt(data.id);
  }

  return (
    <section
      aria-labelledby="gezinslijst-maken"
      className="paneel space-y-3 px-4 py-5"
      data-testid="gezinslijst-maken"
    >
      <h2 id="gezinslijst-maken" className="flex items-center gap-2 text-kaarttitel">
        <Users className="size-6 shrink-0 text-primary" aria-hidden /> Nog geen gezinslijst
      </h2>
      {groepId ? (
        <>
          <p className="text-base text-muted-foreground">
            Hieronder staat je eigen lijst. Met een gezinslijst ziet iedereen dezelfde boodschappen
            en kan je vragen wie wat haalt.
          </p>
          <Button
            variant="secondary"
            onClick={() => void maak()}
            disabled={bezig}
            className="w-full sm:w-auto"
          >
            <Users aria-hidden /> Maak de gezinslijst
          </Button>
        </>
      ) : (
        <p className="text-base text-muted-foreground">
          Je bent nog niet in een gezin. Hieronder staat je eigen lijst.
        </p>
      )}
    </section>
  );
}
