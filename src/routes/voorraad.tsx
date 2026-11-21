import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChefHat,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  WifiOff,
} from "lucide-react";
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
import { gebruikEerst } from "@/lib/intelligentie/gebruik-eerst";
import { merkVoorraadGebruik, useVoorraadBijhouden } from "@/lib/intelligentie/voorraad-modus";
import { useSlimmeVoorstellen } from "@/lib/intelligentie/slim";
import { NA_WINKELEN_LABEL, useNaWinkelen } from "@/lib/intelligentie/na-winkelen";
import { opsomming } from "@/lib/vandaag";
import { RestjesLijst } from "@/components/kringloop/RestjesLijst";
import { vindDubbels, voegToeAlsNieuw, zorgVoorLijst } from "@/lib/boodschappen";
import type { Recipe } from "@/lib/types";
import { useOnline } from "@/hooks/useOnline";
import {
  EENHEDEN,
  EENHEID_LABEL,
  PLEKKEN,
  PLEK_LABEL,
  bewaarPlek,
  eenheidKeuze,
  isBijnaOp,
  leesHoeveelheid,
  leesPlekken,
  plekVan,
  zoekVoorraad,
  type Plek,
} from "@/lib/voorraad-plek";

export const Route = createFileRoute("/voorraad")({
  head: () => ({
    meta: [
      { title: "Voorraad – Foodlo" },
      {
        name: "description",
        content:
          "Houd bij wat je thuis hebt staan, zodat je nooit dubbel koopt en meteen ziet wat je nog nodig hebt.",
      },
      { property: "og:title", content: "Voorraad – Foodlo" },
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
  created_at?: string | null;
  updated_at?: string | null;
  /** Na voorstel 0020; anders op dit toestel of een gok op basis van de naam. */
  plek?: string | null;
};

/** Kolom bestaat (nog) niet (Postgres 42703, PostgREST PGRST204). */
function isOntbrekendeKolom(fout: { code?: string; message?: string } | null): boolean {
  if (!fout) return false;
  return (
    fout.code === "42703" ||
    fout.code === "PGRST204" ||
    /column .* does not exist|could not find the '.*' column/i.test(fout.message ?? "")
  );
}

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
  const [zoek, setZoek] = useState("");
  const [bewerk, setBewerk] = useState<string | null>(null);
  const [plekken, setPlekken] = useState<Record<string, Plek>>({});
  const online = useOnline();
  useEffect(() => setPlekken(leesPlekken(user?.id)), [user?.id]);

  useEffect(() => {
    void meet("voorraad.bekeken");
  }, []);

  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["voorraad", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // "*": ook `plek` en `houdbaar_tot` als die kolommen er (na een migratie) zijn.
      const { data, error } = await supabase
        .from("pantry_items")
        .select("*")
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
  // Minder verspilling: verse producten die al even in huis zijn (datum van aankoop of toevoegen).
  // Alleen als je je voorraad bijhoudt: anders weet Foodlo niet of het er nog is.
  const [bijgehouden, zetBijgehouden] = useVoorraadBijhouden();
  const oudInHuis = useMemo(
    () => (bijgehouden ? gebruikEerst(items, Date.now(), 50) : []),
    [items, bijgehouden],
  );
  const oudPerNaam = useMemo(() => new Map(oudInHuis.map((o) => [o.naam, o.dagen])), [oudInHuis]);
  const [slim] = useSlimmeVoorstellen();
  const [naWinkelenKeuze, zetNaWinkelenKeuze] = useNaWinkelen();
  // Fase 3: per plek (koelkast, diepvries, kast), met zoeken.
  const gevonden = useMemo(() => zoekVoorraad(items, zoek), [items, zoek]);
  const perPlek = useMemo(() => {
    const per = new Map<Plek, Item[]>();
    for (const item of gevonden) {
      const p = plekVan(item, plekken);
      per.set(p, [...(per.get(p) ?? []), item]);
    }
    return PLEKKEN.filter((p) => per.has(p)).map((p) => ({
      id: p,
      label: PLEK_LABEL[p],
      lijst: per.get(p)!,
    }));
  }, [gevonden, plekken]);
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
    const lijst = watKanIkKoken(
      veilig.map((r) => ({ id: r.id, title: r.title, ingredienten: perRecept.get(r.id) ?? [] })),
      voorraadNamen,
      { minAanwezig: 1, max: 6 },
    );
    if (!slim || !oudInHuis.length) return lijst;
    // Wat iets opmaakt dat al even in huis is, komt eerst (verder dezelfde volgorde).
    const oudeNamen = oudInHuis.slice(0, 3).map((o) => o.naam);
    const maaktOp = (m: (typeof lijst)[number]) =>
      m.aanwezig.some((n) => zitInVoorraad(n, oudeNamen)) ? 0 : 1;
    return [...lijst].sort((a, b) => maaktOp(a) - maaktOp(b));
  }, [recepten, ingredienten, voorraadNamen, user?.id, slim, oudInHuis]);

  // Voorraad telt mee in Vandaag en Slim aanvullen: die mee verversen (anders tot 20 s verouderd).
  const vernieuw = () => {
    void qc.invalidateQueries({ queryKey: ["voorraad", user?.id] });
    void qc.invalidateQueries({ queryKey: ["aanvulling"] });
    void qc.invalidateQueries({ queryKey: ["home-dagmenu"] });
  };

  const offlineMelding = () => {
    toast(t("Je bent offline. Aanpassen kan zodra je weer verbinding hebt."));
  };

  /** Hoeveelheid, eenheid en plek bewaren (met ongedaan maken). */
  const bewaarAanpassing = async (
    item: Item,
    v: { hoeveelheid: number | null; eenheid: string; plek: Plek },
  ) => {
    if (!user) return;
    if (!online) return offlineMelding();
    merkVoorraadGebruik(user.id);
    const vorig = {
      hoeveelheid: item.hoeveelheid,
      eenheid: item.eenheid,
      plek: plekVan(item, plekken),
    };
    const { error } = await supabase
      .from("pantry_items")
      .update({ hoeveelheid: v.hoeveelheid, eenheid: v.eenheid })
      .eq("id", item.id);
    if (error) {
      toast.error(t("Aanpassen lukte niet."));
      return;
    }
    await zetPlek(item, v.plek);
    setBewerk(null);
    vernieuw();
    toast.success(`${item.naam} ${t("aangepast")}`, {
      action: {
        label: t("Ongedaan maken"),
        onClick: async () => {
          await supabase
            .from("pantry_items")
            .update({ hoeveelheid: vorig.hoeveelheid, eenheid: vorig.eenheid })
            .eq("id", item.id);
          await zetPlek(item, vorig.plek);
          vernieuw();
        },
      },
    });
  };

  /** Plek op het account (kolom `plek`, voorstel 0020) of anders op dit toestel. */
  const zetPlek = async (item: Item, plek: Plek) => {
    if (!user || plekVan(item, plekken) === plek) return;
    const { error } = await supabase
      .from("pantry_items")
      .update({ plek } as never)
      .eq("id", item.id);
    if (!error) {
      qc.setQueryData(["voorraad", user.id], (oud: Item[] | undefined) =>
        oud?.map((i) => (i.id === item.id ? { ...i, plek } : i)),
      );
      return;
    }
    if (!isOntbrekendeKolom(error)) throw error;
    bewaarPlek(user.id, item.id, plek);
    setPlekken(leesPlekken(user.id));
  };

  /** "Bijna op": één tik zet het op je lijst (niet dubbel), met ongedaan maken. */
  const zetOpLijst = async (item: Item) => {
    if (!user) return;
    if (!online) return offlineMelding();
    setBezigMet(item.id);
    try {
      const listId = await zorgVoorLijst(user.id);
      const dubbel = await vindDubbels(listId, [{ name: item.naam, quantity: null, unit: "" }]);
      if (dubbel.length) {
        toast(`${item.naam} ${t("staat al op je lijst")}`);
        return;
      }
      const { data, error } = await supabase
        .from("shopping_items")
        .insert({ user_id: user.id, list_id: listId, name: item.naam, quantity: null, unit: "" })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("geen id");
      void meet("voorraad.bijna_op_lijst");
      void qc.invalidateQueries({ queryKey: ["shopping"] });
      toast.success(`${item.naam} ${t("staat op je lijst")}`, {
        action: {
          label: t("Ongedaan maken"),
          onClick: async () => {
            await supabase.from("shopping_items").delete().eq("id", data.id);
            void qc.invalidateQueries({ queryKey: ["shopping"] });
          },
        },
      });
    } catch {
      toast.error(t("Op je lijst zetten lukte niet. Probeer het opnieuw."));
    } finally {
      setBezigMet(null);
    }
  };

  const voegToe = async (regel = nieuw.trim()) => {
    if (!regel || !user) return;
    if (!online) return offlineMelding();
    merkVoorraadGebruik(user.id);
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
    if (!online) return offlineMelding();
    if (user) merkVoorraadGebruik(user.id);
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
            // Terugzetten = hoe het was, ook "sinds wanneer in huis".
            ...(item.created_at ? { created_at: item.created_at } : {}),
            ...(item.updated_at ? { updated_at: item.updated_at } : {}),
          });
          vernieuw();
        },
      },
    });
  };

  // Hoeveelheid met één tik aanpassen; naar nul = uit de voorraad (met ongedaan maken).
  const wijzigAantal = async (item: Item, richting: 1 | -1) => {
    if (!online) return offlineMelding();
    if (user) merkVoorraadGebruik(user.id);
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
    // Meer = bijgekocht: "in huis sinds" begint opnieuw. Minder (opgebruikt) laat de datum staan.
    const { error } = await supabase
      .from("pantry_items")
      .update(
        richting > 0
          ? { hoeveelheid: volgende, updated_at: new Date().toISOString() }
          : { hoeveelheid: volgende },
      )
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
      title={t("Voorraad")}
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

          <div className="mt-3 rounded-2xl bg-muted px-4 py-3 text-base">
            <p>
              {bijgehouden
                ? t(
                    "Je houdt je voorraad bij. Foodlo gebruikt ze voor voorstellen en Gebruik eerst.",
                  )
                : t(
                    "Je voorraad bijhouden is niet nodig. Foodlo gebruikt ze nu niet voor voorstellen, en gaat er niet van uit dat iets nog in huis is.",
                  )}
            </p>
            <button
              type="button"
              onClick={() => zetBijgehouden(!bijgehouden)}
              className="mt-1 inline-flex min-h-12 items-center text-base font-semibold underline underline-offset-4"
            >
              {bijgehouden ? t("Ik houd mijn voorraad niet bij") : t("Ik houd mijn voorraad bij")}
            </button>
            <fieldset className="mt-2">
              <legend className="font-semibold">{t("Na het winkelen")}</legend>
              <div className="mt-1 flex flex-col gap-1">
                {(["altijd", "vragen", "nooit"] as const).map((k) => (
                  <label key={k} className="flex min-h-12 cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="na-winkelen"
                      value={k}
                      checked={naWinkelenKeuze === k}
                      onChange={() => zetNaWinkelenKeuze(k)}
                      className="size-6 accent-[var(--primary)]"
                    />
                    <span>{t(NA_WINKELEN_LABEL[k])}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

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
              placeholder={t("Wat heb je?")}
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

          {!online ? (
            <p
              role="status"
              className="mt-4 flex items-start gap-2 rounded-2xl bg-muted px-4 py-3 text-base"
            >
              <WifiOff className="mt-0.5 size-5 shrink-0" aria-hidden />
              {t(
                "Je bent offline. Je ziet je voorraad van daarnet; aanpassen kan zodra je weer verbinding hebt.",
              )}
            </p>
          ) : null}

          {items.length ? (
            <div className="mt-4">
              <label htmlFor="voorraad-zoek" className="text-base font-semibold">
                {t("Zoek in je voorraad")}
              </label>
              <div className="relative mt-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="voorraad-zoek"
                  type="search"
                  value={zoek}
                  onChange={(e) => setZoek(e.target.value)}
                  placeholder={t("Bijvoorbeeld: kaas")}
                  className="h-14 pl-10 text-lg"
                />
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="mt-6">
              <PageSkeleton rows={2} />
            </div>
          ) : isError ? (
            <div role="alert" className="mt-6 rounded-2xl bg-muted px-4 py-4 text-base">
              <p className="font-semibold">{t("Je voorraad laden lukte niet.")}</p>
              <p className="text-muted-foreground">
                {t("Er is niets verloren. Controleer je verbinding en probeer opnieuw.")}
              </p>
              <Button variant="outline" className="mt-3 h-12" onClick={() => void refetch()}>
                {t("Opnieuw proberen")}
              </Button>
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
          ) : !gevonden.length ? (
            <p role="status" className="mt-6 rounded-2xl bg-muted px-4 py-3 text-base">
              {t("Niets gevonden voor")} "{zoek.trim()}".{" "}
              <button
                type="button"
                onClick={() => setZoek("")}
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
              >
                {t("Toon alles")}
              </button>
            </p>
          ) : (
            <ul className="mt-6 space-y-5" aria-label={t("In huis")}>
              {perPlek.map((g) => (
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
                    {g.lijst.map((item) => {
                      const bijnaOp = isBijnaOp(item);
                      return (
                        <li key={item.id} className="py-2 pl-4 pr-1">
                          <div className="flex min-h-[3.25rem] flex-wrap items-center gap-x-2 gap-y-1">
                            {/* Bij grote tekst schuiven de knoppen naar een tweede regel,
                                zodat de productnaam nooit afgekapt wordt (review punt 1). */}
                            <span className="min-w-0 flex-1 basis-40">
                              <span className="block hyphens-auto break-words text-lg font-semibold leading-snug">
                                {item.naam}
                              </span>
                              <span className="block text-[0.95rem] tabular-nums text-muted-foreground">
                                {item.hoeveelheid
                                  ? toonBelgischeMaat(item.hoeveelheid, item.eenheid)
                                  : t("in huis")}
                                {bijnaOp ? (
                                  <span className="ml-2 font-semibold text-[oklch(0.42_0.1_55)] dark:text-[oklch(0.85_0.09_75)]">
                                    · {t("Bijna op")}
                                  </span>
                                ) : null}
                              </span>
                              {oudPerNaam.has(item.naam) ? (
                                <span className="block text-[0.95rem] font-semibold text-[oklch(0.42_0.1_55)] dark:text-[oklch(0.85_0.09_75)]">
                                  {t("Al")} {oudPerNaam.get(item.naam)}{" "}
                                  {oudPerNaam.get(item.naam) === 1
                                    ? t("dag in huis")
                                    : t("dagen in huis")}
                                </span>
                              ) : null}
                            </span>
                            <span className="ml-auto flex shrink-0 items-center rounded-full bg-muted p-0.5">
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
                              onClick={() => setBewerk(bewerk === item.id ? null : item.id)}
                              aria-expanded={bewerk === item.id}
                              aria-label={`${t("Aanpassen")}: ${item.naam}`}
                              className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="size-5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => void verwijder(item)}
                              aria-label={`${t("Verwijderen")}: ${item.naam}`}
                              className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                            >
                              <Trash2 className="size-5" aria-hidden />
                            </button>
                          </div>
                          {bijnaOp ? (
                            <Button
                              variant="secondary"
                              onClick={() => void zetOpLijst(item)}
                              disabled={bezigMet === item.id}
                              aria-label={`${item.naam} ${t("op mijn lijst")}`}
                              className="mt-1 h-12 text-base"
                            >
                              <ShoppingCart className="size-5" aria-hidden />
                              {t("Op mijn lijst")}
                            </Button>
                          ) : null}
                          {bewerk === item.id ? (
                            <AanpasVak
                              item={item}
                              plek={plekVan(item, plekken)}
                              onBewaar={(v) => void bewaarAanpassing(item, v)}
                              onAnnuleer={() => setBewerk(null)}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <RestjesLijst />

        <section aria-labelledby="koken-titel" className="min-w-0">
          <h2 id="koken-titel" className="text-sectietitel">
            {t("Wat kan ik koken?")}
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            {t("Je eigen recepten. Bovenaan: waarvoor je het minst hoeft te kopen.")}
          </p>
          {slim && oudInHuis.length ? (
            <p
              role="note"
              aria-label={t("Gebruik eerst")}
              className="mt-3 rounded-2xl bg-[oklch(0.95_0.04_70)] px-4 py-3 text-base text-[oklch(0.32_0.07_60)] dark:bg-[oklch(0.3_0.05_70)] dark:text-[oklch(0.93_0.04_80)]"
            >
              <span className="font-semibold">{t("Gebruik eerst")}:</span>{" "}
              {opsomming(
                oudInHuis.slice(0, 3).map((o) => o.naam),
                3,
              )}
              . {t("Dat is al even in huis. Recepten die het opmaken, staan bovenaan.")}
            </p>
          ) : null}
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

/** Hoeveelheid, eenheid en plek aanpassen voor één product. */
function AanpasVak({
  item,
  plek,
  onBewaar,
  onAnnuleer,
}: {
  item: Item;
  plek: Plek;
  onBewaar: (v: { hoeveelheid: number | null; eenheid: string; plek: Plek }) => void;
  onAnnuleer: () => void;
}) {
  const t = useT();
  const [hoeveel, setHoeveel] = useState(
    item.hoeveelheid != null ? String(item.hoeveelheid).replace(".", ",") : "",
  );
  const [eenheid, setEenheid] = useState<string>(eenheidKeuze(item.eenheid));
  const [waar, setWaar] = useState<Plek>(plek);
  const id = `aanpas-${item.id}`;
  const fout = hoeveel.trim() !== "" && leesHoeveelheid(hoeveel) === null;
  return (
    <form
      aria-label={`${t("Aanpassen")}: ${item.naam}`}
      className="mt-2 mr-3 grid gap-3 rounded-2xl bg-muted p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (fout) return;
        onBewaar({
          hoeveelheid: hoeveel.trim() ? leesHoeveelheid(hoeveel) : null,
          eenheid,
          plek: waar,
        });
      }}
    >
      <div className="flex flex-wrap gap-3">
        <div className="min-w-0 flex-1 basis-28">
          <label htmlFor={`${id}-hoeveel`} className="block text-base font-semibold">
            {t("Hoeveelheid")}
          </label>
          <Input
            id={`${id}-hoeveel`}
            inputMode="decimal"
            value={hoeveel}
            onChange={(e) => setHoeveel(e.target.value)}
            aria-invalid={fout}
            aria-describedby={fout ? `${id}-fout` : undefined}
            className="mt-1 h-14 text-lg"
          />
        </div>
        <div className="min-w-0 flex-1 basis-32">
          <label htmlFor={`${id}-eenheid`} className="block text-base font-semibold">
            {t("Eenheid")}
          </label>
          <select
            id={`${id}-eenheid`}
            value={eenheid}
            onChange={(e) => setEenheid(e.target.value)}
            className="mt-1 h-14 w-full rounded-xl border border-input bg-background px-3 text-lg"
          >
            {EENHEDEN.map((e) => (
              <option key={e} value={e}>
                {t(EENHEID_LABEL[e])}
              </option>
            ))}
          </select>
        </div>
      </div>
      {fout ? (
        <p id={`${id}-fout`} className="text-base font-semibold text-destructive">
          {t("Typ een getal groter dan 0, bijvoorbeeld 1,5 of 250.")}
        </p>
      ) : null}
      <fieldset>
        <legend className="text-base font-semibold">{t("Waar staat het?")}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {PLEKKEN.map((p) => (
            <label
              key={p}
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 text-base has-[:checked]:border-primary has-[:checked]:font-semibold"
            >
              <input
                type="radio"
                name={`${id}-plek`}
                value={p}
                checked={waar === p}
                onChange={() => setWaar(p)}
                className="size-5 accent-[var(--primary)]"
              />
              {t(PLEK_LABEL[p])}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-14 flex-1 text-base">
          {t("Bewaren")}
        </Button>
        <Button type="button" variant="ghost" className="h-14 text-base" onClick={onAnnuleer}>
          {t("Annuleren")}
        </Button>
      </div>
    </form>
  );
}
