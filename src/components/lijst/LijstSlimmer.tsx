/**
 * Fase 7 — "Maak mijn lijst slimmer": een voorstel met verschillen (voor → na), per verschil aan
 * of uit, dan "Doe maar" of "Nee, laat zo". Vaste regels, geen AI. Ongedaan maken in één keer
 * via de melding of de terugknop van de lijst.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Combine, PiggyBank, ShoppingBasket, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { db } from "@/lib/module-beschikbaar";
import { euro } from "@/lib/budget";
import type { CategorieId } from "@/lib/categorie";
import {
  kostMetKeuze,
  kostZin,
  maakLijstSlimmer,
  type Basis,
  type LijstRij,
  type SlimVerschil,
} from "@/lib/lijst-slimmer";
import { ketenVan, WINKELS_MET_INDELING } from "@/lib/supermarkt/indeling";
import { cn } from "@/lib/utils";

const KOP: Record<SlimVerschil["soort"], { titel: string; icoon: typeof Combine }> = {
  samenvoegen: { titel: "Dubbels samenvoegen", icoon: Combine },
  goedkoper: { titel: "Goedkoper alternatief", icoon: PiggyBank },
  basis: { titel: "Misschien vergeten", icoon: ShoppingBasket },
  volgorde: { titel: "Volgorde van je winkel", icoon: Store },
};

export function LijstSlimmer({
  open,
  onOpenChange,
  userId,
  items,
  basis,
  voorraad,
  volgorde,
  veilig,
  magVerwijderen,
  budget,
  onDoeMaar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null | undefined;
  items: readonly LijstRij[];
  basis: readonly Basis[];
  voorraad: readonly string[];
  volgorde: readonly CategorieId[];
  veilig: (naam: string) => boolean;
  magVerwijderen: boolean;
  budget: number | null;
  onDoeMaar: (gekozen: SlimVerschil[], volgorde: CategorieId[]) => Promise<void>;
}) {
  // Gekozen winkel: standaard je favoriete klantenkaart, als Foodlo daar een indeling voor heeft.
  const { data: favoriet = null } = useQuery({
    queryKey: ["slimmer-winkel", userId],
    enabled: open && !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await db
        .from("loyalty_cards")
        .select("winkel_naam, favoriet")
        .eq("user_id", userId!);
      const rijen = (data ?? []) as { winkel_naam: string | null; favoriet: boolean | null }[];
      const fav = rijen.find((r) => r.favoriet) ?? null;
      return ketenVan(fav?.winkel_naam) ?? null;
    },
  });
  const [winkel, setWinkel] = useState<string | null>(null);
  const [winkelGekozen, setWinkelGekozen] = useState(false);
  useEffect(() => {
    if (!winkelGekozen) setWinkel(favoriet);
  }, [favoriet, winkelGekozen]);

  const voorstel = useMemo(
    () =>
      maakLijstSlimmer({
        items,
        basis,
        voorraad,
        volgorde,
        winkel,
        veilig,
        magVerwijderen,
      }),
    [items, basis, voorraad, volgorde, winkel, veilig, magVerwijderen],
  );
  const [uit, setUit] = useState<Set<string>>(new Set());
  const [bezig, setBezig] = useState(false);
  useEffect(() => {
    if (open) {
      setUit(new Set());
      setWinkelGekozen(false);
    }
  }, [open]);

  const gekozen = voorstel.verschillen.filter((v) => !uit.has(v.id));
  const kostNa = useMemo(() => kostMetKeuze(items, gekozen), [items, gekozen]);

  async function doeMaar() {
    if (!gekozen.length || bezig) return;
    setBezig(true);
    try {
      await onDoeMaar(gekozen, [...volgorde]);
      onOpenChange(false);
    } finally {
      setBezig(false);
    }
  }

  const groepen = (["samenvoegen", "goedkoper", "basis", "volgorde"] as const)
    .map((soort) => ({ soort, lijst: voorstel.verschillen.filter((v) => v.soort === soort) }))
    .filter((g) => g.lijst.length);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Maak mijn lijst slimmer</SheetTitle>
          <SheetDescription>
            Foodlo kijkt naar dubbels, de volgorde van je winkel, goedkopere keuzes en wat je
            misschien vergeet. Er verandert niets tot je “Doe maar” zegt.
          </SheetDescription>
        </SheetHeader>

        <section aria-labelledby="slim-winkel" className="mt-4 space-y-2">
          <h3 id="slim-winkel" className="text-lg font-semibold">
            In welke winkel?
          </h3>
          <div role="group" aria-labelledby="slim-winkel" className="flex flex-wrap gap-2">
            {[null, ...WINKELS_MET_INDELING].map((w) => (
              <Button
                key={w ?? "geen"}
                size="sm"
                variant={winkel === w ? "default" : "outline"}
                aria-pressed={winkel === w}
                onClick={() => {
                  setWinkel(w);
                  setWinkelGekozen(true);
                }}
              >
                {w ?? "Geen voorkeur"}
              </Button>
            ))}
          </div>
          <p className="text-[0.95rem] text-muted-foreground">
            Voorbeeldindeling van een gewone winkel, geen echte plattegrond. Je eigen volgorde
            blijft altijd aan te passen.
          </p>
        </section>

        {groepen.length === 0 ? (
          <p role="status" className="mt-5 rounded-2xl bg-muted p-4 text-lg">
            Je lijst is al netjes: geen dubbels, geen goedkopere keuze die Foodlo kent en niets
            vergeten uit je vaste producten.
          </p>
        ) : (
          <div className="mt-5 space-y-5" aria-label="Voorgestelde verschillen">
            {groepen.map((g) => {
              const Icoon = KOP[g.soort].icoon;
              return (
                <section key={g.soort} aria-labelledby={`slim-${g.soort}`} className="space-y-2">
                  <h3
                    id={`slim-${g.soort}`}
                    className="flex items-center gap-2 text-lg font-semibold"
                  >
                    <Icoon className="size-5 shrink-0 text-primary" aria-hidden />
                    {KOP[g.soort].titel}
                  </h3>
                  <ul className="space-y-2">
                    {g.lijst.map((v) => {
                      const aan = !uit.has(v.id);
                      return (
                        <li key={v.id}>
                          <label
                            className={cn(
                              "paneel flex cursor-pointer items-start gap-3 p-3",
                              !aan && "opacity-70",
                            )}
                          >
                            <Checkbox
                              checked={aan}
                              className="mt-0.5"
                              aria-label={`${KOP[v.soort].titel}: ${v.na}`}
                              onCheckedChange={(c) =>
                                setUit((s) => {
                                  const n = new Set(s);
                                  if (c) n.delete(v.id);
                                  else n.add(v.id);
                                  return n;
                                })
                              }
                            />
                            <span className="min-w-0 flex-1 space-y-1">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
                                <span className="text-muted-foreground line-through decoration-1">
                                  {v.voor}
                                </span>
                                <ArrowRight className="size-4 shrink-0" aria-label="wordt" />
                                <span className="font-semibold">{v.na}</span>
                              </span>
                              {v.soort === "goedkoper" ? (
                                <span className="block text-[0.95rem] text-muted-foreground">
                                  {v.reden}. ≈ {euro(v.besparing)} goedkoper (richtprijs).
                                </span>
                              ) : v.soort === "basis" ? (
                                <span className="block text-[0.95rem] text-muted-foreground">
                                  {v.reden}
                                </span>
                              ) : v.soort === "volgorde" ? (
                                <span className="block text-[0.95rem] text-muted-foreground">
                                  Voorbeeldindeling voor {v.winkel}.
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            <p className="rounded-2xl bg-muted p-3 text-base" aria-live="polite">
              {kostZin(voorstel.kostNu, kostNa)}
              {budget ? `. Je weekbudget: ${euro(budget)}.` : "."}
            </p>
          </div>
        )}

        <p className="mt-4 text-[0.95rem] text-muted-foreground">
          Foodlo gebruikt hier vaste regels, geen AI: dit is gratis en telt niet mee voor je slimme
          vragen.
        </p>
        <div className="sticky bottom-0 -mx-6 mt-4 flex flex-col gap-2 bg-background/95 px-6 py-3 backdrop-blur sm:flex-row">
          {groepen.length ? (
            <Button
              className="h-14 flex-1 text-lg"
              disabled={!gekozen.length || bezig}
              onClick={() => void doeMaar()}
            >
              Doe maar{gekozen.length ? ` (${gekozen.length})` : ""}
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="h-14 flex-1 text-lg"
            onClick={() => onOpenChange(false)}
          >
            {groepen.length ? "Nee, laat zo" : "Sluiten"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
