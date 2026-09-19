import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/lib/types";
import { useT } from "@/lib/voorkeuren";
import {
  ontdekSuggesties,
  importRecipeFromText,
  gerechtFoto,
  type InternetSuggestie,
} from "@/lib/ai.functions";

/**
 * "Zin in iets nieuws?" — suggestieblok dat nooit vanzelf start (geen credits zonder tik),
 * met een "Zoek opnieuw"-knop om verse ideeën te laten zoeken.
 * Wordt gebruikt op de startpagina én de receptenpagina.
 */
export function NieuweSuggesties({
  recipes,
  favorites,
}: {
  recipes: Recipe[];
  favorites: string[];
}) {
  const { user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [ontdekAan, setOntdekAan] = useState(false);
  const [ronde, setRonde] = useState(0);
  const [bezig, setBezig] = useState<string | null>(null);

  const bekend = useMemo(() => recipes.map((r) => r.title).slice(0, 60), [recipes]);
  const favorietTitels = useMemo(
    () => recipes.filter((r) => favorites.includes(r.id)).map((r) => r.title).slice(0, 15),
    [favorites, recipes],
  );

  const { data: ideeen = [], isFetching: ideeenBezig } = useQuery({
    queryKey: ["internet-suggesties", ronde, bekend.join("|"), favorietTitels.join("|")],
    enabled: !!user && ontdekAan,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const lijst = await ontdekSuggesties({
        data: { bekend, favorieten: favorietTitels, sfeer: "" },
      });
      const bestaand = new Set(bekend.map((titel) => titel.toLowerCase().trim()));
      return lijst.filter((s) => !bestaand.has(s.title.toLowerCase().trim()));
    },
  });

  // Eerst bekijken: we halen het recept op en tonen het in een venster.
  const [bekijk, setBekijk] = useState<InternetSuggestie | null>(null);
  const [bekijkBezig, setBekijkBezig] = useState(false);
  const [bekijkFout, setBekijkFout] = useState(false);
  const [recept, setRecept] = useState<ImportedRecipe | null>(null);

  async function openVoorbeeld(s: InternetSuggestie) {
    setBekijk(s);
    setRecept(null);
    setBekijkFout(false);
    setBekijkBezig(true);
    try {
      const ai = await importRecipeFromText({
        data: {
          text: `Geef een volledig recept voor: ${s.title}. ${s.keuken ? `Keuken: ${s.keuken}.` : ""} ${s.waarom}`,
        },
      });
      setRecept(ai);
    } catch {
      setBekijkFout(true);
    } finally {
      setBekijkBezig(false);
    }
  }

  async function bewaarSuggestie(s: InternetSuggestie, ai: ImportedRecipe) {
    if (!user) return;
    setBezig(s.title);
    try {
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          user_id: user.id,
          title: ai.title || s.title,
          description: ai.description || s.waarom,
          servings: ai.servings || 4,
          prep_minutes: ai.prep_minutes || 0,
          cook_minutes: ai.cook_minutes || 0,
          category: ai.category || s.category,
          difficulty: ai.difficulty || "makkelijk",
          tags: ai.tags ?? [],
          instructions: ai.instructions ?? [],
        })
        .select("id")
        .single();
      if (error) throw error;
      if (ai.ingredients?.length) {
        await supabase.from("recipe_ingredients").insert(
          ai.ingredients.map((i, index) => ({
            recipe_id: data.id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit ?? "",
            position: index,
          })),
        );
      }
      toast.success(t("Toegevoegd aan je gerechten"));
      setBekijk(null);
      navigate({ to: "/recepten/$id", params: { id: data.id } });
    } catch {
      toast.error(t("Bewaren lukte niet. Probeer opnieuw."));
    } finally {
      setBezig(null);
    }
  }

  return (
    <section aria-labelledby="ideeen-titel" data-tour="ideeen">
      <div className="flex items-center justify-between gap-3">
        <h2 id="ideeen-titel" className="text-xl">{t("Zin in iets nieuws?")}</h2>
        {ontdekAan ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRonde((r) => r + 1)}
            disabled={ideeenBezig}
            className="text-primary"
          >
            <RefreshCw className={ideeenBezig ? "animate-spin" : ""} aria-hidden />
            {t("Zoek opnieuw")}
          </Button>
        ) : null}
      </div>
      {!ontdekAan ? (
        <div className="mt-3 rounded-2xl bg-card p-5 ring-1 ring-border/60">
          <p className="text-base text-muted-foreground">{t("Laat een paar verse ideeën zoeken op maat van wat jij lekker vindt.")}</p>
          <Button onClick={() => setOntdekAan(true)} className="mt-4 w-full sm:w-auto"><Sparkles />{t("Zoek nieuwe ideeën")}</Button>
        </div>
      ) : ideeenBezig && ideeen.length === 0 ? (
        <p className="mt-3 text-base text-muted-foreground">{t("Even zoeken naar nieuwe ideeën…")}</p>
      ) : ideeen.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-card p-5 ring-1 ring-border/60">
          <p className="text-base text-muted-foreground">{t("Geen nieuwe suggesties gevonden. Probeer het nog eens.")}</p>
          <Button onClick={() => setRonde((r) => r + 1)} disabled={ideeenBezig} className="mt-4 w-full sm:w-auto">
            <RefreshCw className={ideeenBezig ? "animate-spin" : ""} aria-hidden />
            {t("Zoek opnieuw")}
          </Button>
        </div>
      ) : (
        <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2" aria-busy={ideeenBezig}>
          {ideeen.map((s) => (
            <IdeeKaart key={s.title} s={s} t={t} onBekijk={() => void openVoorbeeld(s)} />
          ))}
        </ul>
      )}

      <Dialog open={bekijk !== null} onOpenChange={(o) => !o && setBekijk(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-left text-xl">{t(bekijk?.title ?? "")}</DialogTitle>
          </DialogHeader>
          {bekijkBezig ? (
            <p className="text-base text-muted-foreground">{t("Recept wordt uitgeschreven…")}</p>
          ) : bekijkFout || !recept ? (
            <div>
              <p className="text-base text-muted-foreground">
                {t("Dit recept uitschrijven lukte niet. Probeer het opnieuw.")}
              </p>
              <Button
                onClick={() => bekijk && void openVoorbeeld(bekijk)}
                className="mt-4 h-14 w-full text-base"
              >
                <RefreshCw aria-hidden />
                {t("Opnieuw proberen")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recept.description ? (
                <p className="text-base text-muted-foreground">{t(recept.description)}</p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {recept.servings || 4} {t("personen")} ·{" "}
                {(recept.prep_minutes ?? 0) + (recept.cook_minutes ?? 0)} min
              </p>
              <div>
                <h3 className="text-lg">{t("Ingrediënten")}</h3>
                <ul className="mt-2 space-y-1 text-base">
                  {(recept.ingredients ?? []).map((i, n) => (
                    <li key={n}>
                      {[i.quantity ?? "", i.unit ?? "", i.name].join(" ").replace(/\s+/g, " ").trim()}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-lg">{t("Bereiding")}</h3>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-base">
                  {(recept.instructions ?? []).map((s, n) => (
                    <li key={n}>{t(s)}</li>
                  ))}
                </ol>
              </div>
              <Button
                onClick={() => bekijk && void bewaarSuggestie(bekijk, recept)}
                disabled={bezig !== null}
                className="h-14 w-full text-base"
              >
                <Plus aria-hidden />
                {bezig ? t("Bezig…") : t("Bewaar bij mijn recepten")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function IdeeKaart({
  s,
  t,
  onBekijk,
}: {
  s: InternetSuggestie;
  t: (x: string) => string;
  onBekijk: () => void;
}) {
  const { data: foto } = useQuery({
    queryKey: ["gerecht-foto", s.title],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    retry: false,
    queryFn: () => gerechtFoto({ data: { titel: s.title } }),
  });

  return (
    <li className="w-60 shrink-0 snap-start">
      <button
        type="button"
        onClick={onBekijk}
        className="flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl bg-card text-left shadow-sm ring-1 ring-border/60 transition hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div>
          {foto ? (
            <img src={foto} alt={s.title} className="h-32 w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-32 w-full animate-pulse bg-muted" aria-hidden />
          )}
          <div className="p-4">
            <p className="text-lg font-semibold leading-tight">{t(s.title)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {s.keuken ? `${t(s.keuken)} · ` : ""}
              {s.minuten} min
            </p>
            <p className="mt-2 line-clamp-3 text-base">{t(s.waarom)}</p>
          </div>
        </div>
        <span className="px-4 pb-4 text-base font-medium text-primary">{t("Bekijk recept")}</span>
      </button>
    </li>
  );
}
