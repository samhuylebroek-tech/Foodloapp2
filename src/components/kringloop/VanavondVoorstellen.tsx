/**
 * Niets gepland voor vandaag? Drie gerechten die je (bijna) helemaal in huis hebt.
 * Eén tik: gepland voor vanavond + wat ontbreekt op de lijst. Ongedaan maken kan.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChefHat, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RecipePhoto } from "@/components/RecipePhoto";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { meldMetHerstel } from "@/hooks/useAanvulling";
import { HalfGelukt, kookVanavond } from "@/lib/kringloop-db";
import { meet } from "@/lib/meten";
import { watKanIkKoken } from "@/lib/voorraad-match";
import { useVoorkeuren } from "@/lib/voorkeuren";

type ReceptKort = {
  id: string;
  title: string;
  servings: number | null;
  image_url: string | null;
  category: string | null;
};

export function VanavondVoorstellen({ recepten }: { recepten: ReceptKort[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { momenten } = useVoorkeuren();
  const [bezig, setBezig] = useState<string | null>(null);
  const ids = recepten.map((r) => r.id);

  const { data: voorstellen = [] } = useQuery({
    queryKey: ["vanavond", user?.id, ids.join(",")],
    enabled: !!user && ids.length > 0,
    queryFn: async () => {
      const [ingr, voorraad] = await Promise.all([
        supabase
          .from("recipe_ingredients")
          .select("recipe_id, name")
          .in("recipe_id", ids.slice(0, 100)),
        supabase.from("pantry_items").select("naam").eq("user_id", user!.id),
      ]);
      const per = new Map<string, { name: string }[]>();
      for (const i of ingr.data ?? []) per.set(i.recipe_id, [...(per.get(i.recipe_id) ?? []), i]);
      return watKanIkKoken(
        recepten.map((r) => ({ id: r.id, title: r.title, ingredienten: per.get(r.id) ?? [] })),
        (voorraad.data ?? []).map((v) => v.naam),
        { max: 3 },
      );
    },
  });

  if (!voorstellen.length) return null;

  async function kies(id: string) {
    const recept = recepten.find((r) => r.id === id);
    if (!user || !recept || bezig) return;
    setBezig(id);
    try {
      const moment = momenten.includes("avondeten")
        ? "avondeten"
        : (momenten.at(-1) ?? "avondeten");
      const r = await kookVanavond({ userId: user.id, recept, moment });
      if (r.alGepland) {
        toast(`${recept.title} staat al op vanavond`);
        return;
      }
      void meet("kringloop.vanavond", undefined, { ontbreekt: r.ontbreekt });
      const vernieuw = () => {
        void qc.invalidateQueries({ queryKey: ["home-dagmenu"] });
        void qc.invalidateQueries({ queryKey: ["home-week"] });
        void qc.invalidateQueries({ queryKey: ["aanvulling"] });
        void qc.invalidateQueries({ queryKey: ["shopping"] });
      };
      vernieuw();
      meldMetHerstel(
        r.ontbreekt
          ? `${recept.title} staat op vanavond · ${r.ontbreekt} op je lijst`
          : `${recept.title} staat op vanavond · je hebt alles`,
        r.herstel,
        vernieuw,
      );
    } catch (fout) {
      toast.error(
        fout instanceof HalfGelukt
          ? "Dat lukte maar half. Kijk je weekmenu en lijst even na."
          : "Dat lukte niet. Er is niets veranderd; probeer het opnieuw.",
      );
    } finally {
      setBezig(null);
    }
  }

  return (
    <section aria-labelledby="vanavond-kop" className="mt-6">
      <h3 id="vanavond-kop" className="text-base font-semibold text-inkt-zacht">
        Met wat je in huis hebt
      </h3>
      <ul className="mt-3 space-y-2">
        {voorstellen.map((v) => {
          const recept = recepten.find((r) => r.id === v.id)!;
          const ontbreekt = v.ontbreekt.length;
          return (
            <li key={v.id} className="flex items-start gap-3 rounded-2xl bg-white/10 p-2 pr-3">
              <RecipePhoto
                path={recept.image_url}
                alt=""
                recept={recept}
                className="size-14 shrink-0 rounded-xl"
                icoonClassName="size-6"
              />
              {/* Naam krijgt de volle breedte; meldingsregel en knop eronder (smalle telefoons). */}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-lg leading-snug font-semibold break-words text-inkt-foreground">
                  {v.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1 text-[0.95rem] whitespace-nowrap text-inkt-zacht">
                    {ontbreekt === 0 ? (
                      <>
                        <Check className="size-4" aria-hidden /> Alles in huis
                      </>
                    ) : (
                      `${ontbreekt} ontbreekt`
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => void kies(v.id)}
                    disabled={!!bezig}
                    aria-label={`Kook ${v.title} vanavond`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-honing px-4 text-base font-semibold text-honing-foreground disabled:opacity-60"
                  >
                    {bezig === v.id ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <ChefHat className="size-5" aria-hidden />
                    )}
                    Vanavond
                  </button>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
