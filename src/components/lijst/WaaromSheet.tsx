/**
 * B3 — "Waarom staat dit op mijn lijst?": welke geplande gerechten het nodig hebben (met dag en
 * hoeveelheid), wat er al in huis is en wat er nog op de lijst staat. Alleen lezen.
 */
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Loader2, Package, ShoppingCart } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toonBelgischeMaat } from "@/lib/ingredienten";
import { korteDag } from "@/lib/kringloop";
import { laadWaarom } from "@/lib/kringloop-db";
import { vervanging } from "@/lib/product-herkenning";
import { lokaleDatum } from "@/lib/tijd";

export type WaaromRegel = { id: string; name: string; recipe_id?: string | null };

function maat(q: number | null, unit: string) {
  return toonBelgischeMaat(q, unit) || "hoeveelheid onbekend";
}

export function WaaromSheet({
  regel,
  userId,
  listId,
  onSluit,
}: {
  regel: WaaromRegel | null;
  userId: string;
  listId: string | null;
  onSluit: () => void;
}) {
  const vandaag = lokaleDatum();
  const q = useQuery({
    queryKey: ["waarom", listId, regel?.id, regel?.name],
    enabled: !!regel && !!listId,
    queryFn: () =>
      laadWaarom({ userId, listId: listId!, naam: regel!.name, regelId: regel!.id, vandaag }),
  });
  const naam = regel ? vervanging(regel.name).naam : "";
  const w = q.data;

  return (
    <Sheet open={!!regel} onOpenChange={(o) => !o && onSluit()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Waarom staat {naam} op je lijst?</SheetTitle>
          <SheetDescription>
            Foodlo kijkt naar je weekmenu van vandaag tot volgende week, je voorraad en je lijst.
          </SheetDescription>
        </SheetHeader>

        {q.isLoading ? (
          <p className="mt-6 flex items-center gap-2 text-lg text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden /> Even rekenen…
          </p>
        ) : q.isError ? (
          <p role="alert" className="mt-6 text-lg">
            Dat lukte niet. Probeer het zo opnieuw.
          </p>
        ) : w ? (
          <div className="mt-5 space-y-6 pb-4 text-lg">
            <section aria-labelledby="waarom-voor">
              <h3 id="waarom-voor" className="flex items-center gap-2 font-semibold">
                <CalendarDays className="size-5 text-primary" aria-hidden /> Nodig voor
              </h3>
              {w.voor.length ? (
                <>
                  <ul className="mt-2 divide-y divide-border/70 rounded-2xl bg-muted/50 px-4">
                    {w.voor.map((v, i) => (
                      <li
                        key={`${v.titel}-${v.dag}-${i}`}
                        className="flex min-h-14 items-center gap-3"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{v.titel}</span>
                          <span className="block text-base capitalize text-muted-foreground">
                            {korteDag(v.dag, vandaag)}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">{maat(v.quantity, v.unit)}</span>
                      </li>
                    ))}
                  </ul>
                  {w.voor.length > 1 && w.nodig ? (
                    <p className="mt-2 text-base text-muted-foreground">
                      Samen:{" "}
                      <strong className="text-foreground">
                        {maat(w.nodig.quantity, w.nodig.unit)}
                      </strong>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  {regel?.recipe_id
                    ? "Geen gepland gerecht meer in de komende 7 dagen. Je kan het gerust van je lijst halen."
                    : "Je zette dit zelf op je lijst. Geen gepland gerecht heeft het nodig."}
                </p>
              )}
            </section>

            <section aria-labelledby="waarom-huis">
              <h3 id="waarom-huis" className="flex items-center gap-2 font-semibold">
                <Package className="size-5 text-primary" aria-hidden /> Al in huis
              </h3>
              {w.inHuis.length ? (
                <ul className="mt-2 space-y-1">
                  {w.inHuis.map((v, i) => (
                    <li key={`${v.naam}-${i}`} className="flex justify-between gap-3">
                      <span className="truncate">{v.naam}</span>
                      <span className="shrink-0 tabular-nums">{maat(v.quantity, v.unit)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-muted-foreground">Niets in je voorraad.</p>
              )}
            </section>

            {w.opLijst.length ? (
              <section aria-labelledby="waarom-lijst">
                <h3 id="waarom-lijst" className="flex items-center gap-2 font-semibold">
                  <ShoppingCart className="size-5 text-primary" aria-hidden /> Ook op je lijst
                </h3>
                <ul className="mt-2 space-y-1">
                  {w.opLijst.map((v) => (
                    <li key={v.id} className="flex justify-between gap-3">
                      <span className="truncate">
                        {vervanging(v.naam).naam}
                        <span className="text-muted-foreground">
                          {v.eigen ? " · zelf toegevoegd" : " · door Foodlo"}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{maat(v.quantity, v.unit)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-base text-muted-foreground">
                  Wat je zelf toevoegde, past Foodlo nooit aan. Het telt wel mee.
                </p>
              </section>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
