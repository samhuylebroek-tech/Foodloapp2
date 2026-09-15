import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { bewaarLokaal, leesLokaal, type Kaart } from "@/lib/kaarten";

// Kleine strook met je klantenkaarten, zodat je ze bij de kassa
// meteen bij de hand hebt vanaf je boodschappenlijst.
export function Klantenkaarten() {
  const { user } = useAuth();
  const { data: kaarten = leesLokaal() } = useQuery({
    queryKey: ["loyalty-kaarten", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_cards")
        .select("id, user_id, store_slug, winkel_naam, kaartnaam, nummer, formaat, favoriet, gedeeld")
        .order("favoriet", { ascending: false })
        .order("winkel_naam");
      if (error) return leesLokaal();
      const lijst = (data ?? []) as Kaart[];
      bewaarLokaal(lijst);
      return lijst;
    },
  });

  if (!kaarten.length) {
    return (
      <Link
        to="/kaarten"
        className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-base text-muted-foreground"
      >
        <CreditCard className="size-5" aria-hidden />
        Bewaar hier je klantenkaarten en toon ze aan de kassa
      </Link>
    );
  }

  return (
    <section aria-label="Je klantenkaarten">
      <h2 className="mb-2 text-base font-semibold text-muted-foreground">Je klantenkaarten</h2>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {kaarten.map((k) => (
          <li key={k.id} className="shrink-0">
            <Link
              to="/kaarten/$id"
              params={{ id: k.id }}
              className="flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-4 text-base font-semibold"
            >
              <CreditCard className="size-5 text-primary" aria-hidden />
              {k.winkel_naam}
              <span className="text-sm font-normal text-muted-foreground">Toon kaart</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
