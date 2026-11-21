/**
 * Fase 7 — "Stuur naar winkel (testmodus)": lijst → productkoppeling → mandje → terug naar de lijst.
 *
 * Alleen de TestSupermarktProvider (verzonnen producten en prijzen, geen netwerk, geen echte
 * winkel). Het scherm zegt dat overal. Een echte winkel komt later achter dezelfde interface
 * (src/lib/supermarkt/provider.ts). Het mandje wordt bewaard in `winkel_mandjes` (voorstel 0024)
 * als die tabel bestaat; anders blijft het alleen op dit scherm (en zegt de app dat).
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Minus, PackageSearch, Plus, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageSkeleton } from "@/components/PageSkeleton";
import { TestmodusBand } from "@/components/TestmodusBand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { meet } from "@/lib/meten";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { toonBelgischeMaat } from "@/lib/ingredienten";
import {
  aantalVoor,
  euroCent,
  koppelLijst,
  mandjeTotaal,
  type KoppelUitkomst,
} from "@/lib/supermarkt/mandje";
import {
  TestSupermarktProvider,
  type MandjeBevestiging,
  type MandjeRegel,
} from "@/lib/supermarkt/provider";
import { cn } from "@/lib/utils";

export const MANDJE_TABEL = "winkel_mandjes";

export const Route = createFileRoute("/mandje")({
  head: () => ({
    meta: [
      { title: "Stuur naar winkel (testmodus) – Foodlo" },
      {
        name: "description",
        content: "Probeer hoe je lijst als mandje naar een winkel zou gaan. Testgegevens.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { lijst?: string } =>
    typeof s["lijst"] === "string" && /^[0-9a-f-]{36}$/i.test(s["lijst"])
      ? { lijst: s["lijst"] }
      : {},
  component: MandjePagina,
});

const provider = new TestSupermarktProvider();

type Keuze = { product: number; aantal: number; mee: boolean };

function regelTekst(r: { name: string; quantity: number | null; unit: string }) {
  return [toonBelgischeMaat(r.quantity, r.unit), r.name].filter(Boolean).join(" ");
}

function MandjePagina() {
  const { user } = useAuth();
  const { lijst } = Route.useSearch();
  const opslag = useModuleBeschikbaar(MANDJE_TABEL);

  const { data: lijstId, isLoading: lijstLaden } = useQuery({
    queryKey: ["mandje-lijst", user?.id, lijst],
    enabled: !!user,
    queryFn: async () => {
      if (lijst) return lijst;
      const { data } = await supabase
        .from("shopping_lists")
        .select("id")
        .order("created_at")
        .limit(1);
      return (data?.[0]?.id as string | undefined) ?? null;
    },
  });

  const {
    data: koppeling,
    isLoading: koppelLaden,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["mandje-koppeling", lijstId],
    enabled: !!lijstId,
    queryFn: async (): Promise<KoppelUitkomst> => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("id, name, quantity, unit, checked")
        .eq("list_id", lijstId!)
        .eq("checked", false)
        .order("name");
      if (error) throw error;
      return koppelLijst(
        (data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          quantity: r.quantity,
          unit: r.unit ?? "",
        })),
        provider,
      );
    },
  });

  const [keuzes, setKeuzes] = useState<Record<string, Keuze>>({});
  useEffect(() => {
    if (!koppeling) return;
    setKeuzes(
      Object.fromEntries(
        koppeling.gevonden.map((k) => [
          k.regel.id,
          { product: 0, aantal: aantalVoor(k.regel, k.voorstellen[0]!), mee: true },
        ]),
      ),
    );
  }, [koppeling]);

  const regels: MandjeRegel[] = useMemo(
    () =>
      (koppeling?.gevonden ?? []).flatMap((k) => {
        const c = keuzes[k.regel.id];
        if (!c?.mee) return [];
        const product = k.voorstellen[c.product] ?? k.voorstellen[0]!;
        return [{ lijstNaam: k.regel.name, product, aantal: c.aantal }];
      }),
    [koppeling, keuzes],
  );
  const totaal = mandjeTotaal(regels);
  const [stap, setStap] = useState<"kiezen" | "klaar">("kiezen");
  const [bevestiging, setBevestiging] = useState<MandjeBevestiging | null>(null);
  const [bewaard, setBewaard] = useState(false);
  const [bezig, setBezig] = useState(false);

  async function zetInMandje() {
    if (!user || !regels.length || bezig) return;
    setBezig(true);
    try {
      const b = await provider.stuurMandje(regels);
      setBevestiging(b);
      let ok = false;
      if (opslag.beschikbaar) {
        const { error } = await db.from(MANDJE_TABEL).insert({
          user_id: user.id,
          list_id: lijstId,
          provider: provider.id,
          referentie: b.referentie,
          test: true,
          regels: regels.map((r) => ({
            lijst: r.lijstNaam,
            product: r.product.naam,
            merk: r.product.merk ?? null,
            inhoud: r.product.inhoud,
            aantal: r.aantal,
            prijs_cent: r.product.prijsCent,
          })),
          totaal_cent: totaal.totaalCent,
          zonder_prijs: totaal.zonderPrijs,
          niet_gevonden: (koppeling?.nietGevonden ?? []).map((r) => r.name),
        });
        ok = !error;
      }
      setBewaard(ok);
      void meet("mandje.testmodus", undefined, {
        regels: regels.length,
        niet_gevonden: koppeling?.nietGevonden.length ?? 0,
      });
      setStap("klaar");
      window.scrollTo({ top: 0 });
    } catch {
      toast.error("Het mandje maken lukte niet. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  const zet = (id: string, deel: Partial<Keuze>) =>
    setKeuzes((k) => ({ ...k, [id]: { ...k[id]!, ...deel } }));

  const terug = (
    <Link
      to="/boodschappen"
      className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary"
    >
      <ArrowLeft className="size-5" aria-hidden />
      Terug naar je lijst
    </Link>
  );

  if (lijstLaden || (lijstId && koppelLaden)) return <PageSkeleton />;

  return (
    <AppShell
      title={stap === "klaar" ? "Je testmandje" : "Stuur naar winkel"}
      ondertitel="Testmodus: verzonnen producten en prijzen, geen echte winkel."
    >
      <div className="mx-auto max-w-2xl space-y-6 pb-8">
        {terug}
        <TestmodusBand>
          Dit is de testwinkel van Foodlo. Er gaat niets naar een echte winkel en je betaalt niets.
          Producten en prijzen zijn verzonnen.
        </TestmodusBand>

        {!lijstId ? (
          <p className="paneel p-4 text-lg">Je hebt nog geen boodschappenlijst.</p>
        ) : isError ? (
          <div role="alert" className="paneel space-y-3 p-4">
            <p className="text-lg">Je lijst kon niet geladen worden.</p>
            <Button variant="outline" onClick={() => void refetch()}>
              Opnieuw proberen
            </Button>
          </div>
        ) : !koppeling ? null : stap === "klaar" && bevestiging ? (
          <Overzicht
            regels={regels}
            nietGevonden={koppeling.nietGevonden.map((r) => regelTekst(r))}
            bevestiging={bevestiging}
            bewaard={bewaard}
          />
        ) : koppeling.gevonden.length + koppeling.nietGevonden.length === 0 ? (
          <p className="paneel p-4 text-lg">
            Er staat niets meer open op je lijst. Voeg eerst iets toe.
          </p>
        ) : (
          <>
            <section aria-labelledby="gekoppeld" className="space-y-3">
              <h2 id="gekoppeld" className="text-sectietitel">
                Gevonden in de testwinkel ({koppeling.gevonden.length})
              </h2>
              {koppeling.gevonden.length === 0 ? (
                <p className="paneel p-4 text-base">De testwinkel kent geen van je producten.</p>
              ) : (
                <ul className="space-y-3">
                  {koppeling.gevonden.map((k) => {
                    const c = keuzes[k.regel.id];
                    if (!c) return null;
                    return (
                      <li
                        key={k.regel.id}
                        className={cn("paneel space-y-3 p-4", !c.mee && "opacity-75")}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 text-lg font-semibold">
                            <span className="block text-[0.95rem] font-normal text-muted-foreground">
                              Op je lijst
                            </span>
                            {regelTekst(k.regel)}
                          </p>
                          <Button
                            size="sm"
                            variant={c.mee ? "outline" : "zacht"}
                            aria-pressed={!c.mee}
                            onClick={() => zet(k.regel.id, { mee: !c.mee })}
                          >
                            {c.mee ? "Niet meenemen" : "Toch meenemen"}
                          </Button>
                        </div>
                        <fieldset className="space-y-2" disabled={!c.mee}>
                          <legend className="text-base font-semibold">Welk product?</legend>
                          {k.voorstellen.map((p, i) => (
                            <label
                              key={p.naam}
                              className={cn(
                                "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-3",
                                c.product === i
                                  ? "border-primary bg-secondary/60"
                                  : "border-border",
                              )}
                            >
                              <input
                                type="radio"
                                name={`product-${k.regel.id}`}
                                className="mt-1 size-5 accent-[var(--primary)]"
                                checked={c.product === i}
                                onChange={() =>
                                  zet(k.regel.id, { product: i, aantal: aantalVoor(k.regel, p) })
                                }
                              />
                              <span className="min-w-0 flex-1 break-words">
                                <span className="block text-base font-semibold">{p.naam}</span>
                                <span className="block text-[0.95rem] text-muted-foreground">
                                  {[p.merk, p.inhoud].filter(Boolean).join(" · ")}
                                </span>
                                <span className="mt-1 block text-base font-semibold tabular-nums">
                                  {p.prijsCent === null ? (
                                    <span className="font-normal text-muted-foreground">
                                      Geen prijs van de winkel
                                    </span>
                                  ) : (
                                    euroCent(p.prijsCent)
                                  )}
                                </span>
                              </span>
                            </label>
                          ))}
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-base" id={`aantal-${k.regel.id}`}>
                              Aantal
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-12"
                              aria-label={`Eén minder ${k.regel.name}`}
                              disabled={c.aantal <= 1}
                              onClick={() => zet(k.regel.id, { aantal: c.aantal - 1 })}
                            >
                              <Minus className="size-5" />
                            </Button>
                            <span
                              className="min-w-8 text-center text-lg font-semibold tabular-nums"
                              aria-labelledby={`aantal-${k.regel.id}`}
                              aria-live="polite"
                            >
                              {c.aantal}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-12"
                              aria-label={`Eén meer ${k.regel.name}`}
                              disabled={c.aantal >= 20}
                              onClick={() => zet(k.regel.id, { aantal: c.aantal + 1 })}
                            >
                              <Plus className="size-5" />
                            </Button>
                          </div>
                        </fieldset>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {koppeling.nietGevonden.length ? (
              <section aria-labelledby="niet-gevonden" className="space-y-3">
                <h2 id="niet-gevonden" className="text-sectietitel">
                  Niet gevonden ({koppeling.nietGevonden.length})
                </h2>
                <p className="text-base text-muted-foreground">
                  Deze producten kent de testwinkel niet. Ze blijven gewoon op je lijst.
                </p>
                <ul className="paneel divide-y divide-border/70">
                  {koppeling.nietGevonden.map((r) => (
                    <li key={r.id} className="flex min-h-14 items-center gap-3 px-4 py-2 text-lg">
                      <PackageSearch
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      {regelTekst(r)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="paneel space-y-3 p-4">
              <p className="text-base" aria-live="polite">
                <strong>Testtotaal: {euroCent(totaal.totaalCent)}</strong> voor {regels.length}{" "}
                {regels.length === 1 ? "product" : "producten"}
                {totaal.zonderPrijs
                  ? ` · ${totaal.zonderPrijs} zonder prijs van de winkel`
                  : ""}{" "}
                (testgegevens)
              </p>
              <Button
                className="h-14 w-full text-lg"
                disabled={!regels.length || bezig}
                onClick={() => void zetInMandje()}
              >
                <ShoppingBasket className="size-5" aria-hidden />
                Zet in mandje (testmodus)
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Overzicht({
  regels,
  nietGevonden,
  bevestiging,
  bewaard,
}: {
  regels: MandjeRegel[];
  nietGevonden: string[];
  bevestiging: MandjeBevestiging;
  bewaard: boolean;
}) {
  const totaal = mandjeTotaal(regels);
  return (
    <div className="space-y-5">
      <p role="status" className="paneel flex items-start gap-3 p-4 text-lg">
        <Check className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
        <span>
          Je testmandje staat klaar (kenmerk {bevestiging.referentie}). Er is niets naar een echte
          winkel gestuurd.
          {bewaard
            ? ""
            : " Dit mandje wordt nog niet bewaard: dat komt zodra de functie actief is."}
        </span>
      </p>
      <section aria-labelledby="in-mandje" className="space-y-2">
        <h2 id="in-mandje" className="text-sectietitel">
          In je mandje
        </h2>
        <ul className="paneel divide-y divide-border/70">
          {regels.map((r) => (
            <li key={r.lijstNaam} className="flex items-start gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">
                  {r.aantal} × {r.product.naam}
                </span>
                <span className="block text-[0.95rem] text-muted-foreground">
                  Voor “{r.lijstNaam}” · {r.product.inhoud}
                </span>
              </span>
              <span className="shrink-0 text-base font-semibold tabular-nums">
                {r.product.prijsCent === null
                  ? "Geen prijs"
                  : euroCent(r.product.prijsCent * r.aantal)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-lg">
          <strong>Testtotaal: {euroCent(totaal.totaalCent)}</strong>
          {totaal.zonderPrijs
            ? ` + ${totaal.zonderPrijs} ${totaal.zonderPrijs === 1 ? "product" : "producten"} zonder prijs van de winkel`
            : ""}{" "}
          (testgegevens, geen echte prijzen)
        </p>
      </section>
      {nietGevonden.length ? (
        <section aria-labelledby="mandje-niet" className="space-y-2">
          <h2 id="mandje-niet" className="text-sectietitel">
            Niet in het mandje
          </h2>
          <p className="text-base text-muted-foreground">
            Niet gevonden in de testwinkel; ze staan nog op je lijst: {nietGevonden.join(", ")}.
          </p>
        </section>
      ) : null}
      <Button asChild className="h-14 w-full text-lg">
        <Link to="/boodschappen">Terug naar je lijst</Link>
      </Button>
    </div>
  );
}
