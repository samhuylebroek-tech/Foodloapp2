/**
 * Fase 3 — Ontdek zonder catalogus (geen netwerk, nieuwe omgeving): nooit een leeg sjabloon.
 * Toont een ontworpen uitleg, je eigen recepten om te herontdekken en twee duidelijke acties.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { RecipePhoto } from "@/components/RecipePhoto";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { eigenId } from "@/lib/zichtbare-eigenaren";

export function OntdekLeeg() {
  const { data: eigen = [] } = useQuery({
    queryKey: ["ontdek-eigen"],
    queryFn: async () => {
      // "Je eigen keuken herontdekken": alleen eigen recepten (BUG-105, tweede laag).
      const ik = await eigenId();
      if (!ik) return [];
      const { data, error } = await supabase
        .from("recipes")
        .select("id, title, image_url, category, tags, prep_minutes, cook_minutes")
        .eq("user_id", ik)
        .is("deleted_at", null)
        .eq("is_concept", false)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-8">
      <section className="omslag omslag-groen relative overflow-hidden rounded-[1.75rem] p-6 text-inkt">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3 -top-8 font-display text-[9rem] font-semibold leading-none text-white/30"
        >
          O
        </span>
        <h2 className="relative text-sectietitel">De ideeënbibliotheek komt hier</h2>
        <p className="relative mt-2 max-w-md text-lg">
          Zodra er nieuwe gerechten en collecties zijn, vind je ze op deze plek. Intussen kan je je
          eigen keuken herontdekken of een gerecht zoeken op naam.
        </p>
        <div className="relative mt-5 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="sm:w-auto">
            <Link to="/recepten/nieuw">
              <Search /> Zoek een gerecht op naam
            </Link>
          </Button>
          <Button asChild variant="zacht" className="sm:w-auto">
            <Link to="/recepten/nieuw">
              <Plus /> Recept toevoegen
            </Link>
          </Button>
        </div>
      </section>

      {eigen.length ? (
        <section aria-labelledby="eigen-keuken">
          <h2 id="eigen-keuken" className="text-sectietitel">
            Uit je eigen keuken
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            {eigen.map((r) => (
              <li key={r.id}>
                <Link
                  to="/recepten/$id"
                  params={{ id: r.id }}
                  className="paneel block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RecipePhoto
                    path={r.image_url}
                    alt=""
                    recept={r}
                    className="aspect-[4/3] w-full"
                  />
                  <span className="block p-3 text-base font-semibold leading-tight">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
