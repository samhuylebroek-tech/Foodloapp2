import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChefHat, Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { KeukenWissel } from "@/components/KeukenWissel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipePhoto } from "@/components/RecipePhoto";
import { useT } from "@/lib/voorkeuren";
import { meet } from "@/lib/meten";
import { parseIngredientLine, toonBelgischeMaat } from "@/lib/ingredienten";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { watKanIkKoken, zitInVoorraad } from "@/lib/voorraad-match";
import { leesKennismaking } from "@/lib/kennismaking";
import { magVoorstellen } from "@/lib/veiligheid";
import { vindDubbels, voegToeAlsNieuw, zorgVoorLijst } from "@/lib/boodschappen";
import type { Recipe } from "@/lib/types";
import { CATEGORIE_LABEL, CATEGORIE_VOLGORDE, categorieVan } from "@/lib/categorie";

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

type Ing = { recipe_id: string; name: string; quantity: number | null; unit: string };

/** Snel toevoegen: wat veel mensen standaard in huis hebben. */
const SNEL = [
  "bloem",
  "eieren",
  "melk",
  "boter",
  "rijst",
  "pasta",
  "uien",
  "look",
  "tomaten",
  "kaas",
];

/** Hoeveel één tik op + of − verandert, afhankelijk van de eenheid. */
function stapVoor(eenheid: string | null | undefined) {
  const e = (eenheid ?? "").trim().toLowerCase();
  if (e === "g" || e === "ml") return 100;
  if (e === "cl") return 10;
  if (e === "kg" || e === "l") return 0.5;
  return 1;
}

function VoorraadPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const t = useT();
  const [nieuw, setNieuw] = useState("");
  const [bezigMet, setBezigMet] = useState<string | null>(null);

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

  // Eigen recepten met ingrediënten, voor "Wat kan ik koken?".
  const { data: recepten = [] } = useQuery({
    queryKey: ["voorraad-recepten", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, title, image_url, category, tags")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .eq("is_concept", false)
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Pick<Recipe, "id" | "title" | "image_url" | "category" | "tags">[];
    },
  });
  const ids = recepten.map((r) => r.id);
  const { data: ingredienten = [] } = useQuery({
    queryKey: ["voorraad-ingredienten", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const uit: Ing[] = [];
      // In blokken, zodat de URL nooit te lang wordt.
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase
          .from("recipe_ingredients")
          .select("recipe_id, name, quantity, unit")
          .in("recipe_id", ids.slice(i, i + 100));
        if (error) throw error;
        uit.push(...((data ?? []) as Ing[]));
      }
      return uit;
    },
  });

  const voorraadNamen = useMemo(() => items.map((i) => i.naam), [items]);
  // Mobiel-eerst: voorraad per afdeling (zelfde indeling als de boodschappenlijst).
  const perAfdeling = useMemo(() => {
    const per = new Map<string, typeof items>();
    for (const item of items) {
      const c = categorieVan(item.naam, {});
      per.set(c, [...(per.get(c) ?? []), item]);
    }
    return CATEGORIE_VOLGORDE.filter((c) => per.has(c)).map((c) => ({
      id: c,
      label: c === "voorraadkast" ? "Kast en houdbaar" : CATEGORIE_LABEL[c],
      lijst: per.get(c)!,
    }));
  }, [items]);
  const suggesties = useMemo(() => {
    const perRecept = new Map<string, { name: string }[]>();
    for (const ing of ingredienten) {
      const lijst = perRecept.get(ing.recipe_id) ?? [];
      lijst.push({ name: ing.name });
      perRecept.set(ing.recipe_id, lijst);
    }
    // Zelfde harde regel als Vandaag en Week: nooit een gekozen allergeen of iets buiten je dieet,
    // en met allergieën nooit een recept zonder ingrediënten (dat kan Foodlo niet nakijken).
    const kennis = leesKennismaking(user?.id);
    const veilig = recepten.filter((r) =>
      magVoorstellen(
        {
          title: r.title,
          tags: r.tags ?? [],
          ingredienten: (perRecept.get(r.id) ?? []).map((i) => i.name),
        },
        { allergieen: kennis.allergieen, dieet: kennis.dieet },
      ),
    );
    return watKanIkKoken(
      veilig.map((r) => ({ id: r.id, title: r.title, ingredienten: perRecept.get(r.id) ?? [] })),
      voorraadNamen,
      { minAanwezig: 1, max: 6 },
    );
  }, [recepten, ingredienten, voorraadNamen, user?.id]);

  // Voorraad telt mee in Vandaag en Slim aanvullen: die mee verversen (anders tot 20 s verouderd).
  const vernieuw = () => {
    void qc.invalidateQueries({ queryKey: ["voorraad", user?.id] });
    void qc.invalidateQueries({ queryKey: ["aanvulling"] });
    void qc.invalidateQueries({ queryKey: ["home-dagmenu"] });
  };

  const voegToe = async (regel = nieuw.trim()) => {
    if (!regel || !user) return;
    // BUG-101: "-5 kg rijst" werd stil 5 kg. Een minteken tegen een getal is geen opsomming.
    if (/^-\d/.test(regel)) {
      toast.error(t("Een hoeveelheid kan niet negatief zijn. Typ bijvoorbeeld: 5 kg rijst."));
      return;
    }
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
    if (regel === nieuw.trim()) setNieuw("");
    vernieuw();
  };

  const verwijder = async (item: Item) => {
    const { error } = await supabase.from("pantry_items").delete().eq("id", item.id);
    if (error) {
      toast.error(t("Verwijderen lukte niet."));
      return;
    }
    vernieuw();
    // Vergissing hersteld met één tik.
    toast(`${item.naam} ${t("is weg uit je voorraad")}`, {
      action: {
        label: t("Ongedaan maken"),
        onClick: async () => {
          if (!user) return;
          await supabase.from("pantry_items").insert({
            user_id: user.id,
            naam: item.naam,
            hoeveelheid: item.hoeveelheid,
            eenheid: item.eenheid,
          });
          vernieuw();
        },
      },
    });
  };

  // Hoeveelheid met één tik aanpassen; naar nul = uit de voorraad (met ongedaan maken).
  const wijzigAantal = async (item: Item, richting: 1 | -1) => {
    const stap = stapVoor(item.eenheid);
    const huidig = item.hoeveelheid ?? 1;
    const volgende = Math.round((huidig + richting * stap) * 100) / 100;
    if (volgende <= 0) {
      await verwijder(item);
      return;
    }
    qc.setQueryData(["voorraad", user?.id], (oud: Item[] | undefined) =>
      oud?.map((i) => (i.id === item.id ? { ...i, hoeveelheid: volgende } : i)),
    );
    const { error } = await supabase
      .from("pantry_items")
      .update({ hoeveelheid: volgende })
      .eq("id", item.id);
    if (error) toast.error(t("Aanpassen lukte niet."));
    vernieuw();
  };

  const zetOntbrekendeOpLijst = async (receptId: string, ontbreekt: string[]) => {
    if (!user) return;
    setBezigMet(receptId);
    try {
      const listId = await zorgVoorLijst(user.id);
      const rijen = ingredienten
        .filter((i) => i.recipe_id === receptId && ontbreekt.includes(i.name.trim()))
        .map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, recipe_id: receptId }));
      // Wat al (nog te kopen) op de lijst staat, zetten we er niet nog eens op.
      const dubbels = new Set((await vindDubbels(listId, rijen)).map((d) => d.index));
      const nieuwe = rijen.filter((_, i) => !dubbels.has(i));
      await voegToeAlsNieuw(user.id, listId, nieuwe);
      void qc.invalidateQueries({ queryKey: ["shopping"] });
      void qc.invalidateQueries({ queryKey: ["aanvulling"] });
      void qc.invalidateQueries({ queryKey: ["home-dagmenu"] });
      toast.success(
        nieuwe.length
          ? `${nieuwe.length} ${t(nieuwe.length === 1 ? "ding op je lijst gezet" : "dingen op je lijst gezet")}${
              dubbels.size ? `, ${dubbels.size} ${t("stond(en) er al")}` : ""
            }`
          : t("Alles stond al op je lijst."),
      );
    } catch {
      toast.error(t("Op je lijst zetten lukte niet. Probeer het opnieuw."));
    } finally {
      setBezigMet(null);
    }
  };

  const snelKeuzes = SNEL.filter((s) => !zitInVoorraad(s, voorraadNamen));

  return (
    <AppShell
      breed
      title={t("Voorraadkast")}
      ondertitel={t("Wat heb je al in huis? Dan zie je meteen wat je ermee kan koken.")}
    >
      <div className="mb-8 max-w-md">
        <KeukenWissel />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-8 lg:gap-12">
        <section aria-labelledby="in-huis-titel" className="min-w-0">
          <h2 id="in-huis-titel" className="text-sectietitel">
            {t("In huis")}
            {items.length ? (
              <span className="ml-2 font-sans text-base font-medium text-muted-foreground">
                ({items.length})
              </span>
            ) : null}
          </h2>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void voegToe();
            }}
          >
            <Input
              value={nieuw}
              onChange={(e) => setNieuw(e.target.value)}
              aria-label={t("Nieuw product")}
              aria-describedby="voorraad-hulp"
              placeholder={t("Wat heb je in huis?")}
              className="h-14 text-lg"
            />
            <Button type="submit" className="size-14 shrink-0 px-0 text-lg sm:w-auto sm:px-5">
              <Plus className="size-6" aria-hidden />
              {/* Op de telefoon alleen het plusteken; de naam blijft voor schermlezers. */}
              <span className="sr-only sm:not-sr-only">{t("Toevoegen")}</span>
            </Button>
          </form>
          <p id="voorraad-hulp" className="mt-1 text-[0.9rem] text-muted-foreground">
            {t("Bijvoorbeeld: 500 g bloem of 6 eieren")}
          </p>

          {snelKeuzes.length ? (
            <div className="mt-4">
              <p className="text-base font-semibold">{t("Snel toevoegen")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {snelKeuzes.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => void voegToe(s)}
                      aria-label={`${t(s)} ${t("toevoegen")}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-secondary px-4 text-base font-medium text-secondary-foreground transition-colors hover:bg-secondary/70"
                    >
                      <Plus className="size-4" aria-hidden />
                      {t(s)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {isLoading ? (
            <div className="mt-6">
              <PageSkeleton rows={2} />
            </div>
          ) : items.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title={t("Je voorraadkast is nog leeg")}
                description={t(
                  "Voeg toe wat je in huis hebt. Dan tonen we welke recepten je meteen kan maken.",
                )}
              />
            </div>
          ) : (
            <ul className="mt-6 space-y-5" aria-label={t("In huis")}>
              {perAfdeling.map((g) => (
                <li key={g.id}>
                  <h3
                    id={`voorraad-${g.id}`}
                    className="mb-2 px-1 text-[0.95rem] font-bold text-muted-foreground"
                  >
                    {t(g.label)} · {g.lijst.length}
                  </h3>
                  <ul
                    className="paneel divide-y divide-border/80 overflow-hidden"
                    aria-label={t(g.label)}
                  >
                    {g.lijst.map((item) => (
                      <li
                        key={item.id}
                        className="flex min-h-[4.25rem] items-center gap-2 py-2 pl-4 pr-1"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-lg font-semibold leading-snug">
                            {item.naam}
                          </span>
                          <span className="block text-[0.95rem] tabular-nums text-muted-foreground">
                            {item.hoeveelheid
                              ? toonBelgischeMaat(item.hoeveelheid, item.eenheid)
                              : t("in huis")}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center rounded-full bg-muted p-0.5">
                          <button
                            type="button"
                            onClick={() => void wijzigAantal(item, -1)}
                            aria-label={`${t("Minder")}: ${item.naam}`}
                            className="flex size-11 items-center justify-center rounded-full hover:bg-card active:bg-card"
                          >
                            <Minus className="size-5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => void wijzigAantal(item, 1)}
                            aria-label={`${t("Meer")}: ${item.naam}`}
                            className="flex size-11 items-center justify-center rounded-full hover:bg-card active:bg-card"
                          >
                            <Plus className="size-5" aria-hidden />
                          </button>
                        </span>
                        <button
                          type="button"
                          onClick={() => void verwijder(item)}
                          aria-label={`${t("Verwijderen")}: ${item.naam}`}
                          className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <Trash2 className="size-5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="koken-titel" className="min-w-0">
          <h2 id="koken-titel" className="text-sectietitel">
            {t("Wat kan ik koken?")}
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            {t("Je eigen recepten. Bovenaan: waarvoor je het minst hoeft te kopen.")}
          </p>
          {!items.length ? (
            <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-base text-muted-foreground">
              {t("Voeg eerst iets toe aan je voorraad.")}
            </p>
          ) : !suggesties.length ? (
            <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-base text-muted-foreground">
              {t("Geen van je recepten gebruikt wat je nu in huis hebt.")}
            </p>
          ) : (
            <ul className="mt-4 space-y-3" aria-label={t("Recepten met wat je in huis hebt")}>
              {suggesties.map((m) => {
                const recept = recepten.find((r) => r.id === m.id);
                return (
                  <li key={m.id} className="overflow-hidden rounded-2xl bg-card shadow-zacht">
                    <Link
                      to="/recepten/$id"
                      params={{ id: m.id }}
                      className="flex items-center gap-3 p-3 hover:bg-muted/40"
                    >
                      <RecipePhoto
                        path={recept?.image_url ?? null}
                        alt=""
                        recept={recept ?? { title: m.title }}
                        className="size-16 shrink-0 rounded-xl"
                        icoonClassName="size-8"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-kaarttitel">{t(m.title)}</span>
                        <span className="mt-0.5 block text-base font-medium text-primary">
                          {m.ontbreekt.length === 0
                            ? t("Je hebt alles in huis")
                            : `${t("Je hebt")} ${m.aanwezig.length} ${t("van de")} ${m.totaal}`}
                        </span>
                      </span>
                      <ChefHat className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                    {m.ontbreekt.length ? (
                      <div className="border-t border-border/70 px-3 py-3">
                        <p className="text-base">
                          <span className="font-semibold">{t("Nog nodig")}: </span>
                          <span className="text-muted-foreground">{m.ontbreekt.join(", ")}</span>
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() => void zetOntbrekendeOpLijst(m.id, m.ontbreekt)}
                          disabled={bezigMet === m.id}
                          className="mt-2 h-12 w-full text-base sm:w-auto"
                        >
                          {bezigMet === m.id ? (
                            <Loader2 className="size-5 animate-spin" aria-hidden />
                          ) : (
                            <ShoppingCart className="size-5" aria-hidden />
                          )}
                          {t("Ontbrekende op mijn lijst")}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
