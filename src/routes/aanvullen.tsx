/**
 * Slim aanvullen (prototype V2, stroom S1): wat heb je nodig voor je komende
 * maaltijden, min wat je al hebt? Eén tik zet de rest op je lijst.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ListChecks,
  PackageCheck,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LadenRijen } from "@/components/mobiel/Lijst";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { zorgVoorLijst } from "@/lib/boodschappen";
import { toonBelgischeMaat } from "@/lib/ingredienten";
import { berekenAanvulling, korteDag, type Regel } from "@/lib/kringloop";
import { meet } from "@/lib/meten";
import { lokaleDatum } from "@/lib/tijd";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/aanvullen")({
  head: () => ({
    meta: [
      { title: "Slim aanvullen – Foodlo" },
      {
        name: "description",
        content: "Zet in één tik op je lijst wat je nog nodig hebt voor je komende maaltijden.",
      },
    ],
  }),
  component: AanvullenPagina,
});

const DAGEN = 7;

function AanvullenPagina() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const vandaag = lokaleDatum();
  const tot = useMemo(() => {
    const d = new Date(`${vandaag}T12:00:00`);
    d.setDate(d.getDate() + DAGEN - 1);
    return lokaleDatum(d);
  }, [vandaag]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["aanvullen", user?.id, vandaag],
    enabled: !!user,
    queryFn: async () => {
      const uid = user!.id;
      const listId = await zorgVoorLijst(uid);
      const [plan, voorraad, lijst] = await Promise.all([
        supabase
          .from("meal_plan")
          .select("plan_date, recipe_id, personen, custom_title, soort")
          .eq("user_id", uid)
          .is("group_id", null)
          .gte("plan_date", vandaag)
          .lte("plan_date", tot),
        supabase.from("pantry_items").select("naam").eq("user_id", uid),
        supabase.from("shopping_items").select("name, checked").eq("list_id", listId),
      ]);
      if (plan.error) throw plan.error;
      const ids = [
        ...new Set((plan.data ?? []).map((p) => p.recipe_id).filter((x): x is string => !!x)),
      ];
      const [recepten, ingredienten] = ids.length
        ? await Promise.all([
            supabase.from("recipes").select("id, title, servings").in("id", ids),
            supabase
              .from("recipe_ingredients")
              .select("recipe_id, name, quantity, unit")
              .in("recipe_id", ids),
          ])
        : [{ data: [] }, { data: [] }];
      return {
        listId,
        aanvulling: berekenAanvulling({
          plan: plan.data ?? [],
          recepten: recepten.data ?? [],
          ingredienten: ingredienten.data ?? [],
          voorraad: (voorraad.data ?? []).map((v) => v.naam),
          lijst: lijst.data ?? [],
          vanaf: vandaag,
        }),
      };
    },
  });

  // Welke regels gaan mee? Standaard: alles uit "Nog kopen", niets uit "Heb je al".
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [klaar, setKlaar] = useState<number | null>(null);
  const [bezig, setBezig] = useState(false);
  useEffect(() => {
    if (data) setGekozen(new Set(data.aanvulling.kopen.map((r) => r.sleutel)));
  }, [data]);

  function wissel(sleutel: string) {
    setGekozen((oud) => {
      const nieuw = new Set(oud);
      if (nieuw.has(sleutel)) nieuw.delete(sleutel);
      else nieuw.add(sleutel);
      return nieuw;
    });
  }

  async function zetOpLijst() {
    if (!user || !data) return;
    const regels = [...data.aanvulling.kopen, ...data.aanvulling.inHuis].filter((r) =>
      gekozen.has(r.sleutel),
    );
    if (!regels.length) return;
    setBezig(true);
    const { data: rijen, error } = await supabase
      .from("shopping_items")
      .insert(
        regels.map((r) => ({
          user_id: user.id,
          list_id: data.listId,
          name: r.naam,
          quantity: r.quantity,
          unit: r.unit,
          recipe_id: r.recipe_id,
          note: null,
        })),
      )
      .select("id");
    setBezig(false);
    if (error) {
      toast.error("Op je lijst zetten lukte niet. Probeer het opnieuw.");
      return;
    }
    void meet("kringloop.aangevuld", String(regels.length));
    void qc.invalidateQueries({ queryKey: ["shopping"] });
    setKlaar(regels.length);
    const ids = (rijen ?? []).map((r) => r.id as string);
    toast.success(`${regels.length} ${regels.length === 1 ? "ding" : "dingen"} op je lijst`, {
      action: {
        label: "Ongedaan maken",
        onClick: async () => {
          await supabase.from("shopping_items").delete().in("id", ids);
          setKlaar(null);
          void refetch();
        },
      },
    });
  }

  const a = data?.aanvulling;
  const aantal = gekozen.size;

  return (
    <AppShell
      title="Slim aanvullen"
      ondertitel={
        a
          ? `${a.aantalGerechten} ${a.aantalGerechten === 1 ? "gerecht" : "gerechten"} in je komende ${DAGEN} dagen · min wat je al hebt`
          : undefined
      }
    >
      {isLoading ? (
        <LadenRijen aantal={5} label="Je week wordt berekend" />
      ) : isError || !a ? (
        <EmptyState
          icon={<ShoppingCart />}
          title="Dat lukte even niet"
          description="We konden je week niet ophalen."
          action={
            <Button onClick={() => void refetch()} className="w-full">
              Opnieuw proberen
            </Button>
          }
        />
      ) : klaar !== null ? (
        <EmptyState
          icon={<Check />}
          title={`${klaar} ${klaar === 1 ? "ding staat" : "dingen staan"} op je lijst`}
          description="Wat je al in huis hebt, hebben we weggelaten."
          action={
            <Button asChild className="w-full">
              <Link to="/boodschappen">
                <ShoppingCart /> Naar je lijst
              </Link>
            </Button>
          }
        />
      ) : a.aantalGerechten === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Nog niets gepland"
          description="Plan eerst een paar gerechten. Daarna rekenen we uit wat je nodig hebt."
          action={
            <Button asChild className="w-full">
              <Link to="/planner">Plan je week</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-7 pb-28">
          {/* In één oogopslag: drie getallen. */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                n: a.kopen.length,
                label: "nog kopen",
                icoon: ShoppingCart,
                tint: "bg-inkt text-inkt-foreground",
              },
              { n: a.inHuis.length, label: "heb je al", icoon: PackageCheck, tint: "paneel" },
              { n: a.opLijst.length, label: "al op lijst", icoon: ListChecks, tint: "paneel" },
            ].map((t) => (
              <div key={t.label} className={cn("rounded-[1.25rem] p-3 text-center", t.tint)}>
                <t.icoon className="mx-auto size-5 opacity-80" aria-hidden />
                <p className="mt-1 text-3xl font-bold tabular-nums leading-none">{t.n}</p>
                <p className="mt-1 text-[0.9rem] font-semibold leading-tight">{t.label}</p>
              </div>
            ))}
          </div>

          {a.kopen.length === 0 && a.inHuis.length === 0 ? (
            <EmptyState
              icon={<Sparkles />}
              title="Je hebt alles"
              description="Alles voor je komende maaltijden staat al op je lijst. Smakelijk!"
            />
          ) : null}

          <RegelGroep
            id="kopen"
            titel="Nog kopen"
            uitleg="Tik om iets weg te laten."
            regels={a.kopen}
            gekozen={gekozen}
            onWissel={wissel}
            vandaag={vandaag}
          />
          <RegelGroep
            id="in-huis"
            titel="Heb je al in je voorraad"
            uitleg="Toch nodig? Tik om het mee te nemen."
            regels={a.inHuis}
            gekozen={gekozen}
            onWissel={wissel}
            vandaag={vandaag}
          />
          {a.opLijst.length ? (
            <section aria-labelledby="op-lijst-kop">
              <h2
                id="op-lijst-kop"
                className="mb-2 px-1 text-[0.95rem] font-bold text-muted-foreground"
              >
                Staat al op je lijst
              </h2>
              <p className="paneel px-4 py-3 text-base text-muted-foreground">
                {a.opLijst.map((r) => r.naam).join(", ")}
              </p>
            </section>
          ) : null}
          {a.zonderRecept.length ? (
            <p className="rounded-2xl bg-honing-zacht px-4 py-3 text-base text-honing-foreground">
              Zonder recept, dus zelf aanvullen: {a.zonderRecept.join(", ")}
            </p>
          ) : null}

          {/* Eén hoofdactie, altijd binnen bereik. */}
          <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-md lg:bottom-0">
            <div className="mx-auto max-w-3xl">
              <Button
                onClick={() => void zetOpLijst()}
                disabled={!aantal || bezig}
                className="h-16 w-full text-lg"
              >
                <ShoppingCart className="size-6" />
                {aantal
                  ? `Zet ${aantal} ${aantal === 1 ? "ding" : "dingen"} op mijn lijst`
                  : "Niets gekozen"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function RegelGroep({
  id,
  titel,
  uitleg,
  regels,
  gekozen,
  onWissel,
  vandaag,
}: {
  id: string;
  titel: string;
  uitleg: string;
  regels: Regel[];
  gekozen: Set<string>;
  onWissel: (sleutel: string) => void;
  vandaag: string;
}) {
  if (!regels.length) return null;
  return (
    <section aria-labelledby={`${id}-kop`}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 id={`${id}-kop`} className="text-[0.95rem] font-bold text-muted-foreground">
          {titel}
        </h2>
        <p className="text-[0.9rem] text-muted-foreground">{uitleg}</p>
      </div>
      <ul className="paneel divide-y divide-border/80 overflow-hidden" aria-label={titel}>
        {regels.map((r) => {
          const aan = gekozen.has(r.sleutel);
          const maat = toonBelgischeMaat(r.quantity, r.unit);
          const voor = r.voor.map((v) => `${v.titel} (${korteDag(v.dag, vandaag)})`).join(", ");
          return (
            <li key={r.sleutel}>
              <button
                type="button"
                role="checkbox"
                aria-checked={aan}
                onClick={() => onWissel(r.sleutel)}
                className={cn(
                  "flex min-h-[4.25rem] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-muted",
                  !aan && "bg-muted/40",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    aan
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card",
                  )}
                >
                  {aan ? <Check className="size-5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn("block text-lg leading-snug", !aan && "text-muted-foreground")}
                  >
                    {r.naam}
                  </span>
                  <span className="block truncate text-[0.9rem] text-muted-foreground">
                    voor {voor}
                  </span>
                </span>
                {maat ? (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[0.95rem] font-semibold tabular-nums text-muted-foreground">
                    {maat}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
