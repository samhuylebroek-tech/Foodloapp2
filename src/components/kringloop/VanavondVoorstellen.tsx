/**
 * Niets gepland voor vandaag? Drie voorstellen, elk met 1 à 2 redenen (Foodloapp Intelligence I-1).
 * Eerst wat je (bijna) helemaal in huis hebt; is er niets in huis, dan ideeën uit je recepten.
 * Eén tik: gepland voor vanavond + wat ontbreekt op de lijst. "Niet nu" verbergt een voorstel
 * 7 dagen. Allergieën en dieet komen van dit toestel en verlaten het niet. Ongedaan maken kan altijd.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ChefHat, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RecipePhoto } from "@/components/RecipePhoto";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { meldMetHerstel } from "@/hooks/useAanvulling";
import { bepaalContext } from "@/lib/intelligentie/context";
import { vatSamen } from "@/lib/intelligentie/geschiedenis";
import { herstelNietNu, nietNuLijst, zetNietNu } from "@/lib/intelligentie/niet-nu";
import { useSlimmeVoorstellen } from "@/lib/intelligentie/slim";
import { beveelAan, type Aanbeveling } from "@/lib/intelligentie/voorstel";
import { leesKennismaking } from "@/lib/kennismaking";
import { HalfGelukt, kookVanavond } from "@/lib/kringloop-db";
import { meet } from "@/lib/meten";
import { lokaleDatum } from "@/lib/tijd";
import { useT, useVoorkeuren } from "@/lib/voorkeuren";

type ReceptKort = {
  id: string;
  title: string;
  servings: number | null;
  image_url: string | null;
  category: string | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  tags?: string[] | null;
};

const minutenVan = (r: ReceptKort) => (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);

export function VanavondVoorstellen({ recepten }: { recepten: ReceptKort[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const t = useT();
  const { momenten, weekmenu } = useVoorkeuren();
  const [bezig, setBezig] = useState<string | null>(null);
  const [nietNu, setNietNu] = useState<string[]>([]);
  // "Slimme voorstellen" uit: niets voorstellen en ook niets extra opvragen.
  const [slim] = useSlimmeVoorstellen();
  // Pas lezen als de gebruiker bekend is (na het aanmelden en niet tijdens server-rendering).
  useEffect(() => setNietNu(nietNuLijst(user?.id)), [user?.id]);
  const ids = recepten.map((r) => r.id);

  const { data: bronnen } = useQuery({
    queryKey: ["vanavond", user?.id, ids.join(",")],
    enabled: !!user && ids.length > 0 && slim,
    queryFn: async () => {
      const van = lokaleDatum(new Date(Date.now() - 180 * 86400000));
      const [ingr, voorraad, plan, sterren, favorieten] = await Promise.all([
        supabase
          .from("recipe_ingredients")
          .select("recipe_id, name")
          .in("recipe_id", ids.slice(0, 100)),
        supabase.from("pantry_items").select("naam").eq("user_id", user!.id),
        supabase
          .from("meal_plan")
          .select("recipe_id, plan_date")
          .eq("user_id", user!.id)
          .gte("plan_date", van)
          .limit(600),
        supabase.from("recipe_ratings").select("recipe_id, stars").eq("user_id", user!.id),
        supabase.from("favorites").select("recipe_id").eq("user_id", user!.id),
      ]);
      const per: Record<string, string[]> = {};
      for (const i of ingr.data ?? []) (per[i.recipe_id] ??= []).push(i.name);
      return {
        ingredienten: per,
        voorraad: (voorraad.data ?? []).map((v) => v.naam),
        // Geschiedenis, sterren en favorieten zijn hulp: lukt het niet, dan zonder.
        plan: plan.data ?? [],
        sterren: Object.fromEntries((sterren.data ?? []).map((s) => [s.recipe_id, s.stars])),
        favorieten: (favorieten.data ?? []).map((f) => f.recipe_id as string),
      };
    },
  });

  const { voorstellen, uitHuis } = useMemo(() => {
    if (!bronnen) return { voorstellen: [] as Aanbeveling[], uitHuis: true };
    const nu = new Date();
    const context = bepaalContext(nu);
    const dag = weekmenu.perDag?.[String(context.weekdag)];
    const kennis = leesKennismaking(user?.id);
    const minuten = Object.fromEntries(recepten.map((r) => [r.id, minutenVan(r)]));
    const alle = beveelAan({
      kandidaten: recepten.map((r) => ({
        id: r.id,
        title: r.title,
        minuten: minutenVan(r),
        category: r.category,
        tags: r.tags ?? [],
        ingredienten: bronnen.ingredienten[r.id] ?? [],
      })),
      context,
      voorraad: bronnen.voorraad,
      geschiedenis: vatSamen(bronnen.plan, minuten, context.datum),
      sterren: bronnen.sterren,
      favorieten: bronnen.favorieten,
      voorkeur: {
        maxMinuten: dag?.maxMinuten || weekmenu.maxMinuten || 0,
        soort: dag?.soort ?? null,
        vermijd: weekmenu.vermijd ?? "",
        dieet: kennis.dieet,
      },
      allergieen: kennis.allergieen,
      nietNu,
      max: 12,
    });
    const inHuis = alle.filter((a) => a.aanwezig.length > 0);
    return inHuis.length
      ? { voorstellen: inHuis.slice(0, 3), uitHuis: true }
      : { voorstellen: alle.slice(0, 3), uitHuis: false };
  }, [bronnen, recepten, weekmenu, nietNu, user?.id]);

  if (!slim || !voorstellen.length) return null;

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
      void meet("kringloop.vanavond", undefined, {
        ontbreekt: r.ontbreekt,
        reden: voorstellen.find((v) => v.id === id)?.redenen[0]?.soort ?? null,
      });
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

  function nietNuVoor(v: Aanbeveling) {
    if (!user) return;
    zetNietNu(user.id, v.id);
    setNietNu(nietNuLijst(user.id));
    void meet("voorstel.niet_nu", undefined, { reden: v.redenen[0]?.soort ?? null });
    toast(t("Je ziet dit voorstel een week niet."), {
      duration: 8000,
      action: {
        label: t("Ongedaan maken"),
        onClick: () => {
          herstelNietNu(user.id, v.id);
          setNietNu(nietNuLijst(user.id));
        },
      },
    });
  }

  const kop = uitHuis ? t("Met wat je in huis hebt") : t("Ideeën voor vanavond");

  return (
    <section aria-labelledby="vanavond-kop" className="mt-6">
      <h3 id="vanavond-kop" className="text-base font-semibold text-inkt-zacht">
        {kop}
      </h3>
      <ul className="mt-3 space-y-2">
        {voorstellen.map((v) => {
          const recept = recepten.find((r) => r.id === v.id)!;
          const ontbreekt = v.ontbreekt.length;
          const totaal = v.aanwezig.length + ontbreekt;
          return (
            <li key={v.id} className="rounded-2xl bg-white/10 p-2 pr-3">
              <span className="flex items-start gap-3">
                <RecipePhoto
                  path={recept.image_url}
                  alt=""
                  recept={recept}
                  className="size-14 shrink-0 rounded-xl"
                  icoonClassName="size-6"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-lg leading-snug font-semibold break-words text-inkt-foreground">
                    {v.title}
                  </span>
                  <span className="mt-0.5 block text-[0.95rem] leading-snug break-words text-inkt-zacht">
                    {v.redenen.map((r) => r.tekst).join(" · ")}
                  </span>
                  {totaal > 0 && (
                    <span className="mt-1 flex flex-wrap items-center gap-1 text-[0.95rem] text-inkt-zacht">
                      {ontbreekt === 0 ? (
                        <>
                          <Check className="size-4" aria-hidden /> {t("Alles in huis")}
                        </>
                      ) : (
                        `${ontbreekt} ${t("ontbreekt")}`
                      )}
                    </span>
                  )}
                </span>
              </span>
              {/* Knoppen onder de tekst over de volle breedte: past ook op 320 px met grote tekst. */}
              <span className="mt-2 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => nietNuVoor(v)}
                  disabled={!!bezig}
                  aria-label={`${t("Niet nu")}: ${v.title}`}
                  className="inline-flex min-h-11 max-w-full items-center rounded-full border border-inkt-foreground/40 px-3 text-base font-semibold text-inkt-foreground hover:bg-white/10 disabled:opacity-60"
                >
                  {t("Niet nu")}
                </button>
                <button
                  type="button"
                  onClick={() => void kies(v.id)}
                  disabled={!!bezig}
                  aria-label={`Kook ${v.title} vanavond`}
                  className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full bg-honing px-4 text-base font-semibold text-honing-foreground disabled:opacity-60"
                >
                  {bezig === v.id ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <ChefHat className="size-5" aria-hidden />
                  )}
                  Vanavond
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        to="/hulp/$slug"
        params={{ slug: "voorstellen" }}
        className="mt-2 inline-flex min-h-11 items-center text-[0.95rem] text-inkt-zacht underline underline-offset-4"
      >
        {t("Waarom zie ik dit?")}
      </Link>
    </section>
  );
}
