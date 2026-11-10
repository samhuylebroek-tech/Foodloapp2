/**
 * Slim aanvullen (V2, stroom S1): wat ontbreekt er voor je komende maaltijden?
 * Foodlo rekent: porties, overlappende ingrediënten, wat in huis is, wat al op
 * de lijst staat. Jij tikt één keer. Weglaten of toch meenemen = één tik.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Loader2, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LadenRijen } from "@/components/mobiel/Lijst";
import { Button } from "@/components/ui/button";
import { useAanvulling } from "@/hooks/useAanvulling";
import { CATEGORIE_LABEL, CATEGORIE_VOLGORDE } from "@/lib/categorie";
import { toonBelgischeMaat } from "@/lib/ingredienten";
import { KOMENDE_DAGEN } from "@/lib/kringloop-db";
import { type Regel } from "@/lib/kringloop";
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

function kortVoor(r: Regel) {
  const eerste = r.voor[0]?.titel ?? "";
  return r.voor.length > 1 ? `${eerste} +${r.voor.length - 1}` : eerste;
}

function AanvullenPagina() {
  const { data, isLoading, isError, refetch, zetOpLijst, haalWeg } = useAanvulling();
  const a = data?.aanvulling;

  // Standaard alles wat ontbreekt; "heb je al" alleen als je het zelf aantikt.
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState<number | null>(null);
  const sleutels = a?.kopen.map((r) => r.sleutel).join(",");
  useEffect(() => {
    if (a) setGekozen(new Set(a.kopen.map((r) => r.sleutel)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutels]);

  const perAfdeling = useMemo(() => {
    const groepen = new Map<string, Regel[]>();
    for (const r of a?.kopen ?? [])
      groepen.set(r.categorie, [...(groepen.get(r.categorie) ?? []), r]);
    return CATEGORIE_VOLGORDE.filter((c) => groepen.has(c)).map((c) => ({
      id: c,
      regels: groepen.get(c)!,
    }));
  }, [a]);

  function wissel(sleutel: string) {
    setGekozen((oud) => {
      const nieuw = new Set(oud);
      if (nieuw.has(sleutel)) nieuw.delete(sleutel);
      else nieuw.add(sleutel);
      return nieuw;
    });
  }

  const aantal = gekozen.size;

  return (
    <AppShell
      title="Slim aanvullen"
      ondertitel={`Voor je komende ${KOMENDE_DAGEN} dagen. Wat je al hebt, laten we weg.`}
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
          description="Foodlo hield rekening met wat je al hebt."
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
          description="Plan een paar gerechten. Dan rekent Foodlo uit wat je nodig hebt."
          action={
            <Button asChild className="w-full">
              <Link to="/planner">Plan je week</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-7 pb-28">
          {a.nietMeerNodig.length ? (
            <div className="paneel flex items-center gap-3 p-4">
              <p className="min-w-0 flex-1 text-base">
                <strong>{a.nietMeerNodig.length}</strong> op je lijst: gerecht niet meer gepland
              </p>
              <Button
                variant="zacht"
                size="sm"
                onClick={() => void haalWeg(a.nietMeerNodig.map((n) => n.id))}
              >
                Haal weg
              </Button>
            </div>
          ) : null}

          {a.kopen.length === 0 ? (
            <EmptyState
              icon={<Sparkles />}
              title="Je hebt alles"
              description="Alles voor je komende maaltijden is in huis of staat op je lijst."
            />
          ) : (
            perAfdeling.map((g) => (
              <section key={g.id} aria-labelledby={`afd-${g.id}`}>
                <h2
                  id={`afd-${g.id}`}
                  className="mb-2 px-1 text-[0.95rem] font-bold text-muted-foreground"
                >
                  {CATEGORIE_LABEL[g.id]}
                </h2>
                <ul
                  className="paneel divide-y divide-border/80 overflow-hidden"
                  aria-label={`Nog kopen: ${CATEGORIE_LABEL[g.id]}`}
                >
                  {g.regels.map((r) => {
                    const aan = gekozen.has(r.sleutel);
                    const maat = toonBelgischeMaat(r.quantity ?? r.nodig, r.unit);
                    return (
                      <li key={r.sleutel}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={aan}
                          onClick={() => wissel(r.sleutel)}
                          className={cn(
                            "flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-muted",
                            !aan && "bg-muted/50",
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
                              className={cn(
                                "block text-lg leading-snug",
                                !aan && "text-muted-foreground line-through",
                              )}
                            >
                              {r.naam}
                            </span>
                            <span className="block truncate text-[0.9rem] text-muted-foreground">
                              {/* Telefoon: hoeveelheid hier, zodat de naam de volle breedte krijgt. */}
                              {maat ? (
                                <span className="font-semibold text-foreground sm:hidden">
                                  {maat} ·{" "}
                                </span>
                              ) : null}
                              {r.inHuisDeels
                                ? `je hebt al ${r.inHuisDeels}`
                                : r.opLijstDeels
                                  ? `extra bij wat al op je lijst staat`
                                  : kortVoor(r)}
                            </span>
                          </span>
                          {maat ? (
                            <span className="hidden shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[0.95rem] font-semibold tabular-nums sm:inline">
                              {maat}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}

          {a.inHuis.length ? (
            <section aria-labelledby="in-huis-kop">
              <h2
                id="in-huis-kop"
                className="mb-2 px-1 text-[0.95rem] font-bold text-muted-foreground"
              >
                In huis — toch nodig? Tik erop
              </h2>
              <ul className="flex flex-wrap gap-2" aria-label="Heb je al in huis">
                {a.inHuis.map((r) => {
                  const aan = gekozen.has(r.sleutel);
                  return (
                    <li key={r.sleutel}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={aan}
                        onClick={() => wissel(r.sleutel)}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-base font-semibold transition-colors",
                          aan
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {aan ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          <Plus className="size-4" aria-hidden />
                        )}
                        {r.naam}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {a.zonderRecept.length ? (
            <p className="rounded-2xl bg-honing-zacht px-4 py-3 text-base text-honing-foreground">
              Zonder recept: {a.zonderRecept.join(", ")}
            </p>
          ) : null}

          {/* Eén hoofdactie, altijd binnen bereik van de duim. */}
          <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-md md:bottom-0 md:left-24 lg:left-0">
            <div className="mx-auto max-w-3xl">
              <Button
                onClick={async () => {
                  setBezig(true);
                  const n = await zetOpLijst(gekozen);
                  setBezig(false);
                  if (n) setKlaar(n);
                }}
                disabled={!aantal || bezig}
                className="h-16 w-full text-lg"
              >
                {bezig ? <Loader2 className="animate-spin" /> : <ShoppingCart className="size-6" />}
                {aantal ? `Zet ${aantal} op mijn lijst` : "Niets gekozen"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
